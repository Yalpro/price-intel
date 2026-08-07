/**
 * Admin Catalogue Management Routes
 *
 * Provides authenticated, admin-only REST APIs for catalogue version management,
 * CSV upload, validation summaries, import error inspection, atomic activation,
 * and version rollback.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const CatalogueImportService = require('../services/CatalogueImportService');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// Middleware to verify admin/manager role authorization
const verifyAdminRole = async (req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const apiSecret = process.env.SCRAPER_API_SECRET;

  const authHeader = req.headers['x-api-secret'] || req.headers['authorization'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

  // Allow service-role API secret header match
  if (apiSecret && token === apiSecret) {
    return next();
  }

  // Verify JWT user token via Supabase
  if (token && supabase) {
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (!authErr && user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, account_status')
          .eq('id', user.id)
          .single();

        if (profile && ['admin', 'manager'].includes(profile.role) && ['active', 'trial'].includes(profile.account_status)) {
          req.user = user;
          return next();
        }
      }
    } catch {}
  }

  if (isProduction || apiSecret) {
    return res.status(403).json({ error: 'Forbidden: Admin or Manager authorization required.' });
  }

  next();
};

const importService = new CatalogueImportService();

// 1. GET /api/admin/catalogues - List all catalogue versions
router.get('/', verifyAdminRole, async (req, res) => {
  try {
    const { data: versions, error } = await supabase
      .from('catalogue_versions')
      .select('*')
      .order('id', { ascending: false });

    if (error) throw error;
    res.json(versions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET /api/admin/catalogues/:id - Get specific catalogue version details
router.get('/:id', verifyAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: version, error } = await supabase
      .from('catalogue_versions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(version);
  } catch (err) {
    res.status(404).json({ error: `Catalogue version ID '${req.params.id}' not found.` });
  }
});

// 3. GET /api/admin/catalogues/:id/errors - Get paginated import errors
router.get('/:id/errors', verifyAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = (page - 1) * limit;

    const { data: errors, count, error } = await supabase
      .from('catalogue_import_errors')
      .select('*', { count: 'exact' })
      .eq('version_id', id)
      .order('row_number', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    res.json({
      errors: errors || [],
      page,
      limit,
      totalErrors: count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. POST /api/admin/catalogues/upload - Process CSV upload and create draft version
router.post('/upload', verifyAdminRole, async (req, res) => {
  try {
    const { filePath, originalFileName, catalogueMonth, notes } = req.body;
    if (!filePath || !originalFileName) {
      return res.status(400).json({ error: "Missing required fields 'filePath' or 'originalFileName'." });
    }

    const result = await importService.processCatalogueUpload({
      filePath,
      originalFileName,
      catalogueMonth,
      userUuid: req.user?.id || null,
      notes
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. POST /api/admin/catalogues/:id/activate - Atomically activate version via DB function
router.post('/:id/activate', verifyAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const versionId = parseInt(id, 10);

    // Call atomic activate_catalogue_version database function
    const { data: result, error } = await supabase
      .rpc('activate_catalogue_version', {
        p_version_id: versionId,
        p_activated_by: req.user?.id || null
      });

    if (error) {
      return res.status(400).json({ error: `Activation failed: ${error.message}` });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. POST /api/admin/catalogues/:id/reactivate - Rollback/reactivate archived version
router.post('/:id/reactivate', verifyAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const versionId = parseInt(id, 10);

    const { data: result, error } = await supabase
      .rpc('activate_catalogue_version', {
        p_version_id: versionId,
        p_activated_by: req.user?.id || null
      });

    if (error) {
      return res.status(400).json({ error: `Reactivation failed: ${error.message}` });
    }

    res.json({ ...result, rollback: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. POST /api/admin/catalogues/:id/reject - Reject draft version
router.post('/:id/reject', verifyAdminRole, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('catalogue_versions')
      .update({
        status: 'rejected',
        is_active: false,
        rejected_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    res.json({ message: `Catalogue version ID '${id}' rejected cleanly.`, version: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
