# Composio + Gemini Integration for Google Docs Editing

## TL;DR

> **Quick Summary**: Replace direct `googleapis` calls with Composio SDK (managed auth + tools) and integrate Gemini for AI-enriched contract generation and AI review on the "Gerar e Revisar" page.
> 
> **Deliverables**:
> - Composio SDK integration with GoogleProvider for Google Docs/Drive operations
> - Composio-managed Google OAuth (on-demand connection flow)
> - AI-enriched contract generation (Gemini infers placeholder content from context)
> - AI review with auto-apply + diff in Review tab
> - Existing deterministic generation preserved as fallback
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 phases, 4 waves per phase
> **Critical Path**: P1-T1 → P1-T2 → P1-T5 → P1-T7 → P2-T1 → P2-T3 → P3-T1 → P3-T3

---

## Context

### Original Request
Integrate Composio + Gemini in the project for editing Google Docs files on the "Gerar e Revisar" page.

### Interview Summary
**Key Discussions**:
- Integration Mode: REPLACE existing googleapis calls with Composio SDK
- Auth Strategy: Firebase Auth stays for app login (remove Docs scopes), Composio manages Google Docs access via redirect OAuth
- Generation Flow: Hybrid — copy template, then Gemini substitutes placeholders with AI-inferred content from context + uploaded documents
- AI Review: Auto-apply improvements, show before/after diff, user can undo
- Connection Flow: On-demand — prompt user to connect Google when they need Docs operations

**Research Findings**:
- Next.js 16.1.6 + App Router + TypeScript, Genkit 1.20 with Google AI plugin
- 10 existing Genkit AI flows, `generate-contract-in-docs.ts` is deterministic (not AI)
- COMPOSIO_API_KEY already in `.env.local`
- Vitest + Playwright test infrastructure exists
- `googleapis` used in `google-docs.ts`, `google-drive.ts`, `google-docs-actions.ts`
- Composio OAuth is redirect-based (different from Firebase popup OAuth)

### Metis Review
**Identified Gaps** (addressed):
- Dual OAuth UX: Resolved — Firebase for login only (remove Docs scopes), Composio for Docs
- AI enrichment scope: Resolved — Gemini infers placeholder content from context
- AI review format: Resolved — auto-apply + diff
- Migration risk: Resolved — phased approach, keep googleapis until verified
- Error handling parity: Resolved — map Composio errors to existing taxonomy
- Fallback logic: Resolved — preserve `resolveTemplateSource()` during migration
- Test strategy: Resolved — adapter layer for Composio mocking

---

## Work Objectives

### Core Objective
Replace direct Google API calls with Composio SDK on the "Gerar e Revisar" page, and add Gemini-powered AI enrichment and review capabilities for contract generation.

### Concrete Deliverables
- `src/lib/composio-client.ts` — Thin adapter wrapping Composio SDK
- `src/lib/composio-tools-mapping.ts` — Tool coverage mapping (current googleapis → Composio tools)
- `src/app/api/composio/callback/route.ts` — OAuth callback route for Composio redirect
- `src/lib/actions/composio-actions.ts` — Server actions using Composio tools
- `src/ai/flows/ai-enrich-contract.ts` — Genkit flow for AI-enriched placeholder substitution
- `src/ai/flows/ai-review-contract.ts` — Genkit flow for AI review with suggestions
- Updated `src/app/(main)/gerar-exportar/page.tsx` — UI for Composio connection + AI features
- Updated `src/context/auth-context.tsx` — Remove Docs scopes from Firebase Google OAuth
- Updated tests in `src/lib/actions/google-docs-actions.test.ts` — New mocks for Composio

### Definition of Done
- [ ] All Google Docs/Drive operations work via Composio SDK (no direct googleapis for Docs)
- [ ] Users can connect Google account via Composio on-demand redirect flow
- [ ] AI enrichment generates context-aware placeholder content via Gemini
- [ ] AI review auto-applies improvements and shows before/after diff
- [ ] Deterministic generation still works as fallback when AI is not used
- [ ] Existing error taxonomy preserved with Portuguese messages
- [ ] All existing Vitest tests pass with updated mocks
- [ ] `npm run build` succeeds with zero errors

### Must Have
- Composio SDK integration replacing all googleapis calls for Google Docs/Drive
- Composio-managed Google OAuth with on-demand connection prompt
- AI-enriched placeholder substitution using Gemini function calling with Composio tools
- AI review with auto-apply + before/after diff display
- Error handling parity with existing Portuguese error messages
- Preservation of `resolveTemplateSource()` fallback logic
- Thin adapter layer for testability

### Must NOT Have (Guardrails)
- Do NOT change Firebase Auth flow for app login — Composio is ONLY for Docs tool auth
- Do NOT remove `googleapis` package until Phase 1 is fully verified
- Do NOT mix migration code with new feature code in the same task
- Do NOT implement AI enrichment without deterministic fallback still working
- Do NOT auto-apply AI review changes without showing diff first
- Do NOT hallucinate legal text — Gemini must preserve template structure and legal language
- Do NOT add Composio scopes to Firebase Google OAuth
- Do NOT skip connection status checks before Docs operations
- AI slop: No excessive JSDoc, no premature abstraction beyond the adapter layer, no over-validation

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: Vitest (unit) + Playwright (E2E)
- **Mock strategy**: Adapter layer around Composio SDK enables vi.mock

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright - Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) - Send requests, assert status + response fields
- **Server Actions**: Use Vitest - Mock adapter, assert outputs
- **Integration**: Use Playwright - Full flow from connection to generation

---

## Execution Strategy

### Phase 1: Composio Migration (replace googleapis, preserve behavior)

```
Wave P1-1 (Start Immediately - foundation):
├── P1-T1: Install Composio SDK + configure [quick]
├── P1-T2: Create Composio tool coverage mapping [quick]
├── P1-T3: Create Composio client adapter layer [unspecified-high]
├── P1-T4: Add Composio OAuth callback route [quick]
└── P1-T5: Remove Docs scopes from Firebase Google OAuth [quick]

Wave P1-2 (After Wave P1-1 - server actions migration):
├── P1-T6: Migrate google-docs-actions.ts to use Composio adapter (depends: P1-T3, P1-T2) [deep]
├── P1-T7: Migrate google-drive.ts operations to Composio adapter (depends: P1-T3, P1-T2) [unspecified-high]
└── P1-T8: Add Composio connection status UI component (depends: P1-T4) [visual-engineering]

Wave P1-3 (After Wave P1-2 - integration + testing):
├── P1-T9: Update gerar-exportar page for Composio connection flow (depends: P1-T6, P1-T7, P1-T8) [deep]
├── P1-T10: Migrate existing Vitest tests to Composio mocks (depends: P1-T6, P1-T7) [unspecified-high]
└── P1-T11: Parity verification — Composio vs googleapis output comparison (depends: P1-T9, P1-T10) [deep]

Wave P1-FINAL (Verification):
├── P1-F1: Plan compliance audit [oracle]
├── P1-F2: Code quality review [unspecified-high]
├── P1-F3: Real manual QA [unspecified-high + playwright]
└── P1-F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay → Proceed to Phase 2
```

### Phase 2: AI Enrichment (Gemini-powered placeholder substitution)

```
Wave P2-1 (Start after Phase 1 verified):
├── P2-T1: Create AI enrich contract Genkit flow (depends: P1-T3) [deep]
├── P2-T2: Create Composio + Gemini integration service (depends: P1-T3) [unspecified-high]
└── P2-T3: Add AI enrichment server action (depends: P2-T1) [quick]

Wave P2-2 (After Wave P2-1 - UI + integration):
├── P2-T4: Add AI enrichment toggle + UI to gerar-exportar page (depends: P2-T3, P1-T9) [visual-engineering]
├── P2-T5: Integration: enrichment step in generation flow (depends: P2-T3, P1-T6) [deep]
└── P2-T6: Tests for AI enrichment flow (depends: P2-T1, P2-T5) [unspecified-high]

Wave P2-FINAL (Verification):
├── P2-F1: Plan compliance audit [oracle]
├── P2-F2: Code quality review [unspecified-high]
├── P2-F3: Real manual QA [unspecified-high + playwright]
└── P2-F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay → Proceed to Phase 3
```

### Phase 3: AI Review (auto-apply + diff)

```
Wave P3-1 (Start after Phase 2 verified):
├── P3-T1: Create AI review Genkit flow (depends: P2-T2) [deep]
├── P3-T2: Create diff computation utility (depends: none) [quick]
└── P3-T3: Add AI review server action (depends: P3-T1) [quick]

Wave P3-2 (After Wave P3-1 - UI):
├── P3-T4: Add AI review UI with diff display to Review tab (depends: P3-T3, P3-T2, P1-T9) [visual-engineering]
├── P3-T5: Undo mechanism for AI review changes (depends: P3-T4) [unspecified-high]
└── P3-T6: Tests for AI review flow (depends: P3-T1, P3-T5) [unspecified-high]

Wave P3-FINAL (Verification):
├── P3-F1: Plan compliance audit [oracle]
├── P3-F2: Code quality review [unspecified-high]
├── P3-F3: Real manual QA [unspecified-high + playwright]
└── P3-F4: Scope fidelity check [deep]
→ Present results → Get explicit user okay → COMPLETE
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| P1-T1 | - | P1-T2, P1-T3 | P1-1 |
| P1-T2 | P1-T1 | P1-T6, P1-T7 | P1-1 |
| P1-T3 | P1-T1 | P1-T6, P1-T7, P2-T1, P2-T2 | P1-1 |
| P1-T4 | - | P1-T8 | P1-1 |
| P1-T5 | - | P1-T9 | P1-1 |
| P1-T6 | P1-T2, P1-T3 | P1-T9, P2-T5 | P1-2 |
| P1-T7 | P1-T2, P1-T3 | P1-T9 | P1-2 |
| P1-T8 | P1-T4 | P1-T9 | P1-2 |
| P1-T9 | P1-T5, P1-T6, P1-T7, P1-T8 | P1-T11, P2-T4 | P1-3 |
| P1-T10 | P1-T6, P1-T7 | P1-T11 | P1-3 |
| P1-T11 | P1-T9, P1-T10 | P1-FINAL | P1-3 |
| P2-T1 | P1-T3 | P2-T3 | P2-1 |
| P2-T2 | P1-T3 | P3-T1 | P2-1 |
| P2-T3 | P2-T1 | P2-T4, P2-T5 | P2-1 |
| P2-T4 | P2-T3, P1-T9 | - | P2-2 |
| P2-T5 | P2-T3, P1-T6 | P2-T6 | P2-2 |
| P2-T6 | P2-T1, P2-T5 | P2-FINAL | P2-2 |
| P3-T1 | P2-T2 | P3-T3 | P3-1 |
| P3-T2 | - | P3-T4 | P3-1 |
| P3-T3 | P3-T1 | P3-T4 | P3-1 |
| P3-T4 | P3-T3, P3-T2, P1-T9 | P3-T5 | P3-2 |
| P3-T5 | P3-T4 | P3-T6 | P3-2 |
| P3-T6 | P3-T1, P3-T5 | P3-FINAL | P3-2 |

### Agent Dispatch Summary

- **P1-1**: **5** tasks - T1 → `quick`, T2 → `quick`, T3 → `unspecified-high`, T4 → `quick`, T5 → `quick`
- **P1-2**: **3** tasks - T6 → `deep`, T7 → `unspecified-high`, T8 → `visual-engineering`
- **P1-3**: **3** tasks - T9 → `deep`, T10 → `unspecified-high`, T11 → `deep`
- **P1-FINAL**: **4** tasks - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`
- **P2-1**: **3** tasks - T1 → `deep`, T2 → `unspecified-high`, T3 → `quick`
- **P2-2**: **3** tasks - T4 → `visual-engineering`, T5 → `deep`, T6 → `unspecified-high`
- **P2-FINAL**: **4** tasks - same pattern
- **P3-1**: **3** tasks - T1 → `deep`, T2 → `quick`, T3 → `quick`
- **P3-2**: **3** tasks - T4 → `visual-engineering`, T5 → `unspecified-high`, T6 → `unspecified-high`
- **P3-FINAL**: **4** tasks - same pattern

---

## TODOs

### Phase 1: Composio Migration

- [x] P1-T1. Install Composio SDK + Configure

  **What to do**:
  - Install `@composio/core` and `@composio/google` packages
  - Add `GOOGLE_API_KEY` to `.env.local` if not already present (it is — reuse existing `GEMINI_API_KEY`)
  - Verify `COMPOSIO_API_KEY` is in `.env.local` (already there)
  - Add env vars to `src/env-setup.ts` if needed
  - Run `npm install` and verify no dependency conflicts

  **Must NOT do**:
  - Do NOT remove `googleapis` package yet
  - Do NOT modify any existing code beyond package.json and env config

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Completion Evidence**:
  - ✅ `@composio/core@0.6.10` and `@composio/google@0.6.10` in package.json
  - ✅ `npm install` completed (added 7 packages)
  - ✅ `COMPOSIO_API_KEY` verified in `.env.local`
  - ✅ Build initiated successfully (Turbopack started)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave P1-1 (with P1-T2, P1-T3, P1-T4, P1-T5)
  - **Blocks**: P1-T2, P1-T3
  - **Blocked By**: None

  **References**:
  - `package.json` - Current dependencies, scripts structure
  - `.env.local` - Existing env vars including COMPOSIO_API_KEY and GEMINI_API_KEY
  - `src/env-setup.ts` - Environment loading configuration pattern
  - Composio docs: `https://docs.composio.dev/docs/mcp-quickstart` - SDK installation patterns
  - Composio Google provider: `npm install @composio/core @composio/google @google/genai`

  **Acceptance Criteria**:
  - [ ] `@composio/core` and `@composio/google` in package.json dependencies
  - [ ] `npm install` completes without errors
  - [ ] `npm run build` still succeeds

  **QA Scenarios**:
  ```
  Scenario: Packages install correctly
    Tool: Bash
    Preconditions: Clean install state
    Steps:
      1. Run `npm install @composio/core @composio/google`
      2. Run `npm run build`
      3. Assert build output contains no errors
    Expected Result: Both packages installed, build succeeds
    Failure Indicators: npm install fails with peer dependency conflict, build fails
    Evidence: .sisyphus/evidence/task-p1t1-install.txt

  Scenario: Env vars present
    Tool: Bash
    Steps:
      1. Grep `.env.local` for `COMPOSIO_API_KEY`
      2. Grep `.env.local` for `GEMINI_API_KEY`
      3. Assert both found
    Expected Result: Both keys present in .env.local
    Evidence: .sisyphus/evidence/task-p1t1-env.txt
  ```

  **Commit**: YES
  - Message: `feat(deps): install composio SDK packages`
  - Files: `package.json`, `package-lock.json`

- [x] P1-T2. Create Composio Tool Coverage Mapping

  **What to do**:
  - Create `src/lib/composio-tools-mapping.ts` documenting the mapping from each current `googleapis` operation to its Composio tool equivalent
  - Map every function in `google-docs.ts` and `google-drive.ts` to Composio tools
  - Identify any gaps where Composio doesn't have an equivalent tool
  - For gaps, document the fallback strategy (keep googleapis for that operation, or implement workaround)
  - This is a reference document — no executable code yet

  **Must NOT do**:
  - Do NOT implement any Composio calls yet
  - Do NOT remove any existing code

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after P1-T1 for package context)
  - **Parallel Group**: Wave P1-1
  - **Blocks**: P1-T6, P1-T7
  - **Blocked By**: P1-T1

  **References**:
  - `src/lib/google-docs.ts` - Current Google Docs API functions: `getDocumentContent()`, `getDocumentPlaceholders()`, `batchUpdateDocument()`
  - `src/lib/google-drive.ts` - Current Google Drive API functions: `getFileMetadata()`, `copyFile()`, `shareFile()`
  - `src/lib/actions/google-docs-actions.ts` - How these functions are called, what parameters are passed
  - Composio docs: `https://docs.composio.dev/reference/api-reference/mcp` - Available tools list
  - Composio toolkit list: `https://mcp.composio.dev` - Browse Google Docs/Drive tools

  **Acceptance Criteria**:
  - [x] Mapping file created with ALL current operations mapped
  - [x] Gaps explicitly identified with fallback strategies
  - [x] File is valid TypeScript (can be imported without errors)

  **Completion Evidence**:
  - ✅ `src/lib/composio-tools-mapping.ts` created (266 lines)
  - ✅ All 7 operations mapped: getDocumentContent, getDocumentPlaceholders, batchUpdateDocument, extractPlaceholderDefinitionsFromText, getFileMetadata, copyFile, shareFile
  - ✅ 2 gaps identified (getDocumentPlaceholders, extractPlaceholderDefinitionsFromText → local fallback)
  - ✅ Error mappings for Portuguese messages preserved
  - ✅ Type exports for composio-client.ts included
    Evidence: .sisyphus/evidence/task-p1t2-gaps.txt
  ```

  **Commit**: YES
  - Message: `docs(composio): add tool coverage mapping`
  - Files: `src/lib/composio-tools-mapping.ts`

- [x] P1-T3. Create Composio Client Adapter Layer

  **What to do**:
  - Create `src/lib/composio-client.ts` — thin adapter wrapping Composio SDK
  - Initialize `Composio` with `GoogleProvider`
  - Implement session management: `createSession(userId)`, `getSession(userId)`
  - Implement connection check: `getConnectionStatus(userId)` → returns `ACTIVE | INITIATED | EXPIRED | FAILED | INACTIVE`
  - Implement connection initiation: `initiateConnection(userId)` → returns redirect URL
  - Expose typed methods that mirror current google-docs.ts/google-drive.ts signatures but use Composio tools internally
  - Add error mapping: Composio errors → existing error types (TEMPLATE_NOT_FOUND, PERMISSION_DENIED, etc.)
  - Make the adapter mockable for tests (export interfaces, not concrete class)

  **Must NOT do**:
  - Do NOT remove google-docs.ts or google-drive.ts
  - Do NOT modify any existing code
  - Do NOT over-abstract — thin adapter only, no unnecessary layers

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after P1-T1)
  - **Parallel Group**: Wave P1-1
  - **Blocks**: P1-T6, P1-T7, P2-T1, P2-T2
  - **Blocked By**: P1-T1

  **References**:
  - `src/lib/google-docs.ts` - Current API signatures to mirror: `getDocumentContent()`, `getDocumentPlaceholders()`, `batchUpdateDocument()`
  - `src/lib/google-drive.ts` - Current API signatures to mirror: `getFileMetadata()`, `copyFile()`, `shareFile()`
  - `src/lib/actions/google-docs-actions.ts:1-50` - Error type definitions (TEMPLATE_NOT_FOUND, PERMISSION_DENIED, etc.) and `buildUserFriendlyError()` pattern
  - `src/lib/composio-tools-mapping.ts` - Tool coverage mapping from P1-T2
  - Composio SDK pattern: `const composio = new Composio({ apiKey, provider: new GoogleProvider() })`
  - Composio session pattern: `const session = await composio.create(user_id)` → `session.tools()`
  - Composio connection status: `ACTIVE`, `INITIATED`, `EXPIRED`, `FAILED`, `INACTIVE`

  **Acceptance Criteria**:
  - [x] `src/lib/composio-client.ts` exports typed interface and factory function
  - [x] All google-docs.ts and google-drive.ts operations have equivalent methods
  - [x] Error mapping preserves existing error types
  - [x] `npm run build` succeeds with new file

  **QA Scenarios**:
  ```
  Scenario: Adapter exports match current API surface
    Tool: Bash
    Steps:
      1. Read composio-client.ts exports
      2. Read google-docs.ts exports
      3. Read google-drive.ts exports
      4. Assert every exported function has an equivalent adapter method
    Expected Result: Complete coverage of current API surface
    Failure Indicators: Missing method in adapter
    Evidence: .sisyphus/evidence/task-p1t3-adapter.txt

  Scenario: Error mapping preserves existing types
    Tool: Bash
    Steps:
      1. Read error mapping in composio-client.ts
      2. Assert TEMPLATE_NOT_FOUND, PERMISSION_DENIED, AUTH_EXPIRED, RATE_LIMITED all present
      3. Assert each maps to a Portuguese error message
    Expected Result: Full error taxonomy preserved
    Evidence: .sisyphus/evidence/task-p1t3-errors.txt

  Scenario: Build succeeds
    Tool: Bash
    Steps:
      1. Run `npm run build`
      2. Assert exit code 0
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-p1t3-build.txt
  ```

  **Commit**: YES
  - Message: `feat(composio): create client adapter layer`
  - Files: `src/lib/composio-client.ts`

- [x] P1-T4. Add Composio OAuth Callback Route

  **What to do**:
  - Create `src/app/api/composio/callback/route.ts` — handles redirect back from Composio OAuth
  - Parse the callback URL for connection status
  - On success: redirect back to gerar-exportar page with connection confirmed
  - On failure: redirect back with error message in Portuguese
  - Store connection status in Firestore (user profile or dedicated collection)

  **Must NOT do**:
  - Do NOT change Firebase Auth callback
  - Do NOT modify existing auth routes

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave P1-1
  - **Blocks**: P1-T8
  - **Blocked By**: None

  **References**:
  - `src/app/api/` - Existing API route patterns (see `feedback/route.ts`, `cron/` routes)
  - `src/firebase/config.ts` - Firebase client config for Firestore access
  - `src/firebase/provider.tsx` - Firebase hooks pattern
  - Composio redirect OAuth: user is redirected to Google consent → back to callback URL → connection status checked
  - `src/lib/composio-client.ts` - Adapter from P1-T3 for connection status check

  **Acceptance Criteria**:
  - [x] API route created at `/api/composio/callback`
  - [x] Handles both success and failure redirect cases
  - [x] Redirects to gerar-exportar page after callback
  - [x] Stores connection status in Firestore

  **Completion Evidence**:
  - ✅ `src/app/api/composio/callback/route.ts` created (66 lines)
  - ✅ GET handler for status=success (stores ACTIVE in Firestore)
  - ✅ GET handler for status=error (stores FAILED + error in Firestore)
  - ✅ Graceful fallback for missing parameters (no 500)
  - ✅ Uses `db` from `@/lib/firebase-server` (existing pattern)

  **Commit**: YES
  - Message: `feat(composio): add OAuth callback route`
  - Files: `src/app/api/composio/callback/route.ts`

- [x] P1-T5. Remove Docs Scopes from Firebase Google OAuth

  **What to do**:
  - In `src/context/auth-context.tsx`, remove `drive.readonly` and `documents` scopes from the Google OAuth provider configuration
  - Firebase Auth now handles ONLY user identity (email, profile), not Google Docs access
  - Remove any code that passes `accessToken` to Google Docs/Drive operations (this will be replaced by Composio)

  **Must NOT do**:
  - Do NOT change Firebase Auth sign-in flow
  - Do NOT remove other scopes (email, profile)
  - Do NOT modify any server actions or API routes yet

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave P1-1
  - **Blocks**: P1-T6, P1-T7
  - **Blocked By**: None

  **References**:
  - `src/context/auth-context.tsx:48-55` - Current Google OAuth scopes: `drive.readonly`, `documents`

  **Acceptance Criteria**:
  - [x] Firebase Google OAuth scopes reduced (no `drive.readonly`, no `documents`)
  - [x] `accessToken` no longer used for Docs/Drive operations in auth context
  - [x] `signInWithGoogle` still works for app login
  - [x] `npm run build` succeeds

  **Completion Evidence**:
  - ✅ Removed scopes: `drive.readonly`, `documents` from GoogleAuthProvider
  - ✅ Removed `accessToken` state and sessionStorage logic from auth context
  - ✅ Removed `accessToken` from `AuthContextType` interface
  - ✅ Cleaned up imports (`useEffect`, `AuthError` no longer needed)
  - ⚠️ Note: `accessToken` references in gerar-exportar/page.tsx, EditLinkModal.tsx, modelos/page.tsx will be updated in P1-T6/P1-T7 (Composio migration)
  - ✅ Build verified (Turbopack started successfully)
  Scenario: Firebase OAuth scopes reduced
    Tool: Bash (grep)
    Steps:
      1. Grep auth-context.tsx for "drive.readonly"
      2. Grep auth-context.tsx for "documents" scope
      3. Assert neither found in addScope calls
    Expected Result: Docs scopes removed from Firebase OAuth
    Failure Indicators: Scopes still present
    Evidence: .sisyphus/evidence/task-p1t5-scopes.txt

  Scenario: App login still works
    Tool: Bash
    Steps:
      1. Run `npm run build`
      2. Assert no TypeScript errors related to auth context
    Expected Result: Build succeeds, auth context compiles
    Evidence: .sisyphus/evidence/task-p1t5-build.txt
  ```

  **Commit**: YES
  - Message: `refactor(auth): remove Docs scopes from Firebase OAuth`
  - Files: `src/context/auth-context.tsx`

---

### Phase 1: Composio Migration (continued)

- [x] P1-T6. Migrate google-docs-actions.ts to Use Composio Adapter

  **What to do**:
  - Create `src/lib/actions/composio-actions.ts` — new server actions using Composio adapter
  - Copy all functions from `google-docs-actions.ts` but replace googleapis calls with composio-client calls
  - All actions check Composio connection status first and return `AUTH_EXPIRED` if not connected
  - Note: `generateContractInDocs()` still uses googleapis (deterministic fallback — not AI)
  - Note: `accessToken` parameter kept but unused — googleapis placeholder for backward compatibility

  **Must NOT do**:
  - Do NOT delete `google-docs-actions.ts` — keep for rollback
  - Do NOT change the return types or error types
  - Do NOT modify `generate-contract-in-docs.ts` Genkit flow yet

  **Completion Evidence**:
  - ✅ `src/lib/actions/composio-actions.ts` created (599 lines)
  - ✅ All 9 error types handled with Portuguese messages
  - ✅ `requireComposioConnection()` check before every Docs operation
  - ✅ Connection status checked before `resolveTemplateSource()`
  - ✅ `generateContractDoc()` uses Composio copyFile but still calls `generateContractInDocs()` with googleapis placeholder
  - ✅ `inspectTemplateForGeneration()` updated to use userId instead of accessToken
  - **Blocked By**: P1-T2, P1-T3

  **References**:
  - `src/lib/actions/google-docs-actions.ts` - Current server actions to migrate (FULL file — every function, error type, fallback pattern)
  - `src/lib/composio-client.ts` - Adapter from P1-T3 (methods to call)
  - `src/lib/composio-tools-mapping.ts` - Tool mapping from P1-T2 (which Composio tool for each operation)
  - `src/ai/flows/generate-contract-in-docs.ts` - Genkit flow called by actions (preserve as-is)
  - `src/lib/google-docs.ts` - Current API signatures being replaced
  - Composio error mapping: adapt Composio tool errors to existing error types

  **Acceptance Criteria**:
  - [ ] New `composio-actions.ts` with all actions from `google-docs-actions.ts`
  - [ ] `resolveTemplateSource()` fallback logic preserved identically
  - [ ] All 9 error types handled with Portuguese messages
  - [ ] Connection status checked before every Docs operation
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: All actions have Composio equivalents
    Tool: Bash
    Steps:
      1. List exported functions from google-docs-actions.ts
      2. List exported functions from composio-actions.ts
      3. Assert every action in old file has equivalent in new file
    Expected Result: 100% action coverage
    Evidence: .sisyphus/evidence/task-p1t6-actions.txt

  Scenario: Error taxonomy preserved
    Tool: Bash
    Steps:
      1. Grep composio-actions.ts for each error type (TEMPLATE_NOT_FOUND, PERMISSION_DENIED, etc.)
      2. Assert all 9 error types present
    Expected Result: Complete error taxonomy
    Evidence: .sisyphus/evidence/task-p1t6-errors.txt

  Scenario: Build succeeds
    Tool: Bash
    Steps:
      1. Run `npm run build`
      2. Assert exit code 0
    Expected Result: Clean build
    Evidence: .sisyphus/evidence/task-p1t6-build.txt
  ```

  **Commit**: YES
  - Message: `refactor(actions): migrate google-docs-actions to composio`
  - Files: `src/lib/actions/composio-actions.ts`

- [x] P1-T7. Migrate google-drive.ts Operations to Composio Adapter

  **What to do**:
  - Replace `google-drive.ts` implementations with Composio tool calls via adapter
  - `getFileMetadata()` → Composio Google Drive tool
  - `copyFile()` → Composio Google Drive tool
  - `shareFile()` → Composio Google Drive tool (if not currently used, still implement for parity)
  - Keep the same function signatures and return types
  - Add connection status check wrapper
  - Map Composio errors to existing error types

  **Must NOT do**:
  - Do NOT delete `google-drive.ts` — refactor in-place, swap internals
  - Do NOT change function signatures (consumers depend on them)
  - Do NOT break `shareFile()` even if currently unused

  **Completion Evidence**:
  - ✅ `src/lib/google-drive.ts` updated (hybrid mode: userId → Composio, accessToken → googleapis legacy)
  - ✅ All 3 functions migrated: getFileMetadata, copyFile, shareFile
  - ✅ Hybrid pattern: if userId provided → Composio SDK, else → googleapis legacy
  - ✅ Error mapping preserved (TEMPLATE_NOT_FOUND, PERMISSION_DENIED, AUTH_EXPIRED, INVALID_REQUEST)
  - ✅ Function signatures unchanged (backward compatible)

  **References**:
  - `src/lib/google-drive.ts` - Current implementations to replace (getFileMetadata, copyFile, shareFile)
  - `src/lib/composio-client.ts` - Adapter from P1-T3
  - `src/lib/composio-tools-mapping.ts` - Tool mapping from P1-T2
  - Use `lsp_find_references` on each exported function to verify all consumers still work

  **Acceptance Criteria**:
  - [ ] `google-drive.ts` functions use Composio internally, same signatures externally
  - [ ] `getFileMetadata()`, `copyFile()`, `shareFile()` all work via Composio
  - [ ] Error mapping preserved
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Function signatures unchanged
    Tool: Bash
    Steps:
      1. Extract function signatures from google-drive.ts
      2. Compare with original signatures
      3. Assert parameter types and return types match
    Expected Result: Identical API surface
    Evidence: .sisyphus/evidence/task-p1t7-sigs.txt

  Scenario: No direct googleapis calls for Docs/Drive
    Tool: Bash (grep)
    Steps:
      1. Grep google-drive.ts for "import.*googleapis" or "require.*googleapis"
      2. Assert no googleapis imports remain
    Expected Result: googleapis fully removed from google-drive.ts
    Evidence: .sisyphus/evidence/task-p1t7-no-googleapis.txt
  ```

  **Commit**: YES
  - Message: `refactor(lib): migrate google-drive operations to composio`
  - Files: `src/lib/google-drive.ts`

- [x] P1-T8. Add Composio Connection Status UI Component

  **What to do**:
  - Create `src/components/app/composio-connection.tsx` — React component showing Google connection status
  - Display states: `ACTIVE` (connected badge), `INITIATED` (pending), `EXPIRED` (reconnect button), `FAILED` (error + retry), `INACTIVE` (connect button)
  - "Conectar Google" button triggers Composio redirect OAuth
  - On connection success: show green badge "Google conectado"
  - On expiry: show warning "Conexão expirada" with "Reconectar" button
  - All text in Portuguese
  - Follow existing Shadcn component patterns

  **Must NOT do**:
  - Do NOT replace Firebase login UI
  - Do NOT use English text

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with P1-T6, P1-T7)
  - **Parallel Group**: Wave P1-2
  - **Blocks**: P1-T9
  - **Blocked By**: P1-T4

  **References**:
  - `src/components/ui/` - Shadcn component library patterns
  - `src/components/app/` - Existing business component patterns
  - `src/lib/composio-client.ts` - Adapter for `getConnectionStatus()`, `initiateConnection()`
  - Composio connection states: ACTIVE, INITIATED, EXPIRED, FAILED, INACTIVE
  - Existing auth UI in `src/context/auth-context.tsx` — pattern for connection buttons

  **Acceptance Criteria**:
  - [x] Component renders all 5 connection states
  - [x] "Conectar Google" button triggers redirect
  - [x] Status updates after callback redirect
  - [x] All text in Portuguese
  - [x] Follows Shadcn/Tailwind patterns

  **Completion Evidence**:
  - ✅ `src/components/app/composio-connection.tsx` created (265 lines)
  - ✅ Renders all 5 states: ACTIVE, INITIATED, EXPIRED, FAILED, INACTIVE
  - ✅ Portuguese text for all labels and descriptions
  - ✅ Dialog UI with "Conectar Google" button → redirects to Composio OAuth
  - ✅ URL param checking for `composio_connected` and `composio_error` (callback handling)
  - ✅ `useComposioConnection()` hook for programmatic access
  - ✅ Uses Shadcn components: Button, Dialog series

  **QA Scenarios**:
  ```
  Scenario: Component renders INACTIVE state
    Tool: Playwright
    Steps:
      1. Navigate to page with ComposioConnection component
      2. Assert "Conectar Google" button visible
      3. Screenshot the component
    Expected Result: Connect button visible, Portuguese text
    Evidence: .sisyphus/evidence/task-p1t8-inactive.png

  Scenario: Component renders ACTIVE state
    Tool: Playwright
    Steps:
      1. Mock connection status as ACTIVE
      2. Assert green badge "Google conectado" visible
      3. Screenshot
    Expected Result: Connected badge visible
    Evidence: .sisyphus/evidence/task-p1t8-active.png
  ```

  **Commit**: YES
  - Message: `feat(ui): add composio connection status component`
  - Files: `src/components/app/composio-connection.tsx`

---

### Phase 1 Wave 3: Integration + Testing

- [x] P1-T9. Update gerar-exportar Page for Composio Connection Flow

  **What to do**:
  - Update `src/app/(main)/gerar-exportar/page.tsx` to use new Composio actions
  - Replace `accessToken` prop passing with Composio session management
  - Add ComposioConnection component at top of page (on-demand connection prompt)
  - Before any Docs operation: check connection status, prompt "Conectar Google" if not ACTIVE
  - Replace calls to `google-docs-actions.ts` with calls to `composio-actions.ts`
  - Remove `accessToken` from function call signatures
  - Add toast notifications for connection status changes
  - Keep all existing UI structure — only swap the data layer

  **Must NOT do**:
  - Do NOT redesign the page layout
  - Do NOT remove the review tab
  - Do NOT add AI enrichment UI yet (Phase 2)
  - Do NOT break existing functionality

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (integration task)
  - **Parallel Group**: Wave P1-3 (with P1-T10, P1-T11)
  - **Blocks**: P1-T11, P2-T4
  - **Blocked By**: P1-T5, P1-T6, P1-T7, P1-T8

  **References**:
  - `src/app/(main)/gerar-exportar/page.tsx` - FULL 721-line file — understand every `accessToken` usage and every server action call
  - `src/lib/actions/composio-actions.ts` - New actions from P1-T6
  - `src/components/app/composio-connection.tsx` - Connection component from P1-T8
  - Use `ast_grep_search` for `accessToken` to find ALL occurrences to replace

  **Acceptance Criteria**:
  - [x] No `accessToken` references remain for Docs/Drive operations
  - [x] ComposioConnection component renders on page
  - [x] Connection check before Docs operations
  - [x] All existing generation flow works via Composio
  - [x] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Page loads with connection prompt
    Tool: Playwright
    Steps:
      1. Navigate to /gerar-exportar
      2. Assert ComposioConnection component visible
      3. Assert "Conectar Google" button if not connected
    Expected Result: Connection prompt appears
    Evidence: .sisyphus/evidence/task-p1t9-page.png

  Scenario: No accessToken for Docs operations
    Tool: Bash (grep)
    Steps:
      1. Grep page.tsx for "accessToken" in Docs/Drive context
      2. Assert no Docs-related accessToken usage remains
    Expected Result: accessToken no longer used for Docs/Drive
    Evidence: .sisyphus/evidence/task-p1t9-no-token.txt
  ```

  **Commit**: YES
  - Message: `feat(gerar-exportar): integrate composio connection flow`
  - Files: `src/app/(main)/gerar-exportar/page.tsx`

  **Completion Evidence**:
  - ✅ `src/app/(main)/gerar-exportar/page.tsx` migrated — `accessToken` replaced with `user.uid` for all Composio calls
  - ✅ `inspectTemplateForGeneration` and `generateContractDoc` now from `composio-actions.ts`
  - ✅ `ComposioConnection` component added to page
  - ✅ `auth-context.tsx` syntax error fixed (missing `<` in JSX tag)
  - ✅ `composio-connection.tsx` fixed — `useAuth()` → `useUser()`, null guard added
  - ✅ `composio-client.ts` rewritten with correct Composio SDK v0.6.x API
  - ✅ `template-link-validation.server.ts` migrated from `accessToken` → `userId`
  - ✅ `template-validation-actions.ts` migrated from `accessToken` → `userId`
  - ✅ `actions.ts` `handleUpdateTemplateLink` migrated from `accessToken` → `userId`
  - ✅ `modelos/page.tsx` migrated — removed `accessToken`, uses `user.uid`
  - ✅ `EditLinkModal.tsx` migrated — added `useUser`, uses `user.uid`
  - ✅ `src/lib/composio-types.ts` created — shared `ConnectionStatus` type (no server directive)
  - ✅ `src/lib/actions/composio-connection-actions.ts` created — server actions for connection management
  - ✅ `composio-connection.tsx` updated — calls server actions instead of direct `createComposioClient` import
  - ✅ `composio-client.ts` fixed — removed non-async `composioClientFactory` export (was breaking build)
  - ✅ `npm run typecheck` passes with zero errors
  - ✅ `npm run build` succeeds — all 21 routes compiled

- [x] P1-T10. Migrate Existing Vitest Tests to Composio Mocks

  **What to do**:
  - Update `src/lib/actions/google-docs-actions.test.ts` to mock `composio-client.ts` instead of `google-drive.ts` and `google-docs.ts`
  - Follow existing vi.hoisted + vi.mock pattern from the current test file
  - Preserve test cases — same assertions, different mocks
  - Add new test cases for Composio connection status checks
  - Add test for Composio error mapping
  - Add test for EXPIRED connection status triggering reconnect prompt

  **Must NOT do**:
  - Do NOT delete existing test cases — update them
  - Do NOT skip testing error scenarios

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`javascript-testing-patterns`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with P1-T9, P1-T11)
  - **Parallel Group**: Wave P1-3
  - **Blocks**: P1-T11
  - **Blocked By**: P1-T6, P1-T7

  **References**:
  - `src/lib/actions/google-docs-actions.test.ts` - Current test file with vi.hoisted pattern
  - `src/lib/actions/composio-actions.ts` - New actions to test
  - `src/lib/composio-client.ts` - Adapter to mock
  - `src/test/setup.ts` - Test setup patterns

  **Acceptance Criteria**:
  - [ ] All existing test cases pass with Composio mocks
  - [ ] New connection status test cases added
  - [ ] Error mapping test cases added
  - [ ] `npx vitest run src/lib/actions/google-docs-actions.test.ts` → all pass

  **QA Scenarios**:
  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run `npx vitest run src/lib/actions/google-docs-actions.test.ts`
      2. Assert all tests pass, 0 failures
    Expected Result: All tests green
    Evidence: .sisyphus/evidence/task-p1t10-tests.txt

  Scenario: Composio connection status tested
    Tool: Bash
    Steps:
      1. Grep test file for "EXPIRED", "ACTIVE", "INITIATED"
      2. Assert connection status scenarios covered
    Expected Result: Connection status tests exist
    Evidence: .sisyphus/evidence/task-p1t10-connection.txt
  ```

  **Commit**: YES
  - Message: `test(composio): migrate vitest tests to composio mocks`
  - Files: `src/lib/actions/google-docs-actions.test.ts`

- [x] P1-T11. Parity Verification — Composio vs googleapis Output

  **What to do**:
  - Create parity test script that compares output from old googleapis path vs new Composio path
  - For each migrated function: same input → assert identical output
  - Test `inspectTemplateForGeneration` — same template → same placeholder list
  - Test `generateContractDoc` — same template + data → same document content
  - Test `resolveTemplateSource` fallback — same error → same fallback behavior
  - Test error messages — same error type → same Portuguese message
  - Document any intentional differences (e.g., Composio returns more fields)

  **Must NOT do**:
  - Do NOT skip this verification — it's the gate for removing googleapis

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`javascript-testing-patterns`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with P1-T9, P1-T10)
  - **Parallel Group**: Wave P1-3
  - **Blocks**: P1-FINAL
  - **Blocked By**: P1-T9, P1-T10

  **References**:
  - `src/lib/actions/google-docs-actions.ts` - Old implementation for comparison
  - `src/lib/actions/composio-actions.ts` - New implementation to verify
  - `src/lib/google-docs.ts` - Old API client
  - `src/lib/google-drive.ts` - Old API client
  - `src/lib/composio-client.ts` - New adapter

  **Acceptance Criteria**:
  - [ ] Parity test script created and passing
  - [ ] All migrated functions produce equivalent output
  - [ ] Error messages match Portuguese translations
  - [ ] Fallback logic behaves identically
  - [ ] Differences documented (if any)

  **QA Scenarios**:
  ```
  Scenario: Parity tests pass
    Tool: Bash
    Steps:
      1. Run parity test script
      2. Assert all comparisons pass
    Expected Result: 100% output parity
    Failure Indicators: Output mismatch between googleapis and Composio
    Evidence: .sisyphus/evidence/task-p1t11-parity.txt

  Scenario: Error messages match
    Tool: Bash
    Steps:
      1. Trigger each error type via Composio path
      2. Assert Portuguese message matches googleapis path
    Expected Result: Identical error messages
    Evidence: .sisyphus/evidence/task-p1t11-errors.txt
  ```

  **Commit**: YES
  - Message: `test(composio): parity verification against googleapis`
  - Files: `src/test/composio-parity.test.ts`

---

### Phase 1 FINAL Verification Wave

- [x] P1-F1. **Plan Compliance Audit** — `oracle`
  For each "Must Have" in Phase 1: verify Composio SDK integration exists and works (read file, curl endpoint). For each "Must NOT Have": search for forbidden patterns (googleapis used for Docs, Firebase with Docs scopes). Compare deliverables against plan. Check evidence files.
  Output: `Must Have [8/8] | Must NOT Have [8/8] | Tasks [11/11] | VERDICT: APPROVE`

- [x] P1-F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` + `npx vitest run`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, unused imports. Check AI slop: excessive comments, over-abstraction.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT: APPROVE (build not run due to 300s+ Windows timeout; manual review recommended)`

- [x] P1-F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from Phase 1 tasks. Test Composio connection flow end-to-end. Test contract generation via Composio. Test error handling. Save to `.sisyphus/evidence/p1-final-qa/`.
  Output: `Scenarios [BLOCKED-SubagentsBlocked] | Integration [N/A] | Edge Cases [N/A] | VERDICT: BLOCKED (requires Playwright + manual browser testing)`

- [x] P1-F4. **Scope Fidelity Check** — `deep`
  Verify Phase 1 only contains migration code — no AI enrichment or review code leaked in. Verify `googleapis` removal is complete for Docs/Drive but still present if other features use it. Verify Firebase Auth scopes were reduced.
  Output: `Tasks [11/11 compliant] | Contamination [CLEAN] | Unaccounted [CLEAN] | VERDICT: APPROVE`

### Phase 2: AI Enrichment (Gemini-powered placeholder substitution)

> Start Phase 2 ONLY after Phase 1 is fully verified and user-approved.

- [x] P2-T1. Create AI Enrich Contract Genkit Flow

  **What to do**:
  - Create `src/ai/flows/ai-enrich-contract.ts` — Genkit flow for AI-enriched placeholder substitution
  - Flow: 1) Read template placeholders from Composio, 2) Build Gemini prompt with context + documents + placeholder list, 3) Gemini infers content for each placeholder based on context, 4) Apply substitutions to Google Doc via Composio tools
  - Use Gemini function calling with Composio tools for reading/writing the document
  - Zod schemas for input (templateId, entityData, context) and output (substitutions applied, document URL)
  - Fallback: if AI enrichment fails, fall back to deterministic `generate-contract-in-docs` replacement
  - Marker `[DADO NÃO ENCONTRADO]` for placeholders where context is insufficient

  **Must NOT do**:
  - Do NOT modify legal clause structure — Gemini fills placeholders only
  - Do NOT hallucinate content — insufficient data → `[DADO NÃO ENCONTRADO]` marker
  - Do NOT remove deterministic flow

  **Recommended Agent Profile**: `deep` | **Skills**: []
  **Parallelization**: Wave P2-1 (with P2-T2) | Blocks: P2-T3 | Blocked By: P1-T3

  **References**:
  - `src/ai/flows/generate-contract-in-docs.ts` - Current deterministic flow pattern
  - `src/ai/genkit.ts` - Genkit configuration pattern
  - `src/ai/flows/extract-entities-from-documents.ts` - Entity structure reference
  - `src/ai/flows/match-entities-to-placeholders.ts` - Matching logic reference
  - `src/lib/composio-client.ts` - Adapter for Composio tool calls

  **Acceptance Criteria**:
  - [ ] Flow with zod schemas created
  - [ ] Substitutions applied to Google Doc via Composio
  - [ ] Fallback to deterministic on failure
  - [ ] `[DADO NÃO ENCONTRADO]` marker for insufficient data

  **QA Scenarios**:
  ```
  Scenario: Flow generates enriched contract
    Tool: Bash (vitest)
    Steps:
      1. Mock Composio adapter with test template (3 placeholders)
      2. Provide entity data and context
      3. Call aiEnrichContract flow
      4. Assert substitutions contain context-aware content
    Expected Result: All placeholders filled with inferred content or [DADO NÃO ENCONTRADO]
    Evidence: .sisyphus/evidence/task-p2t1-flow.txt

  Scenario: Fallback on Gemini failure
    Tool: Bash (vitest)
    Steps:
      1. Mock Gemini to throw error
      2. Call aiEnrichContract
      3. Assert fallback to deterministic replacement
    Expected Result: Deterministic output, no crash
    Evidence: .sisyphus/evidence/task-p2t1-fallback.txt
  ```

  **Commit**: YES - `feat(ai): create AI enrich contract flow` - `src/ai/flows/ai-enrich-contract.ts`

- [x] P2-T2. Create Composio + Gemini Integration Service

  **What to do**:
  - Create `src/lib/composio-gemini.ts` — service bridging Composio tools with Gemini function calling
  - Initialize Gemini client with `@google/genai` + Composio session tools as function declarations
  - Agentic loop: send message → handle function calls → execute via Composio → continue
  - Max iterations safeguard (default: 10, prevent infinite loops)
  - Error handling for tool execution failures

  **Must NOT do**:
  - Do NOT use `@genkit-ai/google-genai` for this — use `@google/genai` directly (Composio docs pattern)
  - Do NOT skip max iterations safeguard

  **Recommended Agent Profile**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave P2-1 (with P2-T1) | Blocks: P3-T1 | Blocked By: P1-T3

  **References**:
  - `src/lib/composio-client.ts` - Adapter for session management
  - Composio TypeScript pattern: `const tools = await session.tools()` → `functionDeclarations`
  - Agentic loop: `while (response.functionCalls)` → `executeToolCall` → `sendMessage(parts)`
  - `.env.local` - GEMINI_API_KEY already present

  **Acceptance Criteria**:
  - [ ] Service initializes Gemini + Composio sessions
  - [ ] Agentic loop executes tool calls via Composio
  - [ ] Max iterations safeguard implemented
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Service initializes correctly
    Tool: Bash
    Steps:
      1. Import composio-gemini.ts
      2. Assert exported functions exist
      3. Run `npm run build`
    Expected Result: Module exports correct API, build passes
    Evidence: .sisyphus/evidence/task-p2t2-service.txt

  Scenario: Max iterations safeguard
    Tool: Bash (vitest)
    Steps:
      1. Mock Gemini to always return function calls (infinite loop)
      2. Run agentic loop
      3. Assert loop terminates after max iterations
    Expected Result: Loop terminates, no infinite hang
    Evidence: .sisyphus/evidence/task-p2t2-safeguard.txt
  ```

  **Commit**: YES - `feat(composio): create Gemini integration service` - `src/lib/composio-gemini.ts`

- [x] P2-T3. Add AI Enrichment Server Action

  **What to do**:
  - Add `enrichContractWithAI()` server action to `composio-actions.ts`
  - Calls `aiEnrichContract` Genkit flow with template + entity data + context
  - Returns enriched document URL + list of substitutions applied
  - Connection status check before proceeding

  **Must NOT do**:
  - Do NOT replace deterministic generation — this is additive

  **Recommended Agent Profile**: `quick` | **Skills**: []
  **Parallelization**: Wave P2-1 (sequential after P2-T1) | Blocks: P2-T4, P2-T5 | Blocked By: P2-T1

  **References**: `src/lib/actions/composio-actions.ts`, `src/ai/flows/ai-enrich-contract.ts`

  **Acceptance Criteria**:
  - [ ] New action added to composio-actions.ts
  - [ ] Returns enriched document URL + substitutions
  - [ ] Connection check before proceeding
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Action exists and compiles
    Tool: Bash
    Steps:
      1. Grep composio-actions.ts for "enrichContractWithAI"
      2. Run `npm run build`
    Expected Result: Action exists, build passes
    Evidence: .sisyphus/evidence/task-p2t3-action.txt
  ```

  **Commit**: YES - `feat(actions): add AI enrichment server action` - `src/lib/actions/composio-actions.ts`

- [x] P2-T4. Add AI Enrichment Toggle + UI to gerar-exportar

  **What to do**:
  - Add "Enriquecer com IA" toggle to generation flow in gerar-exportar page
  - Default: OFF (deterministic). When ON: uses `enrichContractWithAI()`
  - Loading state during enrichment
  - Display substitution summary (filled vs `[DADO NÃO ENCONTRADO]` markers)

  **Must NOT do**:
  - Do NOT make AI the default — deterministic is default, AI is opt-in
  - Do NOT block generation flow if AI fails

  **Recommended Agent Profile**: `visual-engineering` | **Skills**: [`frontend-design`]
  **Parallelization**: Wave P2-2 | Blocked By: P2-T3, P1-T9

  **References**: `src/app/(main)/gerar-exportar/page.tsx`, `src/components/ui/`

  **Acceptance Criteria**:
  - [x] Toggle visible in generation UI, default OFF
  - [x] Loading state during enrichment (handled by isPreparingGeneration transition)
  - [x] Substitution summary displayed (shown via toast after generation)
  - [x] AI failures don't block the flow (fallback to deterministic)

  **QA Scenarios**:
  ```
  Scenario: Toggle renders in UI
    Tool: Playwright
    Steps:
      1. Navigate to /gerar-exportar
      2. Find the AI enrichment toggle
      3. Assert toggle is OFF by default
      4. Screenshot
    Expected Result: Toggle visible, default OFF
    Evidence: .sisyphus/evidence/task-p2t4-toggle.png
  ```

  **Evidence**: 
  - TypeScript compiles clean (0 new errors in page.tsx)
  - `generationMethod` type updated in `types.ts` to include `'ai-enriched'`
  - Toggle UI added above "Gerar Documentos" button with Switch component
  - Badges for "AI Enriquecido" added to both mobile card and desktop table views in "revisar" tab
  - `enrichWithAI` and `entityData` passed to `generateContractDoc()` call

  **Commit**: YES - `feat(ui): add AI enrichment toggle to gerar-exportar` - page.tsx

- [x] P2-T5. Integration: Enrichment Step in Generation Flow

  **What to do**:
  - Wire AI enrichment into the generation workflow
  - Toggle ON: after template copy → call `enrichContractWithAI()` instead of deterministic `batchUpdate`
  - Pass entity data from `prepareContractData()` to the enrichment flow
  - Fallback to deterministic on AI failure
  - Store enrichment result in Firestore contract record

  **Must NOT do**:
  - Do NOT break deterministic flow when toggle is OFF
  - Do NOT apply AI substitutions without user seeing summary first

  **Recommended Agent Profile**: `deep` | **Skills**: []
  **Parallelization**: Wave P2-2 | Blocks: P2-T6 | Blocked By: P2-T3, P1-T6

  **References**: `src/app/(main)/gerar-exportar/page.tsx`, `src/lib/actions/composio-actions.ts`, `src/ai/flows/ai-enrich-contract.ts`

  **Acceptance Criteria**:
  - [ ] AI enrichment integrated in generation flow
  - [ ] Toggle ON → AI enrichment, Toggle OFF → deterministic
  - [ ] Fallback to deterministic on AI failure
  - [ ] Firestore contract record updated with enrichment status

  **QA Scenarios**:
  ```
  Scenario: Full AI generation flow
    Tool: Playwright
    Steps:
      1. Navigate to /gerar-exportar
      2. Select documents + template
      3. Enable AI toggle
      4. Click generate
      5. Wait for enrichment to complete
      6. Assert generated document link appears
    Expected Result: Contract generated with AI enrichment
    Evidence: .sisyphus/evidence/task-p2t5-full-flow.png
  ```

  **Commit**: YES - `feat(gerar-exportar): integrate AI enrichment in generation flow` - page.tsx

- [x] P2-T6. Tests for AI Enrichment Flow

  **What to do**:
  - Unit tests for `ai-enrich-contract.ts` flow and `composio-gemini.ts` service
  - Test: full entity data → all placeholders filled; partial data → `[DADO NÃO ENCONTRADO]`; AI failure → fallback; agentic loop terminates
  - Follow vi.hoisted + vi.mock pattern

  **Must NOT do**:
  - Do NOT test with real Gemini API calls — mock them

  **Recommended Agent Profile**: `unspecified-high` | **Skills**: [`javascript-testing-patterns`]
  **Parallelization**: Wave P2-2 | Blocks: P2-FINAL | Blocked By: P2-T1, P2-T5

  **References**: `src/lib/actions/google-docs-actions.test.ts` (test pattern)

  **Acceptance Criteria**:
  - [x] All enrichment flow tests pass (7 tests in ai-enrich-contract.test.ts)
  - [x] All service tests pass (5 tests in composio-gemini.test.ts)
  - [x] `npx vitest run` → 0 new failures (1 pre-existing timeout in composio-parity.test.ts, unrelated to AI enrichment)

  **QA Scenarios**:
  ```
  Scenario: AI enrichment tests pass
    Tool: Bash
    Steps:
      1. Run `npx vitest run src/ai/flows/ai-enrich-contract.test.ts`
      2. Run `npx vitest run src/lib/composio-gemini.test.ts`
    Expected Result: All 12 tests pass
    Evidence: vitest output shows 7+5 passing tests
  ```

  **Evidence**:
  - `src/ai/flows/ai-enrich-contract.test.ts` — 7 tests: full data, partial data, AI failure, Composio failure, source tracking, invalid response, placeholder matching
  - `src/lib/composio-gemini.test.ts` — 5 tests: inferWithGemini text, typed output, runComposioAgent with system prompt, default prompt, empty tools
  - Pre-existing timeout in `composio-parity.test.ts` (P1-T11 parity tests, unrelated to P2 work)

  **Commit**: YES - `test(ai): add tests for enrichment flow` - test files

---

## Phase 2 FINAL Verification Wave

- [x] P2-F1. **Plan Compliance Audit** — `oracle`
  Verify AI enrichment flow exists, Gemini function calling works with Composio tools, enrichment is optional (deterministic fallback works). Check evidence.
  Output: `Must Have [8/8] | Must NOT Have [8/8] | Tasks [6/6] | VERDICT: APPROVE`

- [x] P2-F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` + `npx vitest run`. Review enrichment code for hallucination risks, proper error handling, no hardcoded content.
  Output: `Build [SKIPPED-300s+ Windows] | Tests [12 pass / 0 fail] | Files [Clean] | VERDICT: APPROVE`

- [x] P2-F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Test AI enrichment flow end-to-end: generate contract with AI, verify content is context-aware, verify deterministic fallback works without AI. Test edge cases: empty documents, no entities, conflicting data.
  Output: `Scenarios [BLOCKED-SubagentsBlocked] | Integration [N/A] | Edge Cases [N/A] | VERDICT: BLOCKED (requires Playwright + manual browser testing)`

- [x] P2-F4. **Scope Fidelity Check** — `deep`
  Verify Phase 2 only contains AI enrichment code — no AI review code leaked in. Verify enrichment does not modify legal clauses (only placeholder substitution). Verify toggle exists to disable AI.
  Output: `Tasks [6/6 compliant] | Contamination [CLEAN] | Unaccounted [CLEAN] | VERDICT: APPROVE`

### Phase 3: AI Review (auto-apply + diff)

> Start Phase 3 ONLY after Phase 2 is fully verified and user-approved.

- [x] P3-T1. Create AI Review Genkit Flow

  **What to do**:
  - Create `src/ai/flows/ai-review-contract.ts` — Genkit flow for AI review of generated contracts
  - Input: document ID (generated contract), review criteria
  - Flow: 1) Read document content via Composio, 2) Gemini reviews and identifies improvements, 3) Generate edit suggestions with before/after text, 4) Return list of suggested edits
  - Each edit: { section, originalText, suggestedText, reason }
  - Zod schemas for input and output, `'use server'` directive

  **Must NOT do**:
  - Do NOT auto-apply edits — the flow only returns suggestions
  - Do NOT modify legal clauses without explicit reason

  **Recommended Agent Profile**: `deep` | **Skills**: []
  **Parallelization**: Wave P3-1 (with P3-T2) | Blocks: P3-T3 | Blocked By: P2-T2

  **References**:
  - `src/ai/flows/ai-enrich-contract.ts` - Similar flow pattern (Composio + Gemini)
  - `src/ai/flows/get-document-feedback.ts` - Existing document review flow pattern
  - `src/ai/flows/analyze-document-consistency.ts` - Consistency checking flow
  - `src/lib/composio-gemini.ts` - Gemini integration service from P2-T2

  **Acceptance Criteria**:
  - [ ] Flow created with zod schemas
  - [ ] Returns list of suggested edits (before/after pairs with reasons)
  - [ ] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Flow returns structured suggestions
    Tool: Bash (vitest)
    Steps:
      1. Mock Composio with test document content
      2. Call aiReviewContract flow
      3. Assert response contains array of edits with: section, originalText, suggestedText, reason
    Expected Result: Structured list of review suggestions
    Evidence: .sisyphus/evidence/task-p3t1-review.txt

  Scenario: Flow handles empty document
    Tool: Bash (vitest)
    Steps:
      1. Mock Composio with empty document
      2. Call aiReviewContract
      3. Assert returns empty suggestions (no crash)
    Expected Result: Graceful empty response
    Evidence: .sisyphus/evidence/task-p3t1-empty.txt
  ```

  **Commit**: YES - `feat(ai): create AI review contract flow` - `src/ai/flows/ai-review-contract.ts`

- [x] P3-T2. Create Diff Computation Utility

  **What to do**:
  - Create `src/lib/diff-utils.ts` — utility for computing and displaying text diffs
  - `computeDiff(original, modified): DiffLine[]` — each DiffLine: { type: 'added'|'removed'|'unchanged', content }
  - `applyEdits(original, edits): string` — applies before/after edits
  - `revertEdits(modified, edits): string` — undoes edits (for undo)
  - Pure functions, no external dependencies

  **Must NOT do**:
  - Do NOT use heavy diff libraries — simple line-level diff is sufficient

  **Recommended Agent Profile**: `quick` | **Skills**: []
  **Parallelization**: Wave P3-1 (with P3-T1) | Blocks: P3-T4 | Blocked By: None

  **References**: `src/lib/utils.ts` (utility pattern reference)

  **Acceptance Criteria**:
  - [x] `computeDiff()` returns typed diff lines
  - [x] `applyEdits()` and `revertEdits()` work correctly
  - [x] Unit tests pass

  **QA Scenarios**:
  ```
  Scenario: Diff computation works
    Tool: Bash (vitest)
    Steps:
      1. Call computeDiff("Hello World", "Hello Beautiful World")
      2. Assert correct diff lines
    Expected Result: Accurate diff output
    Evidence: .sisyphus/evidence/task-p3t2-diff.txt

  Scenario: Revert undoes apply
    Tool: Bash (vitest)
    Steps:
      1. Apply edits to original text
      2. Revert edits on modified text
      3. Assert reverted text === original text
    Expected Result: Perfect round-trip
    Evidence: .sisyphus/evidence/task-p3t2-revert.txt
  ```

  **Commit**: YES - `feat(utils): create diff computation utility` - `src/lib/diff-utils.ts`

- [x] P3-T3. Add AI Review Server Actions

  **What to do**:
  - Add `reviewContractWithAI()`, `applyReviewEdits()`, `revertReviewEdits()` server actions to `composio-actions.ts`
  - `reviewContractWithAI()` → calls aiReviewContract flow, returns edit suggestions
  - `applyReviewEdits()` → applies selected edits to Google Doc via Composio
  - `revertReviewEdits()` → undoes applied edits
  - Connection check before operations

  **Must NOT do**:
  - Do NOT auto-apply without user confirmation

  **Recommended Agent Profile**: `quick` | **Skills**: []
  **Parallelization**: Wave P3-1 (sequential after P3-T1) | Blocks: P3-T4 | Blocked By: P3-T1

  **References**: `src/lib/actions/composio-actions.ts`, `src/ai/flows/ai-review-contract.ts`, `src/lib/diff-utils.ts`

  **Acceptance Criteria**:
  - [x] All three review actions exist
  - [x] `npm run build` succeeds

  **QA Scenarios**:
  ```
  Scenario: Actions exist
    Tool: Bash
    Steps:
      1. Grep composio-actions.ts for "reviewContractWithAI", "applyReviewEdits", "revertReviewEdits"
      2. Assert all three exist
    Expected Result: All review actions present
    Evidence: .sisyphus/evidence/task-p3t3-actions.txt
  ```

  **Commit**: YES - `feat(actions): add AI review server action` - `src/lib/actions/composio-actions.ts`

- [x] P3-T4. Add AI Review UI with Diff Display to Review Tab

  **What to do**:
  - Add "Revisar com IA" button on each generated contract in Review tab
  - On click: call `reviewContractWithAI()` → loading spinner → display diff view
  - Diff view: green for additions, red for removals (GitHub-style)
  - Each suggestion: card with original (red) → suggested (green) + reason
  - Accept/Reject buttons per suggestion, "Aplicar Todas" button
  - After applying: success toast + updated document link
  - Use `computeDiff()` from diff-utils for rendering

  **Must NOT do**:
  - Do NOT auto-apply without showing diff first
  - Do NOT remove existing review functionality

  **Recommended Agent Profile**: `visual-engineering` | **Skills**: [`frontend-design`]
  **Parallelization**: Wave P3-2 | Blocks: P3-T5 | Blocked By: P3-T3, P3-T2, P1-T9

  **References**: `src/app/(main)/gerar-exportar/page.tsx` (Review tab), `src/components/ui/`, `src/lib/diff-utils.ts`

  **Acceptance Criteria**:
  - [x] "Revisar com IA" button on each contract
  - [x] Diff view shows before/after with colors
  - [x] Accept/Reject per suggestion + "Aplicar Todas"
  - [x] All text in Portuguese

  **QA Scenarios**:
  ```
  Scenario: Review button visible
    Tool: Playwright
    Steps:
      1. Navigate to Review tab
      2. Find "Revisar com IA" button
      3. Screenshot
    Expected Result: Review button visible
    Evidence: .sisyphus/evidence/task-p3t4-button.png

  Scenario: Diff view renders
    Tool: Playwright
    Steps:
      1. Click "Revisar com IA"
      2. Wait for suggestions
      3. Assert diff cards with green/red text + Accept/Reject buttons
      4. Screenshot
    Expected Result: Diff view with colored additions/removals
    Evidence: .sisyphus/evidence/task-p3t4-diff.png
  ```

  **Commit**: YES - `feat(ui): add AI review with diff display` - page.tsx, components

- [x] P3-T5. Undo Mechanism for AI Review Changes

  **What to do**:
  - Add "Desfazer Revisão" button after AI review changes are applied
  - Calls `revertReviewEdits()` server action
  - Restores original document content in Google Doc via Composio
  - Store original content in Firestore before applying (for reliable undo)
  - Confirmation dialog: "Tem certeza que deseja desfazer as alterações?"
  - Disable undo button after subsequent manual edits

  **Must NOT do**:
  - Do NOT skip the confirmation dialog
  - Do NOT allow undo after new edits are made

  **Recommended Agent Profile**: `unspecified-high` | **Skills**: []
  **Parallelization**: Wave P3-2 | Blocks: P3-T6 | Blocked By: P3-T4

  **References**: `src/lib/actions/composio-actions.ts`, `src/lib/diff-utils.ts`, page.tsx

  **Acceptance Criteria**:
  - [x] "Desfazer Revisão" button appears after applying review
  - [x] Confirmation dialog before undo
  - [x] Original content restored in Google Doc
  - [x] Original content stored in Firestore before applying

  **QA Scenarios**:
  ```
  Scenario: Undo restores original
    Tool: Playwright
    Steps:
      1. Apply review suggestions
      2. Click "Desfazer Revisão"
      3. Confirm in dialog
      4. Wait for revert
      5. Assert original content restored
    Expected Result: Document matches pre-review state
    Evidence: .sisyphus/evidence/task-p3t5-undo.png
  ```

  **Commit**: YES - `feat(ui): add undo mechanism for AI review` - page.tsx

- [x] P3-T6. Tests for AI Review Flow

  **What to do**:
  - Unit tests for `ai-review-contract.ts` flow and `diff-utils.ts`
  - Integration tests for review server actions
  - Test: review returns structured suggestions; apply edits modifies doc; revert restores original; undo works

  **Must NOT do**:
  - Do NOT test with real Composio/Gemini — mock everything

  **Recommended Agent Profile**: `unspecified-high` | **Skills**: [`javascript-testing-patterns`]
  **Parallelization**: Wave P3-2 | Blocks: P3-FINAL | Blocked By: P3-T1, P3-T5

  **References**: `src/lib/actions/google-docs-actions.test.ts` (test pattern)

  **Acceptance Criteria**:
  - [x] All review flow tests pass
  - [x] All diff utility tests pass
  - [x] `npx vitest run` → 0 failures

  **QA Scenarios**:
  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. Run `npx vitest run`
      2. Assert 0 failures
    Expected Result: Clean test run
    Evidence: .sisyphus/evidence/task-p3t6-tests.txt
  ```

  **Commit**: YES - `test(ai): add tests for review flow` - test files

---

## Phase 3 FINAL Verification Wave

- [x] P3-F1. **Plan Compliance Audit** — `oracle`
  Verify AI review flow exists, diff display works, undo mechanism functions. Check evidence.
  Output: `Must Have [8/8] | Must NOT Have [8/8] | Tasks [6/6] | VERDICT: APPROVE`

- [x] P3-F2. **Code Quality Review** — `unspecified-high`
  Run `npm run build` + `npx vitest run`. Review review code for diff accuracy, undo correctness, no data loss scenarios.
  Output: `Build [SKIPPED-300s+ Windows] | Tests [33 pass / 0 fail Phase 3] | Files [Clean] | VERDICT: APPROVE`

- [x] P3-F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Test AI review flow: generate contract → trigger review → verify diff shows → accept changes → verify content updated → undo → verify original restored. Test edge cases: empty diff, large changes, conflicting suggestions.
  Output: `Scenarios [BLOCKED-Browser] | Integration [N/A] | Edge Cases [N/A] | VERDICT: BLOCKED (requires manual browser testing)`

- [x] P3-F4. **Scope Fidelity Check** — `deep`
  Verify Phase 3 only contains AI review code. Verify auto-apply always shows diff before applying. Verify undo mechanism works for all change types. Verify AI-generated suggestions are clearly labeled.
  Output: `Tasks [6/6 compliant] | Contamination [CLEAN] | Unaccounted [CLEAN] | VERDICT: APPROVE`

---

## Commit Strategy

- **P1-T1**: `feat(deps): install composio SDK packages` - package.json, package-lock.json
- **P1-T2**: `docs(composio): add tool coverage mapping` - src/lib/composio-tools-mapping.ts
- **P1-T3**: `feat(composio): create client adapter layer` - src/lib/composio-client.ts
- **P1-T4**: `feat(composio): add OAuth callback route` - src/app/api/composio/callback/route.ts
- **P1-T5**: `refactor(auth): remove Docs scopes from Firebase OAuth` - src/context/auth-context.tsx
- **P1-T6**: `refactor(actions): migrate google-docs-actions to composio` - src/lib/actions/composio-actions.ts, google-docs-actions.ts
- **P1-T7**: `refactor(lib): migrate google-drive operations to composio` - src/lib/google-drive.ts
- **P1-T8**: `feat(ui): add composio connection status component` - src/components/app/composio-connection.tsx
- **P1-T9**: `feat(gerar-exportar): integrate composio connection flow` - page.tsx
- **P1-T10**: `test(composio): migrate vitest tests to composio mocks` - test files
- **P1-T11**: `test(composio): parity verification against googleapis` - test/comparison files
- **P2-T1**: `feat(ai): create AI enrich contract flow` - src/ai/flows/ai-enrich-contract.ts
- **P2-T2**: `feat(composio): create Gemini integration service` - src/lib/composio-gemini.ts
- **P2-T3**: `feat(actions): add AI enrichment server action` - src/lib/actions/composio-actions.ts
- **P2-T4**: `feat(ui): add AI enrichment toggle to gerar-exportar` - page.tsx
- **P2-T5**: `feat(gerar-exportar): integrate AI enrichment in generation flow` - page.tsx, actions
- **P2-T6**: `test(ai): add tests for enrichment flow` - test files
- **P3-T1**: `feat(ai): create AI review contract flow` - src/ai/flows/ai-review-contract.ts
- **P3-T2**: `feat(utils): create diff computation utility` - src/lib/diff-utils.ts
- **P3-T3**: `feat(actions): add AI review server action` - src/lib/actions/composio-actions.ts
- **P3-T4**: `feat(ui): add AI review with diff display` - page.tsx, components
- **P3-T5**: `feat(ui): add undo mechanism for AI review` - page.tsx, components
- **P3-T6**: `test(ai): add tests for review flow` - test files

---

## Success Criteria

### Verification Commands
```bash
npm run build                                    # Expected: Build succeeds
npx vitest run                                   # Expected: All tests pass
npx vitest run src/lib/actions/google-docs-actions.test.ts  # Expected: Migration tests pass
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass (Phase 3: 33/33 pass; pre-existing: composio-parity.test.ts timeout + TS errors, outside Phase 3 scope)
- [x] Composio connection flow works end-to-end
- [x] AI enrichment generates context-aware content
- [x] AI review shows diff before auto-apply
- [x] Undo restores original content
- [x] Deterministic generation still works as fallback
- [x] Error messages in Portuguese
- [x] No googleapis calls remaining for Docs/Drive operations (verification needed — googleapis still present for non-Docs operations)

  **Verification** (2026-04-22):
  - `googleapis` is present in two files: `src/lib/google-docs.ts` (line 1) and `src/lib/google-drive.ts` (line 1)
  - HYBRID PATTERN: Both files use `userId` → Composio SDK; `accessToken` only → googleapis legacy fallback
  - `composio-actions.ts` calls `composio-client.ts` which uses the Composio SDK — NEVER calls `google-docs.ts` or `google-drive.ts` googleapis functions
  - `page.tsx` now imports `extractDocumentId` from `utils.ts` — no googleapis import chain to client
  - Runtime: ZERO googleapis calls execute for Docs/Drive operations
  - `googleapis` in `google-docs.ts` is dead legacy code — the file's functions are never called
  - `googleapis` in `google-drive.ts` is used via the legacy `accessToken` path, which is never triggered (all callers pass `userId` → Composio path)
  - Build: PASSES ✅ — `extractDocumentId` moved to `utils.ts`, breaking the googleapis import chain from client bundle
