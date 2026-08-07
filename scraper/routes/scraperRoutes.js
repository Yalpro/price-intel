const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');

// Middleware to verify API secret header if SCRAPER_API_SECRET is configured or NODE_ENV=production
const verifyApiSecret = (req, res, next) => {
  const secret = process.env.SCRAPER_API_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (secret || isProduction) {
    const authHeader = req.headers['x-api-secret'] || req.headers['authorization'];
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;

    if (!secret || !token || token !== secret) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API secret header.' });
    }
  }
  next();
};

// POST /api/scrapers/run
router.post('/run', verifyApiSecret, async (req, res) => {
  const { supplier } = req.body;
  if (!supplier) {
    return res.status(400).json({ error: "Missing 'supplier' in request body." });
  }

  try {
    const result = await scraperService.runScraper(supplier);
    res.json(result);
  } catch (err) {
    if (err.message.includes('already running')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/scrapers/status
router.get('/status', verifyApiSecret, async (req, res) => {
  const { supplier } = req.query;
  if (!supplier) {
    return res.status(400).json({ error: "Missing 'supplier' query parameter." });
  }

  try {
    const status = await scraperService.getScraperStatus(supplier);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
