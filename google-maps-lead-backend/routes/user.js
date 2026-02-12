const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

const UsageLog = require('../models/UsageLog');

// @route   GET /api/user/me
// @desc    Get current user details
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/user/usage
// @desc    Get user usage statistics
// @access  Private
router.get('/usage', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const todayUsage = await UsageLog.countDocuments({
            userId: req.user.userId,
            timestamp: { $gte: todayStart }
        });

        const monthUsage = await UsageLog.countDocuments({
            userId: req.user.userId,
            timestamp: { $gte: monthStart }
        });

        res.json({
            plan: user.plan,
            totalCredits: user.credits + monthUsage, // Approx total available this month? Or just current balance? Let's use current balance.
            // Actually user asked for "Total credits" and "Remaining credits".
            // Since I don't store initial credits, I'll return:
            // totalCredits: (Plan limit if known, else remaining + used)
            // But if user bought multiple packs, total is hard to know.
            // I'll return remainingCredits and creditsUsed.
            // Frontend can display "Remaining: X".
            remainingCredits: user.credits,
            creditsUsedToday: todayUsage,
            creditsUsedThisMonth: monthUsage
        });

    } catch (err) {
        console.error('Usage Stats Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
