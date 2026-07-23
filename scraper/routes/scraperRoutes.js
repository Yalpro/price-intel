const express = require('express');
const router = express.Router();
const scraperService = require('../services/scraperService');

// POST /api/scrapers/run
router.post('/run', async (req, res) => {
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
router.get('/status', async (req, res) => {
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
