#!/usr/bin/env node
/**
 * Script to deploy Firestore security rules to Firebase
 * This script uses the Firebase Admin SDK to deploy the rules programmatically
 */

const { execSync } = require('child_process');
const path = require('path');

const projectId = 'studio-7861892440-bca98';
const rulesPath = path.join(__dirname, '../firestore.rules');

try {
    console.log('Deploying Firestore security rules...');
    console.log(`Project ID: ${projectId}`);
    console.log(`Rules file: ${rulesPath}`);

    // Deploy using Firebase CLI
    execSync(`firebase deploy --only firestore:rules --project ${projectId}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
    });

    console.log('\n✅ Firestore security rules deployed successfully!');
} catch (error) {
    console.error('\n❌ Error deploying Firestore rules:', error.message);
    console.log('\nPlease deploy rules manually using:');
    console.log(`  firebase deploy --only firestore:rules --project ${projectId}`);
    console.log('\nOr deploy directly from the Firebase Console:');
    console.log(`  https://console.firebase.google.com/project/${projectId}/firestore/rules`);
    process.exit(1);
}
