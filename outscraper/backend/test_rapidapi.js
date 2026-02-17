const axios = require('axios');
require('dotenv').config();

async function testApi() {
    const keyword = 'gym';
    const location = 'velachery';

    const options = {
        method: 'GET',
        url: 'https://local-business-data.p.rapidapi.com/search',
        params: {
            query: `${keyword} in ${location}`,
            limit: '20',
            zoom: '13',
            language: 'en',
            region: 'us'
        },
        headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY,
            'x-rapidapi-host': 'local-business-data.p.rapidapi.com'
        }
    };

    try {
        console.log('Testing RapidAPI with key:', process.env.RAPIDAPI_KEY ? 'Present' : 'Missing');
        const response = await axios.request(options);
        console.log('Status:', response.status);
        console.log('Data sample:', JSON.stringify(response.data).substring(0, 200));
    } catch (error) {
        if (error.response) {
            console.error('API Error Status:', error.response.status);
            console.error('API Error Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testApi();
