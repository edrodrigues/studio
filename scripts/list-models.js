require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // Fallback to .env if .env.local doesn't have it

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error('Error: API Key not found in environment variables.');
    process.exit(1);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
const fs = require('fs');

fetch(url)
    .then(res => res.json())
    .then(data => {
        fs.writeFileSync('models.json', JSON.stringify(data, null, 2));
        console.log('Models written to models.json');
    })
    .catch(err => console.error('Error fetching models:', err));
