const axios = require('axios');

/**
 * Search Google Maps using SerpApi with pagination
 * @param {string} keyword - Search term
 * @param {string} location - Search location
 * @param {number} startOffset - Result offset for starting point
 * @param {number} limit - Target number of leads to fetch
 * @returns {Promise<Array>} - Array of formatted leads
 */
const searchGoogleMaps = async (keyword, location, startOffset = 0, limit = 20) => {
    try {
        const apiKey = process.env.SERPAPI_KEY;
        if (!apiKey) throw new Error('SERPAPI_KEY is not defined');

        let allLeads = [];
        let currentStart = startOffset;
        let pagesFetched = 0;
        const maxPages = Math.ceil(limit / 20);

        console.log(`[SerpApi Service] Starting multi-page search: "${keyword}" in "${location}" | Target: ${limit} | Start Offset: ${startOffset}`);

        while (allLeads.length < limit && pagesFetched < maxPages) {
            console.log(`[SerpApi Service] Fetching page ${pagesFetched + 1} (Start: ${currentStart})...`);

            const response = await axios.get('https://serpapi.com/search.json', {
                params: {
                    engine: 'google_maps',
                    q: `${keyword} ${location}`,
                    api_key: apiKey,
                    type: 'search',
                    start: currentStart
                }
            });

            if (!response.data || !response.data.local_results || response.data.local_results.length === 0) {
                console.log(`[SerpApi Service] No more results found at offset ${currentStart}.`);
                break;
            }

            const pageLeads = response.data.local_results.map(item => ({
                name: item.title || 'N/A',
                address: item.address || 'N/A',
                phone: item.phone || 'N/A',
                website: item.website || 'N/A',
                rating: item.rating || 0,
                reviews: item.reviews || 0,
                email: 'N/A'
            }));

            allLeads = allLeads.concat(pageLeads);
            console.log(`[SerpApi Service] Page ${pagesFetched + 1} returned ${pageLeads.length} leads. Total so far: ${allLeads.length}`);

            // Move to next page offset (SerpApi uses increments of 20 for Google Maps)
            currentStart += 20;
            pagesFetched++;

            // If we got fewer than 20 results, it's likely the last page
            if (pageLeads.length < 20) {
                console.log(`[SerpApi Service] Last page detected (Incomplete page).`);
                break;
            }
        }

        console.log(`[SerpApi Service] Multi-page search completed. Found ${allLeads.length} leads across ${pagesFetched} pages.`);
        return allLeads.slice(0, limit); // Respect the requested limit exactly

    } catch (error) {
        if (error.response) {
            console.error('SerpApi Error Response:', error.response.status, error.response.data);
            throw new Error(`SerpApi failed: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
        } else if (error.request) {
            console.error('SerpApi No Response:', error.request);
            throw new Error('SerpApi server did not respond');
        } else {
            console.error('SerpApi Service Error:', error.message);
            throw error;
        }
    }
};

module.exports = {
    searchGoogleMaps
};
