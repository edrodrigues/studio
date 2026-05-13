# Perguntas para Validação Humana — Reviewer

> Geradas durante a fase de revisão das especificações SDD do V-Lab Assistant.

## Prioridade P0 (Críticas — bloqueiam reconstrução)

### Q1: Composio Integration — Qual é o escopo real?
**Specs afetadas:** `sync.md`, `code-spec-matrix.md`
**Problema:** O arquivo `src/app/api/composio/callback/route.ts` e `src/lib/actions/composio-actions.ts` estão mapeados na matriz de rastreabilidade mas **nenhuma SDD descreve a integração com Composio**. Há menção em `sync.md` RB-Sy-007 ("Composio integração para automações Google Workspace") mas sem detalhes de fluxo, endpoints, ou modelos de dados.
**Pergunta:** O Composio é usado apenas para automações de Google Workspace (sync de templates) ou também para outras automações? Existe um OAuth flow completo?
**Impacto:** Sem resposta, a reconstrução perderia toda a camada de automação.

### Q2: Firestore Security Rules — Quais são as regras de acesso reais?
**Specs afetadas:** Todas (especialmente `projects.md`, `auth.md`)
**Problema:** `firestore.rules` e `firestore.indexes.json` são listados como infraestrutura (⚪) mas **nunca foram analisados**. Em uma aplicação multi-tenant com projetos compartilhados, as regras de segurança definem quem pode ler/escrever em cada coleção.
**Pergunta:** As regras de Firestore restringem acesso a `users/{userId}/*` apenas ao dono? Projetos compartilhados usam regras customizadas por `projectId`?
**Impacto:** Sem isso, a reconstrução não terá segurança adequada de dados.

### Q3: Shared Templates — Como funciona a listagem cruzada?
**Specs afetadas:** `modelos.md` RB-Md-010, `projects.md`
**Problema:** `modelos.md` diz "Templates shared são listados via coleção separada" (🟡) mas não especifica qual é essa coleção. É `users/{sharedUserId}/sharedTemplates`? Ou uma coleção root `sharedTemplates`?
**Pergunta:** Como exatamente um template compartilhado aparece na listagem do usuário que recebeu o compartilhamento?
**Impacto:** Funcionalidade de compartilhamento de templates não pode ser reconstruída sem isso.

## Prioridade P1 (Importantes — afetam qualidade)

### Q4: Offline Sync — Qual é o limite da queue e o comportamento de retry?
**Specs afetadas:** `sync.md` RB-Sy-009
**Problema:** A spec diz "Operações offline têm retry limitado" (🟡) mas não especifica o número máximo de retries, o intervalo entre retries, ou o que acontece quando o limite é atingido.
**Pergunta:** Qual é o retry limit? Operações falhadas são descartadas ou notificadas ao usuário?

### Q5: Tiptap Editor — Quais extensions customizadas existem?
**Specs afetadas:** `contracts.md` RB-Ct-004
**Problema:** A spec menciona "Editor Tiptap com extensions customizadas" mas não lista quais extensions são usadas (ex: placeholder highlighting, mention, table, etc.).
**Pergunta:** Quais extensions do Tiptap estão habilitadas? Existem nodes/marks customizados?

### Q6: Admin Role — Existe um sistema de roles administrativo?
**Specs afetadas:** `admin.md`, `auth.md` RB-Au-011
**Problema:** `auth.md` RB-Au-011 diz "Sem sistema de roles administrativo explícito" mas `admin.md` tem uma página `/admin/feedback` que sugere algum tipo de acesso administrativo. Como um usuário é considerado "admin"?
**Pergunta:** O acesso admin é hardcoded para emails específicos? Baseado em um campo `role` no perfil do usuário?

### Q7: Google AI File Search — Como o playbook é indexado?
**Specs afetadas:** `alex-chatbot.md` RB-Al-007, `ai-genkit.md` RB-Ai-006
**Problema:** Ambas as specs mencionam Google AI File Search como fonte de conhecimento, mas não detalham como os documentos do playbook são enviados/indexados no Google AI.
**Pergunta:** Existe um processo de ingestion/upload para o Google AI File Search? É manual ou automatizado?

## Prioridade P2 (Melhorias — não bloqueiam)

### Q8: Email Notifications — Quais eventos disparam emails?
**Specs afetadas:** `activity.md` RB-At-006
**Problema:** Diz "Email notifications para eventos críticos" mas não define quais eventos são considerados "críticos".

### Q9: Notificação de Sync Falho — Deveria existir?
**Specs afetadas:** `sync.md` RB-Sy-010
**Problema:** "Sem notificação ao usuário quando sync falha" — é intencional ou uma lacuna a ser preenchida na reconstrução?

### Q10: Versionamento de Contratos — Existe?
**Specs afetadas:** `contracts.md`
**Problema:** Nenhuma SDD menciona versionamento de contratos. Se um contrato é editado após geração, o histórico é preservado?

---

## Estatísticas

| Métrica | Valor |
|---------|-------|
| Total de perguntas | 10 |
| P0 (Críticas) | 3 |
| P1 (Importantes) | 4 |
| P2 (Melhorias) | 3 |
| Specs com perguntas | 8 de 12 |
| Specs sem perguntas | `documents.md`, `placeholders.md`, `export.md`, `ai-genkit.md` |
