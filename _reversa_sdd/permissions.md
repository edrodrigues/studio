# Permissions — V-Lab Assistant

> Matriz de permissões RBAC baseada em análise de código + Firestore Security Rules.
> Gerado pelo Detective em 2026-05-02 | Nível: Completo

---

## Papéis (Roles)

| Papel | Nível | Descrição |
|---|---|---|
| `owner` | 3 | Criador do projeto. Controle total. |
| `editor` | 2 | Pode editar conteúdo, enviar documentos, convidar membros. |
| `viewer` | 1 | Acesso somente leitura. Pode ver e exportar. |

**Fonte:** `src/lib/types.ts:9-13` — `ProjectRole` enum + `ROLE_HIERARCHY`

---

## Matriz de Permissões

### Projetos

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Criar projeto | ✅ | ✅ | ✅ | `request.auth != null && createdBy == getUserId()` |
| Listar projetos | ✅ | ✅ | ✅ | `isSignedIn()` |
| Ler projeto | ✅ | ✅ | ✅ | `isSignedIn()` |
| Editar metadata | ✅ | ⚠️ | ⚠️ | Owner: tudo. Editor: `name, description, clientName, status, contractType, processType`. Viewer: `lastActivityAt, lastActivityBy` |
| Deletar projeto | ✅ | ❌ | ❌ | `hasProjectRole(projectId, 'owner')` |
| Arquivar projeto | ✅ | ✅ | ❌ | Editor pode alterar `status` |

### Membros

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver membros | ✅ | ✅ | ✅ | `isSignedIn()` |
| Convidar membro | ✅ | ✅ | ❌ | `hasProjectRole(request.resource.data.projectId, 'editor')` |
| Aceitar convite | ✅ | ✅ | ✅ | `resource.data.email == getUserEmail()` |
| Alterar role de membro | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |
| Remover membro | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` ou `resource.data.userId == getUserId()` (self) |
| Sair do projeto | ✅ | ✅ | ✅ | `resource.data.userId == getUserId()` |

### Documentos

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver documentos | ✅ | ✅ | ✅ | `isSignedIn()` |
| Upload documento | ✅ | ✅ | ❌ | `hasProjectRole(request.resource.data.projectId, 'editor')` |
| Editar documento | ✅ | ✅ | ❌ | `hasProjectRole(resource.data.projectId, 'editor')` |
| Deletar documento | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |
| Download documento | ✅ | ✅ | ✅ | Presigned URL (R2: 1h PUT, 15min GET) |

### Placeholders

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver placeholders | ✅ | ✅ | ✅ | `isSignedIn()` |
| Editar valor | ✅ | ✅ | ❌ | `hasProjectRole(resource.data.projectId, 'editor')` |
| Confirmar placeholder | ✅ | ✅ | ❌ | `hasProjectRole(resource.data.projectId, 'editor')` |
| Deletar placeholder | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |

### Contratos

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver contratos | ✅ | ✅ | ✅ | `isSignedIn()` |
| Gerar contrato | ✅ | ✅ | ❌ | `hasProjectRole(request.resource.data.projectId, 'editor')` |
| Editar contrato | ✅ | ✅ | ❌ | `hasProjectRole(resource.data.projectId, 'editor')` |
| Deletar contrato | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |
| Exportar (DOCX/PDF/XLSX) | ✅ | ✅ | ✅ | N/A (client-side) |

### Convites (Invites)

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Criar convite | ✅ | ✅ | ❌ | `hasProjectRole(request.resource.data.projectId, 'editor')` |
| Ver convites | ✅ | ✅ | ✅ | `isSignedIn()` |
| Aceitar convite | ✅ | ✅ | ✅ | `resource.data.email == getUserEmail()` |
| Revogar convite | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |
| Deletar convite | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |

### Activity Log

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver activity | ✅ | ✅ | ✅ | `isSignedIn()` |
| Log activity | ✅ | ✅ | ✅ | `request.resource.data.userId == getUserId()` |
| Editar activity | ❌ | ❌ | ❌ | `allow update: if false` (imutável) |
| Deletar activity | ❌ | ❌ | ❌ | `allow delete: if false` (imutável) |

### Sync Configs (Google Docs)

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver configs | ✅ | ✅ | ✅ | `isSignedIn()` |
| Criar config | ✅ | ✅ | ❌ | `hasProjectRole(request.resource.data.projectId, 'editor')` |
| Editar config | ✅ | ✅ | ❌ | `hasProjectRole(resource.data.projectId, 'editor')` |
| Deletar config | ✅ | ❌ | ❌ | `hasProjectRole(resource.data.projectId, 'owner')` |

### Templates (globais)

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver templates | ✅ | ✅ | ✅ | `isSignedIn()` |
| Editar template | ✅ | ✅ | ✅ | `isSignedIn()` (sem restrição de role) |
| Sync templates | ✅ | ✅ | ✅ | CRON + admin SDK |
| Validar links | ✅ | ✅ | ✅ | `isSignedIn()` |

### Notificações

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver notificações | ✅ | ✅ | ✅ | `resource.data.userId == request.auth.uid` |
| Marcar como lida | ✅ | ✅ | ✅ | `resource.data.userId == request.auth.uid` |
| Criar notificação | ❌ | ❌ | ❌ | Server-side only (`allow create: if false`) |
| Deletar notificação | ❌ | ❌ | ❌ | `allow delete: if false` |

### FAQ Content (ALEX)

| Ação | owner | editor | viewer | Regra Firestore |
|---|---|---|---|---|
| Ver FAQ | ✅ | ✅ | ✅ | `isSignedIn()` |
| Editar FAQ | ❌ | ❌ | ❌ | Server-side only (CRON) |
| Sync FAQ | ❌ | ❌ | ❌ | Server-side only (CRON) |

---

## Permissões por Hook (Frontend)

| Hook | Retorna | Usado em |
|---|---|---|
| `usePermission(projectId)` | `{ canView, canEdit, canManageMembers, canDeleteProject, canChangeRoles, isOwner }` | Todas as páginas protegidas |
| `useProjectRole(projectId)` | `{ role, isLoading }` | Componentes de UI condicional |
| `canEdit(role)` | `boolean` | `hasPermission(role, ProjectRole.EDITOR)` |
| `canManageMembers(role)` | `boolean` | `hasPermission(role, ProjectRole.EDITOR)` |
| `canDeleteProject(role)` | `boolean` | `role === ProjectRole.OWNER` |
| `canChangeRoles(role)` | `boolean` | `role === ProjectRole.OWNER` |

**Fonte:** `src/lib/types.ts:488-515` + `src/hooks/use-projects.ts:479-504`

---

## Restrições Especiais

### 🔒 Regras de Segurança Críticas

1. **Convite duplicado bloqueado**: Não permite dois convites pendentes para o mesmo email em um projeto
2. **Convite expira em 30 dias**: `expiresAt = now + 30 * 24 * 60 * 60 * 1000`
3. **Activity log imutável**: `allow update, delete: if false`
4. **Sync events imutáveis**: `allow update, delete: if false`
5. **Notificações imutáveis**: Usuário só pode marcar como lida
6. **FAQ editável apenas via CRON**: `allow create, update, delete: if false`
7. **Self-remove permitido**: Qualquer membro pode sair do projeto
8. **Owner não pode ser removido por outros**: Apenas self-remove

### ⚠️ Lacunas de Segurança

1. **`developer_feedback`**: `allow create: if true` — sem verificação de auth (qualquer request pode criar)
2. **`playbook_feedback`**: `allow create: if true` — mesma lacuna
3. **Template edição**: `isSignedIn()` — qualquer usuário autenticado pode editar templates globais
4. **Presença**: `allow read, list: if isSignedIn()` — qualquer usuário autenticado pode ver presença de qualquer projeto

---

## Hierarquia Visual

```
┌─────────────────────────────────────────────────────────────┐
│                        OWNER (nível 3)                      │
│  Criar, editar, deletar projeto                             │
│  Gerenciar membros (convidar, remover, alterar role)         │
│  Upload, editar, deletar documentos                          │
│  Gerar, editar, deletar contratos                            │
│  Editar, confirmar, deletar placeholders                     │
│  Criar, revogar convites                                     │
│  Criar, editar, deletar sync configs                         │
│  Ver tudo + logs de activity                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        EDITOR (nível 2)                      │
│  Tudo do VIEWER +                                           │
│  Convidar membros                                            │
│  Upload e editar documentos                                  │
│  Gerar e editar contratos                                    │
│  Editar e confirmar placeholders                             │
│  Criar e editar sync configs                                 │
│  Editar metadata do projeto (name, description, clientName,  │
│    status, contractType, processType)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        VIEWER (nível 1)                      │
│  Ver projetos, membros, documentos, contratos, placeholders  │
│  Exportar contratos (DOCX/PDF/XLSX)                          │
│  Ver activity log                                            │
│  Atualizar activity tracking (lastActivityAt)                │
│  Sair do projeto                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Confiança das Análises

| Artefato | Confiança | Fonte |
|---|---|---|
| Matriz de permissões | 🟢 CONFIRMADO | `firestore.rules` (558 linhas) |
| Hooks de permissão | 🟢 CONFIRMADO | `src/lib/types.ts` + `src/hooks/use-projects.ts` |
| Regras especiais | 🟢 CONFIRMADO | Código + rules |
| Lacunas de segurança | 🟡 INFERIDO | Análise das rules |
