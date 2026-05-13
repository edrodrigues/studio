# Domain — V-Lab Assistant

> Glossário e regras de negócio implícitas do sistema.
> Gerado pelo Detective em 2026-05-02 | Nível: Completo

---

## Glossário de Domínio

| Termo | Definição |
|---|---|
| **Projeto** | Unidade central do sistema — representa um caso/contrato específico com documentos, membros e variáveis próprios |
| **Membro** | Usuário com acesso a um projeto, com papel (owner/editor/viewer) |
| **Documento** | Arquivo (PDF, DOCX, etc.) enviado ao projeto para análise de IA |
| **Placeholder** | Variável extraída por IA dos documentos (ex: nome da parte, CPF, valor) |
| **Contrato** | Documento gerado a partir de template + valores de placeholders |
| **Template** | Modelo global de contrato, sincronizado com fontes oficiais (FAQ V-LAB) |
| **Playbook** | Regras institucionais usadas pela IA para revisar contratos |
| **ALEX** | Chatbot de assistência jurídica com base de conhecimento FAQ |
| **File Search** | Índice do Google AI para busca contextual em documentos do projeto |
| **Sync Config** | Configuração de sincronização bidirecional Firestore ↔ Google Docs |
| **Composio** | Plataforma de integração OAuth para operações Google Workspace |
| **Invite** | Convite para ingressar em projeto, com validade de 30 dias |
| **Activity** | Registro imutável de ações no projeto (audit log) |
| **Presence** | Indicador de usuário ativo no projeto (heartbeat a cada 60s) |
| **Official Template** | Modelo extraído automaticamente das páginas FAQ do V-LAB |

---

## Regras de Negócio Identificadas

### 🟢 CONFIRMADO — Regras extraídas do código

#### RB-001: Hierarquia de Permissões
- 3 papéis: `owner` (nível 3) > `editor` (nível 2) > `viewer` (nível 1)
- `editor` pode tudo que `viewer` pode, `owner` pode tudo que `editor` pode
- Fonte: `src/lib/types.ts` → `ROLE_HIERARCHY` + `firestore.rules`

#### RB-002: Convites expiram em 30 dias
- `expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)`
- Fonte: `src/hooks/use-projects.ts:365`

#### RB-003: Apenas um convite pendente por email
- Bloqueia convite duplicado: "Já existe um convite pendente para este email"
- Fonte: `src/hooks/use-projects.ts:353`

#### RB-004: Owner exclusivo por projeto
- Projeto é criado com `createdBy == getUserId()` e o criador se torna owner
- Não há transferência de ownership no código analisado
- Fonte: `firestore.rules:113-115`

#### RB-005: Activity log é imutável
- `allow update, delete: if false` na coleção activity
- Fonte: `firestore.rules:311`

#### RB-006: Sync Events são imutáveis
- Mesma regra: `allow update, delete: if false`
- Fonte: `firestore.rules:432`

#### RB-007: Presença expira após 5 minutos de inatividade
- `const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()`
- Fonte: `src/hooks/use-projects.ts:1040`

#### RB-008: Presença com heartbeat a cada 60 segundos
- `const sixtySecondsAgo = new Date(Date.now() - 60 * 1000).toISOString()`
- Fonte: `src/hooks/use-projects.ts:1009`

#### RB-009: Documentos são versionados por documentType
- Apenas a última versão de cada tipo é usada no contexto ALEX
- Fonte: `_reversa_sdd/code-analysis.md`

#### RB-010: Templates oficiais são sincronizados via cron
- Sync de templates: diário (0 2 * * *)
- Sync de FAQ: semanal (0 3 * * 0)
- Fonte: `src/app/api/cron/`

#### RB-011: Presigned URLs têm tempo de expiração
- R2 PUT: 1 hora (3600s)
- R2 GET: 15 minutos (900s)
- Fonte: `src/lib/actions/storage-actions.ts`

#### RB-012: Upload de documentos requer editor ou owner
- `allow create: if hasProjectRole(..., 'editor')`
- Viewers não podem fazer upload
- Fonte: `firestore.rules:205`

#### RB-013: Delete restrito ao owner
- Documents, Placeholders, Contracts, SyncConfigs: apenas owner pode deletar
- Fonte: `firestore.rules`

#### RB-014: Notificações são read-only após criação
- Usuário só pode marcar como `read: true`
- `allow delete: if false`
- Fonte: `firestore.rules:518`

#### RB-015: FAQ content é server-side only
- Criado/atualizado apenas via CRON (admin SDK)
- Usuários autenticados podem apenas ler
- Fonte: `firestore.rules:539-544`

#### RB-016: Feedback pode ser criado por qualquer usuário autenticado
- `allow create: if true` (sem necessidade de auth token, qualquer request autenticado)
- Fonte: `firestore.rules:475, 487`

#### RB-017: Membros podem editar campos específicos do projeto
- Editor pode editar: `name, description, clientName, status, contractType, processType, updatedAt`
- Viewer pode editar: `lastActivityAt, lastActivityBy, updatedAt`
- Owner pode editar: tudo
- Fonte: `firestore.rules:121-138`

#### RB-018: Auto-migração de memberships
- IDs aleatórios são migrados para formato determinístico `{projectId}_{userId}`
- Fonte: `src/hooks/use-projects.ts`

---

### 🟡 INFERIDO — Regras deduzidas do comportamento

#### RB-019: Projeto não pode ser deletado se for o único owner
- Inferido da lógica de `removeMember` — não há verificação explícita, mas o sistema impede que o último owner saia

#### RB-020: Documentos processados com erro podem ser re-processados
- Status `error` não é terminal — o campo `processingError` sugere retry

#### RB-021: Placeholder com confiança < 0.5 requer revisão humana
- Inferido da classificação de confiança e status `extracted → reviewed → confirmed`

#### RB-022: Google Docs sync é bidirecional por padrão
- `syncDirection: "bidirectional" | "firestore-to-docs" | "docs-to-firestore"`
- Bidirecional parece ser o default recomendado

---

### 🔴 LACUNA — Regras que precisam de validação

#### RB-023: Limite de membros por projeto
- Não há limite explícito nas regras ou no código

#### RB-024: Limite de upload (tamanho máximo de arquivo)
- Não encontrado nas regras de segurança

#### RB-025: Política de retenção de dados
- Não há regras de expurgo de activity, sync events ou documentos

#### RB-026: Transferência de ownership
- Não há função `transferOwnership` no código
