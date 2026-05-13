# User Story: Gestão de Projetos

## Persona
**Gerente Jurídico** — Precisa criar e gerenciar múltiplos projetos de contratos, adicionando membros da equipe.

## História
```
Como gerente de equipe jurídica,
Quero criar projetos, convidar membros e definir permissões,
Para que minha equipe possa colaborar em contratos de forma organizada e segura.
```

## Critérios de Aceitação

### Cenário 1: Criar novo projeto
```gherkin
Dado que estou na página de projetos
Quando clico em "Novo Projeto"
E preencho nome, descrição e contractType
Então o projeto é criado no Firestore
E sou definido como owner do projeto
E sou redirecionado para o dashboard do projeto
```

### Cenário 2: Adicionar membro ao projeto
```gherkin
Dado que sou owner ou editor de um projeto
Quando acesso a aba "Membros"
E insiro o email de um usuário
E seleciono a permissão (owner/editor/viewer)
Então um convite é enviado ao usuário
E o membro aparece na lista com status "pending"
```

### Cenário 3: Aceitar convite de projeto
```gherkin
Dado que recebi um convite de projeto por email
Quando clico no link do convite
E estou logado na plataforma
Então sou adicionado ao projeto com a permissão definida
E o projeto aparece na minha lista de projetos
```

### Cenário 4: Editar permissão de membro
```gherkin
Dado que sou owner de um projeto
Quando acesso a lista de membros
E altero a permissão de um membro de "viewer" para "editor"
Então a permissão é atualizada no Firestore
E o membro recebe notificação da mudança
```

### Cenário 5: Remover membro do projeto
```gherkin
Dado que sou owner de um projeto
Quando clico em "Remover" em um membro
E confirmo a remoção
Então o membro é removido do projeto
E perde acesso a todos os recursos do projeto
```

### Cenário 6: Navegar entre projetos
```gherkin
Dado que sou membro de 3 projetos
Quando acesso a página de projetos
Então vejo uma lista de todos os projetos
Com nome, data de criação e meu papel em cada um
```

## Regras de Negócio Relacionadas
- **RB-Pr-001:** Apenas owner pode remover membros
- **RB-Pr-002:** Owner não pode ser removido por outros
- **RB-Pr-003:** Convites expiram após 7 dias
- **RB-Pr-004:** Viewer não pode editar documentos ou contratos

## Métricas de Sucesso
- Tempo médio de criação de projeto: < 30 segundos
- Taxa de aceitação de convites: > 80%

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/projects.md` | Projects | `src/app/(main)/projects/new/page.tsx` |
| `sdd/projects.md` | Projects | `src/app/(main)/projects/[projectId]/members/page.tsx` |
| `sdd/projects.md` | Projects | `src/app/(main)/projects/page.tsx` |
