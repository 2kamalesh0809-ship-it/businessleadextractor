const { searchGoogleMaps } = require('../services/serpApiService');

const scrapeController = async (req, res) => {
    try {
        const { keyword, location, limit } = req.body;

        // 1. Validate & Normalize
        if (!keyword || !location) {
            return res.status(400).json({
                success: false,
                message: "Missing 'keyword' or 'location' in request body."
            });
        }

        const normalizedKeyword = keyword.trim().toLowerCase();
        const normalizedLocation = location.trim().toLowerCase();

        // 2. Call SerpApi Service (No startOffset/DB history checks needed for clean personal search)
        const requestedLimit = parseInt(limit) || 500;
        console.log(`[ScrapeController] Request via SerpApi: ${keyword} in ${location} | Target Limit: ${requestedLimit}`);

        const leads = await searchGoogleMaps(normalizedKeyword, normalizedLocation, 0, requestedLimit);

        // 3. Response Format
        return res.json({
            success: true,
            total: leads.length,
            leads: leads
        });

    } catch (error) {
        console.error("ScrapeController Error:", error.message);

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
