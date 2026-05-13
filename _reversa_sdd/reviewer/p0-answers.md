# Respostas às Perguntas P0 — Validação Humana

> Respostas baseadas em análise direta do código fonte, substituindo as perguntas originais.

---

## P0-Q1: Composio Integration — Qual é o escopo real?

### ✅ RESPOSTA: Composio é o motor central de Google Workspace

**Escopo completo:** Composio é a camada de integração OAuth com Google Workspace usada para TODAS as operações de Google Docs e Google Drive no sistema. Substitui o uso direto de `googleapis` para operações autenticadas.

### OAuth Flow

1. **Iniciação:** `createComposioClient(userId).initiateConnection(userId, returnTo)` → chama `composio.connectedAccounts.initiate(userId, authConfigId)` → retorna URL de redirect OAuth
2. **Callback:** `/api/composio/callback/route.ts` recebe `status=success` + `connectedAccountId` do Composio
3. **Persistência:** Callback salva em `composio_connections/{userId}` com `{ status: 'ACTIVE', connectedAccountId, appName, connectedAt }`
4. **Status:** `ConnectionStatus` = `'ACTIVE' | 'INITIATED' | 'EXPIRED' | 'FAILED' | 'INACTIVE'`

### Ferramentas Composio utilizadas (Google Toolkit)

| Tool Slug | Uso |
|-----------|-----|
| `GOOGLEDOCS_GET_DOCUMENT` | Ler conteúdo de Google Doc |
| `GOOGLEDOCS_UPDATE_DOCUMENT_BATCH` | Batch replaceAllText em Google Doc |
| `GOOGLEDRIVE_GET_FILE_V2` | Metadados de arquivo (nome, mimeType) |
| `GOOGLEDRIVE_COPY_FILE_ADVANCED` | Copiar template → novo contrato |
| `GOOGLEDRIVE_CREATE_PERMISSION` | Compartilhar arquivo com email |

### Server Actions (composio-actions.ts)

| Action | Função |
|--------|--------|
| `inspectTemplateForGeneration(userId, input)` | Inspeciona template, extrai placeholders |
| `generateContractDoc(userId, input)` | Copia template, substitui placeholders, salva contrato |
| `reviewContractWithAI(userId, input)` | Revisa contrato com IA (Gemini) |
| `applyReviewEdits(userId, input)` | Aplica edições de review via batch update |
| `revertReviewEdits(userId, input)` | Reverte edições de review |
| `enrichContractWithAI(userId, input)` | Enriquece contrato com dados de entidades |

### Env Vars Requeridas

```
COMPOSIO_API_KEY
COMPOSIO_GOOGLE_AUTH_CONFIG_ID
NEXT_PUBLIC_APP_URL (para callback URL)
```

### Conexão com o resto do sistema

- **Verificação pré-operacional:** Todas as server actions chamam `requireComposioConnection(userId)` antes de qualquer operação
- **Fallback:** Se Composio não conectado, lança `AUTH_EXPIRED` com mensagem em português
- **UI Component:** `ComposioConnection` (src/components/app/composio-connection.tsx) mostra status da conexão e botão para conectar
- **NÃO é usado para:** Sync de templates (usa firebase-server), FAQ sync, notifications, ou operações offline

### Correção para SDD `sync.md`

A SDD `sync.md` menciona Composio em RB-Sy-007 mas não detalha. Recomenda-se adicionar seção "Composio Integration" com o fluxo OAuth e lista de tools.

---

## P0-Q2: Firestore Security Rules — Quais são as regras de acesso reais?

### ✅ RESPOSTA: Modelo baseado em projetos com roles hierárquicas

### Estrutura de Coleções

| Coleção | Acesso Read | Acesso Write | Notas |
|---------|-------------|--------------|-------|
| `projects/{projectId}` | isSignedIn() | Owner delete, Editor metadata | Criar requer `createdBy == auth.uid` |
| `projectMembers/{memberId}` | isSignedIn() | Editor cria, Owner muda roles | memberId = `{projectId}_{userId}` |
| `projectDocuments/{docId}` | isSignedIn() | Editor+ create/update, Owner delete | `affectedKeys` restrito |
| `projectPlaceholders/{id}` | isSignedIn() | Editor+ create/update, Owner delete | Permite update de `version` |
| `projectContracts/{id}` | isSignedIn() | Editor+ create/update, Owner delete | Permite `version`, `googleDocId`, `lastSyncedAt` |
| `activity/{id}` | isSignedIn() | Create only (immutable) | Update/delete bloqueados |
| `invites/{id}` | isSignedIn() | Editor cria, Owner revoga | Invited user pode aceitar |
| `presence/{id}` | isSignedIn() | User update own | Real-time collaboration |
| `syncConfigs/{id}` | isSignedIn() | Editor+ create/update, Owner delete | |
| `syncEvents/{id}` | isSignedIn() | Create only (immutable) | |
| `contractModels/{id}` | isSignedIn() | isSignedIn() (aberto) | **LEGACY** — templates globais |
| `users/{userId}/{collection=**}` | Owner only | Owner only | **LEGACY** — read-only during migration |
| `developer_feedback/{id}` | isSignedIn() | Create: ANY (aberto!) | BUG: `allow create: if true` sem auth |
| `playbook_feedback/{id}` | isSignedin() | isSignedIn() | |
| `emailQueue/{id}` | isSignedIn() | Create only (immutable) | |
| `notifications/{id}` | Owner (get), anyone (list) | Server only (create), Owner (mark read) | |
| `officialTemplateSyncs/{id}` | isSignedIn() | Server only (create) | |
| `faqContent/{id}` | isSignedIn() | Server only | |
| `faqContentSyncs/{id}` | isSignedIn() | Server only | |

### Role Hierarchy

```
viewer (1) < editor (2) < owner (3)
```

- **Viewer:** Read-only, update `lastActivityAt`, `lastActivityBy`
- **Editor:** Upload documents, edit placeholders, generate contracts, invite viewers
- **Owner:** Full control, delete project, manage all members, change roles

### Helper Functions

| Function | Lógica |
|----------|--------|
| `isProjectMember(projectId)` | `exists(projectMembers/{projectId}_{userId})` |
| `getProjectRole(projectId)` | `get(projectMembers/{projectId}_{userId}).data.role` |
| `hasProjectRole(projectId, requiredRole)` | hierarchy[userRole] >= hierarchy[requiredRole] |

### ⚠️ Problemas de Segurança Identificados

1. **`developer_feedback` allow create: if true** — Qualquer pessoa (não autenticada) pode criar feedback
2. **`projects` allow read/list: if isSignedIn()** — Qualquer usuário autenticado pode ver TODOS os projetos (não apenas os que participa)
3. **`contractModels` fully open** — Qualquer usuário autenticado pode CRUD todos os templates globais
4. **`users/{userId}/{collection=**}`** — Regras legacy marcadas como read-only mas permitem write se `getUserId() == userId`

---

## P0-Q3: Shared Templates — Como funciona a listagem cruzada?

### ✅ RESPOSTA: Templates são globais na coleção `contractModels` — não há "sharedWith" no código real

### Correção Crítica

A SDD `modelos.md` contém **informação incorreta** sobre templates:

| Afirmação na SDD | Realidade no Código |
|------------------|---------------------|
| "Templates em `users/{userId}/templates`" | Templates estão em `contractModels` (coleção global) |
| "`useUserTemplates(userId)` hook" | **Não existe no código** — é uma hallucinação do Writer |
| "Tipo `model | template | google_doc`" | Tipo real é `OfficialTemplate` ou `Template` |
| "`sharedWith` array com userId/userEmail/permission" | **Não existe** — templates são globais, acessíveis a todos os usuários autenticados |
| "Compartilhamento via array `sharedWith`" | Sem compartilhamento individual — todos veem todos os templates |

### Como templates realmente funcionam

1. **Coleção:** `contractModels` (global, qualquer usuário autenticado pode ler)
2. **UI:** `src/app/(main)/gerar-exportar/page.tsx` — usa `useCollection` em `contractModels` para listar templates
3. **Sync:** `src/lib/template-sync.ts` — sincroniza "official templates" (parseados de algum lugar) com `contractModels`
4. **Tipos reais:** `OfficialTemplate` (templates oficiais do sistema) e `Template` (templates locais do Firestore)
5. **Campos reais do Template:** `id`, `name`, `googleDocLink`, `contractTypes`, `lastOfficialSync`, `syncStatus`, `syncError`, `updatedAt`

### Firestore Rules para Templates

```
match /contractModels/{contractModelId} {
  allow get, list, create, update, delete: if isSignedIn();
}
```

Qualquer usuário autenticado pode fazer CRUD completo. Não há ownership ou permissões granulares.

### Implicação para Reconstrução

- Se a reconstrução quiser manter compatibilidade, usar coleção global `contractModels`
- Se quiser melhorar, implementar modelo de ownership + compartilhamento como a SDD descreve (mas isso seria uma melhoria, não reconstrução fiel)

---

## Atualização do Confidence Report

Com base nestas respostas, as seguintes regras devem ser reclassificadas:

| Regra | Original | Nova | Motivo |
|-------|----------|------|--------|
| RB-Md-001 | 🟢 | 🔴 | Templates em `contractModels`, NÃO em `users/{userId}/templates` |
| RB-Md-005 | 🟢 | 🔴 | Sem compartilhamento individual — templates são globais |
| RB-Md-006 | 🟢 | 🔴 | Sem permissões `edit/view` por usuário |
| RB-Md-010 | 🟡 | 🔴 | "Coleção separada" não existe — é tudo `contractModels` |
| RB-Sy-007 | 🟢 → 🟡 | 🟢 | Composio existe e é documentado aqui |
| RB-Sy-002 | 🟢 | 🟡 | Sync de templates funciona com `contractModels` + official templates |
| RB-Ct-007 | 🟢 | 🟢 | Confirmado via composio-actions.ts |

### Hallucinações do Writer Identificadas

1. **`useUserTemplates`** — hook não existe
2. **`sharedWith` array** — campo não existe no tipo real
3. **Tipos `model | template | google_doc`** — não encontrados no código
4. **Coleção `users/{userId}/templates`** — não existe (existe apenas `users/{userId}/{collection=**}` como regra legacy genérica)
