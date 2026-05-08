# Composio Bug Fix Plan

## TL;DR

> **Quick Summary**: Rewrite composio-gemini.ts to use the **correct Composio integration pattern** (switch from Genkit to native `@google/genai` client per Composio docs), fix model names, and improve error handling.
> 
> **Deliverables**: 
> - Rewritten composio-gemini.ts using `composio.create(user_id)` → `session.tools()` → `@google/genai` client
> - Fixed Gemini model names (use `gemini-3-flash-preview` per Composio docs showing `gemini-3-pro-preview` exists)
> - Working agentic loop with tool execution
> - Improved error handling in composio-client.ts
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Rewrite composio-gemini.ts → Fix tests → Test

---

## Context

### Original Request
User requested: "Review the composio implementation, identify bugs, and make a plan to correct them."

### Interview Summary
**Key Discussions**:
- Reviewed composio implementation across 10+ files
- Identified bugs in Gemini model names, stub implementation, error handling
- Found existing fix-plan.md showing partial work was done (tool slugs updated to UPPERCASE)
- 3 tests failing in composio-gemini.test.ts due to model name mismatch

**Research Findings**:
- Using `@composio/core: ^0.6.10` and `@composio/google: ^0.6.10`
- Tool slugs correctly updated to UPPERCASE versioned format (previous fix)
- Gemini model `googleai/gemini-3-flash-preview` does NOT exist (neither does `gemini-3.1-flash-lite-preview`)
- Correct models: `googleai/gemini-2.0-flash`, `googleai/gemini-1.5-flash`, etc.

### Metis Review
**Identified Gaps** (consultation aborted, proceeding with findings):
- Need to clarify if composio-gemini.ts stub should be fully implemented or just model names fixed
- google-docs-actions.ts labeled "Legacy" but still in use - scope decision needed

---

## Work Objectives

### Core Objective
Fix all identified bugs in the Composio implementation using the **correct Composio integration pattern** (switch from Genkit to native `@google/genai` client as per Composio docs).

### Concrete Deliverables
- `src/lib/composio-gemini.ts` - Rewritten to use Composio `create()` + `session.tools()` + native `@google/genai` client
- `src/lib/composio-gemini.test.ts` - Updated tests for new implementation
- `src/lib/composio-client.ts` - Improve error handling for graceful degradation
- All tests passing (including previously failing composio-gemini tests)
- Vitest suite: All tests passing

### Definition of Done
- [ ] `npm run test` passes with all composio tests green
- [ ] `npm run typecheck` passes
- [ ] Implementation follows Composio documentation pattern

### Must Have
- Correct Composio integration: `composio.create(user_id)` → `session.tools()` → pass to `@google/genai` client
- Working agentic loop with tool execution (per Composio docs pattern)
- All composio-gemini.test.ts tests passing

### Must NOT Have (Guardrails)
- Do NOT upgrade @composio/core or @composio/google beyond ^0.6.10 (per existing fix-plan.md)
- Do NOT remove google-docs-actions.ts without confirming it's safe (labeled legacy but still used)
- Do NOT change tool slugs (already correctly updated to UPPERCASE in previous fix)
- Do NOT add new features beyond bug fixes

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (Vitest + @testing-library/react)
- **Automated tests**: YES (Tests after implementation)
- **Framework**: vitest
- **If TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios (see TODO template below).
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (npm/npx) - Run vitest tests, typecheck
- **API Integration**: Use Bash (curl) - Verify Composio tool execution
- **AI Integration**: Use existing Genkit infrastructure - Test Gemini calls

---

## Execution Strategy

### Parallel Execution Waves

> Maximize throughput by grouping independent tasks into parallel waves.

```
Wave 1 (Start Immediately - foundation fixes):
├── Task 1: Fix Gemini model names in composio-gemini.ts [quick]
├── Task 2: Fix Gemini model names in composio-gemini.test.ts [quick]
└── Task 3: Run tests to verify model name fix [quick]

Wave 2 (After Wave 1 - integration work):
├── Task 4: Wire up Composio tools to Gemini agent [deep]
├── Task 5: Add error handling improvements to composio-client.ts [unspecified-high]
└── Task 6: Update ComposioClient interface if needed [quick]

Wave 3 (After Wave 2 - verification):
├── Task 7: Run full vitest suite [quick]
├── Task 8: Run typecheck [quick]
└── Task 9: Manual verification of Composio+Gemini flow [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user okay):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 4 → Task 7 → F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Waves 1 & 2)
```

### Dependency Matrix

- **1-2**: - - 3, 4
- **3**: 1, 2 - 7
- **4**: 1 - 6, 9
- **5**: - 6, 9
- **6**: 4, 5 - 9
- **7**: 3, 4, 5, 6 - F2, F3
- **8**: - F2
- **9**: 4, 5, 6 - F3

### Agent Dispatch Summary

- **1**: **1** - T1 → `quick`, T2 → `quick`, T3 → `quick`
- **2**: **1** - T4 → `deep`
- **3**: **3** - T5 → `unspecified-high`, T6 → `quick`, T7 → `quick`, T8 → `quick`
- **FINAL**: **4** - F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**

- [ ] 1. Fix Gemini model names in composio-gemini.ts

  **What to do**:
  - Replace incorrect model name `'googleai/gemini-3-flash-preview'` with correct model
  - Lines to fix: 41, 48, 84 in `src/lib/composio-gemini.ts`
  - Use `googleai/gemini-2.0-flash` (recommended) or `googleai/gemini-1.5-flash`
  - Verify model name exists in @genkit-ai/google-genai documentation

  **Must NOT do**:
  - Do NOT use `gemini-3-flash-preview` (doesn't exist)
  - Do NOT use `gemini-3.1-flash-lite-preview` (doesn't exist)
  - Do NOT change the function signatures or logic

  **Recommended Agent Profile**:
  > Select category + skills based on task domain.
  - **Category**: `quick`
    - Reason: Single file change, simple string replacement, <30 min work
  - **Skills**: []
    - No special skills needed for this straightforward fix
  - **Skills Evaluated but Omitted**:
    - `finding-skills`: Not needed, this is a direct fix

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3 (test verification)
  - **Blocked By**: None (can start immediately)

  **References** (CRITICAL - Be Exhaustive):

  **Pattern References** (existing code to follow):
  - `src/lib/composio-gemini.ts:41` - Line with incorrect model name to fix
  - `src/lib/composio-gemini.ts:48` - Second occurrence to fix
  - `src/lib/composio-gemini.ts:84` - Third occurrence to fix

  **External References** (libraries and frameworks):
  - Genkit Google AI docs: https://firebase.google.com/docs/genkit/plugins/google-genai - Supported model names

  **WHY Each Reference Matters**:
  - Line references show exactly where the incorrect model names are located
  - Genkit docs confirm correct model names (gemini-2.0-flash, not gemini-3)

  **Acceptance Criteria**:

  **If TDD (tests enabled):**
  - [ ] Test file created: N/A (fixing existing code)
  - [ ] npm run test → 3 previously failing tests now PASS

  **QA Scenarios (MANDATORY - task is INCOMPLETE without these):**

  ```
  Scenario: Verify model name fix in inferWithGemini
    Tool: Bash (npm)
    Preconditions: composio-gemini.ts has incorrect model name
    Steps:
      1. Read src/lib/composio-gemini.ts and find line 41
      2. Verify model name is 'googleai/gemini-3-flash-preview' (before fix)
      3. Edit line 41 to 'googleai/gemini-2.0-flash'
      4. Edit line 48 to 'googleai/gemini-2.0-flash'
      5. Edit line 84 to 'googleai/gemini-2.0-flash'
    Expected Result: All 3 lines now use 'googleai/gemini-2.0-flash'
    Failure Indicators: Any line still contains 'gemini-3' or 'gemini-3.1'
    Evidence: .sisyphus/evidence/task-1-model-fix.txt

  Scenario: Verify no invalid model names remain
    Tool: Bash (grep)
    Preconditions: Fix applied
    Steps:
      1. grep -r "gemini-3" src/lib/composio-gemini.ts
      2. Confirm no matches found
    Expected Result: grep returns no matches (model name removed)
    Failure Indicators: grep finds 'gemini-3' anywhere in file
    Evidence: .sisyphus/evidence/task-1-grep-verify.txt
  ```

  **Evidence to Capture:**
  - [ ] Each evidence file named: task-1-{scenario-slug}.{ext}
  - [ ] Text files showing model name changes

  **Commit**: YES
  - Message: `fix(composio): correct Gemini model names in composio-gemini.ts`
  - Files: `src/lib/composio-gemini.ts`
  - Pre-commit: `npm run test`

- [ ] 2. Fix Gemini model names in composio-gemini.test.ts

  **What to do**:
  - Replace incorrect expected model names in test file
  - Lines to fix: 45, 66, 95 in `src/lib/composio-gemini.test.ts`
  - Change `'googleai/gemini-3.1-flash-lite-preview'` to `'googleai/gemini-2.0-flash'`
  - Align test expectations with actual implementation from Task 1

  **Must NOT do**:
  - Do NOT use `gemini-3.1-flash-lite-preview` (doesn't exist)
  - Do NOT change test logic or assertions
  - Do NOT add new tests (scope: fix only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Test file fix, simple string replacement to match implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3 (test verification)
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/lib/composio-gemini.test.ts:45` - First incorrect model expectation
  - `src/lib/composio-gemini.test.ts:66` - Second incorrect model expectation
  - `src/lib/composio-gemini.test.ts:95` - Third incorrect model expectation

  **WHY**:
  - Tests expect specific model strings that need to match the fixed implementation

  **Acceptance Criteria**:
  - [ ] npm run test → Tests pass (model names match implementation)

  **QA Scenarios**:

  ```
  Scenario: Verify test file model name fix
    Tool: Bash (npm)
    Preconditions: composio-gemini.test.ts has wrong model expectations
    Steps:
      1. Read src/lib/composio-gemini.test.ts lines 45, 66, 95
      2. Verify they contain 'googleai/gemini-3.1-flash-lite-preview'
      3. Replace all occurrences with 'googleai/gemini-2.0-flash'
    Expected Result: All 3 lines now expect 'googleai/gemini-2.0-flash'
    Evidence: .sisyphus/evidence/task-2-test-fix.txt
  ```

  **Commit**: YES
  - Message: `test(composio): update tests for correct Gemini model names`
  - Files: `src/lib/composio-gemini.test.ts`
  - Pre-commit: `npm run test`

- [ ] 3. Run tests to verify model name fix

  **What to do**:
  - Run vitest to confirm all 77 tests pass (74 existing + 3 fixed)
  - Run typecheck to ensure no TypeScript errors
  - Report final test count and any failures

  **Must NOT do**:
  - Do NOT fix additional bugs (scope: verification only)
  - Do NOT modify test files (already done in Tasks 1-2)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running test commands, verification step
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1 and 2)
  - **Parallel Group**: Sequential (after Wave 1)
  - **Blocks**: Task 4 (integration work)
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `package.json:14` - Test script: "test": "vitest"
  - `package.json:12` - Typecheck script: "typecheck": "tsc --noEmit"

  **Acceptance Criteria**:
  - [ ] `npm run test` → 77 tests passed, 0 failures
  - [ ] `npm run typecheck` → 0 errors

  **QA Scenarios**:

  ```
  Scenario: Verify all tests pass after model name fix
    Tool: Bash (npm)
    Preconditions: Tasks 1 and 2 completed
    Steps:
      1. Run npm run test
      2. Count passing tests (expect 77: 74 existing + 3 fixed)
      3. Verify 0 failures
    Expected Result: Test output shows "77 tests passed, 0 failed"
    Failure Indicators: Any test failure, especially in composio-gemini.test.ts
    Evidence: .sisyphus/evidence/task-3-test-results.txt

  Scenario: Verify TypeScript typecheck passes
    Tool: Bash (npm)
    Preconditions: All code changes complete
    Steps:
      1. Run npm run typecheck
      2. Check for TypeScript errors
    Expected Result: "0 errors" or clean output
    Failure Indicators: Any TS error reported
    Evidence: .sisyphus/evidence/task-3-typecheck.txt
  ```

  **Commit**: NO (verification step, no code changes)

- [ ] 4. Rewrite composio-gemini.ts to use correct Composio pattern

  **What to do**:
  - **REWRITE** `src/lib/composio-gemini.ts` to use the **correct Composio integration pattern** (per Composio docs)
  - Replace Genkit (`ai.generate()`) with native `@google/genai` client
  - Use `composio.create(user_id)` → `session.tools()` → pass to Google GenAI client
  - Implement **agentic loop**: Call Gemini → execute tool calls → re-prompt until text response
  - Reference: https://docs.composio.dev/docs/providers/google (TypeScript example)

  **Correct Pattern (from Composio docs)**:
  ```typescript
  import { Composio } from '@composio/core';
  import { GoogleProvider } from '@composio/google';
  import { GoogleGenAI, type Part } from '@google/genai';

  const composio = new Composio({ provider: new GoogleProvider() });
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

  // In runComposioAgent():
  const session = await composio.create(userId);
  const tools = await session.tools();

  const chat = ai.chats.create({
    model: 'gemini-3-flash-preview',  // Per user's reference docs
    config: { tools: [{ functionDeclarations: tools }] },
  });

  let response = await chat.sendMessage({ message: userMessage });

  // Agentic loop — execute tool calls until text response
  while (response.functionCalls && response.functionCalls.length > 0) {
    const parts: Part[] = [];
    for (const fc of response.functionCalls) {
      const result = await composio.provider.executeToolCall(userId, {
        name: fc.name || '',
        args: (fc.args || {}) as Record<string, unknown>,
      });
      parts.push({ functionResponse: { id: fc.id, name: fc.name, response: JSON.parse(result) } });
    }
    response = await chat.sendMessage({ message: parts });
  }
  return { response: response.text, iterations: ..., toolsUsed: [...] };
  ```

  **Must NOT do**:
  - Do NOT use Genkit (`ai.generate()`) - switch to native `@google/genai`
  - Do NOT manually lookup connectedAccountId (use `composio.create(user_id)` instead)
  - Do NOT change tool slugs in composio-tools-mapping.ts (already correct)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complete rewrite requires understanding Composio + Google GenAI APIs
  - **Skills**: []
    - Composio integration is the core task
  - **Skills Evaluated but Omitted**:
    - `developing-genkit-js`: Not needed - switching AWAY from Genkit

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1-2 for model name clarity)
  - **Parallel Group**: Wave 2 (after Wave 1)
  - **Blocks**: Task 9 (manual verification)
  - **Blocked By**: Tasks 1, 2 (model name decisions)

  **References** (CRITICAL):

  **Pattern References (from Composio docs)**:
  - https://docs.composio.dev/docs/providers/google - TypeScript example with `gemini-3-pro-preview`
  - `src/lib/composio-tools-mapping.ts:16-28` - Tool slugs (already correct UPPERCASE)
  - `src/lib/composio-client.ts` - May be refactored (now using `composio.create()`)

  **API References**:
  - `@google/genai` docs: https://ai.google.dev/docs - Google GenAI SDK
  - Composio session.tools() returns tools in Gemini function calling format

  **WHY Each Reference Matters**:
  - Composio docs show the EXACT pattern to follow (not Genkit)
  - Tool slugs are already correct - don't change them
  - composio-client.ts may need updates to use `composio.create()` pattern

  **Acceptance Criteria**:

  **If TDD (tests enabled):**
  - [ ] Test file updated: composio-gemini.test.ts tests now verify agentic loop works
  - [ ] npm run test → All tests pass

  **QA Scenarios**:

  ```
  Scenario: Verify correct Composio pattern implemented
    Tool: Bash (read)
    Preconditions: Task 4 implementation complete
    Steps:
      1. Read src/lib/composio-gemini.ts
      2. Verify imports: `Composio` from '@composio/core', `GoogleProvider` from '@composio/google', `GoogleGenAI` from '@google/genai'
      3. Verify `composio.create(userId)` is used (not `new Composio()` + manual lookup)
      4. Verify agentic loop: while (response.functionCalls) { execute tools → re-prompt }
    Expected Result: Code follows Composio docs pattern exactly
    Failure Indicators: Still using Genkit, no agentic loop, manual connectedAccountId lookup
    Evidence: .sisyphus/evidence/task-4-pattern-check.txt

  Scenario: Verify agentic loop executes tools
    Tool: Bash (vitest)
    Preconditions: Mock setup complete
    Steps:
      1. Run npm run test -- composio-gemini.test.ts
      2. Mock a tool call response from Gemini
      3. Verify executeToolCall is called
      4. Verify loop continues and eventually returns text
    Expected Result: Test passes, toolsUsed populated, agentic loop works
    Failure Indicators: Test fails, no tool execution, infinite loop
    Evidence: .sisyphus/evidence/task-4-loop-test.txt
  ```

  **Evidence to Capture:**
  - [ ] task-4-pattern-check.txt - Code review showing correct pattern
  - [ ] task-4-loop-test.txt - Test output showing agentic loop works

  **Commit**: YES
  - Message: `refactor(composio): rewrite to use correct Composio pattern with @google/genai`
  - Files: `src/lib/composio-gemini.ts`, possibly `src/lib/composio-client.ts`
  - Pre-commit: `npm run test`

- [ ] 5. Add error handling improvements to composio-client.ts

  **What to do**:
  - Improve error handling in catch blocks (lines 179, 212, 238, 260, 294)
  - Currently, `mapGoogleDocsErrorToComposio()` and `mapGoogleDriveErrorToComposio()` always throw
  - Add retry logic for rate limit errors (HTTP 429)
  - Add logging for debugging without exposing sensitive data
  - Consider adding fallback to googleapis for specific error types

  **Must NOT do**:
  - Do NOT change the error mapping functions in composio-tools-mapping.ts
  - Do NOT remove the Composio client (this is about improving it)
  - Do NOT add exponential backoff beyond 3 retries

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Error handling patterns require careful implementation
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 6)
  - **Parallel Group**: Wave 2 (with Task 6)
  - **Blocks**: Task 9 (manual verification)
  - **Blocked By**: None (can start after Wave 1, but independent)

  **References**:

  **Pattern References**:
  - `src/lib/composio-client.ts:179` - mapGoogleDocsErrorToComposio call
  - `src/lib/composio-client.ts:212` - Second error mapping call
  - `src/lib/composio-client.ts:238` - Drive error mapping
  - `src/lib/composio-tools-mapping.ts:177-227` - Error mapping definitions

  **WHY**:
  - Error handling at these lines needs retry logic for rate limits
  - Error mappings are already defined, just need better handling

  **Acceptance Criteria**:
  - [ ] Rate limit errors (429) trigger retry with exponential backoff (max 3)
  - [ ] Other errors still throw after mapping
  - [ ] npm run test passes

  **QA Scenarios**:

  ```
  Scenario: Verify retry logic for rate limits
    Tool: Bash (vitest)
    Preconditions: Mock Composio client that fails with 429 twice then succeeds
    Steps:
      1. Create test that triggers rate limit error
      2. Verify retry is attempted (call count > 1)
      3. Verify eventual success after retries
    Expected Result: Function succeeds after 2 retries
    Failure Indicators: No retries attempted, or gives up after 1 failure
    Evidence: .sisyphus/evidence/task-5-retry.txt
  ```

  **Commit**: YES
  - Message: `fix(composio): improve error handling in composio-client.ts`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `npm run test`

- [ ] 6. Update ComposioClient interface if needed

  **What to do**:
  - Review `ComposioClient` interface (composio-client.ts:28-43)
  - Check if `runComposioAgent()` integration requires interface changes
  - Ensure interface matches implementation after Task 4
  - Add any missing method signatures

  **Must NOT do**:
  - Do NOT change method signatures unless Task 4 requires it
  - Do NOT add methods that aren't implemented

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Interface review and minor updates
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2 (with Task 5)
  - **Blocks**: Task 9 (manual verification)
  - **Blocked By**: Task 4 (may require interface changes)

  **References**:
  - `src/lib/composio-client.ts:28-43` - Current interface definition
  - `src/lib/composio-gemini.ts` - Implementation that may need interface support

  **Acceptance Criteria**:
  - [ ] Interface matches implementation
  - [ ] No TypeScript errors (npm run typecheck)

  **QA Scenarios**:

  ```
  Scenario: Verify interface matches implementation
    Tool: Bash (npm)
    Preconditions: Task 4 completed
    Steps:
      1. Run npm run typecheck
      2. Verify 0 TypeScript errors
    Expected Result: Clean typecheck output
    Failure Indicators: TypeScript errors about missing methods or wrong signatures
    Evidence: .sisyphus/evidence/task-6-typecheck.txt
  ```

  **Commit**: YES (if changes needed)
  - Message: `fix(composio): update ComposioClient interface for Gemini integration`
  - Files: `src/lib/composio-client.ts`
  - Pre-commit: `npm run typecheck`

- [ ] 7. Run full vitest suite.

  **What to do**:
  - Run complete vitest suite to verify all tests pass
  - Confirm 77 tests passing (74 existing + 3 fixed from composio-gemini.test.ts)
  - Report any failures and fix them

  **Must NOT do**:
  - Do NOT fix unrelated test failures (scope: composio tests only)
  - Do NOT skip failing tests

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running test command, verification step
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 8)
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Task 4, Task 5, Task 6

  **References**:
  - `package.json:14` - Test script: "test": "vitest"

  **Acceptance Criteria**:
  - [ ] `npm run test` → 77 tests passed, 0 failures
  - [ ] All composio tests green

  **QA Scenarios**:

  ```
  Scenario: Verify all 77 tests pass
    Tool: Bash (npm)
    Preconditions: All implementation tasks complete
    Steps:
      1. Run npm run test
      2. Count passing tests (expect 77)
      3. Verify 0 failures
    Expected Result: Test output shows "77 tests passed, 0 failed"
    Failure Indicators: Any test failure
    Evidence: .sisyphus/evidence/task-7-test-results.txt
  ```

  **Commit**: NO (verification step)

- [ ] 8. Run typecheck.

  **What to do**:
  - Run TypeScript type checking to verify no type errors
  - Fix any TypeScript errors found
  - Ensure type safety across all modified files

  **Must NOT do**:
  - Do NOT use `any` type to suppress errors
  - Do NOT skip type checking

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running typecheck command, verification step
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 7)
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Task 4, Task 5, Task 6

  **References**:
  - `package.json:12` - Typecheck script: "typecheck": "tsc --noEmit"

  **Acceptance Criteria**:
  - [ ] `npm run typecheck` → 0 errors

  **QA Scenarios**:

  ```
  Scenario: Verify TypeScript typecheck passes
    Tool: Bash (npm)
    Preconditions: All implementation tasks complete
    Steps:
      1. Run npm run typecheck
      2. Check for TypeScript errors
    Expected Result: "0 errors" or clean output
    Failure Indicators: Any TS error reported
    Evidence: .sisyphus/evidence/task-8-typecheck.txt
  ```

  **Commit**: NO (verification step)

- [ ] 9. Manual verification of Composio+Gemini flow.

  **What to do**:
  - Test the full Composio+Gemini integration flow
  - Verify `runComposioAgent()` actually calls Composio tools
  - Test with a sample prompt that triggers tool usage
  - Verify toolsUsed array is populated correctly

  **Must NOT do**:
  - Do NOT modify implementation during verification
  - Do NOT skip this verification (critical for ensuring Task 4 works)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Manual testing of integration, may need debugging
  - **Skills**: []
  - **Skills Evaluated but Omitted**: None

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 4-6)
  - **Parallel Group**: Wave 3 (sequential after 7-8)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Task 4, Task 5, Task 6

  **References**:
  - `src/lib/composio-gemini.ts:74-91` - Implementation to verify
  - `src/lib/composio-gemini.test.ts` - Test coverage to review

  **Acceptance Criteria**:
  - [ ] `runComposioAgent()` successfully calls Composio tools
  - [ ] toolsUsed array populated with tool names
  - [ ] No runtime errors

  **QA Scenarios**:

  ```
  Scenario: Verify Composio+Gemini integration works
    Tool: Bash (vitest)
    Preconditions: Task 4 completed, tools wired up
    Steps:
      1. Run npm run test -- composio-gemini.test.ts
      2. Check that toolsUsed is populated (not empty [])
      3. Verify agent response is meaningful
    Expected Result: toolsUsed contains tool names, response is valid
    Failure Indicators: toolsUsed is empty, or errors during execution
    Evidence: .sisyphus/evidence/task-9-integration.txt
  ```

  **Commit**: NO (verification step)

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `npm run typecheck` + vitest. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill if UI)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1**: `fix(composio): correct Gemini model names in composio-gemini.ts` - composio-gemini.ts, npm run test
- **2**: `test(composio): update tests for correct Gemini model names` - composio-gemini.test.ts, npm run test
- **3**: `feat(composio): wire up Composio tools to Gemini agent` - composio-gemini.ts, npm run test
- **4**: `fix(composio): improve error handling in composio-client.ts` - composio-client.ts, npm run test

---

## Success Criteria

### Verification Commands
```bash
npm run test  # Expected: 77 tests passing (74 + 3 fixed)
npm run typecheck  # Expected: 0 errors
```

### Final Checklist
- [ ] All "Must Have" present (correct model names, wired tools, tests passing)
- [ ] All "Must NOT Have" absent (no version upgrades, no google-docs-actions.ts removal)
- [ ] All tests pass (npm run test)
- [ ] TypeScript typecheck passes (npm run typecheck)
