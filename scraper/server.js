const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });
const scraperRoutes = require('./routes/scraperRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/scrapers', scraperRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Scraper Service is running.' });
});

app.listen(PORT, () => {
  console.log(`Scraper backend service running on http://localhost:${PORT}`);
});
