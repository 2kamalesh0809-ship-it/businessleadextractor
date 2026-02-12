const { ApifyClient } = require('apify-client');
const Job = require('../models/Job');

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN,
});

// In-memory store for runs (compatibility with existing logic)
const runs = {};

// Helper to generate IDs
const generateRunId = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Cleanup old runs periodically
const CLEANUP_INTERVAL = 30 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    Object.keys(runs).forEach(runId => {
        if (now - runs[runId].timestamp > CLEANUP_INTERVAL) {
            delete runs[runId];
        }
    });
}, CLEANUP_INTERVAL);

/**
 * Starts the Google Maps Scraper via Apify
 */
async function scrapeGoogleMaps(keyword, location, limit = 100, socket = null, userId = null, jobId = null) {
    const runId = jobId || generateRunId();

    runs[runId] = {
        status: 'RUNNING',
        items: [],
        error: null,
        timestamp: Date.now(),
        userId: userId
    };

    console.log(`[Apify Scraper] Starting job ${runId} for "${keyword} in ${location}" (Limit: ${limit})`);

    // Update initial status in DB
    if (jobId) {
        await Job.findOneAndUpdate({ jobId }, { status: 'RUNNING' });
    }

    // Trigger Apify in background
    runApifyScraper(runId, keyword, location, limit, socket).catch(async err => {
        console.error(`[Apify Scraper] Run ${runId} failed critically:`, err);
        if (runs[runId]) {
            runs[runId].status = 'FAILED';
            runs[runId].error = err.message;

            if (jobId) {
                await Job.findOneAndUpdate({ jobId }, { status: 'FAILED', error: err.message });
            }

            if (socket) {
                socket.emit('scrapingError', { message: err.message });
            }
        }
    });

    return {
        runId: runId,
        defaultDatasetId: runId
    };
}

/**
 * Background worker using Apify API
 */
async function runApifyScraper(runId, keyword, location, limit, socket) {
    try {
        if (socket) socket.emit('log', { message: `Triggering Apify Google Maps Scraper...` });

        const query = `${keyword} in ${location}`;

        // Prepare Actor input
        const input = {
            "searchStrings": [query],
            "maxResults": limit,
            "languageCode": "en",
            "exportPlaceUrls": false,
            "includeReviews": false,
            "includeImages": false,
            "includeOpeningHours": false,
            "includePeopleAlsoSearch": false
        };

        // Start the Actor and wait for it to finish
        console.log(`[Apify Scraper ${runId}] Starting actor WbPoRw096YjcMrAVS...`);
        const run = await client.actor('WbPoRw096YjcMrAVS').call(input);

        // Fetch the results from the run's dataset
        console.log(`[Apify Scraper ${runId}] Actor finished. Fetching results from dataset: ${run.defaultDatasetId}`);
        if (socket) socket.emit('log', { message: `Extraction complete. Syncing results...` });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        console.log(`[Apify Scraper ${runId}] Found ${items.length} items in dataset.`);

        // Map Apify items to our internal Lead format
        const leads = items.map(item => ({
            name: item.title || 'Unknown',
            rating: item.totalScore || 'N/A',
            reviews: item.reviewsCount || '0',
            category: item.categoryName || 'N/A',
            address: item.address || 'N/A',
            website: item.website || item.url || 'N/A',
            phone: item.phone || 'N/A',
            email: item.email || 'N/A'
        }));

        // Store and Emit results
        runs[runId].items = leads;
        runs[runId].status = 'SUCCEEDED';

        // Emit to socket for frontend update
        if (socket) {
            leads.forEach(lead => socket.emit('newLead', lead));
            socket.emit('progress', { percent: 100, collected: leads.length, limit });
            socket.emit('scrapingComplete', {
                results: leads,
                total: leads.length,
                runId: runId
            });
        }

        // Update DB
        await Job.findOneAndUpdate({ jobId: runId }, {
            status: 'COMPLETED',
            progress: leads.length,
            updatedAt: Date.now()
        });

    } catch (error) {
        console.error(`[Apify Scraper ${runId}] Error:`, error);
        if (runs[runId]) runs[runId].status = 'FAILED';
        if (socket) socket.emit('scrapingError', { message: error.message });

        await Job.findOneAndUpdate({ jobId: runId }, {
            status: 'FAILED',
            updatedAt: Date.now(),
            error: error.message
        });
    }
}

async function fetchRunItems(runId, offset = 0, limit = 100) {
    const run = runs[runId];
    if (!run) return [];
    return run.items.slice(offset, offset + limit);
}

async function checkRunStatus(runId) {
    const run = runs[runId];
    return run ? run.status : 'UNKNOWN';
}

module.exports = {
    scrapeGoogleMaps,
    fetchRunItems,
    checkRunStatus
};

