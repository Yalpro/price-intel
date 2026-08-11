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

app.use(cors());
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

app.listen(PORT, () => {
  console.log(`Scraper backend service running on http://localhost:${PORT}`);
});
