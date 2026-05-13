# Fluxo: Projetos

## Criação de Projeto

```mermaid
sequenceDiagram
    participant U as Usuário (owner)
    participant UI as ProjectsPage
    participant FS as Firestore
    participant A as Activity Log

    U->>UI: Clica "Novo Projeto"
    UI->>U: Formulário (name, description, clientName)
    U->>UI: Submete formulário
    UI->>FS: addDoc('projects', { name, description, clientName, createdBy: uid, status: 'active', createdAt: ISO, updatedAt: ISO, memberCount: 0, ... })
    FS-->>UI: docRef (new projectId)
    UI->>FS: addDoc('projectMembers', { projectId, userId: uid, role: 'owner', ... })
    FS-->>UI: memberRef
    UI->>FS: addDoc('activity', { projectId, userId, userName, action: 'created', targetType: 'project', targetId: projectId, targetName: name, timestamp: ISO })
    UI-->>U: Redirect /projects/{projectId}
```

## Convite de Membro

```mermaid
sequenceDiagram
    participant E as Editor/Owner
    participant UI as MembersPage
    participant FS as Firestore

    E->>UI: Preenche email + role
    UI->>FS: getDoc('projects/{projectId}')
    FS-->>UI: projectName
    UI->>FS: query('projectMembers', where('email', '==', normalizedEmail))
    alt Já é membro
        FS-->>UI: exists
        UI-->>E: Erro: "Email já é membro"
    else Não é membro
        FS-->>UI: empty
        UI->>FS: query('invites', where('email', '==', normalizedEmail), where('status', '==', 'pending'))
        alt Convite pendente existe
            FS-->>UI: exists
            UI-->>E: Erro: "Convite pendente existe"
        else Sem convite pendente
            FS-->>UI: empty
            UI->>FS: addDoc('invites', { projectId, projectName, email, role, invitedBy, invitedByName, invitedAt, expiresAt: now+30d, status: 'pending' })
            FS-->>UI: inviteRef
            UI-->>E: Sucesso: "Convite enviado"
        end
    end
```

## Aceite de Convite

```mermaid
sequenceDiagram
    participant I as Convidado
    participant UI as ProjectsDashboard
    participant FS as Firestore

    I->>UI: Clica "Aceitar" no convite
    UI->>FS: getDoc('invites/{inviteId}')
    alt Invite não existe
        FS-->>UI: not exists
        UI-->>I: Erro
    else Invite expirado
        FS-->>UI: expiresAt < now
        UI-->>I: Erro: "Convite expirado"
    else Invite não pendente
        FS-->>UI: status !== 'pending'
        UI-->>I: Erro
    else Válido
        FS-->>UI: inviteData
        UI->>FS: writeBatch()
        FS->>FS: set('projectMembers/{projectId}_{userId}', { projectId, userId, role, invitedBy, invitedAt, joinedAt, email, displayName, photoURL })
        FS->>FS: update('invites/{inviteId}', { status: 'accepted', acceptedAt, acceptedByUserId })
        FS->>FS: update('projects/{projectId}', { memberCount: increment(1), updatedAt })
        FS-->>UI: batch committed
        UI-->>I: Sucesso: "Agora você é membro"
    end
```

## Hierarquia de Permissões

```mermaid
flowchart LR
    A[usePermission] --> B[useProjectRole]
    B --> C[useDoc projectMembers/{projectId}_{userId}]
    C --> D{role?}
    D -->|owner| E[canView, canEdit, canManageMembers, canDeleteProject, canChangeRoles]
    D -->|editor| F[canView, canEdit, canManageMembers]
    D -->|viewer| G[canView]
    D -->|null| H[canView=false, canEdit=false, ...]
```

## Presença em Tempo Real

```mermaid
sequenceDiagram
    participant U as Usuário
    participant H as Heartbeat (60s)
    participant FS as Firestore
    participant O as Outros usuários

    U->>FS: updatePresence({ currentView: 'dashboard' })
    FS->>FS: setDoc('presence/{projectId}_{userId}', { userId, userName, projectId, lastSeenAt: now }, { merge: true })
    loop A cada 60 segundos
        H->>FS: updatePresence({})
        FS->>FS: update lastSeenAt
    end
    O->>FS: query('presence', where('projectId', '==', projectId), where('lastSeenAt', '>=', 5minAgo))
    FS-->>O: activeUsers[]
```
