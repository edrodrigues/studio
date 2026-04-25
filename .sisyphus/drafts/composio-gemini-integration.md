# Draft: Composio + Gemini Integration for Google Docs Editing

## Requirements (confirmed)
- Integrate Composio + Gemini in the current project
- Specifically for the "Gerar e Revisar" page
- When user needs to edit Google Docs files

## Research Findings

### Project Stack
- **Framework**: Next.js 16.1.6 + App Router + TypeScript
- **AI**: Genkit 1.20 + Google AI plugin (Gemini already configured)
- **Auth**: Firebase Auth with Google OAuth (access token in sessionStorage)
- **DB**: Firebase Firestore
- **Existing Google API**: `googleapis` npm package, direct API calls with OAuth token
- **Composio**: API key already in `.env.local` (`COMPOSIO_API_KEY=ak_pV1Sby-_bW-IqgBXfTPC`)

### "Gerar e Revisar" Page
- **Location**: `src/app/(main)/gerar-exportar/page.tsx` (721 lines)
- **Current Flow**: Select docs → Select templates → Validate → Generate (deterministic placeholder replacement) → Review
- **Generation**: Copies Google Doc template → batchUpdate with placeholder replacements
- **Google Docs API**: `src/lib/google-docs.ts` - getDocumentContent, getDocumentPlaceholders, batchUpdateDocument
- **Google Drive API**: `src/lib/google-drive.ts` - getFileMetadata, copyFile, shareFile

### Existing AI Flows (10 in `src/ai/flows/`)
1. extract-entities-from-documents.ts
2. extract-template-from-document.ts
3. get-assistance-from-gemini.ts
4. get-document-feedback.ts
5. get-playbook-assistance.ts
6. analyze-document-consistency.ts
7. match-entities-to-placeholders.ts
8. generate-contract-in-docs.ts (deterministic, not AI-driven)

### Composio Integration Options
1. **MCP** (already configured in opencode.json) - tools appear in OpenCode session
2. **Native SDK** (`@composio/core` + `@composio/google`) - tools passed to Gemini function calling
3. **Managed Auth** - Composio handles Google OAuth instead of Firebase Auth

### Key Files
- `src/ai/genkit.ts` - Genkit configuration
- `src/lib/actions/google-docs-actions.ts` - Server actions for Google Docs
- `src/lib/actions.ts` - Main server actions file
- `src/lib/google-docs.ts` - Google Docs API client
- `src/lib/google-drive.ts` - Google Drive API client
- `src/context/auth-context.tsx` - Auth context with Google OAuth
- `src/firebase/provider.tsx` - Firebase context

## Decisions Made
1. **Integration Mode**: REPLACE existing googleapis calls with Composio SDK
2. **AI Edit Type**: Hybrid - template + AI enrichment (copy template first, then Gemini enriches/rewrites sections beyond simple placeholder replacement)
3. **Auth for Google Docs**: Composio-managed OAuth (users connect Google account via Composio)
4. **App Login Auth**: Keep Firebase Auth for user identity/login
5. **Review Tab**: Yes, with AI review (Gemini reviews own output + suggests improvements)

## Technical Decisions
- Use `@composio/core` + `@composio/google` (Native SDK with GoogleProvider)
- Gemini function calling with Composio tools for Google Docs operations
- Composio session created per user (user_id = Firebase uid)
- Keep Firebase Auth for app identity, Composio for Google Docs tool auth
- Hybrid generation: deterministic placeholder replacement first, then AI enrichment pass

## Scope Boundaries
- INCLUDE:
  - Replace googleapis calls in google-docs.ts and google-drive.ts with Composio tools
  - Add Composio Google OAuth connection flow in "Gerar e Revisar" page
  - Create new Genkit flow for AI-enriched contract generation
  - Add AI review step in Review tab
  - Update gerar-exportar page UI for new workflow
- EXCLUDE:
  - Changing Firebase Auth (kept as-is for login)
  - Other pages beyond "Gerar e Revisar"
  - Non-Google Docs features

6. **Composio Connection Flow**: On-demand - prompt user to connect Google when they first try a Docs operation

## Test Infrastructure
- **Exists**: YES (Vitest + Playwright + @testing-library/react)
- **Coverage**: v8 provider, `npm run test:coverage`
- **Pattern**: vi.hoisted + vi.mock for module mocking (see google-docs-actions.test.ts)
- **CI**: NO GitHub Actions configured
- **Decision**: Tests-after (new feature, not TDD-friendly with external API integrations)

7. **Dual OAuth**: Option B - Firebase for login only (remove Docs scopes), Composio handles all Docs operations
8. **AI Enrichment**: Context-aware placeholder substitution — Gemini substitutes placeholders with information inferred from context + uploaded documents (not simple text replace, but AI-inferred content)
9. **AI Review**: Auto-apply improvements + show before/after diff. User can undo.

## Metis Directives (incorporated into plan)
- Phase work: (1) Composio migration, (2) AI enrichment, (3) AI review
- Create Composio tool coverage mapping table before implementation
- Preserve error taxonomy, map Composio errors to existing types
- Create thin adapter layer (src/lib/composio-client.ts) for testability
- Keep googleapis until Composio migration is verified
- Preserve resolveTemplateSource() fallback logic
- Handle Composio connection states (ACTIVE, INITIATED, EXPIRED, FAILED, INACTIVE) in UI
- AI enrichment is optional — deterministic generation still works
- Do NOT mix migration code with new feature code

## Open Questions
- None remaining
