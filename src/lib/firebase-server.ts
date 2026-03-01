import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { join } from 'path';
import { existsSync } from 'fs';

function getFirebaseAdminApp(): App {
    const existingApp = getApps().find(app => app.name === '[DEFAULT]');
    if (existingApp) {
        return existingApp;
    }

    // Try to use environment variable with JSON content first
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            return initializeApp({
                credential: cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
            });
        } catch (error) {
            console.error('Error parsing FIREBASE_SERVICE_ACCOUNT environment variable:', error);
        }
    }

    // Try to use service account file next
    const serviceAccountPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH 
        ? join(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH)
        : join(process.cwd(), './google-service-account.json');
    
    // Check if service account file exists before requiring it
    if (serviceAccountPath && existsSync(serviceAccountPath)) {
        try {
            const serviceAccount = require(serviceAccountPath);
            return initializeApp({
                credential: cert(serviceAccount),
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id,
            });
        } catch (error) {
            console.warn('Error loading service account file, trying Application Default Credentials...');
        }
    }
    
    // Fallback: try to use application default credentials (works in GCP environments)
    console.warn('Service account file not found, using Application Default Credentials...');
    return initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
}

const app = getFirebaseAdminApp();
export const db = getFirestore(app);
export { app };
