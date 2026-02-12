const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

// Global usage tracking (In-memory for now)
const usageState = {
    currentUsage: 0,
    maxMonthlyUsage: 500,
    lastReset: new Date()
};

// Automatic reset every 30 days
const DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

setInterval(() => {
    const now = new Date();
    if (now - usageState.lastReset >= THIRTY_DAYS_MS) {
        usageState.currentUsage = 0;
        usageState.lastReset = now;
        console.log(`[Outscraper Service] Monthly usage reset after 30 days.`);
    }
}, DAILY_CHECK_INTERVAL_MS);


const checkLimit = (requestedLimit) => {
    if (usageState.currentUsage + requestedLimit > usageState.maxMonthlyUsage) {
        const remaining = usageState.maxMonthlyUsage - usageState.currentUsage;
        console.warn(`[Outscraper Service] Limit reached. Requested: ${requestedLimit}, Remaining: ${remaining}, Max: ${usageState.maxMonthlyUsage}`);
        throw new Error(`Free tier limit reached. You have ${remaining} searches remaining this month.`);
    }
};

const incrementUsage = (count) => {
    usageState.currentUsage += count;
    console.log(`[Outscraper Service] Usage updated: ${usageState.currentUsage}/${usageState.maxMonthlyUsage} (+${count})`);
};

// Export for checking status if needed
const getUsageStatus = () => {
    return {
        current: usageState.currentUsage,
        max: usageState.maxMonthlyUsage,
        remaining: usageState.maxMonthlyUsage - usageState.currentUsage,
        lastReset: usageState.lastReset
    };
};


const searchGoogleMaps = async (keyword, location, limit = 50) => {
    try {
        const apiKey = process.env.OUTSCRAPER_API_KEY;

        if (!apiKey) {
            throw new Error('OUTSCRAPER_API_KEY is not defined in environment variables');
        }

        // Enforce limit constraints
        const safeLimit = Math.min(parseInt(limit) || 50, 50);

        // Check global limit before making request
        checkLimit(safeLimit);

        // Construct query
        const query = `${keyword} ${location}`.trim();

        if (!query) {
            throw new Error('Keyword or location is required');
        }

        console.log(`[Outscraper Service] Searching: "${query}" (Limit: ${safeLimit})...`);

        const response = await axios.post(
            'https://api.app.outscraper.com/maps/search-v3',
            {
                query: [query],
                limit: safeLimit,
                async: false, // Always enforce async: false
            },
            {
                headers: {
                    'X-API-KEY': apiKey,
                },
            }
        );

        // Check if response data exists and is an array
        if (!response.data || !response.data.data || !Array.isArray(response.data.data)) {
            console.error('Unexpected Outscraper response structure:', JSON.stringify(response.data, null, 2));
            return [];
        }

        // Outscraper returns an array of arrays (one for each query). We sent one query.
        const results = response.data.data[0] || [];

        // Deduct usage after successful API call
        // Note: We count the actual results returned, or should we count the requested limit?
        // The prompt said "Deduct used results after successful API call". 
        // Counting actual results is fairer, but typically APIs charge per request or per limit. 
        // Let's count actual results returned as per "Deduct used results".
        incrementUsage(results.length);

        // Map to required fields and align with frontend naming
        const formattedResults = results.map((item) => ({
            name: item.name || '',
            address: item.full_address || item.address || '',
            phone: item.phone || '',
            website: item.site || item.website || '',
            rating: item.rating || 0,
            reviews: item.reviews || 0,
            email: item.email || 'N/A' // Add placeholder for email compatibility
        }));

        return formattedResults;

    } catch (error) {
        if (error.response) {
            // API returned an error response
            console.error('Outscraper API Error:', error.response.status, error.response.data);
            throw new Error(`Outscraper API failed: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
            // Request was made but no response received
            console.error('Outscraper API No Response:', error.request);
            throw new Error('Outscraper API did not respond');
        } else {
            // Something else happened
            console.error('Outscraper Service Error:', error.message);
            throw error;
        }
    }
};

module.exports = {
    searchGoogleMaps,
    getUsageStatus
};
