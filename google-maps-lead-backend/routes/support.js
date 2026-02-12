const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const jwt = require('jsonwebtoken');

// @route   POST /api/support/contact
// @desc    Submit a contact form
// @access  Public (Optionally includes userId if token present)
router.post('/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ message: 'Please provide name, email and message' });
        }

        let userId = null;
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (err) {
                // Ignore invalid token, proceed as anonymous
            }
        }

        const newContact = new Contact({
            name,
            email,
            message,
            userId
        });

        await newContact.save();

        res.json({ success: true, message: 'Message sent successfully! We will get back to you soon.' });

    } catch (err) {
        console.error('Support Contact Error:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
