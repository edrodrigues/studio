# Plano de Implementação: Integração FAQ no ALEX

## Visão Geral

Sistema automatizado que sincroniza semanalmente o conteúdo das páginas FAQ do CIn/UFPE com o Firestore, e injeta esse conteúdo dinamicamente no sistema de instruções do ALEX (chatbot de IA).

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    CRON JOB (Vercel Cron)                       │
│                  Executa semanalmente (domingo 03:00)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              API Route: /api/cron/sync-faq-content              │
│                                                                 │
│  1. Fetch páginas FAQ (com cache)                               │
│  2. Parse HTML para extrair conteúdo estruturado                │
│  3. Comparar com versão anterior (hash)                         │
│  4. Se mudou: atualizar Firestore + criar notificação           │
│  5. Registrar log de sincronização                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Firestore Collection: faqContent                 │
│                                                                 │
│  - faqContent/main: Conteúdo da página principal                │
│  - faqContent/faq-templates: Conteúdo de templates              │
│  - faqContent/proc-interno: Conteúdo de procedimentos internos  │
│  - faqContentSyncs: Histórico de sincronizações                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               ALEX Flow: get-playbook-assistance.ts             │
│                                                                 │
│  1. Carregar Playbook estático (MD)                             │
│  2. Carregar FAQ dinâmico do Firestore                          │
│  3. Combinar: FAQ tem precedência sobre Playbook                │
│  4. Injetar no systemInstruction do Gemini                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Páginas FAQ a Sincronizar

| Página | URL | Conteúdo |
|--------|-----|----------|
| Principal | `https://contratos.cin.ufpe.br/` | Visão geral, contato, links |
| FAQ-Templates | `https://contratos.cin.ufpe.br/faq-templates` | Modelos de documentos, instruções |
| Proc-Interno | `https://contratos.cin.ufpe.br/proc-interno` | Procedimentos internos, fluxos |

---

## Passos de Implementação

### Passo 1: Atualizar Schema de Dados

**Arquivo**: `src/lib/types.ts`

Adicionar interfaces:

```typescript
// Conteúdo FAQ extraído da página
export interface FaqContent {
  id: string;                   // 'main', 'faq-templates', 'proc-interno'
  url: string;                  // URL original
  title: string;                // Título da página
  content: string;              // Conteúdo estruturado (Markdown)
  sections: FaqSection[];       // Seções da página
  contentHash: string;          // Hash para detectar mudanças
  lastSyncedAt: string;         // Timestamp da última sincronização
  syncStatus: 'synced' | 'error' | 'pending';
}

export interface FaqSection {
  title: string;
  content: string;
  links?: Array<{ text: string; url: string }>;
}

// Log de sincronização FAQ
export interface FaqContentSync {
  id: string;
  timestamp: string;
  status: 'success' | 'error' | 'partial';
  pagesChecked: number;
  pagesUpdated: number;
  errors: string[];
  changes: Array<{
    pageId: string;
    pageTitle: string;
    changeType: 'content_updated' | 'structure_changed' | 'links_updated';
    oldHash?: string;
    newHash?: string;
  }>;
}

// Notificação FAQ
export interface FaqNotification {
  id: string;
  type: 'faq_updated' | 'faq_sync_error';
  title: string;
  message: string;
  data: {
    pageId?: string;
    pageTitle?: string;
    syncId?: string;
    changeType?: string;
  };
  read: boolean;
  createdAt: string;
  userId: string;
}
```

**Status**: ✅ CONCLUÍDO

**Data**: 28/03/2026
**Notas**: Interfaces FaqContent, FaqSection, FaqContentSync e FaqNotification adicionadas ao types.ts

---

### Passo 2: Criar Parser de Conteúdo FAQ

**Arquivo**: `src/lib/faq-content-parser.ts`

Funcionalidades:
- Fetch das páginas com cache (TTL 7 dias)
- Parse HTML com Cheerio
- Extração de texto estruturado
- Conversão para Markdown simplificado
- Geração de hash para detecção de mudanças

Estrutura do parser:

```typescript
const FAQ_PAGES = [
  { id: 'main', url: 'https://contratos.cin.ufpe.br/' },
  { id: 'faq-templates', url: 'https://contratos.cin.ufpe.br/faq-templates' },
  { id: 'proc-interno', url: 'https://contratos.cin.ufpe.br/proc-interno' },
];

export async function parseFaqContent(pageId: string): Promise<FaqContent>;
export async function parseAllFaqPages(): Promise<FaqContent[]>;
export function generateContentHash(content: string): string;
```

**Status**: ✅ CONCLUÍDO

**Data**: 28/03/2026
**Notas**: Parser criado em src/lib/faq-content-parser.ts com suporte a 3 páginas FAQ, cache de 7 dias, e extração estruturada de conteúdo

---

### Passo 3: Criar API Route para Sincronização FAQ

**Arquivo**: `src/app/api/cron/sync-faq-content/route.ts`

Fluxo:
1. Verificar autorização (CRON_SECRET)
2. Para cada página FAQ:
   - Fetch com cache
   - Parse HTML
   - Calcular hash
   - Comparar com versão anterior
   - Se mudou: atualizar Firestore
3. Criar notificações para admins
4. Salvar log de sincronização

**Status**: ✅ CONCLUÍDO

**Data**: 28/03/2026
**Notas**: API Route criado em src/app/api/cron/sync-faq-content/route.ts com sincronização automática, comparação por hash, e sistema de notificações

---

### Passo 4: Configurar CRON Job Semanal

**Arquivo**: `vercel.json`

Adicionar:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-templates",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/sync-faq-content",
      "schedule": "0 3 * * 0"
    }
  ]
}
```

Executa todo domingo às 03:00 (horário de baixo uso).

**Status**: ✅ CONCLUÍDO

**Data**: 28/03/2026
**Notas**: Endpoint de teste criado em src/app/api/admin/test-faq-sync/route.ts para desenvolvimento manual

---

## Resumo da Implementação

### ✅ TODOS OS PASSOS CONCLUÍDOS

| Passo | Descrição | Status | Data |
|-------|-----------|--------|------|
| 1 | Schema de dados (types.ts) | ✅ CONCLUÍDO | 28/03/2026 |
| 2 | Parser de conteúdo FAQ | ✅ CONCLUÍDO | 28/03/2026 |
| 3 | API Route sincronização | ✅ CONCLUÍDO | 28/03/2026 |
| 4 | CRON Job configuração | ✅ CONCLUÍDO | 28/03/2026 |
| 5 | Modificar ALEX | ✅ CONCLUÍDO | 28/03/2026 |
| 6 | Firestore rules | ✅ CONCLUÍDO | 28/03/2026 |
| 7 | Notificações FAQ | ✅ CONCLUÍDO | 28/03/2026 |
| 8 | Endpoint de teste | ✅ CONCLUÍDO | 28/03/2026 |

### 🎉 Sistema Completo e Funcional

### 📁 Arquivos Criados/Atualizados

```
src/lib/types.ts                                    # Schema atualizado ✅
src/lib/faq-content-parser.ts                       # Parser de páginas FAQ ✅
src/app/api/cron/sync-faq-content/route.ts          # API de sincronização ✅
src/app/api/admin/test-faq-sync/route.ts            # Endpoint de teste ✅
src/ai/flows/get-playbook-assistance.ts             # ALEX integração FAQ ✅
src/components/app/notifications-dropdown.tsx       # Suporte FAQ notificações ✅
vercel.json                                          # CRON FAQ ✅
firestore.rules                                     # Regras faqContent ✅
PLANO_ALEX_FAQ_SYNC.md                              # Plano completo ✅
```

### 🎯 Funcionalidades Implementadas

- ✅ Parser HTML das 3 páginas FAQ do CIn/UFPE
- ✅ Cache de 7 dias para evitar requests excessivos
- ✅ Sincronização automática via CRON (domingos às 03:00)
- ✅ Comparação por hash SHA-256 para detectar mudanças
- ✅ Atualização automática no Firestore
- ✅ Sistema de logs de sincronização (faqContentSyncs)
- ✅ Criação automática de notificações para admins
- ✅ Endpoint de teste para desenvolvimento
- ✅ ALEX integrado com precedência FAQ > Playbook
- ✅ Dropdown de notificações com suporte FAQ
- ✅ Regras de segurança Firestore configuradas

---

## Histórico de Mudanças

| Data | Versão | Mudanças |
|------|--------|----------|
| 28/03/2026 | 1.0 | Criação do plano |

---

**Status**: 🔄 EM ANDAMENTO  
**Data de criação**: 28/03/2026  
**Última atualização**: 28/03/2026
