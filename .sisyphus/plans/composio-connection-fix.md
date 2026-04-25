# Fix Composio Google Connection Error

## TL;DR

> **Fix the "Server Components render" error when connecting Google via Composio.** The root cause is a `'use server'` directive on `composio-client.ts` that exports non-function types (interfaces), which violates Next.js App Router's server action contract. Additionally, the Composio SDK API calls use incorrect method signatures (`executeToolCall` with `any` cast instead of `tools.execute()`).

> **Deliverables**:
> - Remove `'use server'` from `composio-client.ts` (make it a regular server module)
> - Fix Composio SDK API calls to use correct `tools.execute()` method
> - Remove unused `GoogleProvider` parameter from tool execution
> - Add error logging to `checkComposioConnectionStatus`
> - Fix `initiateConnection` return value handling
> - Verify build and type-check pass
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Tasks 3-5 → Task 6

---

## Context

### Original Request
User sees error: "Connection error — Google account connection failed. Try again. An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details."

### Interview Summary
**Key Discussions**:
- Error occurs when trying to connect Google account via Composio on the "Gerar e Exportar" page
- The app has a full Composio integration for Google Docs/Drive operations
- Composio SDK v0.6.10 is installed

**Research Findings**:
- **CRITICAL**: `composio-client.ts` has `'use server'` at line 1 but exports interfaces (`ComposioClientConfig`, `ComposioClient`) and types (`ConnectionStatus`) — non-function exports violate the `'use server'` contract and cause Server Components render errors
- **CRITICAL**: SDK API mismatch — uses `(composio as any).executeToolCall()` but the correct v0.6.x API is `composio.tools.execute(slug, body, modifiers)`
- **HIGH**: Global singleton pattern may cause issues in serverless environments
- **MEDIUM**: `NEXT_PUBLIC_APP_URL` defaults to localhost, breaking production OAuth
- **MEDIUM**: `checkComposioConnectionStatus` swallows all errors silently

### Metis Review
**Identified Gaps** (addressed):
- `'use server'` on composio-client.ts is PRIMARY cause — validated
- `executeToolCall` API is incorrect — validated that correct API is `composio.tools.execute()`
- `GoogleProvider` is unused in correct API flow — should be removed
- `connectedAccounts.initiate()` returns `ConnectionRequest` object, not string — code handles both patterns but should be explicit
- `connectedAccounts.list()` return type filtering may need adjustment
- Missing build/typecheck verification — added as acceptance criteria
- Missing runtime verification steps — added as QA scenarios

---

## Work Objectives

### Core Objective
Fix the Composio Google connection error so users can successfully connect their Google account and generate contracts.

### Concrete Deliverables
- `src/lib/composio-client.ts` — removed `'use server'`, fixed SDK API calls, improved error handling
- `src/lib/actions/composio-connection-actions.ts` — added error logging
- Build passes (`next build` succeeds)
- Type-check passes (`tsc --noEmit` succeeds)
- Connection flow works end-to-end (page loads, button click → OAuth redirect → callback → active status)

### Definition of Done
- [ ] `npm run build` completes without errors
- [ ] `npx tsc --noEmit` passes
- [ ] "Gerar e Exportar" page loads without Server Components render error
- [ ] "Connect Google" button click redirects to Composio OAuth
- [ ] OAuth callback processes successfully
- [ ] Error logs appear in server console when connection fails (not silently swallowed)

### Must Have
- `'use server'` removed from `composio-client.ts`
- Correct Composio SDK API calls (`tools.execute()` not `executeToolCall()`)
- Error logging in connection status check
- Build and type-check pass
- App loads without Server Components render error

### Must NOT Have (Guardrails)
- Do NOT add `'use server'` to `composio-types.ts` — it's a pure type file
- Do NOT modify client component `composio-connection.tsx` UI — it correctly uses `'use client'`
- Do NOT modify the OAuth callback route (`/api/composio/callback/route.ts`) — it's correctly structured
- Do NOT refactor `composio-actions.ts` (925 lines) — out of scope, only import path changes needed
- Do NOT upgrade Composio SDK version — fix for current v0.6.x only
- Do NOT add new features (retry logic, better error UI, etc.)
- Do NOT touch AI flow files (`ai-enrich-contract.ts`, `ai-review-contract.ts`)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest configured)
- **Automated tests**: YES (tests-after) — existing test file `composio-actions.test.ts` should continue passing
- **Framework**: vitest
- **Primary QA**: Agent-Executed QA Scenarios (Playwright for browser, Bash for build/typecheck)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation fix):
├── Task 1: Remove 'use server' from composio-client.ts [quick]
└── Task 2: Fix SDK API calls (executeToolCall → tools.execute) [deep]

Wave 2 (After Wave 1 — hardening + verification):
├── Task 3: Add error logging to composio-connection-actions.ts [quick]
├── Task 4: Fix initiateConnection return handling + remove GoogleProvider [quick]
└── Task 5: Add NEXT_PUBLIC_APP_URL production warning [quick]

Wave 3 (After Wave 2 — build verification):
└── Task 6: Build + typecheck verification [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: Task 1 → Task 2 → Task 6 → F1-F4 → user okay
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 2 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 | — | 2, 6 |
| 2 | 1 | 6 |
| 3 | — | 6 |
| 4 | 2 | 6 |
| 5 | — | 6 |
| 6 | 1, 2, 3, 4, 5 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: 2 tasks — T1 → `quick`, T2 → `deep`
- **Wave 2**: 3 tasks — T3 → `quick`, T4 → `quick`, T5 → `quick`
- **Wave 3**: 1 task — T6 → `quick`
- **FINAL**: 4 tasks — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Remove `'use server'` directive from composio-client.ts

  **What to do**:
  - Remove the `'use server'` directive from line 1 of `src/lib/composio-client.ts`
  - This file is a server utility module, NOT a server actions module — it exports interfaces (`ComposioClientConfig`, `ComposioClient`), types (`ConnectionStatus`), and factory functions. The `'use server'` directive makes Next.js treat ALL exports as server actions, which cannot serialize interfaces/types, causing the "Server Components render" error.
  - Ensure `composio-connection-actions.ts` (which has its own `'use server'`) can still import `createComposioClient` from `composio-client.ts` — this works because server actions can import from regular server modules.
  - Ensure `composio-actions.ts` (which has `'use server'`) can still import `createComposioClient` and `ConnectionStatus` from `composio-client.ts` — same pattern, works correctly.
  - Verify that `ConnectionStatus` type export from `composio-client.ts` line 16 (`export type { ConnectionStatus } from './composio-types'`) is still valid — it should be, since type-only exports are erased at runtime.

  **Must NOT do**:
  - Do NOT add `'use server'` to `composio-types.ts`
  - Do NOT change any client component imports
  - Do NOT modify the `composio-connection-actions.ts` `'use server'` directive

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2 blocked by this)
  - **Parallel Group**: Wave 1 (with Task 2, but Task 2 depends on this)
  - **Blocks**: Task 2, Task 6
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL — Be Exhaustive):

  **Pattern References**:
  - `src/lib/actions/composio-connection-actions.ts:1` — Has `'use server'` directive correctly (it only exports async functions). Use this as the REFERENCE for how `'use server'` should be used.
  - `src/lib/actions/composio-actions.ts:1` — Has `'use server'` and imports from `composio-client.ts`. After removing `'use server'` from composio-client.ts, this import still works because composio-client.ts becomes a regular server module.

  **API/Type References**:
  - `src/lib/composio-client.ts:1` — The `'use server'` line to REMOVE
  - `src/lib/composio-client.ts:16` — `export type { ConnectionStatus }` — type-only export, safe
  - `src/lib/composio-client.ts:22-28` — `ComposioClientConfig` interface — non-function export that violates `'use server'`
  - `src/lib/composio-client.ts:30-45` — `ComposioClient` interface — non-function export that violates `'use server'`
  - `src/lib/composio-client.ts:106` — `createComposioClient` — the only valid server action export

  **WHY Each Reference Matters**:
  - `composio-connection-actions.ts:1` — Shows the CORRECT pattern: `'use server'` on files that ONLY export async functions
  - `composio-client.ts:1` — This is the bug: `'use server'` on a file that exports interfaces = Server Components render error
  - `composio-client.ts:22-45` — These interfaces can't be serialized as server actions = NEXT.js crash

  **Acceptance Criteria**:
  - [ ] `src/lib/composio-client.ts` has NO `'use server'` directive
  - [ ] `src/lib/composio-client.ts` still exports `ComposioClientConfig`, `ComposioClient`, `createComposioClient`, `ConnectionStatus`
  - [ ] `npx tsc --noEmit` passes (no type errors from import changes)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: TypeScript compilation after removing 'use server'
    Tool: Bash
    Preconditions: File composio-client.ts has 'use server' removed
    Steps:
      1. Run `npx tsc --noEmit` in project root
      2. Check for any import resolution errors related to composio-client.ts
    Expected Result: 0 TypeScript errors
    Failure Indicators: Any error mentioning composio-client, ComposioClient, or ConnectionStatus
    Evidence: .sisyphus/evidence/task-1-tsc-compilation.txt

  Scenario: 'use server' removal verification
    Tool: Bash
    Preconditions: composio-client.ts has been edited
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "'use server'"`
      2. Verify NO matches found
    Expected Result: No `'use server'` string in composio-client.ts
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-1-use-server-removal.txt
  ```

  **Commit**: YES (groups with 2, 3, 4, 5)
  - Message: `fix(composio): remove 'use server' and fix SDK API calls for Google connection`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 2. Fix Composio SDK API calls (`executeToolCall` → `tools.execute`)

  **What to do**:
  - Replace all `executeToolCall()` calls in `composio-client.ts` with the correct Composio SDK v0.6.x API: `composio.tools.execute(slug, body, modifiers)`
  - The current code (lines 74-94) uses `(composio as any).executeToolCall(userId, { name: toolName, arguments: JSON.stringify(params) }, { connectedAccountId })` — this is incorrect
  - The correct API signature is: `composio.tools.execute(toolSlug, { connectedAccountId }, { userId })` where `toolSlug` is a string like `'google_googleadocsgetdocs'`
  - Update the `executeToolCall` helper function to use `composio.tools.execute()` instead
  - Remove the `provider` parameter from `executeToolCall` function signature — it's unused in the correct API
  - Remove `getGoogleProvider()` function and `globalGoogleProvider` variable — `GoogleProvider` is not needed for direct tool execution
  - Remove `import { GoogleProvider } from '@composio/google'` — unused after API fix
  - Update all callers of `executeToolCall` in the `createComposioClient` return object to remove the `provider` argument
  - Fix `getConnectedAccountId()` to use the correct SDK API: `composio.connectedAccounts.list({ entityId: userId })` or similar

  **Must NOT do**:
  - Do NOT upgrade the Composio SDK version
  - Do NOT add new Composio tool methods beyond what currently exists
  - Do NOT modify the `composio-connection-actions.ts` imports (they don't import `executeToolCall` directly)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: []
  - **Reason**: SDK API research required, need to understand correct v0.6.x signatures

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1 for `'use server'` removal)
  - **Parallel Group**: Wave 1 (sequential after Task 1)
  - **Blocks**: Task 4, Task 6
  - **Blocked By**: Task 1

  **References** (CRITICAL — Be Exhaustive):

  **Pattern References**:
  - `src/lib/composio-client.ts:74-94` — The `executeToolCall` helper function to REPLACE
  - `src/lib/composio-client.ts:106-314` — The `createComposioClient` function that calls `executeToolCall` in every method
  - `src/lib/composio-tools-mapping.ts:16-28` — `COMPOSIO_GOOGLE_TOOLS` constants — these ARE the correct tool slugs (e.g., `'google_googleadocsgetdocs'`)

  **API/Type References**:
  - `src/lib/composio-client.ts:51-68` — Global singletons to refactor (`globalComposioInstance`, `globalGoogleProvider`)
  - `src/lib/composio-client.ts:134-149` — `getDocumentContent` method — calls `executeToolCall(composio, provider, userId, COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT, ...)` — change to `composio.tools.execute(COMPOSIO_GOOGLE_TOOLS.DOCS_GET_DOCUMENT, ...)`
  - `src/lib/composio-client.ts:161-177` — `batchUpdateDocument` method — calls `executeToolCall`
  - `src/lib/composio-client.ts:184-203` — `getFileMetadata` method — calls `executeToolCall`
  - `src/lib/composio-client.ts:206-221` — `copyFile` method — calls `executeToolCall`
  - `src/lib/composio-client.ts:224-247` — `shareFile` method — calls `executeToolCall`
  - `src/lib/composio-client.ts:114-127` — `getConnectedAccountId` — uses `(composio.connectedAccounts as any).list({ userId })` — verify correct API

  **External References**:
  - Composio SDK v0.6.x API: `composio.tools.execute(slug, body, modifiers)` is the correct method for direct tool execution
  - `connectedAccounts.list({ entityId })` or `connectedAccounts.list({ userId })` returns connected accounts for a user

  **WHY Each Reference Matters**:
  - `composio-client.ts:74-94` — This is the INCORRECT helper to replace. Every method in `createComposioClient` delegates to this function.
  - `composio-tools-mapping.ts:16-28` — Contains the correct tool slugs that `tools.execute()` expects. These ARE the right tool names.
  - `composio-client.ts:51-68` — `globalGoogleProvider` is unused after the API fix and should be removed.

  **Acceptance Criteria**:
  - [ ] No `(composio as any).executeToolCall()` calls remain in the codebase
  - [ ] `executeToolCall` helper function removed or replaced with correct API call
  - [ ] `GoogleProvider` import and `globalGoogleProvider` variable removed
  - [ ] `getGoogleProvider()` function removed
  - [ ] `provider` parameter removed from all method calls in `createComposioClient`
  - [ ] All tool execution uses `composio.tools.execute(slug, body, modifiers)` pattern
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: TypeScript compilation after SDK API fix
    Tool: Bash
    Preconditions: Task 1 and Task 2 changes applied
    Steps:
      1. Run `npx tsc --noEmit` in project root
      2. Verify no TypeScript errors related to Composio
    Expected Result: 0 TypeScript errors
    Failure Indicators: Any error about executeToolCall, GoogleProvider, or ComposioClient
    Evidence: .sisyphus/evidence/task-2-tsc-after-api-fix.txt

  Scenario: No 'executeToolCall' or 'GoogleProvider' references remain
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "executeToolCall|GoogleProvider|globalGoogleProvider|getGoogleProvider"`
      2. Verify NO matches found
    Expected Result: No references to removed API patterns
    Failure Indicators: Any match found
    Evidence: .sisyphus/evidence/task-2-no-stale-references.txt

  Scenario: tools.execute pattern is correctly used
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "tools\.execute"`
      2. Verify matches found for each tool call (getDocumentContent, batchUpdate, etc.)
    Expected Result: At least 5 matches for `tools.execute` (one per tool method)
    Failure Indicators: Less than 5 matches, or matches still using old API
    Evidence: .sisyphus/evidence/task-2-tools-execute-pattern.txt
  ```

  **Commit**: YES (groups with 1, 3, 4, 5)
  - Message: `fix(composio): remove 'use server' and fix SDK API calls for Google connection`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `npx tsc --noEmit`

- [ ] 3. Add error logging to composio-connection-actions.ts

  **What to do**:
  - In `src/lib/actions/composio-connection-actions.ts`, update the `checkComposioConnectionStatus` function (lines 15-24) to log errors before returning `FAILED` status
  - Change from: silent `catch` that returns `{ connected: false, status: 'FAILED' }`
  - Change to: `console.error('[Composio] checkComposioConnectionStatus error:', error)` before returning the FAILED status
  - Also add more descriptive error logging in `initiateComposioConnection` (line 38 already has `console.error`, but enhance the error message with userId context)

  **Must NOT do**:
  - Do NOT change the return type or status values
  - Do NOT add new status types
  - Do NOT modify the client component error handling

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 1-2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 6
  - **Blocked By**: None (can start immediately, but practically after Task 2 for clean diffs)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/lib/actions/composio-connection-actions.ts:15-24` — The `checkComposioConnectionStatus` function with silent catch
  - `src/lib/actions/composio-connection-actions.ts:30-42` — The `initiateComposioConnection` function (already has error logging, enhance it)

  **WHY Each Reference Matters**:
  - Line 22: Currently `catch { return { connected: false, status: 'FAILED' }; }` — swallows ALL errors silently. This is why debugging the connection error was so hard.

  **Acceptance Criteria**:
  - [ ] `checkComposioConnectionStatus` logs errors with `console.error` before returning FAILED
  - [ ] Error messages include the userId for traceability
  - [ ] Return values unchanged (same types and statuses)

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Error logging exists in checkComposioConnectionStatus
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/actions/composio-connection-actions.ts" -Pattern "console\.error.*Composio.*checkConnection"`
      2. Verify match found in catch block
    Expected Result: One or more console.error calls in the catch block
    Failure Indicators: No matches, or matches outside catch block
    Evidence: .sisyphus/evidence/task-3-error-logging.txt

  Scenario: TypeScript compilation after changes
    Tool: Bash
    Preconditions: All Wave 1-2 changes applied
    Steps:
      1. Run `npx tsc --noEmit`
      2. Verify 0 errors
    Expected Result: Clean compilation
    Evidence: .sisyphus/evidence/task-3-tsc.txt
  ```

  **Commit**: YES (groups with 1, 2, 4, 5)
  - Message: `fix(composio): remove 'use server' and fix SDK API calls for Google connection`
  - Files: `src/lib/actions/composio-connection-actions.ts`

- [ ] 4. Fix `initiateConnection` return handling and clean up `connectedAccounts.list` call

  **What to do**:
  - In `src/lib/composio-client.ts`, fix the `initiateConnection` method (lines 277-303):
    - Replace the guessed property access (`(connectionRequest as any)?.redirectUrl || (connectionRequest as any)?.url`) with explicit `connectionRequest.redirectUrl`
    - Add a `console.info` log showing the redirect URL for debugging
    - Handle the case where `connectionRequest.redirectUrl` might be undefined (return empty string with error)
  - Fix `getConnectedAccountId` method (lines 114-127):
    - Remove `(composio.connectedAccounts as any)` cast
    - Use proper typing: `composio.connectedAccounts.list({ entityId: userId })`
    - The return value is an array of connected accounts; filter by the correct property name (`integrationId` or `providerId` containing 'google', not `integrationType`)
    - Add error logging in the catch block

  **Must NOT do**:
  - Do NOT change the overall flow (initiate → redirect → callback → status check)
  - Do NOT modify the callback route handler
  - Do NOT change the `ComposioConnection` client component

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 3, 5)
  - **Parallel Group**: Wave 2 (with Tasks 3, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 2 (SDK API changes affect same file)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/lib/composio-client.ts:114-127` — `getConnectedAccountId` method with `(composio.connectedAccounts as any)` cast and `integrationType === 'google'` filter
  - `src/lib/composio-client.ts:277-303` — `initiateConnection` method with defensive `(connectionRequest as any)?.redirectUrl` access
  - `src/lib/composio-client.ts:253-275` — `getConnectionStatus` method with similar `(composio.connectedAccounts as any).list()` cast

  **WHY Each Reference Matters**:
  - `getConnectedAccountId` uses `(composio.connectedAccounts as any)` — the `any` cast hides API issues. Need to use correct SDK types.
  - `initiateConnection` lines 294-298 — defensive property access suggests uncertainty about SDK response shape. Need to use the documented `.redirectUrl` property.

  **Acceptance Criteria**:
  - [ ] No `(composio.connectedAccounts as any)` casts remain in composio-client.ts
  - [ ] `initiateConnection` uses `connectionRequest.redirectUrl` explicitly (not `as any` access)
  - [ ] Error logging added in `getConnectedAccountId` and `initiateConnection` catch blocks
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: No 'as any' casts on Composio SDK calls
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "as any"`
      2. Verify no matches related to Composio SDK calls
    Expected Result: Zero `as any` casts on composio.connectedAccounts or composio.tools
    Failure Indicators: Any `as any` cast on composio SDK objects
    Evidence: .sisyphus/evidence/task-4-no-as-any.txt

  Scenario: initiateConnection uses explicit redirectUrl
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "redirectUrl"`
      2. Verify `connectionRequest.redirectUrl` is used (not `(connectionRequest as any)?.redirectUrl`)
    Expected Result: Direct property access without `as any` cast
    Failure Indicators: Any `as any` in redirectUrl access
    Evidence: .sisyphus/evidence/task-4-redirect-url.txt
  ```

  **Commit**: YES (groups with 1, 2, 3, 5)
  - Message: `fix(composio): remove 'use server' and fix SDK API calls for Google connection`
  - Files: `src/lib/composio-client.ts`

- [ ] 5. Add NEXT_PUBLIC_APP_URL production warning and singleton reset

  **What to do**:
  - In `src/lib/composio-client.ts`, add a development warning when `NEXT_PUBLIC_APP_URL` is not set or is `localhost`:
    ```typescript
    const callbackUrl = config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/composio/callback`;
    if (process.env.NODE_ENV === 'production' && (!process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL.includes('localhost'))) {
      console.warn('[Composio] NEXT_PUBLIC_APP_URL is not set or points to localhost. OAuth callbacks will fail in production.');
    }
    ```
  - Refactor the global singleton pattern to use `globalThis` for Next.js serverless compatibility:
    ```typescript
    const globalForComposio = globalThis as typeof globalThis & {
      __composioInstance?: Composio;
    };
    ```
    This prevents stale instances across HMR in dev and ensures each serverless invocation can initialize properly.

  **Must NOT do**:
  - Do NOT change the default callback URL behavior (localhost fallback is needed for dev)
  - Do NOT add runtime environment validation that blocks startup
  - Do NOT add a new env var validation library

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 3, 4)
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 6
  - **Blocked By**: None (independent file changes)

  **References** (CRITICAL):

  **Pattern References**:
  - `src/lib/composio-client.ts:51-68` — Current global singleton pattern using module-level `let` variables
  - `src/lib/composio-client.ts:286` — Callback URL construction with localhost fallback
  - `src/firebase/firebase.ts` or similar — Look for existing `globalThis` patterns in the project for consistency

  **WHY Each Reference Matters**:
  - Lines 51-68: `globalComposioInstance` and `globalGoogleProvider` use module-level `let`, which doesn't persist across Next.js serverless invocations. Using `globalThis` is the recommended pattern.
  - Line 286: The localhost fallback is fine for dev but silently fails in production. A warning helps debugging.

  **Acceptance Criteria**:
  - [ ] `NEXT_PUBLIC_APP_URL` warning logged when missing or localhost in production
  - [ ] Composio instance stored on `globalThis` instead of module-level variable
  - [ ] `npx tsc --noEmit` passes

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Production warning for localhost callback URL
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "NEXT_PUBLIC_APP_URL.*localhost|localhost.*production"`
      2. Verify warning exists
    Expected Result: Found a console.warn or similar check for localhost in production
    Failure Indicators: No production warning for localhost callback URL
    Evidence: .sisyphus/evidence/task-5-prod-warning.txt

  Scenario: globalThis singleton pattern
    Tool: Bash
    Preconditions: Code changes applied
    Steps:
      1. Run `Select-String -Path "src/lib/composio-client.ts" -Pattern "globalThis|__composio"`
      2. Verify globalThis-based singleton pattern exists
    Expected Result: Composio instance stored on globalThis, not module-level `let`
    Failure Indicators: Still using `let globalComposioInstance` pattern
    Evidence: .sisyphus/evidence/task-5-globalthis-pattern.txt
  ```

  **Commit**: YES (groups with 1, 2, 3, 4)
  - Message: `fix(composio): remove 'use server' and fix SDK API calls for Google connection`
  - Files: `src/lib/composio-client.ts`

- [ ] 6. Build and type-check verification

  **What to do**:
  - Run `npx tsc --noEmit` and verify 0 errors
  - Run `npm run build` and verify successful build
  - Run `npx vitest run` and verify all existing tests pass
  - Check that `src/lib/composio-client.ts` does NOT have `'use server'`
  - Check that `src/lib/actions/composio-connection-actions.ts` STILL has `'use server'`
  - Check that `src/lib/actions/composio-actions.ts` STILL has `'use server'`
  - Search for any remaining `as any` casts on `composio` object in `src/lib/composio-client.ts`
  - Search for any remaining `executeToolCall` references
  - Search for any remaining `GoogleProvider` imports

  **Must NOT do**:
  - Do NOT modify any code — this is verification only
  - Do NOT skip any check

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on ALL previous tasks)
  - **Parallel Group**: Wave 3 (after Wave 2)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2, 3, 4, 5

  **References**:

  **Pattern References**:
  - `src/lib/composio-client.ts` — Main file to verify
  - `src/lib/actions/composio-connection-actions.ts` — Must preserve `'use server'`

  **Acceptance Criteria**:
  - [ ] `npx tsc --noEmit` returns 0 errors
  - [ ] `npm run build` succeeds
  - [ ] `npx vitest run` passes
  - [ ] No `'use server'` in composio-client.ts
  - [ ] `'use server'` preserved in composio-connection-actions.ts and composio-actions.ts
  - [ ] No `executeToolCall` references in composio-client.ts
  - [ ] No `GoogleProvider` imports in composio-client.ts
  - [ ] No `(composio.connectedAccounts as any)` casts in composio-client.ts

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full build verification
    Tool: Bash
    Preconditions: All code changes from Tasks 1-5 applied
    Steps:
      1. Run `npx tsc --noEmit` — verify 0 errors
      2. Run `npm run build` — verify success
      3. Run `npx vitest run` — verify all tests pass
    Expected Result: All three commands succeed without errors
    Failure Indicators: Any TypeScript errors, build failures, or test failures
    Evidence: .sisyphus/evidence/task-6-build-verification.txt

  Scenario: Code quality checks
    Tool: Bash
    Preconditions: All code changes applied
    Steps:
      1. Verify no 'use server' in composio-client.ts: `Select-String -Path "src/lib/composio-client.ts" -Pattern "'use server'"`
      2. Verify 'use server' preserved in composio-connection-actions.ts: `Select-String -Path "src/lib/actions/composio-connection-actions.ts" -Pattern "'use server'"`
      3. Verify no executeToolCall: `Select-String -Path "src/lib/composio-client.ts" -Pattern "executeToolCall"`
      4. Verify no GoogleProvider: `Select-String -Path "src/lib/composio-client.ts" -Pattern "GoogleProvider"`
      5. Verify no 'as any' on composio: `Select-String -Path "src/lib/composio-client.ts" -Pattern "composio.*as any|connectedAccounts.*as any"`
    Expected Result: Step 1: no matches. Step 2: match found. Steps 3-5: no matches.
    Failure Indicators: Any unexpected matches
    Evidence: .sisyphus/evidence/task-6-code-quality.txt
  ```

  **Commit**: NO (verification only, changes already committed with Tasks 1-5)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + `npm run build` + `npx vitest run`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if needed)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: disconnected state, invalid env vars. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Commit 1**: `fix(composio): remove 'use server' and fix SDK API calls for Google connection` — composio-client.ts, composio-connection-actions.ts, composio-types.ts
  - Pre-commit: `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit          # Expected: 0 errors
npm run build             # Expected: successful build
npx vitest run            # Expected: existing tests pass
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] `composio-client.ts` has NO `'use server'` directive
- [ ] `composio-client.ts` uses `composio.tools.execute()` instead of `executeToolCall()`
- [ ] `composio-connection-actions.ts` logs errors instead of silently swallowing
- [ ] Build succeeds without Server Components render errors