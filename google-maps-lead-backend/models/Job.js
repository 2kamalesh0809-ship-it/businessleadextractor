const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    jobId: {
        type: String,
        required: true,
        unique: true
    },
    keyword: {
        type: String,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    limit: {
        type: Number,
        default: 100
    },
    status: {
        type: String,
        enum: ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'STOPPED'],
        default: 'PENDING'
    },
    progress: {
        type: Number,
        default: 0
    },
    error: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Job', JobSchema);
