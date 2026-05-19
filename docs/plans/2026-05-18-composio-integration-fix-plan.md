# Composio Integration Fix Plan

**Date:** 2026-05-18  
**Scope:** Fix all 7 identified issues in the Composio v3 integration  
**Files affected:** `composio-client.ts`, `composio-gemini.ts`, `composio-client.test.ts`

---

## Issue 1 — Tests expect wrong `create()` signature (P0)

**Problem:** `composio-client.test.ts:75` asserts `mockComposioCreate` was called with `('user-1', undefined)`, but the real code passes a full config object with `toolkits`, `tools`, `authConfigs`, and `manageConnections`. Tests pass but validate nothing real.

**Fix:**
1. Update test assertions in `session creation` describe block to expect the full config object:
   ```ts
   expect(mockComposioCreate).toHaveBeenCalledWith('user-1', expect.objectContaining({
     toolkits: ['googledocs', 'googledrive'],
     tools: expect.any(Object),
     authConfigs: expect.any(Object),
     manageConnections: { waitForConnections: true },
   }));
   ```
2. Add a test verifying the `authConfigs` contains the correct `googledocs` key matching the passed `googleAuthConfigId`.
3. Update the `initiateConnection` test at line 200-205 which also expects a partial config — ensure it matches the full shape.

**Verification:** `npm run test -- composio-client.test.ts` — all tests pass with correct assertions.

---

## Issue 2 — `googledrive` missing from `authConfigs` (P1)

**Problem:** `composio-client.ts:167-169` only sets `authConfigs.googledocs`. Both toolkits share the same Google OAuth but the SDK may require both keys for proper white-label OAuth flow.

**Fix:**
1. In `getOrCreateSession()` (line 167), add `googledrive` to `authConfigs`:
   ```ts
   authConfigs: {
     googledocs: effectiveAuthConfigId,
     googledrive: effectiveAuthConfigId,
   },
   ```
2. Same fix in `composio-gemini.ts:130-132`.

**Verification:** OAuth flow completes for both Docs and Drive with a single auth prompt. No `connectedAccount not found` errors for Drive toolkit.

---

## Issue 3 — Hardcoded auth config ID in Gemini module (P1)

**Problem:** `composio-gemini.ts:131` has `|| 'ac_hhBpnP-HVtg0'` as fallback. If `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` is unset in production, it silently uses a dev config.

**Fix:**
1. Remove the hardcoded fallback. Throw a descriptive error instead:
   ```ts
   const authConfigId = process.env.COMPOSIO_GOOGLE_AUTH_CONFIG_ID;
   if (!authConfigId) {
     throw new Error('COMPOSIO_GOOGLE_AUTH_CONFIG_ID is not set. Configure your Google auth config ID.');
   }
   ```
2. Use the validated `authConfigId` in both `authConfigs.googledocs` and `authConfigs.googledrive`.

**Verification:** Missing env var produces a clear error at startup rather than silent wrong-config behavior.

---

## Issue 4 — `session.tools.execute()` discouraged by docs (P2)

**Problem:** `composio-client.ts:227` uses `session.tools.execute(toolSlug, ...)` which docs §2.3 explicitly discourage. This is a maintenance/deprecation risk.

**Fix:**
1. Research the recommended alternative: use `session.toolkit(toolkitSlug).tool(toolSlug).execute(params)` or the session-based tool execution pattern.
2. Create a wrapper `executeToolViaSession(session, toolSlug, params)` that uses the recommended API.
3. Keep the current `session.tools.execute()` as a fallback with a deprecation warning log, so existing functionality isn't broken during transition.
4. Add a comment linking to the SDK docs section that describes the recommended pattern.

**Note:** This is a P2 — the current approach works. The fix is forward-compatibility. If the recommended SDK pattern requires significant restructuring, defer to a future sprint.

**Verification:** Tool execution succeeds via the new wrapper. No change in behavior for existing operations.

---

## Issue 5 — Dual architecture, duplicated session logic (P2)

**Problem:** `composio-client.ts` (deterministic adapter) and `composio-gemini.ts` (agentic loop) maintain separate:
- Composio base instance creation
- Session creation config (toolkits, tools, authConfigs)
- Tool whitelists
- Error handling

**Fix:**
1. Extract a shared `buildSessionConfig()` function that returns the canonical config object used by both modules:
   ```ts
   export function buildSessionConfig(authConfigId: string) {
     return {
       toolkits: ['googledocs', 'googledrive'] as const,
       tools: { /* shared whitelist */ },
       authConfigs: { googledocs: authConfigId, googledrive: authConfigId },
       manageConnections: { waitForConnections: true },
     };
   }
   ```
2. Move this to a new file `src/lib/composio-config.ts` or keep in `composio-client.ts` and export.
3. Import and use in both `composio-client.ts` and `composio-gemini.ts`.
4. Ensure both modules use the same `authConfigId` resolution logic (env var, no hardcoded fallback).

**Verification:** Both modules produce identical session configs. Changing a tool whitelist in one place affects both.

---

## Issue 6 — `waitForConnections: true` can hang in serverless (P2)

**Problem:** `manageConnections.waitForConnections: true` blocks until connections are active. In Next.js serverless, this can exceed request timeout (10-60s) if the user hasn't completed OAuth.

**Fix:**
1. Set `waitForConnections: false` for session creation during `initiateConnection()` — the OAuth flow is async by nature.
2. Keep `waitForConnections: true` only for deterministic operations (document generation, file copy) where we expect an active connection.
3. Alternatively, add a timeout wrapper around `composio.create()`:
   ```ts
   const session = await Promise.race([
     composio.create(userId, config),
     new Promise((_, reject) => setTimeout(() => reject(new Error('Session creation timeout')), 15000)),
   ]);
   ```

**Verification:** OAuth initiation returns redirect URL within 5s. No serverless timeouts. Connection check after OAuth completion still works via polling.

---

## Issue 7 — Test mocks don't match real SDK (P1)

**Problem:** The test mocks `session.toolkits()` for connection status, but the real code uses `composio.connectedAccounts.list()` (line 267 of `composio-client.ts`). The connection status logic is completely untested.

**Fix:**
1. Add `mockConnectedAccountsList` to the hoisted mocks.
2. Update the `@composio/core` mock to include `connectedAccounts: { list: mockConnectedAccountsList }` on the Composio instance.
3. Rewrite `connection status` describe block tests to mock `connectedAccounts.list()` responses:
   - Active accounts for both toolkits → `ACTIVE`
   - Missing toolkit → `INACTIVE`
   - Empty response → `INACTIVE`
   - Throw → `FAILED`
4. Remove the `session.toolkits()` mock from connection status tests (it's not used by the real code).
5. Keep `session.toolkits()` mock for the `initiateConnection` tests if still needed for `authorize()`.

**Verification:** `npm run test -- composio-client.test.ts` — connection status tests exercise the real code path through `connectedAccounts.list()`.

---

## Execution Order

| Step | Issue | Priority | Est. Effort | Dependencies |
|------|-------|----------|-------------|--------------|
| 1 | #1 Fix test assertions | P0 | 15 min | None |
| 2 | #7 Fix test mocks for connectedAccounts | P1 | 20 min | Step 1 |
| 3 | #2 Add googledrive to authConfigs | P1 | 5 min | None |
| 4 | #3 Remove hardcoded auth config fallback | P1 | 5 min | None |
| 5 | #5 Extract shared session config | P2 | 20 min | Steps 3, 4 |
| 6 | #6 Add timeout to session creation | P2 | 15 min | Step 5 |
| 7 | #4 Replace session.tools.execute() | P2 | 30 min | Step 5 |
| 8 | Run full test suite | — | 5 min | All steps |

**Total estimated effort:** ~2 hours

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `waitForConnections: false` breaks connection flow | Low | OAuth already uses separate `authorize()` → redirect → callback → poll flow |
| Removing hardcoded auth config breaks dev environment | Low | `.env.local` already has the correct value |
| `session.tools.execute()` replacement breaks tool execution | Medium | Keep as fallback during transition, verify each tool still works |
| Shared config extraction introduces import cycles | Low | Place in `composio-client.ts` and export, no new file needed |

---

## Success Criteria

1. All 7 issues resolved
2. `npm run test` passes with 100% of Composio-related tests
3. `npm run typecheck` passes with no errors
4. OAuth flow still works end-to-end (Docs + Drive)
5. Document generation still works
6. No hardcoded secrets or config IDs in source code
