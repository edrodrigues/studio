# Plano de Migração Composio v2 → v3

> **Data:** 2026-05-17
> **Status:** ✅ Concluído
> **Escopo:** Todos os arquivos que usam `@composio/core` e `@composio/google`

---

## Diagnóstico

A implementação atual usa padrões da API v2 do Composio (singleton global, `composio.tools.execute()`, `connectedAccounts.initiate()`, lookup manual de contas). A documentação oficial v3 define um modelo baseado em **sessões** com `composio.create(userId)`, `session.tools()`, e `session.authorize()`.

### Problemas críticos identificados

| # | Problema | Arquivo(s) | Docs v3 |
|---|----------|------------|---------|
| 1 | Singleton global sem sessões | `composio-client.ts:70-78` | `composio.create(userId)` é o entry point |
| 2 | `composio.tools.execute()` (discouraged) | `composio-client.ts:95` | Use `session.tools()` → LLM framework |
| 3 | `connectedAccounts.initiate()` obsoleta | `composio-client.ts:468` | Use `session.authorize("google")` |
| 4 | `connectedAccounts.list()` manual | `composio-client.ts:139,169` | Conexões são automáticas via sessão |
| 5 | `authConfigId` obrigatório via env var | `composio-client.ts:134,448` | Managed automaticamente pelo Composio |
| 6 | `provider.executeToolCall()` no agent loop | `composio-gemini.ts:133` | Discouraged — usar session tools |
| 7 | Sem `composio.use(sessionId)` para reuso | Todo o código | Sessões persistem, reusar com `use()` |

---

## Fases de Migração

### Fase 1 — Fundações: Sessões por Usuário ✅ COMPLETA

**Objetivo:** Substituir o singleton global por sessões criadas via `composio.create(userId)`.

#### Tarefa 1.1 — Refatorar `getComposioInstance()` para factory de sessões ✅

**Arquivo:** `src/lib/composio-client.ts`

#### Tarefa 1.2 — Adicionar `session.sessionId` ao cache ✅

Armazenar `session.sessionId` no cache para permitir reuso via `composio.use(sessionId)` em requests subsequentes, conforme docs recomendam para apps multi-turn.

---

### Fase 2 — Autenticação: `session.authorize()` em vez de `connectedAccounts.initiate()` ✅ COMPLETA

**Objetivo:** Usar o fluxo de Connect Links do v3 em vez do fluxo manual com `authConfigId`.

#### Tarefa 2.1 — Refatorar `initiateConnection()` ✅

#### Tarefa 2.2 — Remover dependência de `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` ✅

#### Tarefa 2.3 — Atualizar componente de conexão ✅

---

### Fase 3 — Connection Status: `session.toolkits()` em vez de `connectedAccounts.list()` ✅ COMPLETA

**Objetivo:** Usar a API v3 para verificar status de conexão.

#### Tarefa 3.1 — Refatorar `getConnectedAccountId()` e `getConnectionStatusHelper()` ✅

#### Tarefa 3.2 — Remover `connectedAccountIdCache` manual ✅

---

### Fase 4 — Tool Execution: Meta Tools via `session.tools()` ✅ COMPLETA

**Objetivo:** Manter `composio.tools.execute()` como fallback para operações determinísticas, enquanto o agent loop usa `session.tools()` + `composio.provider.executeToolCall()`.

#### Tarefa 4.1 — Avaliar abordagem: Native Tools vs MCP ✅

**Decisão:** Native Tools para `composio-gemini.ts` (agentic loop). `composio.tools.execute()` mantido como fallback para operações determinísticas em `composio-client.ts`.

#### Tarefa 4.2 — Refatorar `executeTool()` ✅

#### Tarefa 4.3 — Atualizar `composio-gemini.ts` agent loop ✅

---

### Fase 5 — Limpeza e Validação ✅ COMPLETA

#### Tarefa 5.1 — Remover código morto ✅

- Remover `connectedAccountIdCache` manual → substituído por `sessionCache`
- Remover `connectedAccounts.initiate()` → substituído por `session.authorize("google")`
- Remover `connectedAccounts.list()` → substituído por `session.toolkits()`
- `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` mantido como opcional para white-label

#### Tarefa 5.2 — Atualizar tipos ✅

#### Tarefa 5.3 — Atualizar testes ✅

#### Tarefa 5.4 — Verificar callback handler ✅

---

## Ordem de Execução Recomendada

```
Fase 1 (Sessões)
  └── 1.1 → 1.2
        │
Fase 2 (Auth)
  └── 2.1 → 2.2 → 2.3
        │
Fase 3 (Status)
  └── 3.1 → 3.2
        │
Fase 4 (Tool Execution) ← MAIS COMPLEXA
  └── 4.1 (decisão) → 4.2 → 4.3
        │
Fase 5 (Limpeza)
  └── 5.1 → 5.2 → 5.3 → 5.4
```

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| `session.tools()` retorna formato diferente do esperado pelo Gemini | Alto | Testar com call real antes de migrar |
| `session.authorize()` não suporta callback URL customizada | Médio | Verificar docs de `authorize()` options |
| Meta tools não cobrem todos os slugs atuais | Alto | Manter `composio.tools.execute()` como fallback na Fase 4 |
| Breaking change na versão do `@composio/core` | Médio | Travar versão atual até migração completa |
| Sessões expiram ou têm limitações de rate | Baixo | Implementar retry com `composio.use(sessionId)` |

---

## Arquivos Afetados

| Arquivo | Mudanças |
|---------|----------|
| `src/lib/composio-client.ts` | Refatoração principal — sessões, auth, status, tool execution |
| `src/lib/composio-gemini.ts` | Agent loop — provider execution |
| `src/lib/composio-tools-mapping.ts` | Possível atualização de slugs de tools |
| `src/lib/actions/composio-actions.ts` | Ajustes menores (usa composio-client) |
| `src/lib/actions/composio-connection-actions.ts` | Ajustes menores (usa composio-client) |
| `src/components/app/composio-connection.tsx` | Nenhuma mudança esperada na UI |
| `src/lib/composio-types.ts` | Novos tipos de sessão |
| Testes (3 arquivos) | Mocks atualizados |

---

## Critérios de Aceitação

- [x] Nenhum uso de `composio.connectedAccounts.initiate()` no código
- [x] Nenhum uso de `composio.connectedAccounts.list()` no código
- [x] `composio.create(userId)` é chamado para cada usuário
- [x] `session.authorize("google")` substitui o fluxo manual de OAuth
- [x] `session.toolkits()` substitui o lookup manual de status
- [x] `COMPOSIO_GOOGLE_AUTH_CONFIG_ID` não é mais obrigatório (opcional para white-label)
- [x] Todos os testes passam (109/109)
- [ ] Fluxo de conexão OAuth funciona end-to-end (requer deploy para testar)
- [ ] Geração de contratos via Gemini funciona com novas sessões (requer deploy para testar)
