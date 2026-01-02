
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// --- Env Setup ---
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log('Loading env from:', envLocalPath);
    config({ path: envLocalPath });
} else {
    config();
}

async function main() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ No API KEY!');
        process.exit(1);
    }
    console.log(`✅ API Key: ...${apiKey.slice(-4)}`);

    try {
        console.log('Initializing Genkit...');
        const ai = genkit({
            plugins: [
                googleAI({ apiKey }),
            ],
            model: 'googleai/gemini-3-flash-preview',
        });

        console.log('Generating content...');
        const { text } = await ai.generate('Hello, Gemini!');
        console.log('✅ Success! Response:', text);
    } catch (e: any) {
        console.error('❌ Genkit Error:', e);
        if (e.cause) console.error('Caused by:', e.cause);
    }
}

main();
