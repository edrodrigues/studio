# Design: Chatbot-Driven Document Generation (/gerar-exportar)

**Date:** 2026-05-18
**Status:** Approved

## Overview

Replace the current button-driven document generation flow on `/gerar-exportar` with a conversational, step-by-step experience powered by Alex (the chatbot) using Composio's agentic loop.

## User Flow

1. User lands on `/gerar-exportar` and reads the explanation card
2. User selects a **Project** (all indexed documents become context)
3. User selects a **Document Model** (contract template)
4. Alex prompts: "Ready to generate?" with a "Start" button
5. Step-by-step execution in chat:
   - **Step 1 — Copy:** Alex copies template to user's Google Drive → shows status + "Proceed to customization?" button
   - **Step 2 — Customize:** Alex fills placeholders using project context → shows status + summary of filled fields + "Open for inspection?" button
   - **Step 3 — Open:** Alex opens document in Google Docs → shows success + direct link
6. Below chat: history table of generated documents for the selected project

## Architecture

### Layout (3 zones)

```
┌─────────────────────────────────────────────┐
│  ℹ️ How this page works (dismissible card)  │
├─────────────────────────────────────────────┤
│  Project: [Dropdown ▾]   Template: [▾]     │
├─────────────────────────────────────────────┤
│                                             │
│           Alex Chat Interface               │
│         (inline, not floating)              │
│                                             │
├─────────────────────────────────────────────┤
│  📄 Generated Documents History Table       │
└─────────────────────────────────────────────┘
```

### Zone 1: Explanation Card
- Dismissible info card with Portuguese copy
- 3-step visual indicator: "1. Copiar → 2. Personalizar → 3. Abrir"
- Dismissal preference saved in `localStorage`

### Zone 2: Selectors + Alex Chat
- **Project selector:** Dropdown showing projects with indexed documents. Filters to projects with `DocumentStatus.INDEXED` documents.
- **Template selector:** Dropdown showing `contractModels` filtered by selected project's contract type. Shows template name + health badge.
- **Alex Chat:** Inline version of `playbook-chat-widget.tsx` (not floating). Receives `selectedProjectId`, `selectedTemplateId`, `indexedDocuments[]` as props. Uses `runComposioAgent` from `composio-gemini.ts` for step-by-step execution.

### Zone 3: Generated Documents History
- Table showing `projectContracts` for the selected project
- Columns: Name, Template, Date, Status, Actions (Open in Google Docs, Preview, Delete)
- Auto-refreshes after generation completes

## Key Technical Decisions

- **Alex runs inline** on this page; floating widget is hidden on `/gerar-exportar`
- **Context passed as props** to Alex component
- **Agentic loop** uses `runComposioAgent` (`composio-gemini.ts`) to orchestrate 3 steps via Composio tools
- **Server actions** (`composio-actions.ts`) handle heavy lifting: `generateContractDoc`, `prepareContractData`, etc.
- **Existing Composio integrations** reused: GoogleDocs toolkit (copy, replace text), GoogleDrive toolkit (permissions, metadata)
- **Firestore collections** reused: `projectContracts`, `users/{uid}/filledContracts`, `projectDocuments`, `contractModels`

## Data Flow

```
User selects Project → fetches indexed documents
User selects Template → fetches template googleDocLink
Alex receives context → initiates agentic loop
  Step 1: GOOGLEDOCS_COPY_DOCUMENT → returns new docId
  Step 2: GOOGLEDOCS_REPLACE_ALL_TEXT (or batchUpdateDocument) → fills placeholders
  Step 3: GOOGLEDRIVE_CREATE_PERMISSION or opens URL → user inspects
Alex updates UI → proceeds to next step on user confirmation
Firestore updated → history table refreshes
```

## Error Handling

- **Composio not connected:** Show OAuth connection dialog (reuse `composio-connection.tsx`)
- **Template validation failed:** Show error in chat with retry option
- **Placeholder replacement failed:** Show partial results + manual edit suggestion
- **Google Drive permission error:** Prompt user to re-authenticate

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/app/(main)/gerar-exportar/page.tsx` | Rewrite with new 3-zone layout |
| `src/components/app/playbook-chat-widget.tsx` | Add inline mode variant |
| `src/lib/composio-gemini.ts` | Wire `runComposioAgent` into step-by-step flow |
| `src/components/app/composio-connection.tsx` | Reuse as-is |
| `src/lib/actions/composio-actions.ts` | Reuse/extend existing actions |
| `src/components/app/generate-export-selectors.tsx` | New: project + template selectors |
| `src/components/app/generate-export-history.tsx` | New: generated documents history table |
| `src/components/app/generate-export-explanation.tsx` | New: explanation card |
