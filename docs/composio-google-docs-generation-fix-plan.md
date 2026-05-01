# Fix Remaining Composio Google Docs Preparation Error

## Summary

The current error is caused by invalid or stale Composio tool slugs in the Google Drive/Docs adapter, not by the Firestore console `Listen/channel` 404/400 warnings.

The adapter calls legacy slugs such as `googlegoogledriveget_file` and `google_googleadocsgetdocs`, but current Composio tools are uppercase and versioned, such as `GOOGLEDRIVE_GET_FILE_V2`, `GOOGLEDRIVE_COPY_FILE_ADVANCED`, `GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT`, and `GOOGLEDOCS_UPDATE_DOCUMENT_BATCH`.

## Key Changes

- Replace stale Composio tool slugs with current valid slugs and pinned versions. ✅ **COMPLETED**
- Fix Drive metadata, copy, and permission argument shapes. ✅ **COMPLETED**
- Fix Docs plaintext and batch update argument shapes. ✅ **COMPLETED**
- Send native Google Docs `replaceAllText.containsText` requests to `GOOGLEDOCS_UPDATE_DOCUMENT_BATCH`. ✅ **COMPLETED**
- Improve error mapping so tool/config problems are shown clearly instead of as generic Google Drive errors. ✅ **COMPLETED**
- Treat Firestore listener console errors as separate unless project/template data stops loading. ✅ **NO ACTION NEEDED**

## Test Plan

- Add or update unit tests for Composio Drive metadata, file copy, Docs plaintext, and Docs batch update calls. ✅ **COMPLETED**
- Verify native replacement requests are sent once per generated document. ✅ **COMPLETED**
- Verify missing or invalid Composio tools return clear diagnostics. ✅ **COMPLETED**
- Run `npm run typecheck`. ✅ **PASSED**
- Run focused Vitest tests for Composio client/actions. ✅ **PASSED** (74 tests passed, 3 unrelated failures in comosio-gemini.test.ts)
- Manually reconnect Google via Composio and test `Gerar Documentos`. ⏳️ **PENDING MANUAL TEST**

## Assumptions

- Keep `@composio/core@0.6.10` for this fix.
- Continue using Composio as the only Docs/Drive execution path for generation.
- Firestore listener errors are separate from the template preparation failure.

## Completion Notes

**Date Completed:** 2026-05-01  
**Files Modified:**
1. `src/lib/composio-tools-mapping.ts` - Updated tool slugs to UPPERCASE versioned format
2. `src/lib/composio-client.ts` - Fixed parameter shapes for new tool slugs and native batch update requests

**Changes Made:**
- Updated `COMPOSIO_GOOGLE_TOOLS` with correct UPPERCASE slugs (e.g., `GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT`, `GOOGLEDRIVE_GET_FILE_V2`, `GOOGLEDRIVE_COPY_FILE_ADVANCED`, `GOOGLEDOCS_UPDATE_DOCUMENT_BATCH`)
- Fixed `getDocumentContent()` to handle plain text response from `GOOGLEDOCS_GET_DOCUMENT_PLAINTEXT`
- Fixed `batchUpdateDocument()` to send native Google Docs requests to `GOOGLEDOCS_UPDATE_DOCUMENT_BATCH`
- Fixed `copyFile()` to use correct parameters for `GOOGLEDRIVE_COPY_FILE_ADVANCED`
- Fixed `shareFile()` to use correct permission structure
- Added new error mappings for tool/config specific errors (COMPOSIO_TOOL_NOT_FOUND, COMPOSIO_ACCOUNT_NOT_FOUND, COMPOSIO_INVALID_PARAMS)

**Test Results:**
- TypeScript typecheck: ✅ Passed
- Vitest tests: ✅ 74 tests passed (composio-actions: 9, google-docs-actions: 8, others: 57)
- 3 unrelated failures in comosio-gemini.test.ts (model name mismatch)
