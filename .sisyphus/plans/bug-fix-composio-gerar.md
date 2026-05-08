# Bug Fix Plan: Composio Integration + Gerar/Exportar Page

## TL;DR

> **Objective**: Fix all identified bugs in the Composio Google Docs integration and the "Gerar e Exportar" page — covering critical bugs (broken AI enrichment, dead code, double API calls), medium bugs (error swallowing, code duplication), and code smells.
>
> **Deliverables**:
> - Fix `containingText` → `containsText` in AI enrichment flow
> - Wire `convertBatchRequestsToComposio` into `batchUpdateDocument`
> - Add caching to `getConnectedAccountId`
> - Eliminate double connection checking
> - Extract shared helpers to eliminate code duplication with `google-docs-actions.ts`
> - Fix React useEffect cleanup
> - Fix error swallowing, duplicate logic, and edge cases
> - Write tests for all fixed modules
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 9 → Task 10 → F1-F4

---

## Context

### Original Request
Use the debug-skill to review the Composio integration and "Gerar e Revisar" (Gerar/Exportar) page, identify bugs, and create a plan to fix them.

### Interview Summary
**Key Findings** (14 bugs identified across 5 categories):
- Critical: `containingText` → `containsText` typo breaks AI enrichment
- Critical: Dead code — `convertBatchRequestsToComposio` never called
- Critical: Double Composio API calls on every template operation
- Critical: No caching of connected account ID
- Critical: ~300 lines of duplicated code between composio-actions.ts and google-docs-actions.ts
- Critical: Missing useEffect cleanup in page
- Medium: Error swallowing, duplicate getConnectionStatus logic, empty projectId edge case, unused callback storage

---

## Work Objectives

### Core Objective
Fix all identified bugs and eliminate code quality issues in the Composio integration and Gerar/Exportar page.

### Concrete Deliverables
- 14 bug fixes across composio-client.ts, composio-actions.ts, ai-enrich-contract.ts, google-docs-actions.ts, callback/route.ts, gerar-exportar/page.tsx
- Shared utility module extracted (shared-actions.ts) to eliminate duplication
- Unit tests for all fixed functions

### Definition of Done
- [ ] All tasks implemented
- [ ] `bun test` passes (no regressions)
- [ ] `tsc --noEmit` passes (no type errors)
- [ ] Plan compliance audit passes (oracle)

### Must Have
- Fix `containingText` → `containsText` in `ai-enrich-contract.ts`
- Wire `convertBatchRequestsToComposio` into `batchUpdateDocument`
- Add caching layer to `getConnectedAccountId`
- Remove double `requireComposioConnection` calls
- Extract shared helpers between composio-actions.ts and google-docs-actions.ts
- Fix useEffect cleanup in page
- Fix error swallowing, duplicate getConnectionStatus, empty projectId edge case

### Must NOT Have (Guardrails)
- Do NOT refactor the entire composio-client.ts — only targeted fixes
- Do NOT remove legacy `google-docs-actions.ts` — keep backward compatible
- Do NOT modify Composio SDK behavior — only our wrapper code
- Do NOT change the Gerar/Exportar page layout or UX — only fix bugs/anti-patterns
- No scope creep into unrelated modules

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test, Vitest-compatible)
- **Automated tests**: YES (Tests after) — add tests for all fixed modules
- **Framework**: bun test
- **If tests**: Add test tasks alongside implementation tasks

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.
- **Library/Module**: Use `bun test` to run unit tests, use `dap` debugger to verify runtime logic
- **API/Actions**: Use `ts-node` or direct module import to verify function behavior

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — types, tests, caching):
├── Task 1: Add caching layer to getConnectedAccountId [quick]
├── Task 2: Extract shared utilities from composio-actions.ts [quick]
├── Task 3: Add tests for shared utilities [quick]
├── Task 4: Add tests for composio-client.ts [quick]

Wave 2 (Core bug fixes — MAX PARALLEL):
├── Task 5: Fix containingText → containsText in ai-enrich-contract.ts [quick]
├── Task 6: Wire convertBatchRequestsToComposio into batchUpdateDocument [quick]
├── Task 7: Remove double requireComposioConnection calls [quick]
├── Task 8: Fix error swallowing in getConnectedAccountId [unspecified-high]
├── Task 9: Fix duplicate getConnectionStatus logic [quick]

Wave 3 (Page + integration fixes):
├── Task 10: Fix useEffect cleanup in gerar-exportar/page.tsx [quick]
├── Task 11: Fix empty projectId edge case [quick]
├── Task 12: Fix callback route redundant storage [quick]
├── Task 13: Remove dead convertBatchRequestsToComposio or keep with guard [quick]

Wave FINAL (Verification):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality + type check (unspecified-high)
├── Task F3: Real QA execution — run dap debugger to verify critical paths (unspecified-high)
├── Task F4: Full test suite (bun test + tsc) (quick)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 5 → Task 9 → Task 10 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 2)
```

---

## TODOs

- [ ] 1. Add caching layer to `getConnectedAccountId` in `composio-client.ts`

  **What to do**:
  - Add a private `connectedAccountIdCache: Map<string, { id: string; expiresAt: number }>` inside `createComposioClient` or at module level
  - In `getConnectedAccountId`, before calling `connectedAccounts.list()`, check the cache
  - Cache TTL: 5 minutes (300000ms)
  - On successful lookup, store result in cache
  - On `connectedAccounts.list()` returning empty, cache the "not found" result for 30 seconds (to avoid hammering API on repeated calls for unconnected users)
  - Add `clearConnectedAccountIdCache(userId)` method for explicit invalidation (call when connection status changes)
  - No `as any` casts — use proper types

  **Must NOT do**:
  - Do NOT change the function signature — callers must work without modification
  - Do NOT add dependencies — use built-in Map only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file change, straightforward cache pattern, no complex logic
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: All — no specialized skills needed for a cache layer

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Task 8 (error handling depends on this), Task 6 (batch update depends on client)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `src/lib/composio-client.ts:102-158` — `getConnectedAccountId` function to modify
  - `src/lib/composio-client.ts:317-375` — `getConnectionStatus` (duplicate logic, also will benefit from cache)

  **Acceptance Criteria**:
  - [ ] Cache Map added to `createComposioClient`
  - [ ] `getConnectedAccountId` checks cache before API call
  - [ ] Cache TTL: 5 minutes for success, 30 seconds for "not found"
  - [ ] `clearConnectedAccountIdCache(userId)` method exported

  **QA Scenarios**:
  ```
  Scenario: getConnectedAccountId caches result
    Tool: Bash (bun test + direct import)
    Preconditions: composio-client.ts modified
    Steps:
      1. Import `createComposioClient` and call `getConnectedAccountId("test-user")`
      2. Call again with same userId
    Expected Result: Second call returns cached result (no API call)
    Evidence: .sisyphus/evidence/task-1-cache-hits.md

  Scenario: Cache respects TTL and clearCache works
    Tool: Bash (bun test)
    Preconditions: Cache with short TTL set (via test injection)
    Steps:
      1. Cache a result
      2. Call `clearConnectedAccountIdCache("test-user")`
      3. Verify next call triggers API
    Expected Result: Cache cleared, API called
    Evidence: .sisyphus/evidence/task-1-cache-clear.md
  ```

  **Commit**: YES (groups with 3, 4)
  - Message: `fix(composio): add caching to getConnectedAccountId`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `bun test`

---

- [ ] 2. Extract shared utilities between `composio-actions.ts` and `google-docs-actions.ts`

  **What to do**:
  - Create `src/lib/actions/shared-docs-actions.ts`
  - Extract the following functions (which are duplicated verbatim):
    - `getErrorType`
    - `cloneSourceDiagnostics`
    - `createTemplateActionError`
    - `buildValidationError`
    - `updateSourceFailure`
    - `getSourceAttemptOrder`
    - `buildUserFriendlyError`
    - `mergePlaceholderDefinitions`
    - `buildReplacementRequests`  (use the *correct* version from `composio-actions.ts` which uses `containsText`)
  - In both files, replace the duplicated definitions with `export * from './shared-docs-actions'` or individual imports
  - Also export the shared TypeScript types (`TemplateSource`, `TemplateSourceResult`, `TemplateActionError`, `SourceDiagnostic`, `PlaceholderDefinition`, etc.)
  - Verify no breaking changes — both files must export the same function signatures

  **Must NOT do**:
  - Do NOT modify function behavior — only move them
  - Do NOT change function signatures
  - Do NOT delete google-docs-actions.ts — it's still used elsewhere

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical extraction, no logic changes, well-defined scope
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: All — no specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: None directly, but makes Task 3 (tests) easier
  - **Blocked By**: None

  **References**:
  - `src/lib/actions/composio-actions.ts` — source of duplicated functions
  - `src/lib/actions/google-docs-actions.ts` — target where duplicates will be replaced
  - Both files — check for identical function bodies to confirm duplicates

  **Acceptance Criteria**:
  - [ ] `shared-docs-actions.ts` created with all extracted functions
  - [ ] `composio-actions.ts` imports from shared file (no local duplicates)
  - [ ] `google-docs-actions.ts` imports from shared file (no local duplicates)
  - [ ] `bun test` still passes

  **QA Scenarios**:
  ```
  Scenario: Shared exports are importable from new module
    Tool: Bash (bun test)
    Preconditions: shared-docs-actions.ts created
    Steps:
      1. Import shared functions in test file
      2. Call each function with test inputs
    Expected Result: All functions work identically to before
    Evidence: .sisyphus/evidence/task-2-shared-exports.md

  Scenario: Both original files still export all functions
    Tool: Bash (grep + bun test)
    Steps: Check exports from composio-actions.ts and google-docs-actions.ts
    Expected Result: Both files export same functions as before
    Evidence: .sisyphus/evidence/task-2-backward-compat.md
  ```

  **Commit**: YES (groups with 1)
  - Message: `refactor(composio): extract shared utilities from composio-actions.ts`
  - Files: `src/lib/actions/shared-docs-actions.ts`, `src/lib/actions/composio-actions.ts`, `src/lib/actions/google-docs-actions.ts`
  - Pre-commit: `bun test`

---

- [ ] 3. Add unit tests for shared utilities

  **What to do**:
  - Create `src/lib/actions/__tests__/shared-docs-actions.test.ts`
  - Test each extracted function:
    - `getErrorType`: test with known error codes, test with unknown codes
    - `buildReplacementRequests`: test with matching placeholders, test with special regex chars, test with empty matches
    - `mergePlaceholderDefinitions`: test with overlapping keys, test with disjoint sets
    - `buildUserFriendlyError`: test with various error codes
    - `getSourceAttemptOrder`: test with composio source, legacy source, combined
  - Test the correct `containsText` format (not `containingText`)

  **Must NOT do**:
  - Do NOT test functions that make network calls or depend on external services
  - Do NOT mock Composio or external dependencies here (that's Task 4)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Straightforward unit tests, clear input/output
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: All — standard testing patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: None
  - **Blocked By**: Task 2 (shared module must exist first)

  **References**:
  - `src/lib/actions/__tests__/composio-actions.test.ts` — existing test patterns to follow
  - `src/lib/actions/shared-docs-actions.ts` — functions to test

  **Acceptance Criteria**:
  - [ ] Test file created
  - [ ] `bun test shared-docs-actions` → all pass
  - [ ] Covers at least: happy path, error edge cases, regex escaping, empty inputs

  **QA Scenarios**:
  ```
  Scenario: All shared functions produce expected outputs
    Tool: Bash (bun test)
    Preconditions: test file created
    Steps:
      1. Run `bun test src/lib/actions/__tests__/shared-docs-actions.test.ts`
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-3-test-output.txt
  ```

  **Commit**: YES (groups with 4)
  - Message: `test(composio): add unit tests for shared utils`
  - Files: `src/lib/actions/__tests__/shared-docs-actions.test.ts`
  - Pre-commit: `bun test`

---

- [ ] 4. Add unit tests for `composio-client.ts` key functions

  **What to do**:
  - Create `src/lib/__tests__/composio-client.test.ts`
  - Test the caching behavior of `getConnectedAccountId` (from Task 1):
    - Verify cache hit returns same value
    - Verify cache miss triggers API call
    - Verify `clearConnectedAccountIdCache` works
  - Test `convertBatchRequestsToComposio`:
    - Input with `containsText` → correctly converted to Composio format
    - Input with `containingText` → correctly normalized to `containsText`
    - Empty array → returns empty array
  - Mock `composio.connectedAccounts.list()` for cache tests
  - Mock `composio.tools.execute()` for tool execution tests

  **Must NOT do**:
  - Do NOT make actual Composio API calls — mock external dependencies
  - Do NOT test `createComposioClient` constructor (requires env vars)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Unit tests with mocks, standard patterns
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: All

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: None
  - **Blocked By**: Task 1 (caching must exist to test it)

  **References**:
  - `src/lib/composio-client.ts` — functions to test
  - `src/lib/actions/__tests__/composio-actions.test.ts` — existing test patterns

  **Acceptance Criteria**:
  - [ ] Test file created
  - [ ] `bun test composio-client` → all pass
  - [ ] Cache behavior tested with mocks
  - [ ] `convertBatchRequestsToComposio` format correctness tested

  **QA Scenarios**:
  ```
  Scenario: All client tests pass
    Tool: Bash (bun test)
    Preconditions: Test file created
    Steps:
      1. Run `bun test src/lib/__tests__/composio-client.test.ts`
    Expected Result: All tests pass
    Evidence: .sisyphus/evidence/task-4-test-output.txt
  ```

  **Commit**: YES (groups with 3)
  - Message: `test(composio): add unit tests for composio client`
  - Files: `src/lib/__tests__/composio-client.test.ts`
  - Pre-commit: `bun test`

---

- [ ] 5. Fix `containingText` → `containsText` in `ai-enrich-contract.ts`

  **What to do**:
  - In `src/ai/flows/ai-enrich-contract.ts`, find `buildReplacementRequests` function (around lines 309-316)
  - The current code likely uses `containingText` key in the `replaceAllText` request object
  - Change `containingText` to `containsText` to match Google Docs API specification
  - Note: this function was duplicated from `composio-actions.ts:buildReplacementRequests` which already uses the correct `containsText` key — after Task 2 (shared extraction), this function will be imported from shared module, so the fix is simply to ensure the import uses the correct version

  **Must NOT do**:
  - Do NOT change the logic of how replacements work — only fix the key name
  - Do NOT modify the AI generation pipeline itself, only the replacement function

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: One-line fix, mechanical change
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: All

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8, 9)
  - **Blocks**: None
  - **Blocked By**: Task 2 (shared module extraction) — ensures the correct version is used

  **References**:
  - `src/ai/flows/ai-enrich-contract.ts:280-322` — `buildReplacementRequests` function
  - `src/lib/actions/shared-docs-actions.ts` — correct version of `buildReplacementRequests` (from Task 2)

  **Acceptance Criteria**:
  - [ ] `containingText` changed to `containsText` (or import uses correct version)
  - [ ] `bun test` passes
  - [ ] Visual inspection confirms request format matches Google Docs API specification

  **QA Scenarios**:
  ```
  Scenario: buildReplacementRequests produces correct format
    Tool: Bash (bun test)
    Preconditions: Fix applied
    Steps:
      1. Import buildReplacementRequests from the correct source
      2. Call with test data: { "[[name]]": "João" }
    Expected Result: Output requests use "containsText" not "containingText"
    Evidence: .sisyphus/evidence/task-5-correct-format.txt

  Scenario: Regex-sensitive placeholders don't break
    Tool: Bash (bun test)
    Steps:
      1. Call buildReplacementRequests with placeholders containing special regex chars: { "[[price (R$)]]": "100" }
    Expected Result: All placeholders matched and replaced without regex errors
    Evidence: .sisyphus/evidence/task-5-regex-escaping.txt
  ```

  **Commit**: YES (groups with 6)
  - Message: `fix(ai): correct containingText to containsText in enrich flow`
  - Files: `src/ai/flows/ai-enrich-contract.ts`
  - Pre-commit: `bun test`

---

- [ ] 6. Wire `convertBatchRequestsToComposio` into `batchUpdateDocument`

  **What to do**:
  - In `src/lib/composio-client.ts`, modify `batchUpdateDocument` method (lines 195-220)
  - Currently: `const nativeRequests = requests.filter((req) => req.replaceAllText);` passes raw requests
  - Fix: Call `convertBatchRequestsToComposio(requests)` first, then use the converted result
  - The `convertBatchRequestsToComposio` function already handles both `containsText` and `containingText` — it normalizes to `containingText` (the Composio SDK format)
  - After this fix, `batchUpdateDocument` will correctly handle both formats from both `composio-actions.ts` and `ai-enrich-contract.ts`

  **Must NOT do**:
  - Do NOT change the `convertBatchRequestsToComposio` function — it works correctly
  - Do NOT remove the function after wiring — it's now a critical part of the pipeline

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single method modification, existing function to call
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8, 9)
  - **Blocks**: None
  - **Blocked By**: Task 1 (caching), Task 5 (format fix upstream)

  **References**:
  - `src/lib/composio-client.ts:195-220` — `batchUpdateDocument` method
  - `src/lib/composio-client.ts:451-485` — `convertBatchRequestsToComposio` function (currently dead code)
  - `src/lib/actions/composio-actions.ts:532-579` — the other `buildReplacementRequests` which produces requests in the format that `convertBatchRequestsToComposio` expects

  **Acceptance Criteria**:
  - [ ] `batchUpdateDocument` calls `convertBatchRequestsToComposio` before passing to tool
  - [ ] Both `containsText` and `containingText` input formats work correctly
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: batchUpdateDocument converts requests correctly
    Tool: Bash (bun test + direct module import)
    Preconditions: Fix applied
    Steps:
      1. Import createComposioClient (with mocked execute tool)
      2. Call batchUpdateDocument with requests containing "containsText"
    Expected Result: convertBatchRequestsToComposio called, tool receives correctly formatted requests
    Evidence: .sisyphus/evidence/task-6-conversion.txt

  Scenario: containingText format also converted
    Tool: Bash (bun test)
    Steps:
      1. Same as above but with "containingText" in input
    Expected Result: Both formats produce identical output to tool
    Evidence: .sisyphus/evidence/task-6-dual-format.txt
  ```

  **Commit**: YES (groups with 5)
  - Message: `fix(composio): wire convertBatchRequestsToComposio into batchUpdateDocument`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `bun test`

---

- [ ] 7. Remove double `requireComposioConnection` calls in `composio-actions.ts`

  **What to do**:
  - In `src/lib/actions/composio-actions.ts`:
    - `inspectTemplateForGeneration`: Remove the standalone `requireComposioConnection(userId)` call on line ~605 — `resolveTemplateSource` (called on ~607) already calls `requireComposioConnection` internally via `createComposioClient`
    - `generateContractDoc`: Remove the standalone `requireComposioConnection(userId)` call on line ~749 — same reasoning
  - Verify that `resolveTemplateSource` → `validateTemplateSource` → `createComposioClient` → `getConnectedAccountId` path still works without the standalone call

  **Must NOT do**:
  - Do NOT remove the `requireComposioConnection` function itself — it's used elsewhere (e.g., `generateContractDoc` standalone)
  - Do NOT change `resolveTemplateSource` to NOT check connection — the check should remain inside
  - Only remove the redundant standalone calls

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Remove two function calls, verify flow still works
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8, 9)
  - **Blocks**: None
  - **Blocked By**: Task 1 (caching ensures the remaining connection check is efficient)

  **References**:
  - `src/lib/actions/composio-actions.ts:599-631` — `inspectTemplateForGeneration`
  - `src/lib/actions/composio-actions.ts:749-751` — `generateContractDoc`
  - `src/lib/actions/composio-actions.ts:206-215` — `requireComposioConnection` (the function itself)
  - `src/lib/actions/composio-actions.ts:253-258` — `resolveTemplateSource` (which calls `requireComposioConnection` internally)

  **Acceptance Criteria**:
  - [ ] Standalone `requireComposioConnection(userId)` calls removed from `inspectTemplateForGeneration` and `generateContractDoc`
  - [ ] `bun test` passes
  - [ ] Template operations still verify connection (via `resolveTemplateSource` → `validateTemplateSource` → `createComposioClient`)

  **QA Scenarios**:
  ```
  Scenario: inspectTemplateForGeneration no redundant connection check
    Tool: dap debugger + Bun
    Preconditions: Fix applied, dev server running
    Steps:
      1. Set breakpoint in requireComposioConnection
      2. Trigger inspectTemplateForGeneration
    Expected Result: requireComposioConnection is hit exactly once (inside resolveTemplateSource), not twice
    Evidence: .sisyphus/evidence/task-7-single-check.txt
  ```

  **Commit**: YES (groups with 5)
  - Message: `fix(composio): remove duplicate requireComposioConnection calls`
  - Files: `src/lib/actions/composio-actions.ts`
  - Pre-commit: `bun test`

---

- [ ] 8. Fix error swallowing in `getConnectedAccountId`

  **What to do**:
  - In `src/lib/composio-client.ts`, modify `getConnectedAccountId` (lines 102-158):
  - Currently: `try { ... } catch (error) { console.error(...); return undefined; }`
  - Change to: Create a `ConnectionCheckError` type or subclass, and throw a typed error when the Composio API call fails
  - The caller should distinguish: "no account" ≠ "API error"
  - Add a `getConnectedAccountIdSafe` method that returns `{ accountId?: string; error?: ConnectionCheckError }` or use a Result type pattern
  - Keep existing `getConnectedAccountId` signature for backward compatibility, but have it return `undefined` only when truly "no account found"
  - When API call fails (network error, 5xx), throw a descriptive error

  **Must NOT do**:
  - Do NOT break existing callers that check `if (!connectedAccountId) return;`
  - Do NOT add external dependencies — use built-in Error subclass

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: More nuanced change — needs to handle multiple error scenarios without breaking callers
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 9)
  - **Blocks**: None
  - **Blocked By**: Task 1 (caching layer must exist to modify error handling)

  **References**:
  - `src/lib/composio-client.ts:102-158` — current `getConnectedAccountId`
  - Callers: `getDocumentContent`, `getFileMetadata`, `batchUpdateDocument`, `getConnectionStatus` — all check for `undefined`

  **Acceptance Criteria**:
  - [ ] Network errors throw typed `ConnectionCheckError` instead of returning `undefined`
  - [ ] "No account found" still returns `undefined`
  - [ ] `getConnectedAccountIdSafe` (or equivalent) provides detailed result
  - [ ] All existing callers still work
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: API error throws typed error
    Tool: Bash (bun test with mocked failing API)
    Preconditions: Fix applied
    Steps:
      1. Mock connectedAccounts.list() to throw network error
      2. Call getConnectedAccountId
    Expected Result: Typed ConnectionCheckError thrown (not silent undefined)
    Evidence: .sisyphus/evidence/task-8-error-throw.txt

  Scenario: No account still returns undefined
    Tool: Bash (bun test)
    Steps:
      1. Mock connectedAccounts.list() to return empty array
      2. Call getConnectedAccountId
    Expected Result: Returns undefined (backward compatible)
    Evidence: .sisyphus/evidence/task-8-no-account.txt
  ```

  **Commit**: YES (groups with 9)
  - Message: `fix(composio): add typed error handling in getConnectedAccountId`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `bun test`

---

- [ ] 9. Fix duplicate `getConnectionStatus` logic

  **What to do**:
  - In `src/lib/composio-client.ts`, `getConnectionStatus` method (lines 317-375)
  - Currently: has its own implementation of the same connected-account lookup logic as `getConnectedAccountId`
  - Fix: Make `getConnectionStatus` call `getConnectedAccountId` and then derive the status from the result
  - Pattern: `const accountId = await getConnectedAccountId(userId); return { connected: !!accountId, accountId };`
  - This ensures the caching from Task 1 also benefits `getConnectionStatus`

  **Must NOT do**:
  - Do NOT change the return type of `getConnectionStatus` — callers expect current shape
  - Do NOT remove any additional fields `getConnectionStatus` might return (authConfig, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Replace duplicated logic with a call to the cached version
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7, 8)
  - **Blocks**: None
  - **Blocked By**: Task 1 (caching must exist), Task 8 (error handling must exist)

  **References**:
  - `src/lib/composio-client.ts:317-375` — `getConnectionStatus` (duplicate to eliminate)
  - `src/lib/composio-client.ts:102-158` — `getConnectedAccountId` (the canonical version)

  **Acceptance Criteria**:
  - [ ] `getConnectionStatus` delegates to `getConnectedAccountId`
  - [ ] No duplicate connected-account lookup logic remains
  - [ ] Return type preserved
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: getConnectionStatus returns correct status via delegation
    Tool: Bash (bun test with mock)
    Preconditions: Fix applied
    Steps:
      1. Mock getConnectedAccountId to return "acc-123"
      2. Call getConnectionStatus("user-1")
    Expected Result: Returns { connected: true, accountId: "acc-123" }
    Evidence: .sisyphus/evidence/task-9-delegation.txt
  ```

  **Commit**: YES (groups with 8)
  - Message: `fix(composio): deduplicate getConnectionStatus logic`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `bun test`

---

- [ ] 10. Fix `useEffect` cleanup in `gerar-exportar/page.tsx`

  **What to do**:
  - Find the `useEffect` that fetches project name (around line 251-256):
    ```typescript
    useEffect(() => {
      if (!projectIdFromUrl || !firestore) return;
      getDoc(doc(firestore, "projects", projectIdFromUrl)).then((docSnap) => {
        if (docSnap.exists()) setProjectName(docSnap.data().name);
      });
    }, [firestore, projectIdFromUrl]);
    ```
  - Add an `AbortController` or use a mounted flag to prevent state update on unmounted component
  - Using AbortController with Firestore is tricky (Firestore `getDoc` doesn't accept AbortSignal directly)
  - Best approach: Use a `useEffect` cleanup function with a boolean flag:
    ```typescript
    useEffect(() => {
      if (!projectIdFromUrl || !firestore) return;
      let cancelled = false;
      getDoc(doc(firestore, "projects", projectIdFromUrl)).then((docSnap) => {
        if (!cancelled && docSnap.exists()) setProjectName(docSnap.data().name);
      });
      return () => { cancelled = true; };
    }, [firestore, projectIdFromUrl]);
    ```

  **Must NOT do**:
  - Do NOT change other effects on the page — only this specific one
  - Do NOT refactor the entire page — targeted fix only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: One-useEffect fix, standard React pattern
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 11, 12, 13)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/(main)/gerar-exportar/page.tsx:251-256` — the useEffect to fix
  - React docs on useEffect cleanup: `https://react.dev/reference/react/useEffect#return`

  **Acceptance Criteria**:
  - [ ] Cleanup function added with `cancelled` flag
  - [ ] No state update on unmounted component
  - [ ] Build passes

  **QA Scenarios**:
  ```
  Scenario: Cleanup prevents state update on unmount
    Tool: Bash (code inspection + bun test)
    Preconditions: Fix applied
    Steps:
      1. Read modified useEffect code
    Expected Result: Cleanup function sets cancelled=true; setProjectName guarded by !cancelled
    Evidence: .sisyphus/evidence/task-10-cleanup.txt
  ```

  **Commit**: YES (groups with 11)
  - Message: `fix(ui): add cleanup to project name useEffect`
  - Files: `src/app/(main)/gerar-exportar/page.tsx`
  - Pre-commit: `bun test`

---

- [ ] 11. Fix empty `projectId` edge case in `gerar-exportar/page.tsx`

  **What to do**:
  - Find `const currentProjectId = projectIdFromUrl || "default-project";` (around line 199)
  - `searchParams.get("projectId")` can return empty string `""`, which is falsy but semantically different from `null`
  - Fix: `const currentProjectId = projectIdFromUrl || "default-project";` — add explicit null/undefined check:
    ```typescript
    const currentProjectId = (projectIdFromUrl && projectIdFromUrl.length > 0)
      ? projectIdFromUrl
      : "default-project";
    ```
  - Or simpler: `const currentProjectId = projectIdFromUrl ?? "default-project";` — but this treats `""` as a valid project ID which may cause issues elsewhere
  - Best: use the `||` approach but with explicit trimming: `const currentProjectId = projectIdFromUrl?.trim() || "default-project";`

  **Must NOT do**:
  - Do NOT change how `projectIdFromUrl` is obtained — only the fallback logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: One-line fix
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 12, 13)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/(main)/gerar-exportar/page.tsx:199` — the line to fix
  - Previous lines: `const projectIdFromUrl = searchParams.get("projectId");` — can return `""` or `null`

  **Acceptance Criteria**:
  - [ ] Empty string from `searchParams.get("projectId")` correctly falls to `"default-project"`
  - [ ] Valid project ID still passes through

  **QA Scenarios**:
  ```
  Scenario: Empty projectId falls to default
    Tool: Bash (code inspection + tests)
    Preconditions: Fix applied
    Steps:
      1. Read the modified line
    Expected Result: Empty string treated as "no project" → uses "default-project"
    Evidence: .sisyphus/evidence/task-11-empty-id.txt
  ```

  **Commit**: YES (groups with 10)
  - Message: `fix(ui): handle empty projectId param`
  - Files: `src/app/(main)/gerar-exportar/page.tsx`
  - Pre-commit: `bun test`

---

- [ ] 12. Remove redundant callback storage in callback route

  **What to do**:
  - In `src/app/api/composio/callback/route.ts`, find the Firestore storage logic (around line 66):
    ```typescript
    const docId = userId || connectedAccountId;
    ```
  - Composio OAuth callback does NOT echo `userId` back — only `connectedAccountId` and `status`
  - The Firestore document stored under `connectedAccountId` is NEVER read back (connection status is checked via `connectedAccounts.list()` API)
  - Fix: Remove the Firestore storage entirely — it's dead code with no functional purpose
  - Keep the callback route to handle OAuth redirect and return success to user
  - The route should: validate the callback, extract `status`, and redirect to the app with success/error params

  **Must NOT do**:
  - Do NOT modify how the OAuth redirect URL is constructed (the `redirect_uri` in composio-connection-actions.ts)
  - Do NOT change other parts of the callback handler

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Remove dead code, verify flow still works
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 13)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `src/app/api/composio/callback/route.ts:60-80` — Firestore storage logic

  **Acceptance Criteria**:
  - [ ] Firestore storage removed from callback route
  - [ ] OAuth callback still redirects correctly to app
  - [ ] Connection flow still works end-to-end

  **QA Scenarios**:
  ```
  Scenario: Callback route handles OAuth without Firestore
    Tool: Bash (code inspection)
    Preconditions: Fix applied
    Steps:
      1. Read callback route code
    Expected Result: No Firestore write, just validates and redirects
    Evidence: .sisyphus/evidence/task-12-callback.txt
  ```

  **Commit**: YES (groups with 12)
  - Message: `fix(api): remove redundant callback storage`
  - Files: `src/app/api/composio/callback/route.ts`
  - Pre-commit: `bun test`

---

- [ ] 13. Cleanup: handle dead `convertBatchRequestsToComposio` or remove with guard

  **What to do**:
  - After Task 6 wires `convertBatchRequestsToComposio` into `batchUpdateDocument`, the function is no longer dead code
  - However, verify that the function is now referenced AND has adequate type safety:
    - Check that `convertBatchRequestsToComposio` has proper TypeScript types (not `any`)
    - Check that it handles both `containsText` and `containingText` input formats
    - Remove any other dead code in `composio-client.ts` that is truly unused (run `tsc --noEmit` to check for unused exports)
  - Optional: Rename to `normalizeBatchRequests` for clarity (but only if all references updated)

  **Must NOT do**:
  - Do NOT remove the function entirely — it's now wired in Task 6
  - Do NOT make cosmetic changes beyond what's needed for type safety

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Cleanup pass, type improvements
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 10, 11, 12)
  - **Blocks**: None
  - **Blocked By**: Task 6 (function must be wired first)

  **References**:
  - `src/lib/composio-client.ts:451-485` — the function
  - `src/lib/composio-client.ts:195-220` — where it's now called (per Task 6)

  **Acceptance Criteria**:
  - [ ] `convertBatchRequestsToComposio` has proper types (not `any`)
  - [ ] No other dead code remains in `composio-client.ts`
  - [ ] `tsc --noEmit` passes
  - [ ] `bun test` passes

  **QA Scenarios**:
  ```
  Scenario: No dead code warnings
    Tool: Bash (tsc --noEmit)
    Preconditions: Fix applied
    Steps:
      1. Run tsc --noEmit
    Expected Result: No unused variable/export warnings
    Evidence: .sisyphus/evidence/task-13-no-dead-code.txt
  ```

  **Commit**: YES (groups with 12)
  - Message: `chore(composio): cleanup dead code and improve types`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA with dap debugger** — `unspecified-high`
  Start from clean state. Use `dap` to verify the critical paths end-to-end:
  1. Start Next.js dev server under `dap` debugger
  2. Set breakpoints at fixed functions (getConnectedAccountId caching, batchUpdateDocument conversion, extractSharedHelpers exports)
  3. Trigger template inspection flow and verify: connectedAccountId is cached (single API call per flow), replaceAllText requests use correct format, no double connection checks
  4. Save `.sisyphus/evidence/final-qa/` with dap eval output showing correct values
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Full Test Suite** — `quick`
  Run `bun test` and `tsc --noEmit`. All must pass.
  Output: `Tests [N pass/N fail] | Types [PASS/FAIL] | VERDICT`

---

## Commit Strategy

- **1**: `fix(composio): add caching to getConnectedAccountId`
- **2**: `refactor(composio): extract shared utilities from composio-actions.ts`
- **3–4**: `test(composio): add unit tests for shared utils and client`
- **5**: `fix(ai): correct containingText to containsText in enrich flow`
- **6**: `fix(composio): wire convertBatchRequestsToComposio into batchUpdateDocument`
- **7**: `fix(composio): remove duplicate requireComposioConnection calls`
- **8**: `fix(composio): add typed error handling in getConnectedAccountId`
- **9**: `fix(composio): deduplicate getConnectionStatus logic`
- **10**: `fix(ui): add cleanup to project name useEffect`
- **11**: `fix(ui): handle empty projectId param`
- **12**: `fix(api): remove redundant callback storage`
- **13**: `chore(composio): cleanup dead code convertBatchRequestsToComposio`

---

## Success Criteria

### Verification Commands
```bash
bun test          # All tests pass (existing + new)
tsc --noEmit      # No type errors
# dap debug sessions for runtime verification (see F3)
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] User explicitly approves
