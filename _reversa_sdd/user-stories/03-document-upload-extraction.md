# User Story: Upload de Documentos e Extração de Entidades

## Persona
**Analista Jurídico** — Recebe contratos em PDF/DOCX e precisa que a IA extraia automaticamente as variáveis relevantes.

## História
```
Como analista jurídico,
Quero fazer upload de documentos e ter entidades extraídas automaticamente pela IA,
Para que eu não precise digitar manualmente dados como nomes, CPFs, valores e datas.
```

## Critérios de Aceitação

### Cenário 1: Upload de documento
```gherkin
Dado que estou na página de documentos de um projeto
Quando clico em "Upload"
E seleciono um arquivo PDF ou DOCX (máx 25MB)
Então o arquivo é enviado para o Cloudflare R2
E o documento aparece na lista com status "processing"
```

### Cenário 2: Extração automática de entidades
```gherkin
Dado que um documento foi enviado com sucesso
Quando o upload é concluído
Então o flow extractEntitiesFromDocuments é automaticamente chamado
E entidades são extraídas via Gemini 2.0 Flash
E placeholders são criados com valores e níveis de confiança
```

### Cenário 3: Upload múltiplo
```gherkin
Dado que estou na página de documentos
Quando seleciono múltiplos arquivos (até 5)
Então cada arquivo é enviado sequencialmente
E a extração de entidades é disparada para cada um
```

### Cenário 4: Erro no upload
```gherkin
Dado que tento enviar um arquivo de 30MB
Quando o tamanho excede o limite de 25MB
Então uma mensagem de erro é exibida
E o upload não é iniciado
```

### Cenário 5: Visualizar documento
```gherkin
Dado que existe um documento enviado
Quando clico em "Visualizar"
Então o documento é aberto em preview no browser
```

### Cenário 6: Deletar documento
```gherkin
Dado que sou editor ou owner do projeto
Quando clico em "Deletar" em um documento
E confirmo a deleção
Então o documento é removido do Firestore
E o arquivo é removido do Cloudflare R2
```

## Regras de Negócio Relacionadas
- **RB-Dc-001:** Upload via presigned URL (PUT 1h)
- **RB-Dc-002:** Extração automática pós-upload
- **RB-Dc-003:** Limite de 25MB por arquivo
- **RB-Dc-004:** Formatos suportados: PDF, DOCX

## Métricas de Sucesso
- Tempo médio de extração: < 30 segundos por documento
- Precisão de extração: > 85% de confiança média

## Rastreabilidade
| SDD | Módulo | Arquivo |
|-----|--------|---------|
| `sdd/documents.md` | Documents | `src/hooks/use-file-upload.ts` |
| `sdd/documents.md` | Documents | `src/lib/storage.ts` |
| `sdd/documents.md` | Documents | `src/components/app/DocumentUploader.tsx` |
