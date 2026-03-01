import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    config({ path: envLocalPath });

    // Handle multi-line FIREBASE_SERVICE_ACCOUNT which dotenv might truncate
    if (content.includes('FIREBASE_SERVICE_ACCOUNT={')) {
        // Find the start of the JSON
        const startIndex = content.indexOf('FIREBASE_SERVICE_ACCOUNT={') + 'FIREBASE_SERVICE_ACCOUNT='.length;
        // Find the matching closing brace (simple approach for this specific case)
        const lastBraceIndex = content.lastIndexOf('}');
        if (lastBraceIndex > startIndex) {
            process.env.FIREBASE_SERVICE_ACCOUNT = content.substring(startIndex, lastBraceIndex + 1);
        }
    }
}

// Then load default .env (won't overwrite existing vars)
config();
