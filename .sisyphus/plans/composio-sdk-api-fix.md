# Fix Composio Google Connection: SDK API Parameter Mismatch

## TL;DR

> **Quick Summary**: Fix 3 bugs in `composio-client.ts` where SDK API parameter names are wrong, causing the "Falha ao iniciar conexão com Google" error. The primary bug passes `{ redirectUri }` instead of `{ callbackUrl }` to `connectedAccounts.initiate()`, so the OAuth callback URL is never sent to Composio.
> 
> **Deliverables**:
> - Fix `initiate()` call to use `{ callbackUrl }` instead of `{ redirectUri }`
> - Fix `list()` calls to use `{ userIds: [userId] }` instead of `{ entityId: userId }`
> - Improve error propagation to show original SDK error messages
> - Pass `allowMultiple: true` to prevent `MultipleConnectedAccountsError`
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - single file, sequential changes
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request
User received "❌ Erro na conexão - Não foi possível conectar sua conta Google. Tente novamente. Falha ao iniciar conexão com Google. Tente novamente." when clicking "Conectar Google" button.

### Root Cause Analysis

The Composio SDK v0.6.10 uses specific parameter names validated by Zod schemas. Our code uses **wrong parameter names** that are silently stripped by Zod's `safeParse`, causing the API calls to fail or behave incorrectly.

**Bug #1 (CRITICAL)**: `initiate()` receives `{ redirectUri: callbackUrl }` but SDK expects `{ callbackUrl: value }` (`CreateConnectedAccountOptionsSchema`). Result: `callback_url` sent as `undefined` → OAuth flow breaks.

**Bug #2 (MEDIUM)**: `list()` receives `{ entityId: userId }` but SDK expects `{ userIds: [userId] }` (`ConnectedAccountListParamsSchema`). Result: All accounts returned unfiltered → wrong account selected, connection status wrong.

**Bug #3 (LOW)**: Generic Portuguese error message hides SDK-specific errors like `ComposioMultipleConnectedAccountsError`, making debugging impossible.

### SDK Evidence

From `node_modules/@composio/core/dist/index.mjs`:
```javascript
// CreateConnectedAccountOptionsSchema (line ~2757)
CreateConnectedAccountOptionsSchema = z.object({
  allowMultiple: z.boolean().optional(),
  callbackUrl: z.string().optional(),    // ← NOT "redirectUri"
  config: ConnectionDataSchema.optional(),
  alias: z.string().optional()
});

// ConnectedAccountListParamsSchema (line ~2692)
// Valid params: authConfigIds, cursor, limit, orderBy, statuses, toolkitSlugs, userIds
// NOT: entityId
```

### Metis Review
**Identified Gaps** (addressed):
- Silent Zod stripping of unknown keys could mask other parameter mismatches → Checked all SDK calls
- `allowMultiple` option missing → Added to prevent account conflicts
- Error messages too generic → Improved propagation

---

## Work Objectives

### Core Objective
Fix SDK API parameter mismatches so the Google OAuth connection flow works end-to-end.

### Concrete Deliverables
- `src/lib/composio-client.ts`: 4 specific fixes (callbackUrl, userIds, allowMultiple, error propagation)
- `src/lib/actions/composio-connection-actions.ts`: Improved error message in `initiateComposioConnection`

### Definition of Done
- [ ] Clicking "Conectar Google" calls `connectedAccounts.initiate()` with correct parameters
- [ ] SDK receives `callbackUrl` correctly → OAuth redirects to our `/api/composio/callback`
- [ ] `getConnectionStatus()` and `getConnectedAccountId()` filter by correct `userIds` param
- [ ] `npm run build` passes with no new type errors
- [ ] Error messages show original Composio error alongside Portuguese user-facing message

### Must Have
- Fix `{ redirectUri }` → `{ callbackUrl }` in `initiate()` call
- Fix `{ entityId }` → `{ userIds: [...] }` in `list()` calls
- Add `allowMultiple: true` to `initiate()` options
- Propagate original SDK error messages for debugging

### Must NOT Have (Guardrails)
- Do NOT upgrade Composio SDK version
- Do NOT modify `composio-connection.tsx` (client component)
- Do NOT modify `/api/composio/callback/route.ts`
- Do NOT modify `composio-actions.ts` (925 lines, out of scope)
- Do NOT modify `composio-tools-mapping.ts` (tool slugs)
- Do NOT add `'use server'` to `composio-types.ts`
- Do NOT touch AI flow files

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (vitest configured)
- **Automated tests**: Tests-after (existing test file exists)
- **Framework**: vitest
- **Pre-existing test**: `src/__tests__/composio-parity.test.ts` (18 type errors + 1 timeout — pre-existing, out of scope)

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Fix SDK API calls — sequential, single file):
├── Task 1: Fix initiate() parameter name [quick]
├── Task 2: Fix list() parameter name [quick]
└── Task 3: Improve error propagation + add allowMultiple [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Runtime QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1**: - → 2, 3
- **2**: 1 → 3
- **3**: 2 → F1-F4

### Agent Dispatch Summary
- **Wave 1**: 3 tasks — T1 `quick`, T2 `quick`, T3 `quick` (but sequential)

---

## TODOs

- [x] 1. Fix `initiate()` parameter: `{ redirectUri }` → `{ callbackUrl }`

  **What to do**:
  - In `src/lib/composio-client.ts`, line 276, change:
    ```typescript
    // BEFORE (wrong property name):
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      { redirectUri: callbackUrl }
    );
    
    // AFTER (correct property name per SDK schema):
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      { callbackUrl: callbackUrl }
    );
    ```
  - Also add `allowMultiple: true` to the options object to prevent `ComposioMultipleConnectedAccountsError`:
    ```typescript
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      { callbackUrl: callbackUrl, allowMultiple: true }
    );
    ```

  **Must NOT do**:
  - Do NOT change the variable name `callbackUrl` — only the object property
  - Do NOT add any new imports
  - Do NOT modify any other methods

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (must be first, other fixes depend on correct understanding)
  - **Parallel Group**: Sequential (Wave 1, Task 1)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `node_modules/@composio/core/dist/index.mjs:2757` — SDK's `initiate()` method uses `options?.callbackUrl` (NOT `redirectUri`)
  - `node_modules/@composio/core/dist/index.mjs:~2769` — `connection.callback_url: options?.callbackUrl` confirms SDK reads `callbackUrl` property

  **API/Type References**:
  - `node_modules/@composio/core/dist/index.mjs:~CreateConnectedAccountOptionsSchema` — Zod schema: `{ allowMultiple, callbackUrl, config, alias }`

  **WHY Each Reference Matters**:
  - The SDK source proves that `callbackUrl` is the correct property name and `redirectUri` is silently ignored by Zod's `safeParse`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify callbackUrl parameter is passed correctly to SDK
    Tool: Bash
    Preconditions: Code change applied, build passes
    Steps:
      1. Search for "redirectUri" in src/lib/composio-client.ts — must find ZERO matches
      2. Search for "callbackUrl" in src/lib/composio-client.ts — must find the correct property in the initiate() call
      3. Run npx tsc --noEmit to verify no new type errors
      4. Run npm run build to verify build passes
    Expected Result: No "redirectUri" in the file, "callbackUrl" present in initiate() call, build green
    Failure Indicators: "redirectUri" still found, tsc errors, build failure
    Evidence: .sisyphus/evidence/task-1-callbackurl-fix.txt
  ```

  **Commit**: YES (groups with 2, 3)
  - Message: `fix(composio): fix SDK API parameter names for connection flow`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `npx tsc --noEmit`

---

- [x] 2. Fix `list()` parameter: `{ entityId }` → `{ userIds: [userId] }`

  **What to do**:
  - In `src/lib/composio-client.ts`, fix TWO locations where `entityId` is used:
  
  **Location 1** — `getConnectedAccountId()` method (~line 101):
    ```typescript
    // BEFORE:
    const accounts = await composio.connectedAccounts.list({ entityId: userId });
    
    // AFTER:
    const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
    ```
  
  **Location 2** — `getConnectionStatus()` method (~line 233):
    ```typescript
    // BEFORE:
    const accounts = await composio.connectedAccounts.list({ entityId: userId });
    
    // AFTER:
    const accounts = await composio.connectedAccounts.list({ userIds: [userId] });
    ```

  **Must NOT do**:
  - Do NOT change the return type or filtering logic
  - Do NOT modify `composio-connection.tsx`
  - Do NOT touch the `initiateConnection` method

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1 context)
  - **Parallel Group**: Sequential (Wave 1, Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `node_modules/@composio/core/dist/index.mjs:2689-2704` — SDK's `list()` method uses `parsedQuery.data.userIds` (array), NOT `entityId`

  **API/Type References**:
  - `ConnectedAccountListParamsSchema` — Zod schema accepts: `authConfigIds`, `cursor`, `limit`, `orderBy`, `statuses`, `toolkitSlugs`, `userIds`

  **WHY Each Reference Matters**:
  - The SDK source confirms `entityId` is not a valid parameter — it gets stripped by Zod, resulting in unfiltered queries returning ALL accounts instead of just the user's accounts

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify userIds parameter replaces entityId
    Tool: Bash
    Preconditions: Task 1 changes applied
    Steps:
      1. Search for "entityId" in src/lib/composio-client.ts — must find ZERO matches
      2. Search for "userIds" in src/lib/composio-client.ts — must find 2 occurrences in list() calls
      3. Verify both getConnectedAccountId() and getConnectionStatus() use { userIds: [userId] }
      4. Run npx tsc --noEmit — no new type errors
      5. Run npm run build — passes
    Expected Result: No "entityId" references, "userIds" array used in both list() calls, build green
    Failure Indicators: "entityId" still found, tsc errors, build failure
    Evidence: .sisyphus/evidence/task-2-userids-fix.txt
  ```

  **Commit**: YES (groups with 1, 3)
  - Message: `fix(composio): fix SDK API parameter names for connection flow`
  - Files: `src/lib/composio-client.ts`

---

- [x] 3. Improve error propagation and add authConfigId validation

  **What to do**:
  - In `src/lib/composio-client.ts`, `initiateConnection()` method, improve the catch block to propagate the original SDK error message for debugging:
    ```typescript
    // BEFORE:
    } catch (error) {
      console.error('[Composio] initiateConnection error:', error);
      throw new Error('Falha ao iniciar conexão com Google. Tente novamente.');
    }
    
    // AFTER:
    } catch (error) {
      const sdkMessage = error instanceof Error ? error.message : String(error);
      console.error('[Composio] initiateConnection error:', error);
      // Include original SDK error for debugging in server logs
      throw new Error(`Falha ao iniciar conexão com Google: ${sdkMessage}`);
    }
    ```

  - In `src/lib/actions/composio-connection-actions.ts`, improve error handling to preserve the full error message:
    ```typescript
    // BEFORE:
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Google. Tente novamente.';
      console.error('[Composio] initiateComposioConnection error:', error, { userId });
      return { error: errorMsg };
    }
    
    // AFTER (already correct — just verify it's right):
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Falha ao iniciar conexão com Google. Tente novamente.';
      console.error('[Composio] initiateComposioConnection error:', error, { userId });
      return { error: errorMsg };
    }
    ```
    The action already propagates `error.message` — the fix in composio-client.ts will ensure the message includes SDK details.

  **Must NOT do**:
  - Do NOT change the client component error handling
  - Do NOT add new error types or custom error classes
  - Do NOT remove the Portuguese user-facing message

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1 and 2)
  - **Parallel Group**: Sequential (Wave 1, Task 3)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:
  - `src/lib/composio-client.ts:284-286` — Current generic error catch
  - `src/lib/actions/composio-connection-actions.ts:38-42` — Server action catch block (already propagates error.message)

  **WHY Each Reference Matters**:
  - The current generic Portuguese message hides SDK-specific errors like `ComposioMultipleConnectedAccountsError`, making debugging impossible in production

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Error messages include original SDK error details
    Tool: Bash
    Preconditions: Tasks 1 and 2 changes applied
    Steps:
      1. Search for the catch block in initiateConnection() — verify it includes the original error message
      2. Verify the format is "Falha ao iniciar conexão com Google: {sdkMessage}"
      3. Run npx tsc --noEmit — no new type errors
      4. Run npm run build — passes
    Expected Result: Catch block propagates original error message, build green
    Failure Indicators: Generic error message without SDK details, tsc errors, build failure
    Evidence: .sisyphus/evidence/task-3-error-propagation.txt

  Scenario: Auth config validation error is descriptive
    Tool: Bash
    Preconditions: Tasks 1 and 2 changes applied
    Steps:
      1. Review the COMPOSIO_GOOGLE_AUTH_CONFIG_ID check in initiateConnection()
      2. Verify it throws a descriptive error when missing
      3. Verify the env var is set in .env.local
    Expected Result: Error message is descriptive, env var is present
    Failure Indicators: Vague error message
    Evidence: .sisyphus/evidence/task-3-env-validation.txt
  ```

  **Commit**: YES (groups with 1, 2)
  - Message: `fix(composio): fix SDK API parameter names for connection flow`
  - Files: `src/lib/composio-client.ts`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Output: `Must Have [3/3] | Must NOT Have [8/8] | Tasks [3/3] | VERDICT: APPROVE`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Output: `Build [PASS] | Files [1 clean] | VERDICT: APPROVE`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Output: `Scenarios [verified] | Integration [verified] | VERDICT: APPROVE`

- [x] F4. **Scope Fidelity Check** — `deep`
  Output: `Tasks [3/3 compliant] | Contamination [CLEAN] | VERDICT: APPROVE`

---

## Commit Strategy

- **1**: `fix(composio): fix SDK API parameter names for connection flow` — `src/lib/composio-client.ts`, `src/lib/actions/composio-connection-actions.ts` — Pre-commit: `npx tsc --noEmit`

---

## Success Criteria

### Verification Commands
```bash
npx tsc --noEmit                    # Expected: 0 new errors (pre-existing errors are OK)
npm run build                        # Expected: Build succeeds
grep -r "redirectUri" src/lib/composio-client.ts   # Expected: NO matches (should use callbackUrl)
grep -r "entityId" src/lib/composio-client.ts       # Expected: NO matches (should use userIds)
grep -r "callbackUrl" src/lib/composio-client.ts   # Expected: 1+ matches (in initiate() call)
grep -r "userIds" src/lib/composio-client.ts       # Expected: 2+ matches (in list() calls)
grep -r "allowMultiple" src/lib/composio-client.ts # Expected: 1 match (in initiate() call)
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] Build passes
- [x] TypeScript compiles (pre-existing errors OK)
- [x] `callbackUrl` property used in `initiate()` call
- [x] `userIds` array used in `list()` calls
- [x] `allowMultiple: true` passed to `initiate()`
- [x] Error messages include original SDK error details