#!/bin/bash

# Deploy Firebase Storage Rules
echo "Deploying Firebase Storage rules..."
firebase deploy --only storage

echo ""
echo "Storage rules deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Navigate to a project in the application"
echo "2. Select a contract type"
echo "3. Upload a test file"
echo "4. Verify it appears with download button"
echo ""
echo "To verify in Firebase Console:"
echo "- Storage: https://console.firebase.google.com/project/studio-7861892440-bca98/storage"
echo "- Firestore: https://console.firebase.google.com/project/studio-7861892440-bca98/firestore"
