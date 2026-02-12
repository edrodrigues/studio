import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local if it exists
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    log('Loading env from:', envLocalPath);
    config({ path: envLocalPath });
} else {
    config(); // Fallback
}
// Helper to log to file
function log(msg: string, ...args: any[]) {
    const fullMsg = args.length > 0 ? `${msg} ${args.join(' ')}` : msg;
    console.log(fullMsg);
    fs.appendFileSync('diagnose_log.txt', fullMsg + '\n');
}
function error(msg: string) {
    console.error(msg);
    fs.appendFileSync('diagnose_log.txt', 'ERROR: ' + msg + '\n');
}

// Clear log file
fs.writeFileSync('diagnose_log.txt', '');

// Using native fetch
async function main() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        error('❌ No API key found in environment variables.');
        process.exit(1);
    }
    log(`✅ API Key found (ends with ...${apiKey.slice(-4)})`);

    const modelName = 'gemini-3-flash-preview';
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

    log('\n--- Test 1: List Models ---');
    try {
        const listUrl = `${baseUrl}/models?key=${apiKey}`;
        const res = await fetch(listUrl);
        if (!res.ok) {
            error(`❌ List Models Failed: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            error(txt);
        } else {
            const data = await res.json();
            const models = data.models || [];
            const names = models.map((m: any) => m.name);
            log(`✅ Found ${models.length} models.`);

            const target = names.find((n: string) => n.includes(modelName));
            if (target) {
                log(`✅ Model '${modelName}' FOUND in list: ${target}`);
            } else {
                log(`⚠️ Model '${modelName}' NOT FOUND in list.`);
                log('Available models (partial): ' + names.slice(0, 5).join(', '));
            }
        }
    } catch (e) {
        error('❌ List Models Exception: ' + e);
    }

    log('\n--- Test 2: Generate Content (Simple Hello) ---');
    try {
        // Note: Model names in API usually need 'models/' prefix
        const generateUrl = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: "Hello" }] }]
        };

        log(`Attempting fetch to: ${generateUrl.replace(apiKey, 'API_KEY')}`);
        const res = await fetch(generateUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            error(`❌ Generate Content Failed: ${res.status} ${res.statusText}`);
            const txt = await res.text();
            error(txt);
        } else {
            const data = await res.json();
            log('✅ Generate Content SUCCEEDED!');
            // log('Response: ' + JSON.stringify(data, null, 2).slice(0, 200) + '...');
        }
    } catch (e) {
        error('❌ Generate Content Exception: ' + e);
    }
}

main();
