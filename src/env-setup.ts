import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
    const content = fs.readFileSync(envLocalPath, 'utf8');
    config({ path: envLocalPath });

    // Handle multi-line FIREBASE_SERVICE_ACCOUNT which dotenv might truncate
    if (content.includes('FIREBASE_SERVICE_ACCOUNT={')) {
        const match = content.match(/FIREBASE_SERVICE_ACCOUNT=({[\s\S]*?^})/m);
        if (match && match[1]) {
            process.env.FIREBASE_SERVICE_ACCOUNT = match[1];
        }
    }
}

// Then load default .env (won't overwrite existing vars)
config();
