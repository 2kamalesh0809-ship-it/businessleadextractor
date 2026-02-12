let currentCursor = null;
let scrapingActive = false;
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Validation: Ensure OUTSCRAPER_API_KEY is present
if (!process.env.SERPAPI_KEY) {
    console.error('FATAL ERROR: SERPAPI_KEY is not defined in .env');
    // process.exit(1); // Don't exit yet to give user a chance to add it
}

const connectDB = require('./config/db');
const { scrapeGoogleMaps, fetchRunItems, checkRunStatus } = require('./services/mapsScraper');
const User = require('./models/User'); // Import User model
const Job = require('./models/Job');
const auth = require('./middleware/auth');

// Connect Database
connectDB();

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for development
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors()); // Allow all origins for local development
app.use(express.json());

// Init Middleware
app.use(express.json({ extended: false }));

// Make io accessible globally if needed (or pass to routes)
app.set('socketio', io);

io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Define Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/search', require('./routes/search'));
app.use('/api/user', require('./routes/user'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/support', require('./routes/support'));

const SearchHistory = require('./models/SearchHistory');

// Routes
// ... (rest of routes)

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
/**
 * GET /get-map-leads
 * Query params: keyword, location, limit, cursor (optional)
 */
// Models

/**
 * POST /api/scrape
 * Body: { keyword, location, limit }
 * Trigger a scraping job and return runId
 */
app.post('/api/scrape', auth, async (req, res) => {
    try {
        const { keyword, location, limit, socketId } = req.body;
        console.log(`[Scrape Request] params:`, { keyword, location, limit, socketId });

        // 1. Validation
        if (!keyword || !location) {
            return res.status(400).json({ success: false, message: "Missing keyword or location" });
        }

        const requestLimit = parseInt(limit) || 100;

        // 2. Check User Credits & Deduct Upfront
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.credits < 1) {
            return res.status(403).json({
                success: false,
                message: "Insufficient credits for a search. 1 credit required.",
                required: 1,
                available: user.credits
            });
        }

        // Deduct upfront (1 credit per search)
        user.credits -= 1;
        await user.save();

        console.log(`[Scrape] User ${user.username} - Deducted 1 credit for search. Remaining: ${user.credits}`);

        // 3. Concurrency Check: Ensure no other job is running for this user
        const activeJob = await Job.findOne({ userId: req.user.userId, status: 'RUNNING' });
        if (activeJob) {
            return res.status(400).json({
                success: false,
                message: "A search job is already running on your account. Please wait for it to complete.",
                activeJobId: activeJob.jobId
            });
        }

        // 4. Create Job Record
        const jobId = Math.random().toString(36).substring(2, 15);
        const newJob = new Job({
            userId: req.user.userId,
            jobId: jobId,
            keyword: keyword,
            location: location,
            limit: requestLimit,
            status: 'PENDING'
        });
        await newJob.save();

        // 5. Retrieve Socket (if provided)
        let socket = null;
        if (socketId) {
            const io = req.app.get('socketio');
            socket = io.sockets.sockets.get(socketId);
        }

        // 6. Start Scraper
        const { runId } = await scrapeGoogleMaps(keyword, location, requestLimit, socket, req.user.userId, jobId);

        // 7. Return Success
        res.json({
            success: true,
            message: "Scraping job started successfully",
            jobId: runId, // client will use this to track progress
            remainingCredits: user.credits
        });

    } catch (error) {
        console.error('[Scrape Error]:', error);
        res.status(500).json({ success: false, message: "Failed to start scraping job", error: error.message });
    }
});

/**
 * GET /api/jobs/active
 * Returns the currently running job for the user
 */
app.get('/api/jobs/active', auth, async (req, res) => {
    try {
        const activeJob = await Job.findOne({ userId: req.user.userId, status: 'RUNNING' });
        if (!activeJob) {
            return res.json({ success: true, active: false });
        }
        res.json({ success: true, active: true, job: activeJob });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/jobs/history
 * Returns the user's past scraping jobs
 */
app.get('/api/jobs/history', auth, async (req, res) => {
    try {
        const jobs = await Job.find({ userId: req.user.userId }).sort({ createdAt: -1 }).limit(50);
        res.json({ success: true, jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/search/stream
 * Query params: keyword, location, limit
 * Stream results via SSE
 */
app.get('/api/search/stream', auth, async (req, res) => {
    const { keyword, location, limit } = req.query;
    console.log(`[Stream Request] params:`, { keyword, location, limit });

    // 1. Validation & Setup
    if (!keyword || !location) {
        return res.status(400).json({ message: "Missing keyword or location" });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let runId, defaultDatasetId;

    try {
        // 2. Check User Credits & Calculate Limit
        const user = await User.findById(req.user.userId);
        if (!user) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'User not found' })}\n\n`);
            return res.end();
        }

        if (user.credits <= 0) {
            res.write(`data: ${JSON.stringify({ type: 'error', message: 'Insufficient credits' })}\n\n`);
            return res.end();
        }

        const MAX_PER_RUN = 200; // Hard cap
        const requestLimit = parseInt(limit) || 100;

        // The scraping limit is the minimum of: requested limit, system max, or available credits
        const effectiveLimit = Math.min(requestLimit, MAX_PER_RUN, user.credits);

        console.log(`[Stream] User: ${user.username}, Credits: ${user.credits}, Effective Limit: ${effectiveLimit}`);

        // 3. Start the Scraper
        const scraperStart = await scrapeGoogleMaps(keyword, location, effectiveLimit);
        runId = scraperStart.runId;
        defaultDatasetId = scraperStart.defaultDatasetId;

        console.log(`[Stream] Started run: ${runId}`);

        // Notify client
        res.write(`data: ${JSON.stringify({ type: 'start', runId, credits: user.credits })}\n\n`);

        let offset = 0;
        let isRunning = true;
        let sameCountRetries = 0;
        let totalDeducted = 0;

        // 4. Poll Loop
        while (isRunning) {
            // Check if user still has credits (double check for safety)
            if (user.credits <= 0) {
                console.log(`[Stream] Credits exhausted during run.`);
                res.write(`data: ${JSON.stringify({ type: 'error', message: 'Credits exhausted. Stopping search.' })}\n\n`);
                // Ideally, we should abort the Apify run here too, but for now we just stop listening
                break;
            }

            console.log(`[Stream] Polling offset ${offset}...`);
            const newItems = await fetchRunItems(defaultDatasetId, offset, 100);

            if (newItems.length > 0) {
                console.log(`[Stream] Found ${newItems.length} new items!`);

                // Deduct credits
                const cost = newItems.length;

                // Ensure we don't deduct more than we have (though scraper should have stopped)
                const deduction = Math.min(cost, user.credits);

                user.credits -= deduction;
                totalDeducted += deduction;
                await user.save();

                // Send new items to client with updated credit count
                res.write(`data: ${JSON.stringify({ type: 'leads', data: newItems, remainingCredits: user.credits })}\n\n`);

                if (res.flush) res.flush();

                offset += newItems.length;
                sameCountRetries = 0;
            } else {
                sameCountRetries++;
            }

            // Check Run Status
            const status = await checkRunStatus(runId);

            if (status === 'SUCCEEDED' || status === 'FAILED' || status === 'ABORTED') {
                isRunning = false;
                console.log(`[Stream] Run finished with status: ${status}`);

                // Final fetch
                const finalItems = await fetchRunItems(defaultDatasetId, offset, 100);
                if (finalItems.length > 0) {
                    console.log(`[Stream] Found ${finalItems.length} final items!`);

                    const cost = finalItems.length;
                    const deduction = Math.min(cost, user.credits);
                    user.credits -= deduction;
                    totalDeducted += deduction;
                    await user.save();

                    res.write(`data: ${JSON.stringify({ type: 'leads', data: finalItems, remainingCredits: user.credits })}\n\n`);
                }

                if (status === 'SUCCEEDED') {
                    // Log usage
                    try {
                        await new SearchHistory({
                            userId: req.user.userId,
                            keyword, location, resultCount: offset + finalItems.length
                        }).save();
                    } catch (e) {
                        console.error("Failed to save history", e);
                    }
                }
            }

            res.write(': keep-alive\n\n');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // 5. Cleanup & Close
        res.write(`data: ${JSON.stringify({ type: 'complete', totalDeducted })}\n\n`);
        res.end();

    } catch (error) {
        console.error('[Stream Error]:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        res.end();
    }
});


