# Plan for Integrating Google Docs Generation with AI Filling

## 1. Overview
This plan outlines the steps to transition the contract generation process from local Markdown filling to direct Google Docs manipulation. The system will copy a user-provided Google Doc template and use AI to intelligently fill it with information extracted from "Initial Documents".

## 2. Prerequisites & Configuration
- **Google Cloud Console:**
    - Enable **Google Drive API**.
    - Enable **Google Docs API**.
    - Configure OAuth Consent Screen to include scopes:
        - `https://www.googleapis.com/auth/drive.file` (to create/edit files created by the app)
        - `https://www.googleapis.com/auth/documents` (to edit documents)
        - `email`, `profile`, `openid` (standard)

- **Environment Variables:**
    - Ensure `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, etc., are set.
    - No new service account keys are strictly required if using User OAuth (acting on behalf of the user).

## 3. Implementation Steps

### Phase 1: Authentication & Permissions
Update the authentication flow to request necessary Google scopes and capture the OAuth Access Token.

1.  **Modify `src/context/auth-context.tsx`**:
    - Add `https://www.googleapis.com/auth/drive.file` and `https://www.googleapis.com/auth/documents` to the `GoogleAuthProvider` scopes.
    - Capture the `credential.accessToken` from the `signInWithPopup` result.
    - Store this token in a secure context or session storage (for client-side use) or pass it to server actions.
    - *Note:* Since `googleapis` runs in Node.js (Server Actions), we need a way to pass this token to the backend, or handle the API calls client-side (less secure for secrets but okay for user's own token). Better approach: Pass token to Server Action.

### Phase 2: Backend Services (Server Actions)
Create utility functions to interact with Google APIs.

1.  **Create `src/lib/google-drive.ts`**:
    - `copyFile(accessToken: string, fileId: string, newName: string): Promise<string>`
        - Uses `drive.files.copy` to duplicate the template.
    - `shareFile(accessToken: string, fileId: string, email: string): Promise<void>` (Optional, if sharing is needed).

2.  **Create `src/lib/google-docs.ts`**:
    - `getDocumentContent(accessToken: string, documentId: string): Promise<string>`
        - Uses `docs.documents.get` to retrieve full text.
    - `batchUpdateDocument(accessToken: string, documentId: string, requests: any[]): Promise<void>`
        - Uses `docs.documents.batchUpdate` to apply changes (insert text, replace text).

### Phase 3: AI Logic for Filling
Develop the intelligence to map extracted entities to the document structure.

1.  **Modify or Create Flow: `src/ai/flows/generate-contract-in-docs.ts`**:
    - **Input:** `documentId`, `extractedEntities` (JSON), `templateContent` (Text).
    - **Step A:** Read the copied document's content.
    - **Step B:** Use Genkit/Gemini to analyze the text and find insertion points.
        - *Prompt Strategy:* "Given this contract text and these entities, identify where to insert the values. If placeholders (like `{{Client Name}}` or `[DATA]`) exist, return a list of replacements. If natural language gaps exist, identify the context and text to insert."
        - *Output:* A JSON array of operations: `{ "type": "replace_text", "match": "{{Client Name}}", "replacement": "Acme Corp" }` or `{ "type": "insert_text", "after_text": "Clause 1:", "content": "..." }`.
    - **Step C:** Convert AI output into Google Docs `batchUpdate` requests (`replaceAllText` or `insertText`).

### Phase 4: Frontend Integration
Update the UI to trigger the new flow.

1.  **Update `src/app/(main)/gerar-novo/page.tsx`**:
    - Ensure the user is authenticated with the new scopes.
    - When "Generate" is clicked:
        1.  Get the `googleDocLink` from the selected template (extract ID).
        2.  Call Server Action `generateContractDoc` (wrapping the logic from Phase 2 & 3).
        3.  Show progress: "Copying Template...", "Analyzing Document...", "Filling Content...", "Done".
    - Display the link to the *newly created* Google Doc.

### Phase 5: Testing & Validation
1.  **Auth Test:** Sign in and verify the token has `drive` and `docs` scopes.
2.  **Copy Test:** Verify the template is correctly copied to the user's Drive.
3.  **Fill Test:** Verify that placeholders/sections are correctly filled by the AI.
4.  **Edge Cases:**
    - Template not accessible (permissions error).
    - Token expired (handle re-auth).
    - AI hallucinating insertion points (refine prompt).

## 4. Migration Strategy
- Keep the existing "Markdown" generation as a fallback or legacy option for now.
- Mark templates with `googleDocLink` as "Google Docs Ready".
- Slowly deprecate the internal Markdown editor.
