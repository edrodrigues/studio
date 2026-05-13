# Matriz de Rastreabilidade: Código ↔ Spec

## Visão Geral

Esta matriz mapeia cada arquivo de implementação do V-Lab Assistant para as especificações SDD correspondentes, garantindo rastreabilidade completa entre código-fonte e documentação de requisitos.

## Legenda

| Símbolo | Significado |
|---------|-------------|
| 🟢 | Cobertura completa — arquivo totalmente descrito na SDD |
| 🟡 | Cobertura parcial — arquivo parcialmente descrito |
| 🔴 | Sem cobertura — arquivo não mapeado em nenhuma SDD |
| ⚪ | Infraestrutura — não requer SDD (configs, types, utils) |

---

## Mapeamento por Módulo

### 1. Auth (`sdd/auth.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/components/auth/auth-forms.tsx` | LoginForm, SignupForm | 🟢 |
| `src/components/auth/ProtectedRoute.tsx` | ProtectedRoute HOC | 🟢 |
| `src/context/auth-context.tsx` | AuthContext provider | 🟢 |
| `src/components/app/header.tsx` | Auth section (login/logout) | 🟡 |

### 2. Projects (`sdd/projects.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/app/(main)/projects/page.tsx` | Projects list page | 🟢 |
| `src/app/(main)/projects/new/page.tsx` | Create project page | 🟢 |
| `src/app/(main)/projects/[projectId]/page.tsx` | Project dashboard | 🟢 |
| `src/app/(main)/projects/[projectId]/settings/page.tsx` | Project settings | 🟢 |
| `src/app/(main)/projects/[projectId]/members/page.tsx` | Member management | 🟢 |
| `src/hooks/use-projects.ts` | All project hooks | 🟢 |

### 3. Documents (`sdd/documents.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/components/app/DocumentUploader.tsx` | DocumentUploader | 🟢 |
| `src/components/app/DocumentCard.tsx` | DocumentCard | 🟢 |
| `src/hooks/use-file-upload.ts` | useFileUpload hook | 🟢 |
| `src/lib/storage.ts` | R2 storage operations | 🟢 |
| `src/lib/actions/storage-actions.ts` | Server actions for storage | 🟢 |
| `src/app/(main)/documentos-iniciais/page.tsx` | Initial documents page | 🟢 |

### 4. Placeholders (`sdd/placeholders.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/app/(main)/projects/[projectId]/placeholders/page.tsx` | ProjectPlaceholdersPage | 🟢 |
| `src/hooks/use-projects.ts` | useProjectPlaceholders | 🟢 |
| `src/components/app/EntityEditModal.tsx` | Entity edit modal | 🟢 |

### 5. Contracts (`sdd/contracts.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/app/(main)/projects/[projectId]/contracts/new/page.tsx` | NewProjectContractPage | 🟢 |
| `src/app/(main)/projects/[projectId]/components/TemplatesGrid.tsx` | TemplatesGrid | 🟢 |
| `src/app/(main)/gerar-exportar/page.tsx` | Generate & Export page | 🟢 |
| `src/components/app/ContractEditor.tsx` | Tiptap contract editor | 🟢 |
| `src/components/app/ContractPreviewModal.tsx` | Contract preview | 🟢 |
| `src/components/app/ContractAssistant.tsx` | Contract AI assistant | 🟢 |

### 6. Modelos / Templates (`sdd/modelos.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/app/(main)/modelos/page.tsx` | ModelosPage | 🟢 |
| `src/app/(main)/modelos/components/TemplateCard.tsx` | TemplateCard | 🟢 |
| `src/app/(main)/modelos/components/TemplateViewer.tsx` | TemplateViewer | 🟢 |
| `src/app/(main)/modelos/components/CreateTemplateModal.tsx` | CreateTemplateModal | 🟢 |
| `src/hooks/use-projects.ts` | useUserTemplates | 🟢 |

### 7. AI Genkit (`sdd/ai-genkit.md`)

| Arquivo | Flow | Cobertura |
|---------|------|-----------|
| `src/ai/genkit.ts` | AI configuration | 🟢 |
| `src/ai/dev.ts` | Dev server | 🟢 |
| `src/ai/flows/extract-entities-from-documents.ts` | extractEntitiesFromDocuments | 🟢 |
| `src/ai/flows/ai-enrich-contract.ts` | aiEnrichContract | 🟢 |
| `src/ai/flows/ai-review-contract.ts` | aiReviewContract | 🟢 |
| `src/ai/flows/generate-contract-in-docs.ts` | generateContractInDocs | 🟢 |
| `src/ai/flows/match-entities-to-placeholders.ts` | matchEntitiesToPlaceholders | 🟢 |
| `src/ai/flows/analyze-document-consistency.ts` | analyzeDocumentConsistency | 🟢 |
| `src/ai/flows/get-document-feedback.ts` | getDocumentFeedback | 🟢 |
| `src/ai/flows/extract-template-from-document.ts` | extractTemplateFromDocument | 🟢 |
| `src/ai/flows/get-assistance-from-gemini.ts` | getAssistanceFromGemini | 🟢 |
| `src/ai/flows/get-playbook-assistance.ts` | getPlaybookAssistance | 🟢 |
| `src/ai/flows/ai-review-contract.test.ts` | Tests | 🟢 |
| `src/ai/flows/ai-enrich-contract.test.ts` | Tests | 🟢 |

### 8. ALEX Chatbot (`sdd/alex-chatbot.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/components/app/playbook-chat-widget.tsx` | PlaybookChatWidget | 🟢 |
| `src/ai/flows/get-playbook-assistance.ts` | getPlaybookAssistance | 🟢 |
| `src/ai/flows/get-assistance-from-gemini.ts` | getAssistanceFromGemini | 🟢 |
| `src/app/api/feedback/route.ts` | Feedback endpoint | 🟢 |

### 9. Sync (`sdd/sync.md`)

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `src/lib/template-sync.ts` | syncTemplatesWithGoogleDocs | 🟢 |
| `src/lib/faq-sync.ts` | syncFaqContent | 🟢 |
| `src/lib/offline-sync.ts` | queueOfflineOperation | 🟢 |
| `src/app/api/cron/sync-templates/route.ts` | Cron endpoint | 🟢 |
| `src/app/api/cron/sync-faq-content/route.ts` | Cron endpoint | 🟢 |
| `src/app/api/admin/test-sync/route.ts` | Test endpoint | 🟢 |
| `src/app/api/admin/test-faq-sync/route.ts` | Test endpoint | 🟢 |
| `src/app/api/cron/sync-templates/__tests__/test-sync.ts` | Test | 🟢 |

### 10. Activity (`sdd/activity.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/components/app/notifications-dropdown.tsx` | NotificationsDropdown | 🟢 |
| `src/components/app/header.tsx` | Header integration | 🟡 |
| `src/lib/email-service.ts` | Email notifications | 🟢 |

### 11. Admin (`sdd/admin.md`)

| Arquivo | Componente / Função | Cobertura |
|---------|---------------------|-----------|
| `src/app/(main)/admin/feedback/page.tsx` | AdminFeedbackPage | 🟢 |
| `src/app/(main)/feedback/page.tsx` | FeedbackPage | 🟢 |
| `src/components/app/feedback-modal.tsx` | FeedbackModal | 🟢 |

### 12. Export (`sdd/export.md`)

| Arquivo | Função | Cobertura |
|---------|--------|-----------|
| `src/lib/export.ts` | exportToDocx, exportToXlsx, exportToPdfViaGoogleDocs | 🟢 |
| `src/lib/document-converter.ts` | markdownToDocxElements, filledDataToXlsxRows | 🟢 |
| `src/app/(main)/gerar-exportar/page.tsx` | Export UI | 🟢 |

---

## Mapeamento por SDD

### Resumo de Cobertura

| SDD | Regras de Negócio | Arquivos Mapeados | Cobertura |
|-----|-------------------|-------------------|-----------|
| `sdd/auth.md` | 14 | 4 | 100% |
| `sdd/projects.md` | 33 | 6 | 100% |
| `sdd/documents.md` | 28 | 6 | 100% |
| `sdd/placeholders.md` | 14 | 3 | 100% |
| `sdd/contracts.md` | 11 | 6 | 100% |
| `sdd/modelos.md` | 14 | 5 | 100% |
| `sdd/ai-genkit.md` | 13 | 14 | 100% |
| `sdd/alex-chatbot.md` | 10 | 4 | 100% |
| `sdd/sync.md` | 10 | 7 | 100% |
| `sdd/activity.md` | 9 | 3 | 100% |
| `sdd/admin.md` | 9 | 3 | 100% |
| `sdd/export.md` | 10 | 3 | 100% |
| **Total** | **175** | **64** | **100%** |

---

## Arquivos de Infraestrutura (⚪)

Estes arquivos são infraestrutura e não possuem SDD dedicada, mas são referenciados nas SDDs como dependências.

| Arquivo | Tipo | Uso |
|---------|------|-----|
| `src/lib/types.ts` | Types | Definição de todos os tipos TypeScript |
| `src/lib/utils.ts` | Utils | Funções utilitárias (cn, formatadores) |
| `src/lib/firebase.ts` | Config | Inicialização do Firebase client |
| `src/lib/firebase-server.ts` | Config | Inicialização do Firebase Admin |
| `src/lib/cache.ts` | Infra | Cache layer |
| `src/env-setup.ts` | Config | Validação de variáveis de ambiente |
| `src/firebase/` | Config | Configuração do Firebase |
| `firestore.rules` | Config | Regras de segurança do Firestore |
| `firestore.indexes.json` | Config | Índices do Firestore |
| `package.json` | Config | Dependências e scripts |
| `next.config.ts` | Config | Configuração do Next.js |
| `tailwind.config.ts` | Config | Configuração do Tailwind |

---

## User Stories ↔ SDD ↔ Código

| User Story | SDDs Envolvidas | Arquivos Principais |
|------------|-----------------|---------------------|
| `01-onboarding-auth.md` | `sdd/auth.md` | `auth-forms.tsx`, `auth-context.tsx`, `ProtectedRoute.tsx` |
| `02-project-management.md` | `sdd/projects.md` | `projects/page.tsx`, `members/page.tsx`, `use-projects.ts` |
| `03-document-upload-extraction.md` | `sdd/documents.md`, `sdd/ai-genkit.md` | `use-file-upload.ts`, `storage.ts`, `extract-entities-from-documents.ts` |
| `04-placeholder-review.md` | `sdd/placeholders.md` | `placeholders/page.tsx`, `use-projects.ts`, `EntityEditModal.tsx` |
| `05-contract-generation.md` | `sdd/contracts.md`, `sdd/ai-genkit.md` | `gerar-exportar/page.tsx`, `generate-contract-in-docs.ts`, `ai-review-contract.ts` |
| `06-export-collaboration.md` | `sdd/export.md`, `sdd/activity.md`, `sdd/alex-chatbot.md` | `export.ts`, `document-converter.ts`, `playbook-chat-widget.tsx` |

---

## OpenAPI ↔ Código

| Endpoint | Arquivo | SDD |
|----------|---------|-----|
| `POST /api/feedback` | `src/app/api/feedback/route.ts` | `sdd/admin.md` |
| `GET /api/cron/sync-templates` | `src/app/api/cron/sync-templates/route.ts` | `sdd/sync.md` |
| `GET /api/cron/sync-faq-content` | `src/app/api/cron/sync-faq-content/route.ts` | `sdd/sync.md` |
| `GET /api/admin/test-sync` | `src/app/api/admin/test-sync/route.ts` | `sdd/admin.md` |
| `GET /api/admin/test-faq-sync` | `src/app/api/admin/test-faq-sync/route.ts` | `sdd/admin.md` |
| `GET /api/composio/callback` | `src/app/api/composio/callback/route.ts` | `sdd/sync.md` |
