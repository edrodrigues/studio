# Inventário do Projeto — V-Lab Assistant

**Gerado em**: 2026-05-02
**Projeto**: Assistente de Contratos V-LAB
**Linguagem Principal**: TypeScript
**Total de Arquivos**: 263
**Total de Diretórios**: 95

---

## 1. Tecnologias e Frameworks

### Linguagens

| Linguagem | Extensões | Arquivos |
|-----------|-----------|----------|
| TypeScript (React) | `.tsx` | 95 |
| TypeScript | `.ts` | 77 |
| Markdown | `.md` | 1 |
| JSON | `.json` | 1 |
| CSS | `.css` | 1 |
| SVG | `.svg` | 1 |

### Framework Principal

- **Next.js 16** (App Router, com Turbopack)
- **React 18**
- **TypeScript 5**
- **Tailwind CSS 3.4**
- **Google Genkit 1.20** (AI Engine)
- **Firebase 11** (Auth, Firestore, Storage, App Hosting)

### UI Components

- **Shadcn UI** (36 componentes)
- **Radix UI** (primitivos acessíveis)
- **Tiptap 3.15** (editor rich text)
- **Framer Motion 12** (animações)
- **Lucide React** (ícones)
- **Recharts** (gráficos)

### Cloud & Integrações

- **Firebase** (Firestore, Auth, Storage, App Hosting)
- **Google Gemini API** (IA generativa)
- **Google Docs API** (geração de documentos)
- **Google Drive API** (storage)
- **Cloudflare R2** (storage compatível com S3)
- **Composio** (integração de ferramentas AI)
- **Vercel** (deploy + cron jobs)

---

## 2. Estrutura de Pastas

```
studio/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── (main)/                   # Rotas protegidas
│   │   │   ├── admin/                # Painel admin (feedback)
│   │   │   ├── como-usar/            # Guia de uso
│   │   │   ├── documentos-iniciais/  # Documentos iniciais
│   │   │   ├── feedback/             # Página de feedback
│   │   │   ├── gerar-exportar/       # Geração e exportação
│   │   │   ├── migrate/              # Migração
│   │   │   ├── modelos/              # Modelos de contrato
│   │   │   ├── preencher/[id]/       # Preenchimento de contrato
│   │   │   ├── projects/             # Gestão de projetos
│   │   │   │   └── [projectId]/      # Projeto individual
│   │   │   │       ├── activity/     # Log de atividade
│   │   │   │       ├── contracts/    # Contratos gerados
│   │   │   │       ├── documents/    # Documentos do projeto
│   │   │   │       ├── members/      # Membros do projeto
│   │   │   │       ├── placeholders/ # Placeholders extraídos
│   │   │   │       └── settings/     # Configurações do projeto
│   │   ├── api/                      # API Routes
│   │   │   ├── admin/                # Endpoints admin
│   │   │   │   ├── test-faq-sync/
│   │   │   │   └── test-sync/
│   │   │   ├── composio/             # Callback Composio
│   │   │   │   └── callback/
│   │   │   ├── cron/                 # Jobs agendados
│   │   │   │   ├── sync-faq-content/
│   │   │   │   └── sync-templates/
│   │   │   └── feedback/             # Endpoint feedback
│   │   ├── auth/                     # Autenticação
│   │   ├── privacy/                  # Política de privacidade
│   │   ├── terms/                    # Termos de uso
│   │   ├── layout.tsx                # Layout raiz
│   │   ├── page.tsx                  # Landing page
│   │   └── globals.css               # Estilos globais
│   │
│   ├── ai/                           # Google Genkit AI
│   │   ├── flows/                    # Fluxos de IA (12 arquivos)
│   │   │   ├── ai-enrich-contract.ts
│   │   │   ├── ai-review-contract.ts
│   │   │   ├── analyze-document-consistency.ts
│   │   │   ├── extract-entities-from-documents.ts
│   │   │   ├── extract-template-from-document.ts
│   │   │   ├── generate-contract-in-docs.ts
│   │   │   ├── get-assistance-from-gemini.ts
│   │   │   ├── get-document-feedback.ts
│   │   │   ├── get-playbook-assistance.ts
│   │   │   └── match-entities-to-placeholders.ts
│   │   ├── dev.ts                    # Dev entry Genkit
│   │   └── genkit.ts                 # Config Genkit
│   │
│   ├── components/
│   │   ├── app/                      # Componentes de negócio (19)
│   │   ├── auth/                     # Componentes de auth (2)
│   │   ├── ui/                       # Shadcn primitives (36)
│   │   └── FirebaseErrorListener.tsx
│   │
│   ├── context/                      # Contextos React
│   │   └── auth-context.tsx
│   │
│   ├── firebase/                     # Firebase config & providers
│   │   ├── firestore/                # Hooks Firestore
│   │   ├── config.ts
│   │   ├── provider.tsx
│   │   └── client-provider.tsx
│   │
│   ├── hooks/                        # Custom hooks (6)
│   │   ├── use-file-upload.ts
│   │   ├── use-local-storage.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-projects.ts
│   │   ├── use-toast.ts
│   │   └── use-user-preferences.ts
│   │
│   ├── lib/                          # Utilidades e actions (41)
│   │   ├── actions/                  # Server actions (7)
│   │   ├── services/                 # Serviços (vazio)
│   │   ├── __tests__/                # Testes unitários
│   │   └── [utilitários diversos]
│   │
│   └── test/                         # Setup de testes
│       └── setup.ts
│
├── e2e/                              # Testes E2E Playwright
│   └── home.spec.ts
│
├── scripts/                          # Scripts utilitários (11)
│
├── extensions/                       # Extensões Firebase
│   └── firestore-send-email.env
│
├── docs/                             # Documentação
│
├── .agents/skills/                   # Skills Reversa (12)
│
├── .modified                         # Arquivo de controle
│
├── .idx/                             # Config Project IDX
│
├── .sisyphus/                        # Config Sisyphus
│
├── .gemini/                          # Config Gemini CLI
│
├── .genkit/                          # Config Genkit
```

---

## 3. Pontos de Entrada

### Aplicação

| Arquivo | Tipo |
|---------|------|
| `src/app/layout.tsx` | Layout raiz (App Router) |
| `src/app/page.tsx` | Landing page |
| `src/app/(main)/layout.tsx` | Layout protegido |
| `src/app/(main)/page.tsx` | Dashboard principal |
| `src/app/auth/page.tsx` | Página de login |
| `src/app/auth/layout.tsx` | Layout de autenticação |
| `src/ai/dev.ts` | Entry Genkit dev |

### Configuração

| Arquivo | Descrição |
|---------|-----------|
| `next.config.ts` | Config Next.js |
| `tsconfig.json` | Config TypeScript (path alias `@/*`) |
| `tailwind.config.ts` | Config Tailwind (fontes: Outfit, Cardo) |
| `components.json` | Config Shadcn UI |
| `firebase.json` | Config Firebase (Firestore, Storage) |
| `firestore.rules` | Regras de segurança Firestore |
| `firestore.indexes.json` | Índices Firestore |
| `storage.rules` | Regras Firebase Storage |
| `postcss.config.mjs` | Config PostCSS |
| `apphosting.yaml` | Firebase App Hosting (maxInstances: 1) |
| `vercel.json` | Vercel cron jobs |
| `wrangler.toml` | Cloudflare Workers config |
| `.env.local` | Variáveis de ambiente |

### Scripts package.json

| Script | Comando |
|--------|---------|
| `dev` | `next dev --turbopack` |
| `genkit:dev` | `genkit start -- tsx src/ai/dev.ts` |
| `genkit:watch` | `genkit start -- tsx --watch src/ai/dev.ts` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `next lint` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest` |
| `test:ui` | `vitest --ui` |
| `test:coverage` | `vitest --coverage` |
| `test:e2e` | `playwright test` |

### CI/CD

- **Nenhum arquivo CI/CD encontrado** (sem `.github/workflows/`, `Jenkinsfile`, ou `.gitlab-ci.yml`)

### Docker

- **Nenhum Dockerfile ou docker-compose encontrado**

---

## 4. Banco de Dados (Superficial)

### Firestore Collections (identificadas via `firestore.rules`)

| Collection | Descrição |
|------------|-----------|
| `projects` | Metadados de projetos |
| `projectMembers` | Relacionamentos usuário-projeto |
| `projectDocuments` | Documentos dentro de projetos |
| `projectPlaceholders` | Variáveis extraídas por IA |
| `projectContracts` | Contratos gerados |
| `activity` | Log de auditoria (imutável) |
| `invites` | Convites pendentes |
| `presence` | Presença em tempo real |
| `syncConfigs` | Configurações de sync Google Docs |
| `syncEvents` | Log de eventos de sync (imutável) |
| `contractModels` | Modelos globais (legado) |
| `developer_feedback` | Feedback de desenvolvedor |
| `playbook_feedback` | Feedback de playbook |
| `emailQueue` | Fila de emails |
| `notifications` | Notificações de usuários |
| `officialTemplateSyncs` | Logs de sync de templates |
| `faqContent` | Conteúdo FAQ para ALEX |
| `faqContentSyncs` | Logs de sync FAQ |
| `users/{userId}/{collection}` | Dados legados de usuário |

### Arquivos Relacionados a DB

| Arquivo | Tipo |
|---------|------|
| `firestore.rules` | Regras de segurança |
| `firestore.indexes.json` | Definição de índices |
| `src/firebase/firestore/use-collection.tsx` | Hook React para coleções |
| `src/firebase/firestore/use-doc.tsx` | Hook React para documentos |

**Nota**: Não há migrations, Prisma, ou ORM tradicional. O banco é NoSQL (Firestore).

---

## 5. Cobertura de Testes

### Unit Tests (Vitest)

- **Framework**: Vitest 4.0 + @testing-library/react 16
- **Ambiente**: jsdom
- **Coverage Provider**: v8
- **Arquivos de teste**: 11 arquivos `.test.ts`

| Arquivo | Localização |
|---------|-------------|
| `composio-actions.test.ts` | src/lib/actions/ |
| `composio-gemini.test.ts` | src/lib/ |
| `diff-utils.test.ts` | src/lib/ |
| `ai-review-contract.test.ts` | src/ai/flows/ |
| `ai-enrich-contract.test.ts` | src/ai/flows/ |
| `template-link-validation.test.ts` | src/lib/ |
| `template-link-validation.server.test.ts` | src/lib/ |
| `google-docs-actions.test.ts` | src/lib/actions/ |
| `template-source.test.ts` | src/lib/ |
| `utils.google-docs.test.ts` | src/lib/ |
| `utils.test.ts` | src/lib/ |

### E2E Tests (Playwright)

- **Framework**: Playwright 1.58
- **Browser**: Chromium (Desktop)
- **Arquivos**: 1 arquivo `.spec.ts`

| Arquivo | Localização |
|---------|-------------|
| `home.spec.ts` | e2e/ |

### Setup

| Arquivo | Descrição |
|---------|-----------|
| `vitest.config.ts` | Configuração Vitest |
| `playwright.config.ts` | Configuração Playwright |
| `src/test/setup.ts` | Setup @testing-library/jest-dom |

---

## 6. Módulos Identificados

1. **Autenticação** — Firebase Auth, contexto de auth, formulários de login
2. **Projetos** — CRUD de projetos, membros, permissões (owner/editor/viewer)
3. **Documentos** — Upload, processamento, extração de entidades
4. **Placeholders** — Extração via IA, edição, versionamento
5. **Contratos** — Geração, edição (Tiptap), revisão IA, exportação (DOCX/PDF/XLSX)
6. **Modelos** — Templates de contrato, sync de templates oficiais
7. **IA / Genkit** — 12 flows: extração, análise, geração, review, playbook assistance
8. **ALEX Chatbot** — Assistente virtual com FAQ e playbook chat
9. **Sync** — Google Docs sync, Cloudflare R2, Composio integration
10. **Atividade** — Audit log imutável, notificações
11. **Admin** — Painel admin, feedback, cron jobs de sync
12. **Exportação** — DOCX, PDF, XLSX via bibliotecas dedicadas
