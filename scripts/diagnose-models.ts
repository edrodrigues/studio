
import 'dotenv/config';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const ai = genkit({
    plugins: [
        googleAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY }),
    ],
});

async function main() {
    try {
        console.log('Testing connection to Gemini...');
        // There isn't a direct "listModels" in Genkit core easily accessible without trial/error, 
        // so we'll try a very simple generation with the model we want to use.
        const response = await ai.generate({
            model: 'googleai/gemini-1.5-flash',
            prompt: 'Oi',
        });
        console.log('Success! Response:', response.text);
    } catch (error: any) {
        console.error('Error during diagnostic:');
        if (error.status) console.error('Status:', error.status);
        if (error.message) console.error('Message:', error.message);
        if (error.details) console.error('Details:', JSON.stringify(error.details, null, 2));
    }
}

main();
