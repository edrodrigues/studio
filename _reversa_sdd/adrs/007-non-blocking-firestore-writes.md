# ADR-007: Non-blocking Firestore writes com error handling

**Status:** Aceito  
**Data:** 2026-03-01  
**Fonte:** `src/firebase/non-blocking-updates.tsx`, `src/firebase/error-emitter.ts`  
**Decisores:** Ed

## Contexto

Operações Firestore podem falhar por permissões, conflitos ou falhas de rede. Bloquear a UI durante writes degrada UX. Sistema precisa de error handling robusto sem travar interface.

## Decisão

Implementar writes non-blocking com pub/sub error handling:
- `non-blocking-updates.tsx` — wrapper para operações Firestore que não bloqueiam UI
- `error-emitter.ts` — pub/sub tipado para propagação de erros
- Eventos tipados: `permission-error`, `firestore-error`, `auth-error`
- Error codes mapeados para mensagens amigáveis em 3 tabelas (`auth-context.tsx`)
- Simulação de `request.auth` para debugging de Firestore rules

## Alternativas Consideradas

1. **Blocking writes com loading states** — UX ruim para operações lentas.
2. **Optimistic updates** — Complexo para operações que afetam múltiplas coleções.
3. **Retry automático** — Pode mascarar erros de permissão permanentes.

## Consequências

### Positivas
- UI permanece responsiva durante writes
- Error handling centralizado via pub/sub
- Mensagens de erro amigáveis para usuário final

### Negativas
- Writes podem falhar silenciosamente se nenhum subscriber estiver listening
- Debugging de errors assíncronos é mais complexo
- Simulação de `request.auth` pode divergir do comportamento real do Firestore
