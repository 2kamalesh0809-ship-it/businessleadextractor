const { searchGoogleMaps } = require('../services/serpApiService');
const User = require('../models/User');
const UsageLog = require('../models/UsageLog');
const SearchHistory = require('../models/SearchHistory');

const scrapeController = async (req, res) => {
    try {
        const { keyword, location } = req.body;

        // 1. Validate & Normalize
        if (!keyword || !location) {
            return res.status(400).json({
                success: false,
                message: "Missing 'keyword' or 'location' in request body."
            });
        }

        const normalizedKeyword = keyword.trim().toLowerCase();
        const normalizedLocation = location.trim().toLowerCase();

        // 2. Check User Credits
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.credits < 1) {
            return res.status(403).json({
                success: false,
                message: "Insufficient credits. Please upgrade to continue searching."
            });
        }

        // 3. Deduct Credit (1 per search)
        user.credits -= 1;
        await user.save();

        console.log(`[ScrapeController] User: ${user.username} | Deducted 1 credit | Remaining: ${user.credits}`);

        // 4. Calculate Pagination Offset
        // Find total leads already fetched for this user, keyword, and location
        const searchCount = await SearchHistory.aggregate([
            { $match: { userId: user._id, keyword: normalizedKeyword, location: normalizedLocation } },
            { $group: { _id: null, total: { $sum: "$resultCount" } } }
        ]);
        const startOffset = searchCount.length > 0 ? searchCount[0].total : 0;

        // 5. Call SerpApi Service
        const requestedLimit = parseInt(req.body.limit) || 500; // Default to 500 (25 pages) to satisfy "500 leads" request
        console.log(`[ScrapeController] Request via SerpApi: ${keyword} in ${location} | Start Offset: ${startOffset} | Target Limit: ${requestedLimit}`);
        const leads = await searchGoogleMaps(normalizedKeyword, normalizedLocation, startOffset, requestedLimit);

        // 6. Log Usage & History
        await new UsageLog({
            userId: user._id,
            action: 'SEARCH',
            creditsDeducted: 1
        }).save();

        await new SearchHistory({
            userId: user._id,
            keyword: normalizedKeyword,
            location: normalizedLocation,
            resultCount: leads.length
        }).save();

        // 7. Response Format (Aligned with frontend expectations)
        return res.json({
            success: true,
            total: leads.length,
            remainingCredits: user.credits,
            leads: leads
        });

    } catch (error) {
        console.error("ScrapeController Error:", error.message);

        // Handle SerpApi specific failures (like 402 Payment Required or 401 Unauthorized)
        if (error.message.includes('402')) {
            return res.status(402).json({
                success: false,
                message: "SerpApi credit limit reached or billing issue.",
                details: error.message
            });
        }

        if (error.message.includes('401')) {
            return res.status(401).json({
                success: false,
                message: "Invalid SERPAPI_KEY. Please check your .env file.",
                details: error.message
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
module.exports = { scrapeController };
