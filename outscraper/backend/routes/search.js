const express = require('express');
const router = express.Router();
const { scrapeController } = require('../controllers/scrapeController');

// @route   POST /api/search/outscraper
// @desc    Search Google Maps via SerpApi/Outscraper (Personal Use - No Auth)
router.post('/outscraper', scrapeController);

module.exports = router;
