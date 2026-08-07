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

// Routes
app.use('/api/scrapers', scraperRoutes);
app.use('/api/admin/catalogues', adminCatalogueRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper Service is running.' });
});

app.listen(PORT, () => {
  console.log(`Scraper backend service running on http://localhost:${PORT}`);
});
