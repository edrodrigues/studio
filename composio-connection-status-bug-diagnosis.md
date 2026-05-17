# Diagnóstico: Botão "Conectar Google" Não Atualiza Após OAuth

**Data:** 2026-05-17  
**Status:** 🔴 Problema Identificado  
**Severidade:** Alta - Bloqueia fluxo principal de geração de contratos

---

## Sintoma

Após completar o fluxo OAuth do Composio com sucesso:
- ✅ Mensagem "Google conectado!" aparece (toast)
- ❌ Botão continua mostrando "Conectar Google" em vez de "Verificar conexão"
- ❌ Ao clicar "Gerar Documentos", sistema pede para conectar novamente

---

## Análise do Fluxo Atual

### 1. OAuth Callback (`/api/composio/callback`)
```
Usuário autentica no Google
  ↓
Composio redirect: /api/composio/callback?status=success&connectedAccountId=xxx
  ↓
Callback redirect: /gerar-exportar?composio_connected=true
```
**Status:** ✅ Funcionando corretamente

### 2. Componente `ComposioConnection` Detecta Sucesso
```typescript
// src/components/app/composio-connection.tsx:214-236
if (connected === 'true') {
  toast({ title: 'Google conectado!' });  // ✅ Mostra toast
  await clearComposioSessionCache(user.uid);  // ✅ Limpa cache
  checkConnectionStatus();  // ❌ VERIFICA STATUS
}
```
**Status:** ⚠️ Cache é limpo, mas verificação falha

### 3. Server Action `checkComposioConnectionStatus`
```typescript
// src/lib/actions/composio-connection-actions.ts:28-47
export async function checkComposioConnectionStatus(userId: string) {
  const client = await createComposioClient(userId);  // ❌ Cria NOVO cliente
  const result = await client.checkConnection(userId);  // ❌ Novo cache vazio
  return result;
}
```
**Status:** ❌ **CAUSA RAIZ DO PROBLEMA**

### 4. Verificação de Status no Novo Cliente
```typescript
// src/lib/composio-client.ts:181-220
async function getToolkitStatus(): Promise<ConnectionStatus> {
  const session = await getOrCreateSession(userId);  // Cria sessão nova
  const toolkits = await session.toolkits();  // ❌ Toolkits não aparecem como ACTIVE
  
  const requiredToolkits = ['GOOGLEDOCS', 'GOOGLEDRIVE'];
  // Procura toolkits...
  if (!toolkit) return 'INACTIVE';  // ❌ Retorna INACTIVE
}
```
**Status:** ❌ Toolkits não são encontrados como ACTIVE

---

## Causa Raiz Identificada

### Problema Principal: Session Cache em Server Actions

O `sessionCache` é um `Map` em memória do servidor Node.js:

```typescript
// src/lib/composio-client.ts:77
const sessionCache = new Map<string, { sessionId: string; expiresAt: number }>();
```

**O problema:**

1. **`clearComposioSessionCache(userId)`** é uma server action que limpa o cache
2. **`checkComposioConnectionStatus(userId)`** é OUTRA server action que cria um NOVO cliente
3. **Cada server action pode rodar em:**
   - Uma instância diferente do servidor (serverless/edge functions)
   - Um contexto de execução diferente com seu próprio `Map`
   - Um worker process diferente no runtime do Next.js

**Resultado:** O cache limpo na primeira server action **NÃO AFETA** o segundo cliente!

### Diagrama do Problema

```
┌─────────────────────────────────────────┐
│  Server Action 1: clearCache()          │
│  - Limpa sessionCache Map              │
│  - Execução termina                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Server Action 2: checkStatus()         │
│  - Cria NOVO cliente Composio          │
│  - NOVO sessionCache Map (vazio)       │
│  - composio.create(userId)             │
│  - session.toolkits()                  │
│  - ❌ Toolkits não aparecem como ACTIVE│
└─────────────────────────────────────────┘
```

### Problema Secundário: Timing do Composio

Mesmo que o cache funcionasse corretamente, há um **problema de timing**:

1. OAuth completa → Composio cria connected accounts
2. Imediatamente após, `session.toolkits()` é chamado
3. **PORÉM:** O Composio pode levar alguns segundos para:
   - Processar a conexão OAuth
   - Ativar os toolkits na sessão
   - Sincronizar o status entre serviços

**Resultado:** `session.toolkits()` retorna toolkits como `INACTIVE` ou `INITIALIZING` mesmo após OAuth bem-sucedido.

---

## Evidência no Código

### 1. Cache Não é Compartilhado Entre Server Actions

```typescript
// composio-connection-actions.ts
export async function clearComposioSessionCache(userId: string) {
  clearSessionCache(userId);  // Limpa cache DESTA execução
}

export async function checkComposioConnectionStatus(userId: string) {
  const client = await createComposioClient(userId);  // Cria NOVO cliente
  // Este cliente tem seu PRÓPRIO sessionCache Map!
}
```

### 2. Verificação de Status Requer Ambos Toolkits ACTIVE

```typescript
// composio-client.ts:186-198
const requiredToolkits = ['GOOGLEDOCS', 'GOOGLEDRIVE'];

for (const slug of requiredToolkits) {
  const toolkit = toolkits?.find(t => t.slug?.toUpperCase() === slug);
  
  if (!toolkit) {
    return 'INACTIVE';  // ❌ Se UM toolkit falta, retorna INACTIVE
  }
}
```

### 3. Página "Gerar Documentos" Verifica Conexão

```typescript
// gerar-exportar/page.tsx:371-379
const connectionStatus = await checkComposioConnectionStatus(user.uid);
if (!connectionStatus.connected) {
  setComposioConnectPrompt((value) => value + 1);  // ❌ Abre dialog de conexão
  toast({ title: "Conecte o Google Docs" });
  return;  // ❌ Bloqueia geração
}
```

---

## Impacto

- **Usuários afetados:** Todos que conectam o Composio via OAuth
- **Funcionalidade bloqueada:** Geração de contratos via Google Docs
- **Workaround atual:** Nenhum - usuário fica preso em loop de conexão

---

## Soluções Propostas

### Opção A: Polling com Retry Após OAuth (RECOMENDADA - Mais Simples)

**Implementação:**
1. Após OAuth, fazer polling do status por 10-15 segundos
2. Verificar status a cada 2 segundos
3. Se status for `ACTIVE`, atualizar UI
4. Se timeout, mostrar mensagem para verificar manualmente

**Prós:**
- ✅ Simples de implementar
- ✅ Resolve problema de timing do Composio
- ✅ Não depende de cache compartilhado

**Contras:**
- ⚠️ Pode levar até 15 segundos para atualizar
- ⚠️ Múltiplas chamadas ao servidor

**Complexidade:** Baixa (2-3 horas)

---

### Opção B: Verificar Connected Accounts Direto na API

**Implementação:**
1. Usar API `composio.connectedAccounts.list()` em vez de `session.toolkits()`
2. Verificar se existem connected accounts para GOOGLEDOCS e GOOGLEDRIVE
3. Status baseado em contas reais, não em toolkits da sessão

**Prós:**
- ✅ Mais robusto e confiável
- ✅ Não depende de estado de sessão
- ✅ Vê conexões reais do usuário

**Contras:**
- ⚠️ Requer mudança na lógica de verificação
- ⚠️ Pode precisar de permissões adicionais na API

**Complexidade:** Média (4-6 horas)

---

### Opção C: Armazenar Status no Cliente/LocalStorage

**Implementação:**
1. Após OAuth, armazenar `composio_connected_at=timestamp` no localStorage
2. Ao verificar status, se timestamp < 5 minutos, considerar como conectado
3. Após 5 minutos, verificar com Composio novamente

**Prós:**
- ✅ Muito rápido após OAuth
- ✅ Não depende de server actions

**Contras:**
- ⚠️ Pode mostrar status incorreto se conexão expirar
- ⚠️ Não funciona em modo anônimo/incognito
- ⚠️ Sincronização entre abas pode ser problemática

**Complexidade:** Baixa (1-2 horas)

---

### Opção D: Usar Banco de Dados/Redis para Cache Compartilhado

**Implementação:**
1. Armazenar session cache em Redis ou Firestore
2. Todas as server actions acessam o mesmo cache
3. Clear cache funciona entre todas as instâncias

**Prós:**
- ✅ Solução definitiva para cache compartilhado
- ✅ Funciona em serverless/edge
- ✅ Escala horizontalmente

**Contras:**
- ⚠️ Requer infraestrutura adicional (Redis/Firestore)
- ⚠️ Mais complexo de implementar
- ⚠️ Pode ter custos adicionais

**Complexidade:** Alta (8-12 horas)

---

## Recomendação

**Implementar Opção A (Polling com Retry) IMEDIATAMENTE** porque:
1. ✅ Resolve o problema rapidamente
2. ✅ Baixa complexidade e risco
3. ✅ Não requer mudanças de infraestrutura
4. ✅ Funciona com a arquitetura atual

**Depois, migrar para Opção B (Connected Accounts) como solução de longo prazo** porque:
1. ✅ Mais robusto e confiável
2. ✅ Não depende de timing ou polling
3. ✅ Melhor experiência do usuário

---

## Próximos Passos

1. [ ] Decidir qual abordagem implementar (A, B, C ou D)
2. [ ] Implementar solução escolhida
3. [ ] Adicionar logs de debug para rastrear status dos toolkits
4. [ ] Testar fluxo completo de OAuth → verificação de status → geração
5. [ ] Monitorar logs em produção para confirmar resolução

---

## Logs Úteis para Debug

Para investigar o problema, adicionar logs em:

```typescript
// composio-client.ts:181-220
async function getToolkitStatus(): Promise<ConnectionStatus> {
  const session = await getOrCreateSession(userId);
  const toolkits = await session.toolkits();
  
  console.log('[DEBUG] Toolkits returned:', JSON.stringify(toolkits, null, 2));
  console.log('[DEBUG] Required toolkits:', ['GOOGLEDOCS', 'GOOGLEDRIVE']);
  
  // ... resto do código
}
```

Isso mostrará exatamente o que o Composio retorna após OAuth.
