const mongoose = require('mongoose');

const UsageLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        default: 'SEARCH'
    },
    creditsDeducted: {
        type: Number,
        default: 1
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UsageLog', UsageLogSchema);
