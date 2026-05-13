# Lacunas Identificadas nas Especificações

> Gaps entre o código existente e a documentação SDD gerada.

## ⚠️ CRÍTICO: Hallucinações do Writer Detectadas

### Gap-H001: `useUserTemplates` — Hook não existe
- **Spec:** `modelos.md`
- **Problema:** O hook `useUserTemplates(userId)` é descrito extensivamente na SDD mas **não existe em lugar nenhum do código**. Foi inventado pelo Writer.
- **Realidade:** Templates são buscados diretamente da coleção `contractModels` via `useCollection` em `src/app/(main)/gerar-exportar/page.tsx`
- **Severidade:** CRÍTICA

### Gap-H002: `sharedWith` array — Campo não existe
- **Spec:** `modelos.md` tipo ContractTemplate
- **Problema:** O campo `sharedWith: Array<{ userId, userEmail, permission }>` não existe no tipo real `Template` em `src/lib/types.ts`.
- **Realidade:** Templates são globais na coleção `contractModels`, sem permissões granulares
- **Severidade:** CRÍTICA

### Gap-H003: Coleção `users/{userId}/templates` — Não existe
- **Spec:** `modelos.md` RB-Md-001
- **Problema:** A SDD diz que templates estão em `users/{userId}/templates`. Essa coleção não existe.
- **Realidade:** Templates estão em `contractModels` (coleção root global)
- **Severidade:** CRÍTICA

### Gap-H004: Tipos `model | template | google_doc` — Não verificados
- **Spec:** `modelos.md` RB-Md-002, RB-Md-003, RB-Md-004
- **Problema:** O tipo `type?: 'model' | 'template' | 'google_doc'` não foi encontrado no código.
- **Realidade:** Tipos reais são `OfficialTemplate` (sistema) e `Template` (Firestore local)
- **Severidade:** ALTA

---

## Gap-001: Composio Integration — Sem SDD dedicada
- **Arquivos afetados:** `src/app/api/composio/callback/route.ts`, `src/lib/actions/composio-actions.ts`
- **Matriz:** Listados em `sync.md` e `code-spec-matrix.md`
- **Problema:** Nenhum fluxo, schema, ou regra de negócio documentada para a integração com Composio. O callback endpoint sugere um OAuth flow que não está em nenhuma SDD.
- **Severidade:** ALTA
- **Ação:** Criar seção expandida em `sync.md` ou nova SDD `composio.md`

## Gap-002: Firestore Security Rules — Nunca analisadas
- **Arquivos afetados:** `firestore.rules`, `firestore.indexes.json`
- **Problema:** Listados como infraestrutura (⚪) mas definem o modelo de segurança multi-tenant da aplicação. Sem análise, a reconstrução não terá controle de acesso correto.
- **Severidade:** CRÍTICA
- **Ação:** Analisar firestore.rules e adicionar seção de segurança em SDDs relevantes

## Gap-003: Shared Templates Collection — Mecanismo não especificado
- **Spec:** `modelos.md` RB-Md-010
- **Problema:** "Templates shared são listados via coleção separada" — qual coleção? Como o compartilhamento é implementado no Firestore?
- **Severidade:** ALTA
- **Ação:** Mapear estrutura real de compartilhamento no código

## Gap-004: Tiptap Editor Extensions — Não detalhadas
- **Spec:** `contracts.md` RB-Ct-004
- **Arquivo:** `src/components/app/ContractEditor.tsx`
- **Problema:** "Editor Tiptap com extensions customizadas" — quais extensions? Há nodes/marks customizados para placeholders?
- **Severidade:** MÉDIA
- **Ação:** Listar todas as extensions do Tiptap configuradas

## Gap-005: Admin Role Definition — Ambígua
- **Specs:** `admin.md`, `auth.md` RB-Au-011
- **Problema:** RB-Au-011 diz "Sem sistema de roles administrativo explícito" mas existe `/admin/feedback`. Como o acesso é determinado?
- **Severidade:** MÉDIA
- **Ação:** Verificar como a página /admin/feedback protege o acesso

## Gap-006: Google AI File Search Ingestion — Não documentado
- **Specs:** `alex-chatbot.md` RB-Al-007, `ai-genkit.md` RB-Ai-006
- **Problema:** Como os documentos do playbook são enviados/indexados no Google AI File Search? Existe um processo de ingestion?
- **Severidade:** MÉDIA
- **Ação:** Mapear fluxo de ingestion do playbook

## Gap-007: Contract Versioning — Não mapeado
- **Spec:** `contracts.md`
- **Problema:** Nenhuma menção a versionamento de contratos. Se um usuário edita um contrato gerado, o histórico é preservado?
- **Severidade:** BAIXA
- **Ação:** Verificar se há campo `version` ou coleção de histórico

## Gap-008: Cache Layer — Não documentado
- **Arquivo:** `src/lib/cache.ts`
- **Problema:** Listado como infraestrutura mas não referenciado em nenhuma SDD. O que é cacheado?
- **Severidade:** BAIXA
- **Ação:** Verificar uso do cache layer no código

## Gap-009: User Profile Management — Parcial
- **Spec:** `auth.md`
- **Problema:** Auth cobre login/signup mas não detalha gestão de perfil do usuário (nome, foto, preferências). Existe uma página de perfil?
- **Severidade:** BAIXA
- **Ação:** Verificar se existe página de perfil e mapear

## Gap-010: Error Handling Patterns — Não padronizado nas SDDs
- **Specs:** Todas
- **Problema:** Nenhuma SDD documenta o padrão de error handling do sistema (error boundaries, toast notifications, retry logic).
- **Severidade:** BAIXA
- **Ação:** Adicionar seção transversal de error handling

## Resumo por Severidade

| Severidade | Count | Gaps |
|------------|-------|------|
| CRÍTICA | 1 | Gap-002 |
| ALTA | 3 | Gap-001, Gap-003, Gap-010 |
| MÉDIA | 3 | Gap-004, Gap-005, Gap-006 |
| BAIXA | 3 | Gap-007, Gap-008, Gap-009 |

## Cobertura de SDDs

| SDD | Gaps Identificados |
|-----|-------------------|
| `sync.md` | Gap-001 |
| Todas | Gap-002 |
| `modelos.md` | Gap-003 |
| `contracts.md` | Gap-004, Gap-007 |
| `auth.md`, `admin.md` | Gap-005 |
| `alex-chatbot.md`, `ai-genkit.md` | Gap-006 |
| (infra) | Gap-008, Gap-009 |
| Todas | Gap-010 |
