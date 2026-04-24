const dotenv = require('dotenv');
dotenv.config();

const token = process.env.BRAPI_TOKEN;
const ticker = 'ITSA4';
const url = `https://brapi.dev/api/quote/${ticker}?token=${token}`;

console.log(`Fetching from URL with '?token=' parameter`);

fetch(url)
    .then(res => {
        console.log('Status:', res.status);
        return res.json();
    })
    .then(data => {
        console.log(JSON.stringify(data, null, 2));
    })
    .catch(err => {
        console.error('Error fetching data:', err);
    });
