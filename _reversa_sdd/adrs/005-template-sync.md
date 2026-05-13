# ADR-005: Template sync automático com fontes oficiais

**Status:** Aceito  
**Data:** 2026-04-06 a 2026-04-12  
**Fonte:** Commits `0f34825`, `cf759d7`, `c9a0dfb`, `d1800d3`, `fc9e6c6`  
**Decisores:** Ed

## Contexto

Templates de contrato podem mudar quando legislação ou políticas da V-LAB são atualizadas. Sistema precisa manter templates sincronizados com fontes oficiais sem intervenção manual.

## Decisão

Implementar sync automático de templates:
- CRON job (`/api/cron/sync-templates`) que compara `officialVersionHash`
- Template source resolution com fallback (`c9a0dfb`): tenta `projectDocLink` primeiro, depois `googleDocLink`
- Template link validation (`fc9e6c6`) para verificar se links Google Docs estão acessíveis
- Notificações in-app quando templates são atualizados
- Sync log em `officialTemplateSyncs` collection

## Alternativas Consideradas

1. **Atualização manual** — Propenso a erros e esquecimento.
2. **Webhook do site oficial** — Site não expõe webhooks para mudanças.

## Consequências

### Positivas
- Templates sempre atualizados automaticamente
- Hash-based detection evita updates desnecessários
- Audit trail completo em `officialTemplateSyncs`

### Negativas
- Scraping de HTML frágil — quebra se site oficial muda estrutura
- CRON requer `CRON_SECRET` para segurança
- Falso-positivos se site muda layout sem mudar conteúdo
