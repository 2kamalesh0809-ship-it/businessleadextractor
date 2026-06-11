const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    credits: {
        type: Number,
        default: 5
    },
    plan: {
        type: String,
        default: 'Free'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Pre-save hook to hash password
UserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw err;
    }
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
