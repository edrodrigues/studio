# Plano de Correção: Projetos, Convites, Contratos e Geração via Google Docs

## Resumo
Substituir o conteúdo deste arquivo por um plano consolidado que corrige 4 problemas acoplados:

1. o dashboard deixa de exibir projetos após o décimo vínculo;
2. o fluxo de convite não detecta corretamente membros já existentes;
3. a geração grava contratos em uma coleção diferente da lida pelas telas do projeto;
4. a tela **Gerar e Revisar** precisa validar o template, copiar o Google Doc, preencher a cópia com valores confirmados e salvar o link no contexto do projeto.

## Mudanças de Implementação
### 1. Dashboard de projetos
- Refatorar `useUserProjects` para remover a limitação de `slice(0, 10)`.
- Buscar projetos em lotes de até 10 IDs por query Firestore e ordenar o resultado final no cliente por `updatedAt` desc.
- Manter `memberships` como fonte inicial e preservar o `roleMap`.

### 2. Deduplicação de convites
- Corrigir `inviteMember` para validar membros existentes por `projectId + email`, sem depender do ID `${projectId}_${user.uid}`.
- Validar também convites pendentes duplicados com o mesmo `projectId + email`.
- Bloquear reenvio com mensagens específicas para “já é membro” e “já existe convite pendente”.

### 3. Fonte canônica de contratos
- Tratar `projectContracts` como coleção canônica dos contratos do projeto.
- Continuar gravando em `users/{uid}/filledContracts` apenas por compatibilidade transitória com a tela atual de revisão.
- Adicionar `projectContractId?: string` ao documento legado para vincular os dois registros.
- Garantir que geração e exclusão mantenham `contractCount` consistente.

### 4. Correção do fluxo “Gerar e Revisar”
- Antes de abrir a revisão final:
  - consolidar entidades válidas dos documentos iniciais;
  - descartar valores que pareçam placeholders (`<<...>>`, `{{...}}`, `[[...]]`, `<...>`, valor igual à própria chave, ou lixo de template);
  - validar acesso do usuário ao template do Google Docs;
  - inspecionar os placeholders do template a partir do Google Doc, com fallback para `markdownContent`.
- Trocar o fluxo de confirmação para operar sobre placeholders do template, não sobre o dicionário bruto de extração.
- Usar IA apenas para o match inicial entre entidades extraídas e placeholders ainda não resolvidos.
- Após a confirmação do usuário, preencher o Google Docs de forma determinística com `replaceAllText`.

### 5. Persistência e UX de erro
- Ao gerar:
  - copiar o template para a conta Google do usuário autenticado;
  - preencher a cópia com os placeholders confirmados;
  - salvar o link do novo Google Doc em `projectContracts` e no registro legado em `filledContracts`.
- Validar falhas antes do loading longo:
  - template não encontrado;
  - sem permissão;
  - link inválido;
  - autenticação Google expirada.
- Em seleções múltiplas, reportar sucesso e falha por template sem esconder resultados parciais.

## Interfaces e Tipos
- `ProjectDocument` deve aceitar `extractedEntityDescriptions?: Record<string, string>`.
- `Contract` legado deve aceitar `projectContractId?: string`.
- `prepareContractData` deve retornar:
  - `entities?: Record<string, string>`
  - `entityDescriptions?: Record<string, string>`
  - `discardedEntities?: Record<string, string>`
  - `unresolvedEntities?: string[]`
- A entrada canônica da geração deve ser um mapa `placeholder -> value` confirmado pelo usuário.

## Plano de Testes
### Dashboard e convites
- usuário com mais de 10 memberships vê todos os projetos ativos;
- ordenação por `updatedAt` continua correta;
- convite para membro já existente falha;
- convite duplicado pendente falha;
- convite para novo email continua funcionando.

### Extração e confirmação
- documentos com valores reais pré-preenchem o modal com dados concretos;
- valores placeholder como `<<NOME_CONVENIADA>>` são descartados;
- placeholders sem match confiável chegam vazios para edição manual;
- a revisão final exibe campos do template, não apenas chaves do contexto bruto.

### Google Docs
- template acessível é validado antes da geração;
- template sem permissão falha rapidamente com mensagem específica;
- template com link inválido falha com mensagem específica;
- sessão expirada pede reconexão;
- a cópia do Google Doc é criada na conta do usuário autenticado;
- os placeholders confirmados são aplicados na cópia correta.

### Persistência
- cada geração cria um registro em `projectContracts`;
- o registro legado em `filledContracts` recebe `projectContractId`;
- o contrato recém-gerado aparece na revisão e nas telas de projeto;
- exclusão remove também o registro canônico correspondente;
- `contractCount` incrementa e decrementa corretamente.

## Assumptions
- `projectContracts` é a fonte canônica de contratos de projeto.
- `filledContracts` permanece apenas como compatibilidade transitória.
- O template precisa ser acessível à conta Google autenticada do usuário; o patch não tenta contornar permissões do Google com credenciais administrativas.
- A escrita final no Google Docs é determinística e baseada apenas nos valores confirmados pelo usuário.
