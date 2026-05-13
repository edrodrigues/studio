# User Story: Geração e Revisão de Contratos

## Persona
**Gerador de Contratos** — Precisa gerar contratos a partir de templates confirmados e revisar o resultado antes de exportar.

## História
```
Como gerador de contratos,
Quero selecionar templates, gerar contratos com placeholders preenchidos e revisar com IA,
Para produzir contratos precisos e conformes com o playbook institucional.
```

## Critérios de Aceitação

### Cenário 1: Selecionar template para geração
```gherkin
Dado que existem placeholders confirmados
Quando acesso a página "Gerar e Revisar"
Então vejo os templates disponíveis do projeto
E posso selecionar um ou mais templates
```

### Cenário 2: Gerar contrato
```gherkin
Dado que selecionei um template
Quando clico em "Gerar Contrato"
Então o flow generateContractInDocs é chamado
E um Google Doc é criado com placeholders substituídos
E o contrato aparece na lista de contratos do projeto
```

### Cenário 3: Revisar contrato com IA
```gherkin
Dado que existe um contrato gerado
Quando clico em "Revisar com IA"
Então o flow aiReviewContract é chamado
E sugestões são exibidas com severity e confidence
E posso aceitar ou rejeitar cada sugestão
```

### Cenário 4: Editar contrato manualmente
```gherkin
Dado que estou visualizando um contrato
Quando edito o markdownContent no Tiptap editor
E clico em "Salvar"
Então as alterações são persistidas no Firestore
E a versão do contrato é incrementada
```

### Cenário 5: Desfazer revisão de IA
```gherkin
Dado que aceitei sugestões de revisão
Quando clico em "Desfazer Revisão"
Então o conteúdo volta ao estado pré-revisão
E lastReviewEdits é limpo
```

### Cenário 6: Gerar múltiplos contratos
```gherkin
Dado que selecionei 3 templates
Quando clico em "Gerar Todos"
Então 3 contratos são gerados sequencialmente
E cada um aparece na lista ao ser concluído
```

## Regras de Negócio Relacionadas
- **RB-Ct-001:** Contratos gerados a partir de placeholders confirmados
- **RB-Ct-002:** filledData armazenado como JSON string
- **RB-Ct-006:** lastReviewEdits para undo de review
- **RB-Ct-008:** Geração centralizada em /gerar-exportar

## Métricas de Sucesso
- Tempo médio de geração: < 15 segundos por contrato
- Taxa de aceitação de sugestões de IA: > 70%

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/contracts.md` | Contracts | `src/app/(main)/gerar-exportar/page.tsx` |
| `sdd/contracts.md` | Contracts | `src/ai/flows/generate-contract-in-docs.ts` |
| `sdd/contracts.md` | Contracts | `src/ai/flows/ai-review-contract.ts` |
