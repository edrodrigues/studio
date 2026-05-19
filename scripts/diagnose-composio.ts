// @ts-nocheck
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { config } from 'dotenv';
import { Composio } from '@composio/core';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    console.log('Loading .env.local from:', envLocalPath);
    config({ path: envLocalPath });
}

async function run() {
    const apiKey = process.env.COMPOSIO_API_KEY;
    const authConfigId = process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
    console.log('COMPOSIO_API_KEY:', apiKey ? 'EXISTS' : 'MISSING');
    console.log('COMPOSIO_GOOGLE_AUTH_CONFIG_ID:', authConfigId);

    if (!apiKey) {
        console.error('No COMPOSIO_API_KEY found');
        return;
    }

    try {
        console.log('\n--- Initializing Composio ---');
        const composio = new Composio({ apiKey });
        
        console.log('\n--- Listing Auth Configs ---');
        const authConfigs = await composio.authConfigs.list();
        console.log('Total Auth Configs:', authConfigs?.items?.length || 0);
        if (authConfigs?.items) {
            for (const item of authConfigs.items) {
                console.log(`- ID: ${item.id}`);
                console.log(`  Name: ${item.name}`);
                console.log(`  App: ${JSON.stringify(item.app || item.appName || item.toolkit || {})}`);
                console.log(`  Status: ${item.status}`);
                console.log(`  Full: ${JSON.stringify(item)}`);
            }
        }

        console.log('\n--- Listing Connected Accounts ---');
        const connectedAccounts = await composio.connectedAccounts.list();
        console.log('Total Connected Accounts:', connectedAccounts?.items?.length || 0);
        if (connectedAccounts?.items) {
            for (const item of connectedAccounts.items) {
                console.log(`- ID: ${item.id}`);
                console.log(`  Toolkit: ${item.toolkit?.slug || item.app || 'N/A'}`);
                console.log(`  Status: ${item.status}`);
                console.log(`  User: ${item.userId}`);
            }
        }
    } catch (error) {
        console.error('Error diagnosing Composio:', error);
    }
}

run();
