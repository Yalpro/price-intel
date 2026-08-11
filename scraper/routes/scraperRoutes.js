const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Production-grade Admin & Secret Authentication Middleware
 * 1. Checks machine-to-machine x-api-secret (Server fallback)
 * 2. Or verifies Supabase user access token (Bearer token) and ensures role is 'admin' or 'manager'
 */
const verifyAdminOrSecret = async (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['x-api-secret'];
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing authentication token.' });
  }

  // 1. Check machine-to-machine secret token
  const apiSecret = process.env.SCRAPER_API_SECRET;
  if (apiSecret && token === apiSecret) {
    return next();
  }

  // 2. Validate Supabase user token from browser
  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired access token.' });
    }

    // 3. Verify user has admin / manager role in profiles
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !['admin', 'manager'].includes(profile.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Admin permissions required.' });
    }

    req.user = user;
    req.profile = profile;
    next();
  } catch (err) {
    console.error('[Scraper Auth] Verification error:', err.message);
    return res.status(401).json({ success: false, error: 'Unauthorized: Authentication verification failed.' });
  }
};

// POST /api/scrapers/run
router.post('/run', verifyAdminOrSecret, async (req, res) => {
  const { supplier } = req.body;
  if (!supplier) {
    return res.status(400).json({ success: false, error: "Missing 'supplier' in request body." });
  }

  try {
    const result = await scraperService.runScraper(supplier);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message.includes('already running')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scrapers/active
router.get('/active', verifyAdminOrSecret, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const active = scraperService.getActiveScrapers();
  res.json({ success: true, activeSuppliers: active });
});

// POST /api/scrapers/stop
router.post('/stop', verifyAdminOrSecret, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { supplier } = req.body;
  if (!supplier) {
    return res.status(400).json({ success: false, error: "Missing 'supplier' in request body." });
  }

  try {
    const result = await scraperService.stopScraper(supplier);
    res.json({ success: true, status: 'cancelled', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/scrapers/:supplier/stop
router.post('/:supplier/stop', verifyAdminOrSecret, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { supplier } = req.params;
  try {
    const result = await scraperService.stopScraper(supplier);
    res.json({ success: true, status: 'cancelled', ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/scrapers/status
router.get('/status', verifyAdminOrSecret, async (req, res) => {
  const { supplier } = req.query;
  if (!supplier) {
    return res.status(400).json({ success: false, error: "Missing 'supplier' query parameter." });
  }

  try {
    const status = await scraperService.getScraperStatus(supplier);
    res.json({ success: true, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
