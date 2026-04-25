# Fix "Conectar Google" Server Components Render Error

## TL;DR

> **Quick Summary**: Fix the Server Components render error that occurs when clicking "Conectar Google" by adding missing environment variables, removing a spurious `'use server'` directive, adding error handling to the unprotected server action, and adding an error boundary for graceful error display.
> 
> **Deliverables**:
> - `.env.local` updated with `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` and `NEXT_PUBLIC_APP_URL`
> - `composio-types.ts` cleaned up (remove `'use server'`, fix contradictory comment)
> - `composio-connection-actions.ts` updated with try/catch for `initiateComposioConnection`
> - `composio-client.ts` updated with `NEXT_PUBLIC_APP_URL` fallback
> - `error.tsx` added at `(main)` route for graceful error handling
> 
> **Estimated Effort**: Quick (5 small file changes, ~30 min total)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5

---

## Context

### Original Request
User reported error when clicking "Conectar Google": shows "❌ Erro na conexão / Não foi possível conectar sua conta Google. Tente novamente." with a Next.js Server Components render error.

### Interview Summary
**Root Cause Analysis**:
- **PRIMARY**: `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` missing from `.env.local` — `composio-client.ts:279-285` throws immediately
- **SECONDARY**: `NEXT_PUBLIC_APP_URL` missing — line 286 constructs `undefined/api/composio/callback`
- **TERTIARY**: `'use server'` directive on `composio-types.ts` contradicts its own comment and serves no purpose for a types-only file
- **QUATERNARY**: No `error.tsx` boundary — Server Component errors show generic Next.js error page
- **QUINARY**: `initiateComposioConnection` server action has no try/catch — errors propagate as unhandled Server Components render errors

**Research Findings**:
- The app uses Composio for Google Docs/Drive OAuth (separate from Firebase Auth)
- `checkComposioConnectionStatus` HAS try/catch, but `initiateComposioConnection` does NOT
- The Composio API key (`ak_pV1Sby-_bW-IqgBXfTPC`) IS set in `.env.local`

### Metis Review
**Identified Gaps** (addressed):
- Missing env vars are the direct cause — confirmed via code inspection
- `'use server'` on types file is contradictory (line 1 has directive, line 4 comment says it doesn't)
- No try/catch on `initiateComposioConnection` means errors become Server Components render errors instead of graceful toasts
- No fallback for `NEXT_PUBLIC_APP_URL` in production code (test file has fallback but not the actual code)

---

## Work Objectives

### Core Objective
Fix the "Conectar Google" button error so users can successfully initiate the Composio Google OAuth flow, and ensure Server Component errors are displayed gracefully.

### Concrete Deliverables
- `.env.local` with two new required variables
- `composio-types.ts` without `'use server'` directive
- `composio-connection-actions.ts` with proper error handling
- `composio-client.ts` with URL fallback
- `src/app/(main)/error.tsx` error boundary

### Definition of Done
- [ ] App starts without errors (`npm run dev` succeeds)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit` passes)
- [ ] `"use server"` not found in `composio-types.ts`
- [ ] `NEXT_PUBLIC_APP_URL` fallback present in `composio-client.ts`
- [ ] `initiateComposioConnection` has try/catch in `composio-connection-actions.ts`
- [ ] `error.tsx` exists at `src/app/(main)/`
- [ ] Missing env var yields user-friendly error (no Server Components render crash)

### Must Have
- `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` in `.env.local`
- `NEXT_PUBLIC_APP_URL` in `.env.local`
- `'use server'` removed from `composio-types.ts`
- try/catch added to `initiateComposioConnection`
- URL fallback in `composio-client.ts`
- Error boundary at `(main)` route level

### Must NOT Have (Guardrails)
- Do NOT refactor `composio-client.ts` beyond the specific fixes (fallback URL, error handling in `initiateConnection`)
- Do NOT add retry logic, connection polling, or reconnection features
- Do NOT modify the callback route handler (`/api/composio/callback/route.ts`)
- Do NOT change the UI design of the `ComposioConnection` component
- Do NOT modify Firebase Auth flows (they work fine)
- Do NOT add logging/monitoring infrastructure beyond what's already there
- Do NOT add a `.env.example` file (nice to have but not the bug fix)
- Do NOT expose sensitive env var values in error messages

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest.config.ts present)
- **Automated tests**: YES (tests-after — fix bug first, add targeted tests)
- **Framework**: vitest

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **API/Server Actions**: Use Bash — call server actions, assert error responses
- **TypeScript**: Use Bash — `npx tsc --noEmit` for type checking
- **File checks**: Use Bash — grep/ls for file existence and content verification

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - quick fixes):
├── Task 1: Fix composio-types.ts — remove 'use server' [quick]
├── Task 2: Fix composio-client.ts — add NEXT_PUBLIC_APP_URL fallback [quick]
└── Task 3: Add env vars to .env.local [quick]

Wave 2 (After Wave 1 - error handling + boundary):
├── Task 4: Add try/catch to initiateComposioConnection [quick]
└── Task 5: Add error.tsx boundary at (main) route [quick]

Wave 3 (After Wave 2 - verification):
├── Task 6: Build + type check verification [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → (parallel) → Task 4, 5 → Task 6 → F1-F4
Parallel Speedup: ~50% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| 1 | — | 6 |
| 2 | — | 6 |
| 3 | — | 4, 5, 6 |
| 4 | 3 | 6 |
| 5 | — | 6 |
| 6 | 1, 2, 3, 4, 5 | F1-F4 |

### Agent Dispatch Summary

- **W1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **W2**: **2** — T4 → `quick`, T5 → `quick`
- **W3**: **1** — T6 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [ ] 1. Remove `'use server'` directive from `composio-types.ts`

  **What to do**:
  - Remove `'use server';` from line 1 of `src/lib/composio-types.ts`
  - Update the contradictory comment on line 4 (which says "This file has NO 'use server' directive") to be accurate — remove or update to say this is a shared types file
  - The file should export only the `ConnectionStatus` type with no directives

  **Must NOT do**:
  - Do NOT add any other changes to this file
  - Do NOT move the type to another file
  - Do NOT add runtime code to this types file

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `src/lib/composio-types.ts:1-8` — Current file with `'use server'` on line 1 and contradictory comment on line 4
  - `src/lib/composio-client.ts:13` — How `ConnectionStatus` is imported: `import type { ConnectionStatus } from './composio-types'`

  **API/Type References** (contracts to implement against):
  - `src/lib/composio-types.ts:8` — `export type ConnectionStatus = 'ACTIVE' | 'INITIATED' | 'EXPIRED' | 'FAILED' | 'INACTIVE'`

  **External References**:
  - Next.js docs: `'use server'` directive should only be on files with server actions (async functions), not on type-only files

  **WHY Each Reference Matters**:
  - The `'use server'` directive on a types-only file is semantically wrong and can cause bundler issues
  - The import on line 13 of `composio-client.ts` uses `import type` which is safe even after removal
  - The `composio-connection.tsx` also imports `import type { ConnectionStatus }` so removing the directive won't break imports

  **Acceptance Criteria**:

  - [ ] `grep -n "'use server'" src/lib/composio-types.ts` returns no output
  - [ ] `npx tsc --noEmit` passes with 0 errors
  - [ ] File still exports `ConnectionStatus` type unchanged

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Type-only file has no 'use server' directive
    Tool: Bash (grep)
    Preconditions: File exists at src/lib/composio-types.ts
    Steps:
      1. Run: grep -c "'use server'" src/lib/composio-types.ts
      2. Assert output is "0" (no matches)
    Expected Result: Zero matches for 'use server' in the file
    Failure Indicators: grep returns count > 0
    Evidence: .sisyphus/evidence/task-1-no-use-server.txt

  Scenario: TypeScript still compiles after change
    Tool: Bash (npx tsc)
    Preconditions: File has been modified
    Steps:
      1. Run: npx tsc --noEmit 2>&1
      2. Check exit code is 0
    Expected Result: TypeScript compilation succeeds with no errors
    Failure Indicators: Exit code != 0, type errors in output
    Evidence: .sisyphus/evidence/task-1-tsc-output.txt
  ```

  **Commit**: YES (groups with Task 2)
  - Message: `fix(composio): remove spurious 'use server' from types file`
  - Files: `src/lib/composio-types.ts`

- [ ] 2. Add `NEXT_PUBLIC_APP_URL` fallback in `composio-client.ts`

  **What to do**:
  - In `src/lib/composio-client.ts`, line 286, change the callback URL construction from:
    ```
    const callbackUrl = config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/composio/callback`;
    ```
    to:
    ```
    const callbackUrl = config.callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/composio/callback`;
    ```
  - This prevents the callback URL from being `undefined/api/composio/callback` when the env var is missing

  **Must NOT do**:
  - Do NOT change any other logic in `composio-client.ts`
  - Do NOT add retry or timeout logic
  - Do NOT modify the `createComposioClient` function signature

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `src/lib/actions/composio-connection-actions.ts:15-24` — Shows how `checkComposioConnectionStatus` handles errors with try/catch returning a structured result

  **API/Type References** (contracts to implement against):
  - `src/lib/composio-client.ts:277-303` — The `initiateConnection` method that constructs the callback URL

  **External References**:
  - Next.js docs: `NEXT_PUBLIC_` env vars are available on both server and client; server-only vars like `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` are server-only

  **WHY Each Reference Matters**:
  - The fallback matches the local dev URL (`http://localhost:3000`) which is where the app runs during development
  - The test file already uses this fallback pattern, confirming it's the right default

  **Acceptance Criteria**:

  - [ ] `grep -n "NEXT_PUBLIC_APP_URL" src/lib/composio-client.ts` shows the line with `|| 'http://localhost:3000'`
  - [ ] `npx tsc --noEmit` passes with 0 errors

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Fallback URL is used when NEXT_PUBLIC_APP_URL is missing
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -n "NEXT_PUBLIC_APP_URL" src/lib/composio-client.ts
      2. Verify the line contains "|| 'http://localhost:3000'"
    Expected Result: Line 286 contains the fallback pattern
    Failure Indicators: Pattern not found, or fallback missing
    Evidence: .sisyphus/evidence/task-2-url-fallback.txt

  Scenario: TypeScript still compiles after change
    Tool: Bash (npx tsc)
    Preconditions: File has been modified
    Steps:
      1. Run: npx tsc --noEmit 2>&1
      2. Check exit code is 0
    Expected Result: TypeScript compilation succeeds
    Failure Indicators: Exit code != 0
    Evidence: .sisyphus/evidence/task-2-tsc-output.txt
  ```

  **Commit**: YES (groups with Task 1)
  - Message: `fix(composio): add NEXT_PUBLIC_APP_URL fallback for callback URL`
  - Files: `src/lib/composio-client.ts`

- [ ] 3. Add required Composio env vars to `.env.local`

  **What to do**:
  - Add `COMPOSIO_GOOGLE_AUTH_CONFIG_ID=<VALUE_NEEDED_FROM_USER>` to `.env.local`
  - Add `NEXT_PUBLIC_APP_URL=http://localhost:3000` to `.env.local`
  - **IMPORTANT**: The `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` value MUST come from the Composio dashboard at https://app.composio.dev. The user needs to create a Google integration there and copy the auth config ID.
  - Add a comment above `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` explaining where to find the value: `# Get this from https://app.composio.dev -> Integrations -> Google -> Auth Config ID`
  - Add a comment above `NEXT_PUBLIC_APP_URL` explaining: `# Base URL of the app (used for OAuth callbacks)`

  **Must NOT do**:
  - Do NOT modify any existing env vars
  - Do NOT add a `.env.example` file (out of scope)
  - Do NOT regenerate or change the `COMPOSIO_API_KEY`

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 4 (needs env vars to be in place for testing error handling)
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `.env.local:19` — Existing `COMPOSIO_API_KEY` line showing the pattern
  - `.env.local:23-28` — Existing `NEXT_PUBLIC_FIREBASE_*` vars showing how `NEXT_PUBLIC_` vars are formatted

  **API/Type References** (contracts to implement against):
  - `src/lib/composio-client.ts:279-285` — Code that checks `process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID`
  - `src/lib/composio-client.ts:286` — Code that uses `process.env.NEXT_PUBLIC_APP_URL`

  **External References**:
  - Composio dashboard: https://app.composio.dev — where the auth config ID is created

  **WHY Each Reference Matters**:
  - The `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` is the PRIMARY root cause — without it, the `initiateConnection` method throws immediately
  - The `NEXT_PUBLIC_APP_URL` is SECONDARY — without it, the callback URL is `undefined/api/composio/callback` which breaks OAuth redirects
  - The comments help future developers understand where to get these values

  **Acceptance Criteria**:

  - [ ] `grep "COMPOSIO_GOOGLE_AUTH_CONFIG_ID" .env.local` returns a line with a value (not just a comment)
  - [ ] `grep "NEXT_PUBLIC_APP_URL" .env.local` returns `http://localhost:3000`
  - [ ] App starts with `npm run dev` without env-related errors

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Environment variables are present in .env.local
    Tool: Bash (grep)
    Preconditions: .env.local modified
    Steps:
      1. Run: grep "COMPOSIO_GOOGLE_AUTH_CONFIG_ID" .env.local
      2. Assert: Output contains a non-empty value after the = sign
      3. Run: grep "NEXT_PUBLIC_APP_URL" .env.local
      4. Assert: Output contains "http://localhost:3000"
    Expected Result: Both env vars are present with valid values
    Failure Indicators: Either var is missing or has empty value
    Evidence: .sisyphus/evidence/task-3-env-vars.txt

  Scenario: App starts successfully with new env vars
    Tool: Bash (npm)
    Preconditions: Env vars added
    Steps:
      1. Run: npm run dev (start dev server)
      2. Wait 15 seconds for startup
      3. Check server is responding on port 3000
      4. Kill dev server
    Expected Result: Dev server starts without env-related errors
    Failure Indicators: Server crashes, env var errors in console
    Evidence: .sisyphus/evidence/task-3-dev-server.txt
  ```

  **Commit**: YES
  - Message: `fix(env): add required Composio OAuth env vars`
  - Files: `.env.local`

- [ ] 4. Add try/catch to `initiateComposioConnection` server action

  **What to do**:
  - In `src/lib/actions/composio-connection-actions.ts`, wrap the `initiateComposioConnection` function body in a try/catch block
  - The current code (lines 30-35) is:
    ```typescript
    export async function initiateComposioConnection(
      userId: string
    ): Promise<{ redirectUrl: string }> {
      const client = await createComposioClient(userId);
      const redirectUrl = await client.initiateConnection(userId);
      return { redirectUrl };
    }
    ```
  - Change it to match the error handling pattern already in `checkComposioConnectionStatus` (lines 15-24):
    ```typescript
    export async function initiateComposioConnection(
      userId: string
    ): Promise<{ redirectUrl: string } | { error: string }> {
      try {
        const client = await createComposioClient(userId);
        const redirectUrl = await client.initiateConnection(userId);
        return { redirectUrl };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Google. Tente novamente.';
        console.error('[Composio] initiateComposioConnection error:', error);
        return { error: errorMsg };
      }
    }
    ```
  - Also update the client component `composio-connection.tsx` to handle the new `{ error }` return type
  - In `src/components/app/composio-connection.tsx`, the `initiateConnection` function (lines 117-135) needs to check for `{ error }` in the result:
    ```typescript
    async function initiateConnection() {
      if (!user) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await initiateComposioConnection(user.uid);
        if ('error' in result && result.error) {
          setState({ status: 'FAILED', loading: false, error: result.error });
          toast({
            variant: 'destructive',
            title: 'Erro ao conectar',
            description: result.error,
          });
          return;
        }
        // Redirect to Composio OAuth
        window.location.href = result.redirectUrl;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Erro ao iniciar conexão';
        setState({ status: 'FAILED', loading: false, error: errorMsg });
        toast({
          variant: 'destructive',
          title: 'Erro ao conectar',
          description: errorMsg,
        });
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    }
    ```

  **Must NOT do**:
  - Do NOT change the return type of `initiateComposioConnection` to throw errors (the point is to catch them)
  - Do NOT add retry logic
  - Do NOT modify the callback route handler
  - Do NOT change the `checkComposioConnectionStatus` function (it already has try/catch)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 3 (env vars need to be in place, though this works regardless)

  **References**:

  **Pattern References** (existing code to follow):
  - `src/lib/actions/composio-connection-actions.ts:15-24` — `checkComposioConnectionStatus` shows the exact error handling pattern to replicate
  - `src/components/app/composio-connection.tsx:103-115` — `checkConnectionStatus` shows how the client handles error states

  **API/Type References** (contracts to implement against):
  - `src/lib/composio-client.ts:277-303` — `initiateConnection` method that throws errors including "COMPOSIO_GOOGLE_AUTH_CONFIG_ID not set" and "Falha ao iniciar conexão"

  **WHY Each Reference Matters**:
  - The `checkComposioConnectionStatus` function is the EXACT pattern to follow for error handling
  - The client component already handles error states — we need to make the server action return structured errors instead of throwing

  **Acceptance Criteria**:

  - [ ] `initiateComposioConnection` has try/catch wrapping the entire function body
  - [ ] Return type includes `{ error: string }` union type
  - [ ] Client component handles `{ error }` return type from the action
  - [ ] `npx tsc --noEmit` passes with 0 errors

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Server action returns structured error instead of throwing
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -A5 "initiateComposioConnection" src/lib/actions/composio-connection-actions.ts
      2. Verify try/catch is present
      3. Verify return type includes | { error: string }
    Expected Result: Function body wrapped in try/catch returning { error } on failure
    Failure Indicators: No try/catch found, or function still throws
    Evidence: .sisyphus/evidence/task-4-error-handling.txt

  Scenario: Client component handles error response
    Tool: Bash (grep)
    Preconditions: File modified
    Steps:
      1. Run: grep -n "error" src/components/app/composio-connection.tsx
      2. Verify there's a check for 'error' in the result from initiateComposioConnection
    Expected Result: Client checks for { error } in server action response
    Failure Indicators: No error check found in initiateConnection client function
    Evidence: .sisyphus/evidence/task-4-client-error-handling.txt

  Scenario: TypeScript compiles after changes
    Tool: Bash (npx tsc)
    Preconditions: Both files modified
    Steps:
      1. Run: npx tsc --noEmit 2>&1
      2. Check exit code is 0
    Expected Result: No TypeScript errors
    Failure Indicators: Type errors related to return type or error handling
    Evidence: .sisyphus/evidence/task-4-tsc-output.txt
  ```

  **Commit**: YES
  - Message: `fix(composio): add error handling to initiateComposioConnection server action`
  - Files: `src/lib/actions/composio-connection-actions.ts`, `src/components/app/composio-connection.tsx`

- [ ] 5. Add `error.tsx` error boundary at `(main)` route

  **What to do**:
  - Create `src/app/(main)/error.tsx` with a user-friendly error boundary
  - This catches Server Components render errors and displays them gracefully instead of showing the raw Next.js error page
  - The error boundary should:
    - Accept `error` and `reset` props (standard Next.js error boundary)
    - Show a user-friendly Portuguese message: "Algo deu errado" (Something went wrong)
    - Include a "Tentar novamente" (Try again) button that calls `reset()`
    - Log the error to console for debugging
    - Match the app's design using existing Shadcn/ui components

  **Implementation**:
  ```tsx
  'use client';

  import { useEffect } from 'react';
  import { Button } from '@/components/ui/button';

  export default function Error({
    error,
    reset,
  }: {
    error: Error & { digest?: string };
    reset: () => void;
  }) {
    useEffect(() => {
      console.error('[MainRoute Error]', error);
    }, [error]);

    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-2xl font-bold">Algo deu errado</h2>
        <p className="text-muted-foreground">
          Ocorreu um erro inesperado. Tente novamente.
        </p>
        <Button onClick={reset}>Tentar novamente</Button>
      </div>
    );
  }
  ```

  **Must NOT do**:
  - Do NOT add complex error tracking/logging infrastructure
  - Do NOT modify the global `error.tsx` at `src/app/` level (if it exists)
  - Do NOT add retry logic beyond the `reset()` button
  - Do NOT use any components not already in the project

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `src/components/ui/button.tsx` — Existing Shadcn UI button component
  - `src/app/layout.tsx` — Current root layout for design context

  **API/Type References** (contracts to implement against):
  - Next.js Error Boundary: https://nextjs.org/docs/app/building-your-application/routing/error-handling

  **External References**:
  - Next.js error.tsx convention: Must be a Client Component ('use client'), receives `error` and `reset` props

  **WHY Each Reference Matters**:
  - Error boundary catches Server Components render errors — this is the primary missing piece causing the raw Next.js error display
  - Using existing UI components (Button) keeps the design consistent
  - The Portuguese messages match the app's localization

  **Acceptance Criteria**:

  - [ ] `src/app/(main)/error.tsx` file exists
  - [ ] File starts with `'use client'` directive
  - [ ] Contains a "Tentar novamente" button that calls `reset()`
  - [ ] `npx tsc --noEmit` passes with 0 errors

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Error boundary file exists and is valid
    Tool: Bash (ls + grep)
    Preconditions: File created
    Steps:
      1. Check file exists: ls "src/app/(main)/error.tsx"
      2. Check 'use client' directive: grep "'use client'" "src/app/(main)/error.tsx"
      3. Check reset button: grep "reset" "src/app/(main)/error.tsx"
    Expected Result: File exists with client directive and reset button
    Failure Indicators: File missing, no client directive, no reset
    Evidence: .sisyphus/evidence/task-5-error-boundary.txt

  Scenario: TypeScript compiles with error boundary
    Tool: Bash (npx tsc)
    Preconditions: All previous tasks complete
    Steps:
      1. Run: npx tsc --noEmit 2>&1
      2. Check exit code is 0
    Expected Result: No TypeScript errors
    Failure Indicators: Type errors in error.tsx
    Evidence: .sisyphus/evidence/task-5-tsc-output.txt
  ```

  **Commit**: YES
  - Message: `fix(ui): add error boundary for (main) route`
  - Files: `src/app/(main)/error.tsx`

- [ ] 6. Build + type check verification

  **What to do**:
  - Run `npx tsc --noEmit` and verify 0 errors
  - Run `npm run build` and verify it succeeds
  - Verify all previous changes are correct by running all QA scenarios

  **Must NOT do**:
  - Do NOT fix any newly discovered issues (create follow-up tasks instead)
  - Do NOT modify code — only verify

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (alone)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2, 3, 4, 5

  **References**:

  **Pattern References**:
  - This project uses `vitest.config.ts` for tests
  - `next.config.ts` for Next.js config
  - `tsconfig.json` for TypeScript config

  **Acceptance Criteria**:

  - [ ] `npx tsc --noEmit` exits with code 0
  - [ ] `npm run build` succeeds
  - [ ] `grep "'use server'" src/lib/composio-types.ts` returns no output
  - [ ] `grep "NEXT_PUBLIC_APP_URL" src/lib/composio-client.ts` shows fallback
  - [ ] `grep -A5 "initiateComposioConnection" src/lib/actions/composio-connection-actions.ts` shows try/catch
  - [ ] `ls "src/app/(main)/error.tsx"` file exists
  - [ ] `grep "NEXT_PUBLIC_APP_URL" .env.local` shows value
  - [ ] `grep "COMPOSIO_GOOGLE_AUTH_CONFIG_ID" .env.local` shows value

  **QA Scenarios (MANDATORY)**:

  ```
  Scenario: Full TypeScript compilation passes
    Tool: Bash (npx tsc)
    Preconditions: All previous tasks completed
    Steps:
      1. Run: npx tsc --noEmit 2>&1
      2. Check exit code is 0
    Expected Result: 0 errors, exit code 0
    Failure Indicators: Type errors found
    Evidence: .sisyphus/evidence/task-6-tsc-output.txt

  Scenario: All changes verified with grep
    Tool: Bash (grep)
    Preconditions: All previous tasks completed
    Steps:
      1. Verify: grep "'use server'" src/lib/composio-types.ts → empty
      2. Verify: grep "NEXT_PUBLIC_APP_URL" src/lib/composio-client.ts → shows fallback
      3. Verify: grep "try" src/lib/actions/composio-connection-actions.ts → shows try/catch
      4. Verify: ls "src/app/(main)/error.tsx" → file exists
      5. Verify: grep "COMPOSIO_GOOGLE_AUTH_CONFIG_ID" .env.local → has value
    Expected Result: All 5 verifications pass
    Failure Indicators: Any verification fails
    Evidence: .sisyphus/evidence/task-6-verification.txt
  ```

  **Commit**: NO (verification only, no code changes)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npx tsc --noEmit` + linter. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Types [N errors] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start dev server. Verify the "Conectar Google" button renders correctly. Test error path: with missing env var, verify graceful error message appears (not Server Components render crash). Verify `error.tsx` catches unexpected errors. Test TypeScript compilation passes. Save evidence to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `fix(composio): remove spurious 'use server' from types file` — `src/lib/composio-types.ts`
- **2**: `fix(composio): add NEXT_PUBLIC_APP_URL fallback for callback URL` — `src/lib/composio-client.ts`
- **3**: `fix(env): add required Composio env vars` — `.env.local`
- **4**: `fix(composio): add error handling to initiateComposioConnection server action` — `src/lib/actions/composio-connection-actions.ts`
- **5**: `fix(ui): add error boundary for (main) route` — `src/app/(main)/error.tsx`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit                                          # Expected: 0 errors
grep -n "'use server'" src/lib/composio-types.ts          # Expected: no output
grep -n "NEXT_PUBLIC_APP_URL" src/lib/composio-client.ts   # Expected: line with fallback
grep -A5 "initiateComposioConnection" src/lib/actions/composio-connection-actions.ts  # Expected: try/catch
ls "src/app/(main)/error.tsx"                              # Expected: file exists
npm run dev                                                 # Expected: starts without errors
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] TypeScript compiles with 0 errors
- [ ] Clicking "Conectar Google" with missing env vars shows user-friendly error (no Server Components crash)
- [ ] `'use server'` removed from composio-types.ts
- [ ] NEXT_PUBLIC_APP_URL fallback present in composio-client.ts