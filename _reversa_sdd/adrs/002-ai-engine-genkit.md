# ADR-002: Google Genkit como engine de IA

**Status:** Aceito  
**Data:** 2026-04-29  
**Fonte:** Commits `899ad2e`, `afd154d`, `7b4a6c5`  
**Decisores:** Ed (ed.ufpe@gmail.com)

## Contexto

O sistema precisava de IA para extração de entidades de documentos jurídicos, revisão de contratos contra playbook, geração de contratos e chatbot ALEX. A escolha da engine de IA era crítica.

## Decisão

Adotar Google Genkit com Gemini como modelo principal. 12 flows Genkit foram implementados:
- `extractEntitiesFromDocuments`
- `matchEntitiesToPlaceholders`
- `analyzeDocumentConsistency`
- `aiEnrichContract`
- `aiReviewContract`
- `generateContractInDocs`
- `getAssistanceFromGemini`
- `getDocumentFeedback`
- `getPlaybookAssistance`
- `extractTemplateFromDocument`

## Alternativas Consideradas

1. **OpenAI SDK direta** — Mais simples, mas sem integração nativa Firebase.
2. **LangChain.js** — Mais flexível, mas complexidade desnecessária.
3. **Anthropic Claude API** — Bom para análise jurídica, mas sem Genkit integration.

## Consequências

### Positivas
- Integração nativa com Firebase Functions
- Type-safe com Zod schemas
- Dashboard de desenvolvimento Genkit
- Streaming support nativo

### Negativas
- Vendor lock-in com Google Cloud
- Gemini pode ter performance diferente de GPT-4 em análise jurídica
- Necessidade de manter Genkit dev server em produção

---

# ADR-003: Composio para integração Google Workspace

**Status:** Aceito  
**Data:** 2026-04-25  
**Fonte:** Commits `5ea0d2f`, `2fcc1f5`, `fa77527`, `4f99f48`, `dd96162`  
**Decisores:** Ed

## Contexto

O sistema precisava criar, ler e editar Google Docs para sync bidirecional de contratos. OAuth com Google Workspace diretamente requer verificação de app, review de segurança e configurações complexas.

## Decisão

Usar Composio como middleware para OAuth e API calls do Google Workspace:
- Composio gerencia OAuth flow (redirect, callback, token storage)
- Tool mapping para Google Docs/Drive operations
- Server actions chamam Composio client
- Connection management via `/api/composio/callback`

## Alternativas Consideradas

1. **Google OAuth direto** — Requer app verification (semanas de delay), configuração de consent screen.
2. **Firebase Extensions (Google)** — Não existe extensão para Google Docs.
3. **Service Account** — Não funciona para documentos de usuários finais.

## Consequências

### Positivas
- Zero configuração OAuth manual
- Tool mapping simplifica chamadas de API
- Callback route (`/api/composio/callback`) gerencia tokens automaticamente

### Negativas
- Dependência de serviço third-party (Composio)
- Latência adicional nas chamadas de API
- Se Composio cair, Google Docs sync para
- Múltiplos hotfixes necessários (`d37eb88`, `209b099`, `084d5c7`) indicando complexidade

---

# ADR-004: Cloudflare R2 como storage alternativo

**Status:** Aceito  
**Data:** 2026-04-26 a 2026-04-29  
**Fonte:** Commits `b5407c2`, `6608dac`, `96d2adf`  
**Decisores:** Ed

## Contexto

Firebase Storage tem custos elevados para egress e limitações de CDN. Documentos jurídicos podem ser grandes (PDFs, imagens). R2 oferece S3-compatible storage com egress gratuito.

## Decisão

Implementar R2 como storage primário com Firebase Storage como fallback:
- Presigned PUT URLs (expiram em 1h)
- Presigned GET URLs (expiram em 15min)
- `storageProvider` field em `ProjectDocument` (`'firebase' | 'r2'`)
- `migrateToR2()` para migração de documentos existentes
- ProjectDocumentsUploader component com dual-provider support

## Alternativas Consideradas

1. **Apenas Firebase Storage** — Simples, mas caro para egress.
2. **AWS S3** — Mais maduro, mas configuração mais complexa.
3. **Supabase Storage** — Bom, mas menos maduro que R2.

## Consequências

### Positivas
- Custo de egress zero no R2
- S3-compatible (SDK maduro)
- Presigned URLs para upload seguro direto do browser

### Negativas
- CRC32 checksum do AWS SDK v3 conflita com R2 — requer `checksumAlgorithm: 'crc32'` disabled (`6608dac`)
- Dois providers para manter
- Document upload hook mais complexo

---

# ADR-005: Template sync com fontes oficiais via CRON

**Status:** Aceito  
**Data:** 2026-04-12  
**Fonte:** Commits `0f34825`, `fc9e6c6`, `d1800d3`, `36a43f5`  
**Decisores:** Ed

## Contexto

Modelos de contrato oficiais são publicados em páginas FAQ externas. Templates no sistema precisam ser sincronizados com essas fontes para manter conformidade legal.

## Decisão

CRON job diário que:
1. Scrape páginas FAQ com cheerio
2. Extrai links de Google Docs de templates
3. Compara `officialVersionHash` para detectar mudanças
4. Atualiza templates com novo `googleDocLink` e `markdownContent`
5. Gera notificações para usuários afetados
6. Log de sync em `officialTemplateSyncs` collection

Template link validation system (`fc9e6c6`) adiciona auditoria de links quebrados.

## Alternativas Consideradas

1. **Sync manual** — Propenso a erros humanos.
2. **Webhook do site oficial** — Não disponível (site estático).
3. **RSS feed** — Não existe para templates.

## Consequências

### Positivas
- Templates sempre atualizados com fontes oficiais
- Detecção automática de mudanças via hash
- Audit trail completo em `officialTemplateSyncs`

### Negativas
- Scraping é frágil a mudanças de estrutura HTML
- CRON depende de Vercel cron schedule
- Falso positivos se site oficial muda layout sem mudar conteúdo

---

# ADR-006: Multi-project collaboration model

**Status:** Aceito  
**Data:** 2026-03-29 a 2026-04-03  
**Fonte:** Commits `0e4550b`, `516bf9e`, `c3fff6f`, `1cf31fd`, `c823515`, `aa0e778`, `5e6ac19`  
**Decisores:** Ed

## Contexto

Sistema originalmente era single-user com modelos de contrato globais. Evolução para plataforma multi-projeto com colaboração em tempo real.

## Decisão

Arquitetura multi-project com:
- `Project` como entidade central
- `ProjectMember` com roles (owner/editor/viewer)
- `ProjectDocument`, `ProjectPlaceholder`, `ProjectContract` como coleções por projeto
- `UserPresence` para colaboração real-time
- `Activity` como audit log imutável
- `ProjectInvite` com expiração de 30 dias

## Alternativas Consideradas

1. **Workspace/Team model** — Mais complexo, overkill para MVP.
2. **Single project com tags** — Não escala para isolamento de dados.

## Consequências

### Positivas
- Isolamento claro de dados por projeto
- RBAC granular por projeto
- Audit trail imutável
- Presença real-time para colaboração

### Negativas
- 19 coleções Firestore para gerenciar
- Queries mais complexas (always filter by projectId)
- Presença requer heartbeat constante (60s)
- Migration de legacy collections (`contractModels`, `users/{userId}/...`) ainda em progresso
