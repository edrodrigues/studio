# Architecture — V-Lab Assistant

> Visão geral arquitetural do sistema.
> Gerado pelo Architect em 2026-05-03 | Nível: Completo

---

## Visão Geral

O **V-Lab Assistant** é uma plataforma de gestão e geração inteligente de contratos jurídicos, construída como uma aplicação **Next.js 16** (App Router) com **Firebase** como backend principal e **Google Genkit** como engine de IA.

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|---|---|---|
| **Frontend** | Next.js (App Router), React | 16.x / 18.x |
| **Estilização** | Tailwind CSS, shadcn/ui, Radix UI | 3.4.x |
| **Rich Text** | Tiptap (com tipap-markdown) | 3.15.x |
| **Backend** | Next.js API Routes + Server Actions | 16.x |
| **Auth** | Firebase Authentication | 11.x |
| **Database** | Firebase Firestore (19 coleções) | 11.x |
| **Storage** | Cloudflare R2 (primário) + Firebase Storage (fallback) | S3-compatible |
| **AI** | Google Genkit + Gemini (gemini-3-flash-preview) | 1.20.x |
| **Google Workspace** | Composio (OAuth + API wrapper) | 0.6.x |
| **Hosting** | Vercel (com Cron Jobs) | — |
| **Language** | TypeScript | 5.x |
| **Testing** | Vitest (unit), Playwright (e2e) | 4.x / 1.x |

---

## Padrões Arquiteturais

### 1. Server-First com Server Actions

O sistema usa **React Server Components** e **Server Actions** como padrão primário para operações de escrita, mantendo a lógica sensível (auth, AI, storage) no servidor.

```
Client (Browser)
    │
    ├── Firebase SDK → leitura em tempo real (Firestore)
    ├── Server Actions → operações de escrita
    │   ├── Auth actions (signIn, signUp, logout)
    │   ├── Storage actions (upload, download, migrate)
    │   ├── AI actions (assistance, review, enrich)
    │   ├── Sync actions (templates, FAQ, File Search)
    │   └── Google actions (docs, drive via Composio)
    └── API Routes → endpoints externos (CRON, OAuth callback)
```

### 2. Real-time via Firestore Listeners

- Presença de usuários (heartbeat a cada 60s)
- Documentos, placeholders, contratos (atualizações em tempo real)
- Notificações push via listener

### 3. AI Flows via Genkit

12 flows Genkit executados no servidor, invocados via Server Actions:
- **Extração**: `extractEntitiesFromDocuments`, `extractTemplateFromDocument`
- **Match**: `matchEntitiesToPlaceholders`
- **Geração**: `generateContractInDocs`, `aiEnrichContract`
- **Review**: `aiReviewContract`, `analyzeDocumentConsistency`, `getDocumentFeedback`
- **Assistência**: `getAssistanceFromGemini`, `getPlaybookAssistance`

### 4. Dual Storage Provider

- **R2** (Cloudflare): Storage primário, presigned URLs para upload/download
- **Firebase Storage**: Fallback durante migração
- `storageProvider` field em `ProjectDocument` para rastrear origem

### 5. Non-blocking Writes

Operações Firestore são fire-and-forget com error handling via pub/sub:
- `error-emitter.ts` tipado com eventos: `permission-error`, `firestore-error`, `auth-error`
- UI não bloqueia durante writes
- Toasts de erro sem interromper interação

---

## Integrações Externas

| Integração | Protocolo | Direção | Uso |
|---|---|---|---|
| Firebase Auth | HTTPS (SDK) | Bidirecional | Login, sessão, perfil |
| Firestore | HTTPS + WebSocket | Bidirecional | CRUD, real-time listeners |
| Cloudflare R2 | HTTPS (AWS SDK v3) | Bidirecional | Upload/download documentos |
| Gemini AI | HTTPS (Genkit SDK) | Bidirecional | 12 flows de IA |
| Composio | HTTPS (REST SDK) | Bidirecional | OAuth Google, Workspace API |
| Google Docs/Drive | Via Composio | Bidirecional | Criação, edição, export de contratos |
| Google AI File Search | HTTPS (VertexAI SDK) | Bidirecional | Index semântico para ALEX |
| Site Oficial V-LAB | HTTPS (scraping) | Inbound | Templates e FAQ |
| Vercel Cron | HTTPS | Inbound | Jobs agendados (daily/weekly) |

---

## Dívidas Técnicas Identificadas

### 🔴 Críticas

| ID | Descrição | Impacto | Localização |
|---|---|---|---|
| DT-001 | **Firebase Auth error codes hard-coded em 3 tabelas separadas** | Duplicação, risco de inconsistência | `src/context/auth-context.tsx` (linhas 61, 99, 140) |
| DT-002 | **`allow create: if true` em feedback collections** | Qualquer request autenticado pode criar feedback sem validação | `firestore.rules:475, 487` |
| DT-003 | **CRC32 checksum desabilitado no AWS SDK v3** | Hotfix para incompatibilidade com R2 — pode mascarar corrupção de dados | `src/lib/actions/storage-actions.ts` (commit `6608dac`) |

### 🟡 Moderadas

| ID | Descrição | Impacto | Localização |
|---|---|---|---|
| DT-004 | **Scraping de HTML frágil** para templates e FAQ | Quebra se site oficial muda layout | `src/lib/official-templates-parser.ts`, `src/lib/faq-content-parser.ts` |
| DT-005 | **Composio SDK imaturo** — múltiplos hotfixes em poucos dias | Instabilidade na integração Google Workspace | `src/lib/composio-client.ts`, commits `d37eb88`, `209b099`, `084d5c7` |
| DT-006 | **Presença sem cleanup automático** — registros stale podem acumular | Performance degrade com muitos usuários | `src/hooks/use-projects.ts:1040` |
| DT-007 | **TODO: Send notification email to invitee** | Funcionalidade incompleta | `src/hooks/use-projects.ts:371` |
| DT-008 | **Migração de memberships em progresso** — IDs aleatórios coexistem com determinísticos | Complexidade de manutenção | `src/hooks/use-projects.ts` |

### 🟢 Leves

| ID | Descrição | Impacto | Localização |
|---|---|---|---|
| DT-009 | **`nextn` como nome do package** — genérico | Confusão em logs e CI/CD | `package.json` |
| DT-010 | **Overrides de `markdown-it`** — versão pinned para 13.0.2 | Pode ficar desatualizado com vulnerabilidades | `package.json:20` |
| DT-011 | **Sem testes unitários para AI flows** | Risco de regressão em prompts Genkit | `src/ai/flows/` |
| DT-012 | **`firebase-admin` no client bundle** — risco de tree-shaking inadequado | Bundle size inflado | `package.json:70` |

---

## Decisões Arquiteturais Notáveis

1. **Firestore como single source of truth** — todo estado de aplicação flui pelo Firestore, mesmo operações que poderiam ser locais.
2. **Denormalização intencional** — `memberCount`, `documentCount`, `placeholderCount`, `contractCount` no `Project` para evitar queries aggregations caras.
3. **Immutable logs** — `activity` e `syncEvents` são append-only por design (security rules bloqueiam update/delete).
4. **Versioning para conflict resolution** — `version` field em `ProjectPlaceholder` e `ProjectContract` para detecção de conflitos de edição.
5. **Dual storage strategy** — R2 como primário com Firebase Storage fallback permite migração gradual sem downtime.
