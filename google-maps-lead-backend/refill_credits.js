const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');

async function refill() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOneAndUpdate(
            { email: '2kamalesh0809@gmail.com' },
            { $inc: { credits: 50 } },
            { new: true }
        );
        if (user) {
            console.log(`Credits refilled for ${user.email}. New balance: ${user.credits}`);
        } else {
            console.log('User not found.');
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

refill();
