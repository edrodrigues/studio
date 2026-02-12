# Google Cloud Setup Guide for Google Docs API

This guide will walk you through setting up Google Cloud Console to enable the Google Docs API for bidirectional synchronization.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project selector at the top (or "Select a project")
3. Click "New Project"
4. Enter project name: `assistente-contratos-docs-sync`
5. Select your organization (or leave as "No organization")
6. Choose a location (optional)
7. Click "Create"

## Step 2: Enable Required APIs

1. In your new project, go to **APIs & Services** > **Library**
2. Search for and enable each of these APIs:
   - **Google Docs API** (for reading/writing documents)
   - **Google Drive API** (for document management)
   - **Google Workspace Marketplace SDK** (for publishing if needed)

For each API:
1. Click on the API name
2. Click "Enable"
3. Wait for it to finish enabling

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** > **OAuth consent screen**
2. Select **External** (for public use) or **Internal** (if using Google Workspace)
3. Click "Create"
4. Fill in the app information:
   - **App name**: `Assistente de Contratos V-LAB`
   - **User support email**: Your email
   - **App logo**: Upload your app logo (optional)
   - **Developer contact information**: Your email
5. Click "Save and Continue"

6. On **Scopes** page:
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/documents` (Edit Google Docs)
     - `https://www.googleapis.com/auth/drive.file` (Edit Drive files)
     - `https://www.googleapis.com/auth/userinfo.email` (View email)
     - `https://www.googleapis.com/auth/userinfo.profile` (View profile)
   - Click "Update"
   - Click "Save and Continue"

7. On **Test users** page:
   - Add your email and any test user emails
   - Click "Save and Continue"

8. Review and click "Back to Dashboard"

## Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click "Create Credentials" > "OAuth client ID"
3. Select **Web application**
4. Configure:
   - **Name**: `Assistente Contratos Web Client`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for development)
     - `https://your-production-domain.com` (for production)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google` (for development)
     - `https://your-production-domain.com/api/auth/callback/google` (for production)
5. Click "Create"
6. **IMPORTANT**: Download the JSON file (click the download icon)
   - Save as `google-oauth-credentials.json`
   - Keep this file secure - it contains sensitive information

## Step 5: Create Service Account (for Server-Side Operations)

1. In **Credentials** page, click "Create Credentials" > "Service account"
2. Configure:
   - **Service account name**: `docs-sync-service`
   - **Service account ID**: (auto-generated)
   - **Description**: `Service account for Google Docs synchronization`
3. Click "Create and Continue"
4. Grant roles:
   - **Role**: "Editor" (or create a custom role with Docs/Drive permissions)
5. Click "Continue"
6. Click "Done"

7. **Create and download key**:
   - Click on the service account you just created
   - Go to **Keys** tab
   - Click "Add Key" > "Create new key"
   - Select **JSON**
   - Click "Create"
   - Download and save as `google-service-account.json`

## Step 6: Configure Domain Verification (Production Only)

If using custom domains in production:

1. Go to **APIs & Services** > **Domain verification**
2. Click "Add domain"
3. Enter your production domain
4. Follow verification steps (usually adding a DNS TXT record)
5. Wait for verification (can take up to 72 hours)

## Step 7: Update Application Configuration

Create a `.env.local` file in your project root with:

```env
# Google Cloud Configuration
GOOGLE_CLIENT_ID=your-client-id-from-credentials
GOOGLE_CLIENT_SECRET=your-client-secret-from-credentials
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback/google

# Service Account (for server operations)
GOOGLE_SERVICE_ACCOUNT_EMAIL=docs-sync-service@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./google-service-account.json

# Project Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
```

## Step 8: Install Required Packages

Run this command in your project directory:

```bash
npm install googleapis
```

## Step 9: Test the Setup

1. Start your development server: `npm run dev`
2. Go to http://localhost:3000
3. Try to connect a Google Doc to a project
4. Check browser console for any errors

## Common Issues & Solutions

### Issue: "This app isn't verified"
- Solution: Your app is in testing mode. Add test users in OAuth consent screen or submit for verification.

### Issue: "Redirect URI mismatch"
- Solution: Ensure the redirect URI in Google Cloud Console matches exactly what's in your app

### Issue: "Insufficient permissions"
- Solution: Check that you've added all required scopes and the user has authorized them

### Issue: Service account can't access user documents
- Solution: Service accounts need explicit sharing. The user must share the document with the service account email.

## Security Best Practices

1. **Never commit credentials** to version control
2. Add to `.gitignore`:
   ```
   google-oauth-credentials.json
   google-service-account.json
   .env.local
   ```
3. Use environment variables for all secrets
4. Rotate credentials regularly
5. Enable audit logging in Google Cloud Console

## Next Steps

After completing this setup:
1. Configure Firebase Extensions for email notifications
2. Set up Firebase Storage
3. Test the full sync flow
4. Deploy to production with proper credentials

## Support

- [Google Docs API Documentation](https://developers.google.com/docs/api)
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
