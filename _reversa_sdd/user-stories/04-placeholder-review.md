# User Story: Revisão e Confirmação de Placeholders

## Persona
**Revisor de Contratos** — Precisa revisar os valores extraídos pela IA, corrigir imprecisões e confirmar os dados antes da geração.

## História
```
Como revisor de contratos,
Quero revisar, editar e confirmar os placeholders extraídos pela IA,
Para garantir que os dados usados na geração de contratos estão corretos.
```

## Critérios de Aceitação

### Cenário 1: Revisar placeholders
```gherkin
Dado que existem placeholders extraídos pela IA
Quando acesso a aba "Variáveis" do projeto
Então vejo todos os placeholders ordenados por confiança
Com key, value, confidence e status visíveis
```

### Cenário 2: Editar placeholder de baixa confiança
```gherkin
Dado que existe um placeholder com confidence < 0.5
Quando clico no campo de value
E corrijo o valor extraído
Então o status muda para "reviewed"
E a versão é incrementada
```

### Cenário 3: Batch update de placeholders
```gherkin
Dado que modifiquei 5 placeholders
Quando clico em "Salvar Tudo"
Então todos os placeholders são atualizados atomicamente
E cada um tem sua versão incrementada
```

### Cenário 4: Confirmar placeholder sem edição
```gherkin
Dado que existe um placeholder com confidence >= 0.9
Quando clico em "Confirmar"
Então o status muda para "confirmed"
E o valor permanece inalterado
```

### Cenário 5: Filtrar placeholders por confiança
```gherkin
Dado que existem placeholders com confiança variada
Quando aplico o filtro "Baixa Confiança"
Então apenas placeholders com confidence < 0.5 são exibidos
```

### Cenário 6: Buscar placeholder específico
```gherkin
Dado que existem 20+ placeholders
Quando digito "cpf" na busca
Então apenas placeholders com "cpf" no key ou value são exibidos
```

## Regras de Negócio Relacionadas
- **RB-Ph-005:** Update individual incrementa version
- **RB-Ph-007:** Batch usa writeBatch para atomicidade
- **RB-Ph-009:** Confirmação apenas muda status
- **RB-Ph-014:** Ordenação por confiança (menor primeiro)

## Métricas de Sucesso
- Tempo médio de revisão: < 3 minutos por projeto
- Taxa de correção: < 15% dos placeholders precisam de ajuste

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/placeholders.md` | Placeholders | `src/hooks/use-projects.ts` (useProjectPlaceholders) |
| `sdd/placeholders.md` | Placeholders | `src/app/.../placeholders/page.tsx` |
