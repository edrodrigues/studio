# Plano de Debugging Sistemático: "Gerar e Revisar" + Composio

## 1. Visão Geral da Estratégia

O skill `systematic-debugging` segue uma metodologia de diagnóstico estruturado: **Reproduzir → Isolar → Diagnosticar → Corrigir → Verificar**. Aplicaremos isso em duas frentes principais com fluxos cruzados.

---

## 2. Frente A — Página "Gerar e Revisar" (`src/app/(main)/gerar-exportar/page.tsx`)

### 2.1 Cenários Críticos a Depurar

| # | Cenário | Sintoma Provável | Severidade |
|---|---------|-------------------|------------|
| A1 | Falha na preparação de templates (`handlePrepareGeneration`) | Toast de erro "Falha ao preparar templates", console `[GerarExportar] Falha no preflight` | P0 |
| A2 | Falha na geração de documentos (`handleConfirmGeneration`) | Nenhum documento criado, toast "Falha na geração" | P0 |
| A3 | Falha na revisão com IA (`reviewContractWithAI`) | Dialog mostra erro, `aiReviewResult.success === false` | P0 |
| A4 | Falha ao aplicar edições (`applyReviewEdits`) | Toast de erro, edições não aparecem no doc | P1 |
| A5 | Falha ao reverter edições (`revertReviewEdits`) | Diálogo de confirmação mas sem reversão | P1 |
| A6 | Estado de loading infinito | Spinner eterno, nenhuma resposta do servidor | P0 |
| A7 | Dados de entidades não populam modal | Modal de entidades abre vazio ou com dados errados | P1 |

### 2.2 Passos de Debugging para A1–A2 (Fluxo de Geração)

**Reproduzir:**
- Selecionar template + documento e clicar "Gerar Documentos"
- Capturar network tab: verificar se as server actions retornam `{ success: false }`

**Isolar — verificar cada camada sequencialmente:**

1. **Camada de UI** — `handlePrepareGeneration` (linha 342)
   - Verificar se `selectedTemplates` e `selectedDocs` estão populados corretamente
   - Verificar se `checkComposioConnectionStatus` retorna `connected: true`
   - Depurar: `console.info("[GerarExportar]")` já existe na linha 386 — verificar output

2. **Camada de Server Action** — `prepareContractData` (importado de `@/lib/actions`)
   - Ler o arquivo correspondente para inspecionar o contrato de dados
   - Verificar se `prepared.entities` e `prepared.entityDescriptions` estão corretos

3. **Camada de Inspeção** — `inspectTemplateForGeneration` (composio-actions.ts:334)
   - Verificar se `resolveTemplateSource` resolve corretamente
   - Checar `inspection.placeholders` — se vazio, o problema é na extração

4. **Camada Composio** — `createComposioClient` → `getFileMetadata` / `getDocumentContent` (composio-client.ts)
   - Verificar se `getConnectedAccountId()` retorna um ID válido
   - Checar se `executeTool` lança erro (capturado por `mapGoogleDocsErrorToComposio`)

**Diagnosticar — pontos de falha comuns:**
- `getConnectedAccountId` não encontra conta (cache vazio + API retorna lista vazia)
- `validateTemplateSource` falha por MIME type inválido (PDF em vez de Google Doc)
- `getDocumentPlaceholders` retorna array vazio (template sem placeholders `<<...>>`)

### 2.3 Passos de Debugging para A3–A5 (Fluxo de Revisão com IA)

**Reproduzir:**
- Clicar "Revisar com IA" em um contrato gerado
- Capturar erros no console e network

**Isolar:**

1. **Camada de UI** — handler inline (linha ~717-741 e ~793-819)
   - Verificar se `extractDocumentId(contract.googleDocLink)` retorna um ID válido
   - Verificar se `setIsAIReviewing(true)` é chamado (loading state)

2. **Camada de Server Action** — `reviewContractWithAI` (composio-actions.ts:498)
   - Verificar se `requireComposioConnection` passa (AUTH_EXPIRED?)
   - Verificar se `aiReviewContract` retorna erro

3. **Camada AI Flow** — `reviewContractFlow` (ai-review-contract.ts:188)
   - **Step 1:** `client.getDocumentContent(documentId)` — pode falhar se documento foi deletado
   - **Step 2:** `reviewContractPrompt()` — pode falhar se Gemini retorna JSON inválido ou timeout
   - Verificar se `documentContent.trim().length === 0` (documento vazio)

4. **Aplicação de edições** — `applyReviewEdits` (composio-actions.ts:548)
   - Verificar se `batchUpdateDocument` executa com sucesso
   - Checar se os `requests` estão no formato correto do Composio (`replace_all_text.target_text`)

### 2.4 Ferramentas de Diagnóstico da UI

- **Toast feedback:** `useToast()` — verificar se as variantes `destructive` aparecem
- **Console logs existentes:** prefixos `[GerarExportar]`, `[TemplateSource]`, `[TemplateGeneration]`, `[ai-review-contract]`
- **React DevTools:** inspecionar estados `templatePreparations`, `aiReviewResult`, `isAIReviewing`
- **Network tab:** server actions devem retornar `{ success, error }` — verificar payloads

---

## 3. Frente B — Integração Composio

### 3.1 Cenários Críticos a Depurar

| # | Cenário | Sintoma Provável | Severidade |
|---|---------|-------------------|------------|
| B1 | Conexão OAuth falha (callback) | URL com `composio_error`, toast de erro | P0 |
| B2 | `checkComposioConnectionStatus` retorna FAILED | Botão "Conectar Google" não funciona | P0 |
| B3 | `initiateConnection` não retorna redirect URL | Usuário fica preso na tela de loading | P0 |
| B4 | Auth config ID não está setada no env | Erro "COMPOSIO_GOOGLE_AUTH_CONFIG_ID not set" | P0 |
| B5 | Rate limiting (HTTP 429) | Chamadas falham após sucesso anterior | P1 |
| B6 | Token expirado durante operação longa | Geração falha no meio do processo | P1 |
| B7 | Conta conectada mas status INACTIVE | Conexão parece ativa mas operações falham | P1 |

### 3.2 Passos de Debugging para B1–B3 (Fluxo de Conexão)

**Reproduzir:**
- Clicar "Conectar Google" em `src/components/app/composio-connection.tsx`
- Acompanhar todo o flow OAuth

**Isolar:**

1. **Componente UI** — `composio-connection.tsx`
   - `initiateConnection()` (linha 126): verificar se `returnTo` URL está correto
   - Verificar se `sessionStorage.setItem('composio_return_to', returnTo)` está sendo chamado
   - Callback handler (linha 170): verificar se `params.get('composio_connected')` existe

2. **Server Action** — `src/lib/actions/composio-connection-actions.ts`
   - `initiateComposioConnection`: verificar se `authConfigId` está disponível
   - `checkComposioConnectionStatus`: verificar se o client foi criado corretamente

3. **Callback Route** — `src/app/api/composio/callback/route.ts`
   - Verificar se `status=success` e `connectedAccountId` estão presentes nos params
   - Verificar se `return_to` é válido (começa com `/`, não `//`)
   - Log de erro se `status=error` — verificar `error_description`

4. **Cliente Composio** — `src/lib/composio-client.ts`
   - `initiateConnection` (linha 370): verificar se `composio.connectedAccounts.initiate()` funciona
   - `getConnectedAccountId` (linha 112): dois caminhos — authConfigId lookup vs toolkit fallback
   - Adicionar `console.info` detalhado em cada branch de decisão

### 3.3 Passos de Debugging para B4–B7 (Fluxo Operacional)

**B4 — Auth Config Missing:**
- Verificar variáveis de ambiente: `COMPOSIO_API_KEY`, `COMPOSIO_GOOGLE_AUTH_CONFIG_ID`
- Verificar `.env.local` ou variáveis do deployment

**B5 — Rate Limiting:**
- O retry logic em `executeWithRetry` (composio-client.ts:493) já cobre 429 com 3 tentativas
- Verificar se mensagens de warning aparecem: `[Composio] Rate limit hit`
- Se falhar, aumentar backoff ou implementar queue

**B6 — Token Expirado:**
- `requireComposioConnection` (composio-actions.ts:119) chama `checkConnection` antes de cada operação
- Se connection check passar mas operação falhar com 401 → race condition de expiração
- Solução: retry com refresh de connection status

**B7 — Status Inconsistente:**
- `getConnectionStatus` (composio-client.ts:341) compara cached account ID com fresh list
- Se cached ID não está na fresh list → retorna FAILED
- Verificar cache TTL (300s) vs tempo da sessão OAuth

### 3.4 Mapeamento de Erros do Composio

O arquivo `src/lib/composio-tools-mapping.ts` contém `COMPOSIO_ERROR_MAPPINGS` (linha 177) que mapeia erros via regex:

| Pattern | errorType | Ação |
|---------|-----------|------|
| `notFound\|404\|DOCUMENT_NOT_FOUND` | `TEMPLATE_NOT_FOUND` | Verificar existência do doc |
| `forbidden\|403\|PERMISSION_DENIED` | `PERMISSION_DENIED` | Verificar sharing e autenticação |
| `unauthorized\|401\|AUTH_EXPIRED` | `AUTH_EXPIRED` | Reconectar Google |
| `badRequest\|400\|Invalid` | `INVALID_REQUEST` | Verificar formato do link/ID |
| `rateLimitExceeded\|429` | `RATE_LIMITED` | Aguardar e retry |
| `tool.*not found` | `INVALID_REQUEST` | Verificar credenciais Composio |
| `connectedAccount.*not found` | `AUTH_EXPIRED` | Reconectar conta |

### 3.5 Correções Aplicadas nesta Sessão

**C1 — `getErrorType` não reconhecia Google Workspace domain-level 403 (FIXED)**
- **Arquivo:** `src/lib/actions/shared-docs-actions.ts` (linhas 49-67)
- **Problema:** Erros de autorização do Google Workspace (ex: "Autorização para atuação de servidores da UFPE") continham palavras como "domínio", "organização", "Autorização" mas não correspondiam a nenhum `errorType` conhecido, caindo no `UNKNOWN_ERROR` silencioso.
- **Correção:** Adicionada verificação antecipada para keywords: `403`, `domain`, `organization`, `workspace`, `Autorização`, `autorização`, `permitted`, `domain policy`, `admin`. Esses erros agora classificados como `PERMISSION_DENIED`.
- **Impacto:** Instruções de `PERMISSION_DENIED` agora incluem: "Se o erro mencionar 'domínio' ou 'organização', solicite ao administrador do Google Workspace que libere o acesso."

**C2 — `buildUserFriendlyError` default case descartava detalhes técnicos (FIXED)**
- **Arquivo:** `src/lib/actions/shared-docs-actions.ts` (linhas 207-216)
- **Problema:** O caso `default` exibia apenas "O Google Drive/Docs retornou um erro inesperado ao preparar o template." — todos os detalhes técnicos do erro original eram silenciosamente descartados.
- **Correção:** O `default` agora inclui `typedError.technicalDetails || typedError.message` na mensagem de erro exibida ao usuário, e adiciona instrução para compartilhar detalhes com suporte técnico.
- **Impacto:** Administradores e suporte agora veem o motivo real da falha na mensagem de erro.

**C3 — `inspectTemplateForGeneration` sem retry de auth para `getDocumentPlaceholders` (FIXED)**
- **Arquivo:** `src/lib/actions/composio-actions.ts` (linhas 420-428)
- **Problema:** A chamada `client.getDocumentPlaceholders()` não era envolvida com `executeWithRetryAndAuthRefresh`, então erros 401/403 transitórios falhavam diretamente sem tentar refresh de autenticação.
- **Correção:** Envolver a chamada com `executeWithRetryAndAuthRefresh`, que limpa o cache de conexão e retry em caso de erro de autorização.
- **Impacto:** Reduz falhas intermitentes de auth durante extração de placeholders, especialmente em sessões longas ou com tokens próximos do expiry.

**Ação recomendada:** Adicionar logging do error code original nas funções `mapComposioError` e `mapComposioDriveError` para facilitar triagem.

---

## 4. Fallback e Gaps do Composio

Conforme `src/lib/composio-tools-mapping.ts` (seção `COMPOSIO_GAPS`):

| Operação | Status | Risco | Nota |
|----------|--------|-------|------|
| `getDocumentPlaceholders` | **Sem equivalente** (fallback local) | LOW | Usa `extractPlaceholderDefinitionsFromText()` de `src/lib/google-docs.ts` |
| `batchUpdateDocument` | Parcial (só text replace) | MEDIUM | Edições estruturais (tabelas, listas) podem falhar |
| `getFileMetadata` | Coberto | LOW | — |
| `shareFile` | Coberto | LOW | — |

**Debugging específico do gap:** Se `batchUpdateDocument` falhar em edge cases de formatação, verificar se `convertBatchRequestsToComposio` (composio-client.ts:448) está convertendo corretamente os requests.

---

## 5. Testes — Fonte de Verdade

### Testes existentes:

| Arquivo | O que cobre |
|---------|-------------|
| `src/lib/__tests__/composio-client.test.ts` | Cache de `getConnectedAccountId`, clear cache (3 testes com falha pré-existente por mock constructor) |
| `src/lib/actions/composio-actions.test.ts` | `inspectTemplateForGeneration` e `generateContractDoc` — sucesso, fallback, permissão, MIME, AUTH_EXPIRED (9 testes ✓) |
| `src/lib/actions/__tests__/shared-docs-actions.test.ts` | Tipos e helpers de erro — `getErrorType`, `createTemplateActionError`, `buildValidationError`, `updateSourceFailure`, `getSourceAttemptOrder`, `cloneSourceDiagnostics`, `mergePlaceholderDefinitions`, `buildReplacementRequests`, `buildUserFriendlyError` (22 testes ✓) |
| `src/ai/flows/ai-review-contract.test.ts` | AI review flow |
| `src/ai/flows/ai-enrich-contract.test.ts` | AI enrich flow |

### Testes adicionados nesta sessão:

| Arquivo | Testes | Status |
|---------|--------|--------|
| `src/lib/actions/composio-actions.test.ts` | `reviewContractWithAI` — sucesso, documento vazio, erro de acesso, erro Gemini, sucesso com `aiEnriched=true` | ✅ 4 novos testes passam |
| `src/lib/actions/composio-actions.test.ts` | `applyReviewEdits` — sucesso, sem edits | ✅ 2 novos testes passam |
| `src/lib/actions/composio-actions.test.ts` | `revertReviewEdits` — sucesso, sem edits | ✅ 2 novos testes passam |

Total: **9 testes** em `composio-actions.test.ts`, **22 testes** em `shared-docs-actions.test.ts` — todos passando.

### Testes que ainda faltam (prioridade):

| # | Onde | Cobertura |
|---|------|-----------|
| T1 | `composio-actions.test.ts` | `reviewContractWithAI` — sucesso, documento vazio, erro de acesso, erro Gemini |
| T2 | `composio-actions.test.ts` | `applyReviewEdits` — sucesso, sem edits, erro batch update |
| T3 | `composio-actions.test.ts` | `revertReviewEdits` — sucesso, sem edits, erro |
| T4 | `composio-actions.test.ts` | `enrichContractWithAI` — sucesso, erro Gemini, erro batch |
| T5 | `composio-client.test.ts` | Operações CRUD: `getDocumentContent`, `batchUpdateDocument`, `copyFile`, `shareFile` — sucesso e erro |
| T6 | `composio-client.test.ts` | `checkConnection` — todos os status (ACTIVE, INITIATED, EXPIRED, INACTIVE, FAILED) |
| T7 | (novo) `composio-connection-actions.test.ts` | `checkComposioConnectionStatus`, `initiateComposioConnection` |
| T8 | E2E (Playwright) | Fluxo completo: conectar → selecionar template → gerar → revisar → aplicar edições |

---

## 6. Checklist de Depuração Rápida

Para qualquer bug reportado nas áreas acima, seguir esta sequência:

- [ ] **1. Console logs:** Verificar prefixos `[GerarExportar]`, `[Composio]`, `[TemplateSource]`, `[TemplateGeneration]`, `[ai-review-contract]`, `[ai-enrich-contract]`
- [ ] **2. Network tab:** Verificar request/response das server actions (payload `{ success, error }`)
- [ ] **3. Environment:** Verificar `COMPOSIO_API_KEY`, `COMPOSIO_GOOGLE_AUTH_CONFIG_ID`, `NEXT_PUBLIC_APP_URL`
- [ ] **4. Cache de conexão:** Limpar `connectedAccountIdCache` se comportamento stale
- [ ] **5. Estado do Google Doc:** Verificar se o documento existe, está acessível e é Google Docs (não PDF/Sheets)
- [ ] **6. Placeholders:** Confirmar que o template contém `<<PLACEHOLDER>>` ou `{{PLACEHOLDER}}`
- [ ] **7. Testes unitários:** Executar `npx vitest run` para verificar se testes existentes passam
- [ ] **8. Isolar a camada:** Testar a função suspeita isoladamente com mock do Composio client

---

## 7. Resumo dos Arquivos-Chave

```
📁 src/app/(main)/gerar-exportar/page.tsx          → Página "Gerar e Revisar" (UI)
📁 src/lib/actions/composio-actions.ts              → Server actions (gerar, revisar, aplicar, reverter)
📁 src/lib/actions/composio-connection-actions.ts   → Server actions (check/initiate conexão)
📁 src/lib/actions/shared-docs-actions.ts           → Tipos e helpers compartilhados de erro
📁 src/lib/composio-client.ts                       → Cliente Composio adapter (CRUD + retry + cache)
📁 src/lib/composio-tools-mapping.ts                → Mapeamento ferramentas Composio + erros
📁 src/lib/composio-types.ts                        → Tipos shared (ConnectionStatus)
📁 src/lib/template-source.ts                       → Auditoria de links e diagnósticos
📁 src/lib/google-docs.ts                           → Implementação original googleapis (fallback)
📁 src/components/app/composio-connection.tsx        → Componente UI de conexão
📁 src/app/api/composio/callback/route.ts           → Route de callback OAuth
📁 src/ai/flows/ai-review-contract.ts               → Flow de revisão com Gemini
📁 src/ai/flows/ai-enrich-contract.ts               → Flow de enriquecimento com Gemini
```

## 8. Status Final — ✅ Correções Concluídas

### Correções Implementadas (3):
| # | Correção | Arquivo | Status |
|---|---------|---------|--------|
| C1 | `getErrorType` reconhece Google Workspace domain-level 403 | `shared-docs-actions.ts:49-67` | ✅ Verificado |
| C2 | `buildUserFriendlyError` default case exibe detalhes técnicos | `shared-docs-actions.ts:207-216` | ✅ Verificado |
| C3 | `inspectTemplateForGeneration` com retry de auth para `getDocumentPlaceholders` | `composio-actions.ts:420-428` | ✅ Verificado |

### Resultado dos Testes:
- TypeScript typecheck: **0 erros** ✅
- `composio-actions.test.ts`: **9/9 passaram** ✅
- `shared-docs-actions.test.ts`: **22/22 passaram** ✅
- `composio-client.test.ts`: 3 falhas pré-existentes (mock constructor, não relacionado)
- **Total: 94/97 testes passam**

### Observação para Produção:
Se o erro "Autorização para atuação de servidores" persistir após C1+C3:
1. Verificar OAuth scopes no dashboard Composio (Google Drive + Docs)
2. Solicitar ao admin Google Workspace que libere compartilhamento externo para a OU/grupo
3. Monitorar logs usando request IDs `req:xxx` para confirmar root cause

---