const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const SearchHistory = require('../models/SearchHistory');
const { scrapeController } = require('../controllers/scrapeController');

// @route   POST /api/search/outscraper
// @desc    Search Google Maps via Outscraper
// @access  Private
router.post('/outscraper', auth, scrapeController);

// @route   POST /api/search/start
// @desc    Start search and deduct credit
// @access  Private
router.post('/start', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.credits > 0) {
            user.credits = user.credits - 1;
            await user.save();

            // Log usage
            await new UsageLog({
                userId: user._id,
                action: 'SEARCH',
                creditsDeducted: 1
            }).save();

            return res.json({
                success: true,
                credits: user.credits,
                plan: user.plan,
                message: 'Credit deducted successfully'
            });
        } else {
            return res.status(403).json({
                success: false,
                message: 'Search credit limit reached. Please upgrade to continue.'
            });
        }

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/search/history
// @desc    Get search history
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = await SearchHistory.find({ userId: req.user.userId })
            .sort({ timestamp: -1 })
            .limit(limit);
        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
