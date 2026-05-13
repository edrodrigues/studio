# ADR-001: Multi-project collaboration model

**Status:** accepted  
**Date:** 2026-03-01  
**Fonte:** Commits `0e4550b`, `516bf9e`, `53248ec`  
**Decisores:** Ed (ed.ufpe@gmail.com)

## Contexto

O sistema inicialmente operava com dados globais por usuário (coleção `/users/{userId}/...`). À medida que a equipe cresceu, surgiu a necessidade de múltiplos usuários colaborarem no mesmo projeto jurídico.

## Decisão

Adotar modelo baseado em projetos com:
- Coleções separadas por escopo de projeto (`projectDocuments`, `projectPlaceholders`, `projectContracts`, `projectMembers`)
- RBAC com 3 papéis: `owner`, `editor`, `viewer`
- Convites com expiração de 30 dias
- Activity log imutável para auditoria

## Alternativas consideradas

1. **Manter modelo user-centric** — compartilhamento via links. Rejeitado: sem controle granular de permissões.
2. **Organizações/Workspaces** — modelo tipo Slack. Rejeitado: complexo demais para MVP.

## Consequências

- **+** Controle granular de acesso por projeto
- **+** Audit trail completo
- **-** Necessidade de migrar dados legados (coleções `/users/...`)
- **-** Mais chamadas ao Firestore para checks de permissão

---

# ADR-002: Firebase Firestore como banco de dados principal

**Status:** accepted  
**Date:** 2026-03-01  
**Fonte:** `firestore.rules`, `src/firebase/`  
**Decisores:** Ed

## Contexto

Sistema precisava de:
- Real-time collaboration (presença, sync)
- Offline support
- Escalabilidade automática
- Integração com Firebase Auth

## Decisão

Usar Firestore como banco principal com:
- Security rules para controle de acesso
- IndexedDB para cache offline
- Listener em tempo real para presença e documentos

## Alternativas consideradas

1. **PostgreSQL + Supabase** — Rejeitado: real-time mais complexo de implementar.
2. **MongoDB Atlas** — Rejeitado: sem offline support nativo.

## Consequências

- **+** Real-time out-of-the-box
- **+** Offline persistence
- **-** Query limitations (no joins, no full-text search nativo)
- **-** Custos aumentam com reads/writes frequentes

---

# ADR-003: Google Genkit para fluxos de IA

**Status:** accepted  
**Date:** 2026-03-29  
**Fonte:** Commit `899ad2e`, `src/ai/`  
**Decisores:** Ed

## Contexto

O sistema precisava de IA para:
- Extração de entidades de documentos jurídicos
- Revisão de contratos contra playbook institucional
- Geração de contratos a partir de templates
- Chatbot de assistência (ALEX)

## Decisão

Usar Google Genkit com Gemini API para 12 flows:
- `extractEntitiesFromDocuments`
- `matchEntitiesToPlaceholders`
- `aiReviewContract`
- `aiEnrichContract`
- `generateContractInDocs`
- `getAssistanceFromGemini`
- `getPlaybookAssistance`
- `getDocumentFeedback`
- `analyzeDocumentConsistency`
- `extractTemplateFromDocument`

## Alternativas consideradas

1. **OpenAI/GPT-4** — Rejeitado: integração nativa com Firebase via Genkit.
2. **LangChain** — Rejeitado: Genkit oferece melhor DX para Firebase.

## Consequências

- **+** Integração nativa com Firebase
- **+** Type-safe flows com Zod schemas
- **-** Vendor lock-in com Google AI
- **-** Rate limiting da Gemini API

---

# ADR-004: Cloudflare R2 como alternativa ao Firebase Storage

**Status:** accepted  
**Date:** 2026-04-26  
**Fonte:** Commits `b5407c2`, `6608dac`  
**Decisores:** Ed

## Contexto

Firebase Storage tem custos elevados para egress (download). Cloudflare R2 oferece:
- Zero egress fees
- Compatibilidade com S3 SDK
- Mesma performance

## Decisão

Implementar dual storage provider:
- Firebase Storage como fallback
- Cloudflare R2 como provider primário
- Migração gradual via `migrateToR2()`
- Presigned URLs para upload/download seguro

## Alternativas consideradas

1. **Manter apenas Firebase Storage** — Rejeitado: custos de egress.
2. **AWS S3** — Rejeitado: R2 tem zero egress fees.

## Consequências

- **+** Redução drástica de custos de egress
- **+** Presigned URLs para segurança
- **-** Complexidade de manter dois providers
- **-** Necessidade de migração de dados existentes

---

# ADR-005: Composio para integração Google Workspace

**Status:** accepted  
**Date:** 2026-04-25  
**Fonte:** Commits `2fcc1f5`, `fa77527`, `4f99f48`  
**Decisores:** Ed

## Contexto

O sistema precisava de:
- Gerar contratos no Google Docs
- Sync bidirecional Firestore ↔ Google Docs
- Operações no Google Drive (upload, list files)

Implementar OAuth direto seria complexo e requereria verificação de app no Google Cloud Console.

## Decisão

Usar Composio como camada de OAuth e API wrapper:
- Composio gerencia OAuth flow (redirect, callback, token storage)
- Server actions chamam Composio para operações Google
- Tool mapping para Google Docs e Drive

## Alternativas consideradas

1. **OAuth direto com Google** — Rejeitado: complexidade de app verification.
2. **Firebase Extensions** — Rejeitado: sem extensão para Google Docs sync.

## Consequências

- **+** OAuth gerenciado (sem app verification)
- **+** Tool mapping simplificado
- **-** Dependência de serviço third-party
- **-** Latência adicional via Composio proxy

---

# ADR-006: Template sync automático com fontes oficiais

**Status:** accepted  
**Date:** 2026-04-12  
**Fonte:** Commits `0f34825`, `fc9e6c6`, `d1800d3`  
**Decisores:** Ed

## Contexto

Templates de contrato mudam frequentemente conforme legislação e políticas da V-LAB se atualizam. Manter templates manualmente é propenso a erros.

## Decisão

Implementar sync automático:
- CRON diário (`0 2 * * *`) verifica páginas FAQ oficiais
- Hash de conteúdo detecta mudanças
- Templates atualizados geram notificações
- Link validation para verificar acessibilidade dos Google Docs

## Alternativas consideradas

1. **Atualização manual** — Rejeitado: propenso a erros e atrasos.
2. **Webhooks do site oficial** — Rejeitado: site não suporta webhooks.

## Consequências

- **+** Templates sempre atualizados
- **+** Detecção automática de mudanças
- **-** Dependência de scraping HTML (frágil a mudanças de layout)
- **-** CRON requer serviço externo (Vercel Cron)

---

# ADR-007: Non-blocking Firestore writes com error handling

**Status:** accepted  
**Date:** 2026-03-01  
**Fonte:** `src/firebase/non-blocking-updates.tsx`, `src/firebase/error-emitter.ts`  
**Decisores:** Ed

## Contexto

Operações Firestore podem falhar por:
- Permissões insuficientes
- Conflitos de concorrência
- Falhas de rede

Bloquear a UI durante writes degrada a experiência do usuário.

## Decisão

Implementar writes non-blocking:
- Operações Firestore são fire-and-forget
- Error emitter pub/sub tipado para notificar falhas
- Eventos: `permission-error`, `firestore-error`, `auth-error`
- UI mostra toast de erro sem bloquear interação

## Alternativas consideradas

1. **Blocking writes com loading spinner** — Rejeitado: UX ruim para operações longas.
2. **Optimistic updates com rollback** — Rejeitado: complexo para operações críticas.

## Consequências

- **+** UX responsiva
- **+** Error handling centralizado
- **-** Silêncio de falhas se subscriber não estiver listening
- **-** Dificuldade de debug de errors assíncronos

---

# ADR-008: Auto-migração de memberships para IDs determinísticos

**Status:** accepted  
**Date:** 2026-03-01  
**Fonte:** `src/hooks/use-projects.ts`  
**Decisores:** Ed

## Contexto

Firestore security rules requerem memberId no formato `{projectId}_{userId}` para checks eficientes. Memberships legados usavam random IDs do Firestore.

## Decisão

Implementar auto-migração:
- Ao carregar membros, detectar IDs aleatórios
- Criar novo documento com ID determinístico
- Copiar dados e deletar documento antigo
- Executar transparentemente durante o fetch

## Consequências

- **+** Security rules eficientes (single doc read)
- **-** Write operations adicionais durante migração
- **-** Risco de race conditions durante migração
