# Plano de Implementacao: Aba Contratos - Cards de Modelos

## Objetivo
Alterar a UX da aba Contratos dentro do projeto para exibir cards dos modelos de contratos cadastrados para o tipo de contrato escolhido pelo usuario.

---

## Contexto Atual

### Estrutura de Dados
- Templates (contractModels): Colecao com id, name, description, googleDocLink, projectDocLink, contractTypes
- Projects: Possuem contractType
- Tipos de Contrato: TED, Acordo de Parceria (Lei de Inovacao), Acordo de Parceria (Embrapii), Contrato de Extensao Tecnologica

### Comportamento Atual
A aba Contratos mostra contratos GERADOS, nao modelos.

---

## Passos de Implementacao

### ✅ Passo 1: Adicionar selecao de tipo de contrato nas configuracoes
**Arquivo**: src/app/(main)/projects/[projectId]/settings/page.tsx

- [x] Adicionar Card Configuracao do Contrato
- [x] Incluir seletor dropdown com tipos de contrato
- [x] Salvar escolha no campo contractType
- [x] Mostrar tipo atual

**Implementado**: Card com icone FileSignature, select com 4 tipos, handler handleUpdateContractType

---

### ✅ Passo 2: Criar componente TemplatesGrid
**Arquivo**: src/app/(main)/projects/[projectId]/components/TemplatesGrid.tsx

- [x] Receber contractType e projectId como props
- [x] Buscar templates filtrados por contractType
- [x] Renderizar grid de cards responsivo
- [x] Card com nome, descricao, botoes de link e editar

**Implementado**: Grid responsivo 1/2/3 colunas, skeletons, badge tipo, integracao com modal

---

### ✅ Passo 3: Criar componente EditLinkModal
**Arquivo**: src/app/(main)/projects/[projectId]/components/EditLinkModal.tsx

- [x] Modal com Dialog shadcn/ui
- [x] Input para URL customizada
- [x] Botoes Cancelar e Salvar
- [x] Fechar ao salvar ou clicar fora
- [x] Mostrar link original como referencia

**Implementado**: Validacao URL, loading state, referencia ao link original, server action

---

### ✅ Passo 4: Refatorar ContractsTab
**Arquivo**: src/app/(main)/projects/[projectId]/page.tsx

- [x] Verificar se contractType esta definido
- [x] Mostrar mensagem de configuracao se nao estiver
- [x] Renderizar TemplatesGrid quando definido
- [x] Manter secao de contratos gerados abaixo

**Implementado**: Nova UX completa com duas secoes: Modelos e Contratos Gerados

---

### ✅ Passo 5: Adicionar Server Action
**Arquivo**: src/lib/actions.ts

- [x] Funcao handleUpdateTemplateLink
- [x] Validacao com Zod schema
- [x] Atualizar no Firestore
- [x] Campos de auditoria

**Implementado**: Server action completa com validacao e auditoria

---

### ✅ Passo 6: Estilizacao e Responsividade

- [x] Grid responsivo (mobile/tablet/desktop)
- [x] Cards com design shadcn/ui
- [x] Botao editar discreto
- [x] Estados de loading

**Implementado**: Tailwind classes grid-cols-1 md:grid-cols-2 lg:grid-cols-3, componentes shadcn/ui

---

## Estrutura de Arquivos

```
src/app/(main)/projects/[projectId]/
├── page.tsx                          # Modificado - ContractsTab refatorado
├── settings/
│   └── page.tsx                      # Modificado - Card tipo de contrato
├── components/
│   ├── ProjectDocumentsUploader.tsx  # Existente
│   ├── TemplatesGrid.tsx             # NOVO
│   └── EditLinkModal.tsx             # NOVO
└── ...

src/lib/
└── actions.ts                        # Modificado - handleUpdateTemplateLink
```

---

## Resumo da Implementacao

Todas as etapas foram concluidas com sucesso:

1. **Configuracoes**: Novo card para selecionar tipo de contrato
2. **TemplatesGrid**: Componente que exibe cards dos modelos filtrados
3. **EditLinkModal**: Modal para editar link customizado
4. **ContractsTab**: Refatorado para nova UX
5. **Server Action**: Funcao para atualizar link no backend
6. **Estilo**: Design responsivo e consistente

---

## Status: ✅ CONCLUIDO

Data de conclusao: 23/03/2026
