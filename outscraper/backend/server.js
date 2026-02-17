const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Validation: Ensure SERPAPI_KEY is present
if (!process.env.SERPAPI_KEY) {
    console.error('FATAL ERROR: SERPAPI_KEY is not defined in .env');
}

const connectDB = require('./config/db');
const { scrapeGoogleMaps } = require('./services/mapsScraper');

// Connect Database (Keeping DB for Job tracking if needed, but removing User relations)
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.json({ extended: false }));

// Make io accessible globally
app.set('socketio', io);

io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Define Routes
app.use('/api/search', require('./routes/search'));

/**
 * POST /api/scrape
 * Body: { keyword, location, limit }
 * Trigger a scraping job (Personal Use Version - No Auth/Credits)
 */
app.post('/api/scrape', async (req, res) => {
    try {
        const { keyword, location, limit, socketId } = req.body;
        console.log(`[Scrape Request] params:`, { keyword, location, limit, socketId });

        if (!keyword || !location) {
            return res.status(400).json({ success: false, message: "Missing keyword or location" });
        }

        const requestLimit = parseInt(limit) || 100;
        const jobId = Math.random().toString(36).substring(2, 15);

        // Retrieve Socket (if provided)
        let socket = null;
        if (socketId) {
            const io = req.app.get('socketio');
            socket = io.sockets.sockets.get(socketId);
        }

        // Start Scraper (Removed req.user.userId/jobId dependency if mapsScraper used them)
        const { runId } = await scrapeGoogleMaps(keyword, location, requestLimit, socket, null, jobId);

        res.json({
            success: true,
            message: "Scraping job started successfully",
            jobId: runId
        });

    } catch (error) {
        console.error('[Scrape Error]:', error);
        res.status(500).json({ success: false, message: "Failed to start scraping job", error: error.message });
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
