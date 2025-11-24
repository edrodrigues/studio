import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

const envLocalPath = path.resolve(process.cwd(), '.env.local');

if (fs.existsSync(envLocalPath)) {
    config({ path: envLocalPath });
}

// Then load default .env (won't overwrite existing vars)
config();
