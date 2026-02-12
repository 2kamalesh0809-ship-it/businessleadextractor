const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PLANS = require('../config/plans');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   POST /api/payment/order
// @desc    Create a Razorpay order
// @access  Private
router.post('/order', auth, async (req, res) => {
    try {
        const { planType } = req.body;
        const planKey = planType.toUpperCase();

        if (!PLANS[planKey]) {
            return res.status(400).json({ message: 'Invalid plan type' });
        }

        const plan = PLANS[planKey];
        if (plan.price === 0) {
            return res.status(400).json({ message: 'Free plan cannot be purchased via payment gateway' });
        }

        const amount = plan.price * 100; // Convert to paise

        const options = {
            amount: amount,
            currency: 'INR',
            receipt: `rcpt_${Date.now()}_${req.user.userId.slice(-6)}`,
            notes: {
                userId: req.user.userId,
                planType: planType
            }
        };

        const order = await razorpay.orders.create(options);

        // Create a record in our Payment collection
        const paymentRecord = new Payment({
            userId: req.user.userId,
            plan: plan.name,
            amount: plan.price,
            razorpayOrderId: order.id,
            status: 'CREATED'
        });
        await paymentRecord.save();

        res.json({
            ...order,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });

    } catch (err) {
        console.error('Razorpay Order Error:', err);
        res.status(500).json({ message: `Payment initiation failed: ${err.message}`, error: err.message });
    }
});

// @route   POST /api/payment/verify
// @desc    Verify Razorpay payment signature and update user
// @access  Private
router.post('/verify', auth, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment verified

            // Generate Invoice Number (INV-YYYY-XXXX)
            const year = new Date().getFullYear();
            const count = await Payment.countDocuments({
                invoiceNumber: { $regex: `^INV-${year}` }
            });
            const invoiceNumber = `INV-${year}-${(count + 1).toString().padStart(4, '0')}`;

            // 1. Update Payment Record & Get details
            const paymentRecord = await Payment.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                {
                    razorpayPaymentId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    status: 'SUCCESS',
                    invoiceNumber: invoiceNumber
                },
                { new: true }
            );

            if (!paymentRecord) {
                return res.status(404).json({ message: 'Transaction record not found' });
            }

            // 2. Update user credits and plan
            const user = await User.findById(req.user.userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            const planKey = paymentRecord.plan.toUpperCase();
            const plan = PLANS[planKey];

            if (!plan) {
                return res.status(400).json({ message: 'Stored plan configuration is invalid' });
            }

            user.credits += plan.credits;
            user.plan = plan.name;
            await user.save();

            res.json({
                success: true,
                message: `Upgrade Successful! You are now on the ${plan.name} plan.`,
                credits: user.credits,
                plan: user.plan,
                invoiceNumber: invoiceNumber
            });
        } else {
            // Verification failed
            await Payment.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: 'FAILED' }
            );
            res.status(400).json({ message: 'Invalid payment signature' });
        }

    } catch (err) {
        console.error('Payment Verification Error:', err);
        // Try to mark as failed if we have the order ID
        if (req.body.razorpay_order_id) {
            try {
                await Payment.findOneAndUpdate(
                    { razorpayOrderId: req.body.razorpay_order_id },
                    { status: 'FAILED' }
                );
            } catch (dbErr) {
                console.error('Failed to update status to FAILED after error:', dbErr);
            }
        }
        res.status(500).json({ message: 'Payment verification failed' });
    }
});

// @route   GET /api/payment/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user.userId })
            .sort({ createdAt: -1 });

        const history = payments.map(payment => ({
            id: payment._id,
            plan: payment.plan,
            amount: payment.amount,
            status: payment.status,
            date: payment.createdAt,
            paymentId: payment.razorpayPaymentId || 'N/A',
            invoiceNumber: payment.invoiceNumber || 'N/A'
        }));

        res.json(history);

    } catch (err) {
        console.error('Get Payment History Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @route   GET /api/payment/invoice/:paymentId
// @desc    Get invoice details for a specific payment
// @access  Private
router.get('/invoice/:paymentId', auth, async (req, res) => {
    try {
        const { paymentId } = req.params;

        // 1. Find the payment record
        // We search by _id or razorpayPaymentId to be flexible
        const payment = await Payment.findOne({
            $or: [
                { _id: mongoose.isValidObjectId(paymentId) ? paymentId : null },
                { razorpayPaymentId: paymentId }
            ]
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        // 2. Verify Ownership (Security Check)
        if (payment.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized access to this invoice' });
        }

        // 3. Check Payment Status
        if (payment.status !== 'SUCCESS') {
            return res.status(400).json({ message: 'Invoice is only available for successful payments' });
        }

        // 4. Get User Details (for Invoice)
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 5. Generate Invoice Data
        const invoiceData = {
            invoiceNumber: payment.invoiceNumber || `INV-${payment.razorpayPaymentId || Date.now()}`,
            paymentId: payment.razorpayPaymentId,
            plan: payment.plan,
            amount: payment.amount,
            date: payment.createdAt,
            status: payment.status,
            customerName: user.username, // Using username as name/email placeholder
            customerEmail: user.username,
            companyName: 'Google Maps Lead Extractor',
            companyAddress: '123 Tech Street, Mumbai, India', // Placeholder
            currency: 'INR'
        };

        res.json(invoiceData);

    } catch (err) {
        console.error('Invoice Fetch Error:', err);
        res.status(500).json({ message: 'Server Error' });
    }
});

const PDFDocument = require('pdfkit');

// @route   GET /api/payment/invoice/:paymentId/pdf
// @desc    Download invoice PDF for a specific payment
// @access  Private
router.get('/invoice/:paymentId/pdf', auth, async (req, res) => {
    try {
        const { paymentId } = req.params;

        // 1. Find the payment record
        const payment = await Payment.findOne({
            $or: [
                { _id: mongoose.isValidObjectId(paymentId) ? paymentId : null },
                { razorpayPaymentId: paymentId }
            ]
        });

        if (!payment) {
            return res.status(404).json({ message: 'Payment record not found' });
        }

        // 2. Verify Ownership
        if (payment.userId.toString() !== req.user.userId) {
            return res.status(403).json({ message: 'Unauthorized access to this invoice' });
        }

        // 3. Check Payment Status
        if (payment.status !== 'SUCCESS') {
            return res.status(400).json({ message: 'Invoice is only available for successful payments' });
        }

        // 4. Get User Details
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // 5. Generate PDF
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers
        const filename = `invoice-${payment.invoiceNumber || payment.razorpayPaymentId}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // --- PDF Content ---

        // Header
        doc.fillColor('#444444')
            .fontSize(20)
            .text('INVOICE', 50, 50)
            .fontSize(10)
            .text('Google Maps Lead Extractor', 200, 50, { align: 'right' })
            .text('123 Tech Street', 200, 65, { align: 'right' })
            .text('Mumbai, Maharashtra, India', 200, 80, { align: 'right' })
            .moveDown();

        const invoiceInfoTop = 130;

        // Invoice Details (Left Side)
        doc.fontSize(10)
            .text('Bill To:', 50, invoiceInfoTop)
            .font('Helvetica-Bold').text(user.username, 50, invoiceInfoTop + 15)
            .font('Helvetica').text(user.username, 50, invoiceInfoTop + 30) // Email placeholder

        // Invoice Meta (Right Side)
        doc.text('Invoice Number:', 300, invoiceInfoTop)
            .font('Helvetica-Bold').text(`${payment.invoiceNumber || 'N/A'}`, 400, invoiceInfoTop, { align: 'right' })
            .font('Helvetica').text('Invoice Date:', 300, invoiceInfoTop + 15)
            .text(`${new Date(payment.createdAt).toLocaleDateString()}`, 400, invoiceInfoTop + 15, { align: 'right' })
            .text('Payment ID:', 300, invoiceInfoTop + 30)
            .text(`${payment.razorpayPaymentId}`, 400, invoiceInfoTop + 30, { align: 'right' });

        doc.moveDown();

        // Table Header
        const tableTop = 220;
        doc.rect(50, tableTop - 5, 500, 20).fill('#f3f4f6'); // Gray background
        doc.fillColor('#000000');

        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Item Description', 60, tableTop);
        doc.text('Price', 280, tableTop, { align: 'right' });
        doc.text('Qty', 350, tableTop, { align: 'right' });
        doc.text('Total', 480, tableTop, { align: 'right' });

        // Table Row (Plan)
        const itemTop = tableTop + 30;
        doc.font('Helvetica').fontSize(10);
        doc.text(`${payment.plan} Plan Subscription`, 60, itemTop);
        doc.text(`INR ${payment.amount.toFixed(2)}`, 280, itemTop, { align: 'right' });
        doc.text('1', 350, itemTop, { align: 'right' });
        doc.text(`INR ${payment.amount.toFixed(2)}`, 480, itemTop, { align: 'right' });

        // Line
        doc.moveTo(50, itemTop + 20).lineTo(550, itemTop + 20).strokeColor('#e5e7eb').stroke();

        // Totals Calculation
        const subtotalTop = itemTop + 40;
        doc.font('Helvetica').fontSize(10);

        // Subtotal
        doc.text('Subtotal:', 350, subtotalTop, { align: 'right' });
        doc.text(`INR ${payment.amount.toFixed(2)}`, 480, subtotalTop, { align: 'right' });

        // Total
        const totalTop = subtotalTop + 25;
        doc.font('Helvetica-Bold').fontSize(12);
        doc.text('Total:', 350, totalTop, { align: 'right' });
        doc.text(`INR ${payment.amount.toFixed(2)}`, 480, totalTop, { align: 'right' });

        // Status Stamp
        doc.save()
            .rotate(-15, { origin: [300, 400] })
            .fontSize(40)
            .fillColor('#10b981')
            .opacity(0.15)
            .text('PAID', 280, 350, { align: 'center' })
            .restore();

        // Footer
        doc.fontSize(9)
            .fillColor('#9ca3af')
            .text('This is a computer generated invoice.', 50, 700, { align: 'center', width: 500 });

        doc.end();

    } catch (err) {
        console.error('PDF Generation Error:', err);
        // If headers not sent, return JSON error
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating PDF' });
        }
    }
});

module.exports = router;
