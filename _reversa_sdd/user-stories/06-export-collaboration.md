# User Story: Export e Colaboração

## Persona
**Coordenador Jurídico** — Precisa exportar contratos finalizados em diversos formatos e colaborar com a equipe.

## História
```
Como coordenador jurídico,
Quero exportar contratos para DOCX, PDF e XLSX, e notificar minha equipe,
Para distribuir os documentos finais e manter todos alinhados.
```

## Critérios de Aceitação

### Cenário 1: Exportar contrato para DOCX
```gherkin
Dado que existe um contrato gerado
Quando clico em "Exportar DOCX"
Então o markdownContent é convertido via biblioteca docx
E um arquivo .docx é baixado automaticamente
```

### Cenário 2: Exportar dados para XLSX
```gherkin
Dado que existe um contrato com filledData
Quando clico em "Exportar XLSX"
Então os dados dos placeholders são convertidos para planilha
E um arquivo .xlsx é baixado com colunas: Key, Value, Confidence
```

### Cenário 3: Exportar para PDF
```gherkin
Dado que existe um contrato vinculado ao Google Docs
Quando clico em "Exportar PDF"
Então o Google Doc é exportado como PDF
E o download do arquivo .pdf é iniciado
```

### Cenário 4: Export sem Google Doc
```gherkin
Dado que existe um contrato sem googleDocId
Quando tento exportar para PDF
Então uma mensagem informa que PDF requer Google Doc
E sugiro gerar o contrato via Google Docs primeiro
```

### Cenário 5: Notificar membros do projeto
```gherkin
Dado que um contrato foi gerado com sucesso
Quando o sistema detecta a geração
Então notificações são enviadas aos membros do projeto
E o badge de notificações é incrementado
```

### Cenário 6: Consultar ALEX sobre cláusula
```gherkin
Dado que estou revisando um contrato
Quando abro o widget do ALEX
E pergunto "O que o playbook diz sobre multa rescisória?"
Então ALEX responde com base no playbook institucional
E cita as fontes utilizadas
```

## Regras de Negócio Relacionadas
- **RB-Ex-001:** DOCX gerado client-side
- **RB-Ex-003:** PDF requer Google Doc
- **RB-Al-001:** ALEX usa playbook para respostas
- **RB-At-002:** Notificações em tempo real

## Métricas de Sucesso
- Tempo de export DOCX: < 3 segundos
- Tempo de export PDF: < 5 segundos
- Satisfação com export: > 4.0/5.0

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/export.md` | Export | `src/lib/export.ts` |
| `sdd/export.md` | Export | `src/lib/document-converter.ts` |
| `sdd/alex-chatbot.md` | ALEX | `src/components/app/playbook-chat-widget.tsx` |
| `sdd/activity.md` | Activity | `src/components/app/notifications-dropdown.tsx` |
