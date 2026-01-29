
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log('Loading .env.local from:', envLocalPath);
    config({ path: envLocalPath });
} else {
    console.log('.env.local NOT found at:', envLocalPath);
}

console.log('--- Environment Check ---');
console.log('GOOGLE_GENAI_API_KEY:', process.env.GOOGLE_GENAI_API_KEY ? 'EXISTS (length: ' + process.env.GOOGLE_GENAI_API_KEY.length + ')' : 'MISSING');
console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'EXISTS (length: ' + process.env.GOOGLE_API_KEY.length + ')' : 'MISSING');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'EXISTS (length: ' + process.env.GEMINI_API_KEY.length + ')' : 'MISSING');
console.log('-------------------------');
