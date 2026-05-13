# ADR-003: Composio para integração Google Workspace

**Status:** Aceito  
**Data:** 2026-04-25  
**Fonte:** Commits `5ea0d2f`, `fa77527`, `2fcc1f5`, `4f99f48`, `dd96162`, `d37eb88`  
**Decisores:** Ed

## Contexto

Sistema precisava de: criar Google Docs para contratos, operações no Google Drive, e OAuth para acessar dados do usuário Google. Implementar OAuth e Google APIs manualmente seria complexo e frágil.

## Decisão

Usar Composio como middleware para Google Workspace:
- OAuth flow gerenciado via Composio
- Tool mapping para Google Docs/Drive operations
- Composio client wrapper em `src/lib/composio-client.ts`
- Callback route `/api/composio/callback` para OAuth completion
- Connection management component para UI

## Alternativas Consideradas

1. **Google OAuth2 + APIs diretamente** — Mais controle, mas complexidade significativamente maior (token refresh, scopes, consent screen).
2. **Firebase Auth com Google sign-in** — Já usado para auth, mas não dá acesso a Google Workspace APIs.
3. **Nango** — Alternativa similar ao Composio, mas menos madura para Google Workspace.

## Consequências

### Positivas
- OAuth flow pronto em horas vs semanas
- Tool mapping simplifica chamadas de API
- Connection management UI pronta

### Negativas
- Vendor lock-in com Composio
- Múltiplos hotfixes necessários (`d37eb88`, `209b099`, `084d5c7`)
- SDK parameter naming conflicts exigiram debugging (`084d5c7`)
- GoogleProvider faltante causou render errors (`cd9ce97`)
- Callback params inesperados (`connectedAccountId` vs `user_id`) (`209b099`)
