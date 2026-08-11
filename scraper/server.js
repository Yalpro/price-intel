const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });
const scraperRoutes = require('./routes/scraperRoutes');
const adminCatalogueRoutes = require('./routes/adminCatalogueRoutes');

const isProduction = process.env.NODE_ENV === 'production';
const apiSecret = process.env.SCRAPER_API_SECRET;

if (isProduction && !apiSecret) {
  console.error('FATAL: NODE_ENV=production requires SCRAPER_API_SECRET environment variable.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-secret']
}));
app.use(express.json());

const retailerRoutes = require('./routes/retailerRoutes');

// Routes
app.use('/api/scrapers', scraperRoutes);
app.use('/api/admin/catalogues', adminCatalogueRoutes);
app.use('/api/retailer', retailerRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper Service is running.' });
});

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && supabaseServiceKey) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  supabase
    .from('scraper_runs')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      log: 'Cancelled: Server restarted during execution',
      error_message: 'Cancelled: Server restarted during execution'
    })
    .eq('status', 'running')
    .then(({ data, error }) => {
      if (!error) console.log('[Server Startup] Cleaned stale running status rows in scraper_runs.');
    })
    .catch(() => {});
}

const server = app.listen(PORT, HOST, () => {
  console.log(`Scraper backend service running on http://${HOST}:${PORT}`);
});

// Graceful Shutdown Handler for Docker SIGTERM / SIGINT signals
const gracefulShutdown = (signal) => {
  console.log(`[Server] Received ${signal}, initiating graceful shutdown...`);
  server.close(() => {
    console.log('[Server] Express HTTP server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forced exit due to shutdown timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
