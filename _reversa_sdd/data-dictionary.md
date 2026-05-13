# Dicionário de Dados — V-Lab Assistant

**Gerado em**: 2026-05-02  
**Nível**: Completo  
**Banco**: Google Cloud Firestore (NoSQL)

---

## Coleções Firestore

### 1. `projects`

**Descrição**: Metadados de projetos de contratos.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único do projeto |
| `name` | `string` | ✅ | — | Nome do projeto |
| `description` | `string` | ❌ | — | Descrição opcional |
| `clientName` | `string` | ✅ | — | Nome do cliente |
| `createdBy` | `string` | ✅ | — | UID do criador |
| `createdAt` | `string` (ISO) | ✅ | — | Data de criação |
| `updatedAt` | `string` (ISO) | ✅ | — | Última atualização |
| `status` | `enum` | ✅ | `active` | `active`, `archived`, `deleted` |
| `memberCount` | `number` | ✅ | 0 | Contagem denormalizada de membros |
| `documentCount` | `number` | ✅ | 0 | Contagem denormalizada de documentos |
| `placeholderCount` | `number` | ✅ | 0 | Contagem denormalizada de placeholders |
| `contractCount` | `number` | ✅ | 0 | Contagem denormalizada de contratos |
| `lastActivityAt` | `string` (ISO) | ❌ | — | Timestamp da última atividade |
| `lastActivityBy` | `string` | ❌ | — | Nome do último ator |
| `contractType` | `string` | ❌ | — | Tipo de contrato configurado |
| `processType` | `string` | ❌ | — | Tipo de processo |
| `extraDocumentEnabled` | `boolean` | ❌ | — | Documentos extras habilitados |
| `extraDocumentCount` | `number` | ❌ | — | Quantidade de docs extras |
| `isSyncedToFileSearch` | `boolean` | ❌ | — | Sync com Google AI File Search |
| `fileSearchStoreId` | `string` | ❌ | — | ID do store no File Search |
| `lastSyncedAt` | `string` (ISO) | ❌ | — | Último sync |
| `fileSearchSyncStatus` | `string` | ❌ | — | `pending`, `processing`, `completed`, `failed` |
| `fileSearchSyncError` | `string` | ❌ | — | Erro do último sync |

**Regras de segurança**: CREATE (auth, createdBy == uid), READ (any auth), UPDATE (member com role-based), DELETE (owner)

---

### 2. `projectMembers`

**Descrição**: Relacionamentos usuário-projeto. ID determinístico: `{projectId}_{userId}`.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | `{projectId}_{userId}` | ID determinístico |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `userId` | `string` | ✅ | — | UID do Firebase Auth |
| `role` | `enum` | ✅ | — | `owner`, `editor`, `viewer` |
| `invitedBy` | `string` | ✅ | — | UID de quem convidou |
| `invitedAt` | `string` (ISO) | ✅ | — | Data do convite |
| `joinedAt` | `string` (ISO) | ❌ | — | Data de aceite |
| `email` | `string` | ✅ | — | Email do membro |
| `displayName` | `string` | ❌ | — | Nome exibido |
| `photoURL` | `string` | ❌ | — | Foto do perfil |

**Regras**: CREATE (self ou editor), READ (any auth), UPDATE (owner para role, self para joinedAt), DELETE (owner ou self)

---

### 3. `projectDocuments`

**Descrição**: Documentos iniciais uploaded para extração de entidades.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `name` | `string` | ✅ | — | Nome do documento |
| `fileUrl` | `string` (URL) | ✅ | — | URL do arquivo |
| `fileType` | `string` | ✅ | — | Tipo do arquivo |
| `fileSize` | `number` | ✅ | — | Tamanho em bytes |
| `uploadedBy` | `string` | ✅ | — | UID do uploader |
| `uploadedAt` | `string` (ISO) | ✅ | — | Data do upload |
| `status` | `enum` | ✅ | `uploaded` | `uploaded`, `processing`, `indexed`, `error` |
| `extractedEntities` | `object` | ❌ | — | Entidades extraídas (JSON) |
| `extractedEntityDescriptions` | `object` | ❌ | — | Descrições das entidades |
| `processingError` | `string` | ❌ | — | Erro do processamento |
| `mimeType` | `string` | ✅ | — | MIME type |
| `storagePath` | `string` | ✅ | — | Path no storage |
| `storageProvider` | `enum` | ❌ | `firebase` | `firebase`, `r2` |
| `documentType` | `string` | ✅ | — | Tipo: `planOfWork`, `termOfExecution`, `budgetSpreadsheet`, `other` |
| `version` | `number` | ✅ | 1 | Versão do documento |
| `originalFileName` | `string` | ✅ | — | Nome original do arquivo |
| `fileSearchDocumentName` | `string` | ❌ | — | Nome no File Search |
| `fileSearchIndexedAt` | `string` (ISO) | ❌ | — | Data de indexação |
| `entityExtractionStatus` | `string` | ❌ | — | `pending`, `processing`, `completed`, `failed` |
| `entityExtractionError` | `string` | ❌ | — | Erro da extração |
| `entityCount` | `number` | ❌ | — | Qtd de entidades extraídas |

**Regras**: CREATE (editor+), READ (any auth), UPDATE (editor+, campos restritos), DELETE (owner)

---

### 4. `projectPlaceholders`

**Descrição**: Variáveis extraídas dos documentos para preenchimento de contratos.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `key` | `string` | ✅ | — | Nome da variável (ex: "Nome do Cliente") |
| `value` | `string` | ❌ | — | Valor preenchido |
| `defaultValue` | `string` | ❌ | — | Valor padrão |
| `source` | `string` | ✅ | — | Fonte da extração |
| `sourceDocumentId` | `string` | ❌ | — | Documento de origem |
| `confidence` | `number` (0-1) | ✅ | — | Confiança da IA |
| `aiSuggestions` | `string[]` | ❌ | — | Sugestões da IA |
| `status` | `enum` | ✅ | `extracted` | `extracted`, `reviewed`, `confirmed` |
| `modifiedBy` | `string` | ❌ | — | UID do último editor |
| `modifiedAt` | `string` (ISO) | ❌ | — | Data da última modificação |
| `modifiedByName` | `string` | ❌ | — | Nome do último editor |
| `version` | `number` | ✅ | 0 | Versão (para conflict resolution) |

**Regras**: CREATE (editor+), READ (any auth), UPDATE (editor+, campos restritos: value, status, modifiedBy, modifiedAt, modifiedByName, version), DELETE (owner)

---

### 5. `projectContracts`

**Descrição**: Contratos gerados a partir de templates e placeholders.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `templateId` | `string` | ✅ | — | ID do template usado |
| `name` | `string` | ✅ | — | Nome do contrato |
| `markdownContent` | `string` | ✅ | — | Conteúdo em Markdown |
| `filledData` | `string` (JSON) | ✅ | — | Valores dos placeholders (JSON string) |
| `generatedBy` | `string` | ✅ | — | UID do gerador |
| `generatedAt` | `string` (ISO) | ✅ | — | Data de geração |
| `googleDocId` | `string` | ❌ | — | ID do Google Doc |
| `googleDocLink` | `string` (URL) | ❌ | — | Link do Google Doc |
| `lastSyncedAt` | `string` (ISO) | ❌ | — | Último sync com Google Docs |
| `templateSource` | `enum` | ❌ | — | `googleDocLink`, `projectDocLink` |
| `fallbackUsed` | `boolean` | ❌ | — | Se usou fallback |
| `version` | `number` | ✅ | 1 | Versão do contrato |
| `wordCount` | `number` | ❌ | — | Contagem de palavras |

**Regras**: CREATE (editor+), READ (any auth), UPDATE (editor+, campos restritos), DELETE (owner)

---

### 6. `activity`

**Descrição**: Log de auditoria imutável por projeto.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `userId` | `string` | ✅ | — | UID do ator |
| `userName` | `string` | ✅ | — | Nome do ator |
| `userPhotoURL` | `string` | ❌ | — | Foto do ator |
| `action` | `enum` | ✅ | — | 13 tipos de ação |
| `targetType` | `enum` | ✅ | — | `project`, `document`, `placeholder`, `contract`, `member` |
| `targetId` | `string` | ✅ | — | ID do alvo |
| `targetName` | `string` | ✅ | — | Nome do alvo |
| `metadata` | `object` | ❌ | — | Metadados adicionais |
| `timestamp` | `string` (ISO) | ✅ | — | Data/hora da ação |

**Regras**: CREATE (any auth), READ (any auth), UPDATE/DELETE: **NUNCA** (imutável)

---

### 7. `invites`

**Descrição**: Convites pendentes para colaboração em projetos.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `projectName` | `string` | ✅ | — | Nome do projeto |
| `email` | `string` | ✅ | — | Email do convidado |
| `role` | `enum` | ✅ | — | Role a ser atribuída |
| `invitedBy` | `string` | ✅ | — | UID do convidador |
| `invitedByName` | `string` | ✅ | — | Nome do convidador |
| `invitedAt` | `string` (ISO) | ✅ | — | Data do convite |
| `expiresAt` | `string` (ISO) | ✅ | — | Expiração (30 dias) |
| `status` | `enum` | ✅ | `pending` | `pending`, `accepted`, `expired`, `revoked`, `declined` |
| `acceptedAt` | `string` (ISO) | ❌ | — | Data de aceite |
| `acceptedByUserId` | `string` | ❌ | — | UID de quem aceitou |

**Regras**: CREATE (editor+, email válido), READ (invited email ou owner), UPDATE (invited aceita, owner revoga), DELETE (owner)

---

### 8. `presence`

**Descrição**: Presença em tempo real de usuários em projetos.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `userId` | `string` | ✅ | — | UID do usuário |
| `userName` | `string` | ✅ | — | Nome do usuário |
| `userPhotoURL` | `string` | ❌ | — | Foto do usuário |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `currentView` | `string` | ❌ | — | View atual (dashboard, documents, etc.) |
| `currentEditing` | `string` | ❌ | — | Documento sendo editado |
| `lastSeenAt` | `string` (ISO) | ✅ | — | Última vez visto |
| `joinedAt` | `string` (ISO) | ✅ | — | Entrada na sessão |

**Regras**: CREATE (self), READ (any auth), UPDATE (self), DELETE (self)

**Nota**: Heartbeat a cada 60s. Considerado offline após 5 min sem heartbeat.

---

### 9. `syncConfigs`

**Descrição**: Configurações de sincronização Google Docs ↔ Firestore.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `contractId` | `string` | ✅ | — | ID do contrato |
| `googleDocId` | `string` | ✅ | — | ID do Google Doc |
| `syncDirection` | `enum` | ✅ | — | `bidirectional`, `firestore-to-docs`, `docs-to-firestore` |
| `conflictResolution` | `enum` | ✅ | — | `manual`, `firestore-wins`, `docs-wins` |
| `enabled` | `boolean` | ✅ | — | Sync habilitado |
| `lastSyncAt` | `string` (ISO) | ❌ | — | Último sync |
| `lastSyncStatus` | `enum` | ❌ | — | `success`, `error`, `conflict` |
| `webhookUrl` | `string` | ❌ | — | URL do webhook |
| `webhookSecret` | `string` | ❌ | — | Secret do webhook |

**Regras**: CREATE (editor+), READ (any auth), UPDATE (editor+), DELETE (owner)

---

### 10. `syncEvents`

**Descrição**: Log imutável de eventos de sincronização.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `configId` | `string` | ✅ | — | ID da config de sync |
| `projectId` | `string` | ✅ | — | ID do projeto |
| `contractId` | `string` | ✅ | — | ID do contrato |
| `direction` | `enum` | ✅ | — | `firestore-to-docs`, `docs-to-firestore` |
| `status` | `enum` | ✅ | — | `pending`, `in-progress`, `success`, `error`, `conflict` |
| `startedAt` | `string` (ISO) | ✅ | — | Início do evento |
| `completedAt` | `string` (ISO) | ❌ | — | Fim do evento |
| `errorMessage` | `string` | ❌ | — | Mensagem de erro |
| `changesSummary` | `object` | ❌ | — | `{firestoreVersion, docsVersion, charactersChanged}` |

**Regras**: CREATE (any auth), READ (any auth), UPDATE/DELETE: **NUNCA** (imutável)

---

### 11. `contractModels` (legado)

**Descrição**: Templates globais de contrato (backward compatibility).

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|-------|------|:-----------:|--------|-----------|
| `id` | `string` | ✅ | auto | ID único |
| `name` | `string` | ✅ | — | Nome do template |
| `description` | `string` | ✅ | — | Descrição |
| `markdownContent` | `string` | ✅ | — | Conteúdo Markdown |
| `googleDocLink` | `string` | ❌ | — | Link do Google Doc |
| `projectDocLink` | `string` | ❌ | — | Link do documento do projeto |
| `contractTypes` | `string[]` | ❌ | — | Tipos de contrato aplicáveis |
| `officialSourceUrl` | `string` | ❌ | — | URL da fonte oficial |
| `lastOfficialSync` | `string` (ISO) | ❌ | — | Último sync oficial |
| `officialVersionHash` | `string` | ❌ | — | Hash do conteúdo |
| `syncStatus` | `enum` | ❌ | — | `synced`, `outdated`, `unknown`, `error` |

**Regras**: READ/WRITE (any auth) — permissivo durante migração

---

### 12. `developer_feedback`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| `userId` | `string` | ✅ | — |
| (demais campos inferidos) | | | 🟡 |

**Regras**: CREATE (any auth, inclusive anônimo), READ (auth), UPDATE (self)

---

### 13. `playbook_feedback`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| (demais campos inferidos) | | | 🟡 |

**Regras**: CREATE (any auth), READ/UPDATE (auth)

---

### 14. `emailQueue`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| (demais campos inferidos) | | | 🟡 |

**Regras**: CREATE (auth), READ (auth), UPDATE/DELETE: **NUNCA**

---

### 15. `notifications`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| `userId` | `string` | ✅ | — |
| `read` | `boolean` | ✅ | `false` |
| (demais campos inferidos) | | | 🟡 |

**Regras**: CREATE (server only), READ (self), UPDATE (self, apenas `read`), DELETE: **NUNCA**

---

### 16. `officialTemplateSyncs`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| `timestamp` | `string` (ISO) | ✅ | — |
| `status` | `enum` | ✅ | — | `success`, `error`, `partial` |
| `templatesChecked` | `number` | ✅ | — |
| `templatesUpdated` | `number` | ✅ | — |
| `errors` | `string[]` | ❌ | — |
| `changes` | `object[]` | ❌ | — | Array de mudanças |

**Regras**: READ (auth), CREATE (server only), UPDATE/DELETE: **NUNCA**

---

### 17. `faqContent`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| `url` | `string` (URL) | ✅ | — |
| `title` | `string` | ✅ | — |
| `content` | `string` | ✅ | — |
| `sections` | `object[]` | ✅ | — | Array de seções FAQ |
| `contentHash` | `string` | ✅ | — | Hash para detecção de mudanças |
| `lastSyncedAt` | `string` (ISO) | ✅ | — |
| `syncStatus` | `enum` | ✅ | — | `synced`, `error`, `pending` |

**Regras**: READ (auth), CREATE/UPDATE/DELETE: **NUNCA** (server only via CRON)

---

### 18. `faqContentSyncs`

| Campo | Tipo | Obrigatório | Padrão |
|-------|------|:-----------:|--------|
| `id` | `string` | ✅ | auto |
| `timestamp` | `string` (ISO) | ✅ | — |
| `status` | `enum` | ✅ | — | `success`, `error`, `partial` |
| `pagesChecked` | `number` | ✅ | — |
| `pagesUpdated` | `number` | ✅ | — |
| `errors` | `string[]` | ❌ | — |
| `changes` | `object[]` | ❌ | — |

**Regras**: READ (auth), CREATE (server only via CRON), UPDATE/DELETE: **NUNCA**

---

### 19. `users/{userId}/*` (legado)

**Descrição**: Dados legados de usuário. Read-only durante migração.

**Regras**: READ/WRITE (self only) — migrando para modelo de projetos

---

## Relacionamentos

```
projects (1) ──────< projectMembers (N)      [via projectId]
projects (1) ──────< projectDocuments (N)    [via projectId]
projects (1) ──────< projectPlaceholders (N) [via projectId]
projects (1) ──────< projectContracts (N)    [via projectId]
projects (1) ──────< activity (N)            [via projectId]
projects (1) ──────< invites (N)             [via projectId]
projects (1) ──────< presence (N)            [via projectId]
projects (1) ──────< syncConfigs (N)         [via projectId]

projectContracts (1) ──────< syncConfigs (N) [via contractId]
syncConfigs (1) ───────────< syncEvents (N)  [via configId]

projectDocuments (1) ──────< projectPlaceholders (N) [via sourceDocumentId]
```
