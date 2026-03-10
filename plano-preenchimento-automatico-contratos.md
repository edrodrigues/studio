# Plano: Preenchimento Automático de Cópias Customizadas de Contratos

## Objetivo
Permitir que "cópias customizadas" de contratos sejam preenchidas automaticamente com dados extraídos dos documentos iniciais, identificando e substituindo placeholders em múltiplos formatos.

---

## Escopo

### Funcionalidades Principais
1. **Detecção de placeholders** em múltiplos formatos (`< >`, `{{ }}`, `[ ]`)
2. **Extração de entidades** dos documentos iniciais do projeto
3. **Mapeamento inteligente** entre placeholders e entidades via IA
4. **Preenchimento automático** da cópia customizada no Google Docs
5. **Interface** nas páginas: Projeto e Gerar/Revisar

---

## Arquitetura

### Fluxo de Dados
```
Documentos Iniciais → Extração de Entidades → Match com Placeholders → Preenchimento no Google Docs
```

### Componentes Principais

| Componente | Responsabilidade | Localização |
|------------|------------------|-------------|
| `PlaceholderDetector` | Identificar placeholders em múltiplos formatos | `src/lib/placeholder-detector.ts` (novo) |
| `EntityMatcher` | Mapear placeholders às entidades via IA | Já existe em `src/ai/flows/match-entities-to-placeholders.ts` |
| `GoogleDocsFiller` | Preencher o documento no Google Docs | Já existe em `src/ai/flows/generate-contract-in-docs.ts` |
| `CustomCopyService` | Orquestrar o fluxo completo | `src/lib/services/custom-copy.service.ts` (novo) |

---

## Implementação

### Fase 1: Detector de Placeholders
**Arquivo:** `src/lib/placeholder-detector.ts`

```typescript
// Pseudocode - Detector de placeholders em múltiplos formatos
const PLACEHOLDER_PATTERNS = [
  /<([^>]+)>/g,           // <NOME>
  /\{\{([^}]+)\}\}/g,      // {{NOME}}
  /\[([^\]]+)\]/g          // [NOME]
];

function detectPlaceholders(content: string): Placeholder[]
```

**Tarefas:**
- [x] Criar regex patterns para cada formato
- [x] Normalizar nomes de placeholders (maiúsculas, remover acentos)
- [x] Remover duplicatas
- [x] Retornar lista com tipo de cada placeholder

---

### Fase 2: Serviço de Cópia Customizada
**Arquivo:** `src/lib/services/custom-copy.service.ts`

**Tarefas:**
- [x] Receber ID do template (Google Docs)
- [x] Obter entidades do projeto via Firestore
- [x] Verificar se projeto tem File Search habilitado
- [x] Chamar `detectPlaceholders` no conteúdo do template
- [x] Chamar `matchEntitiesToPlaceholders` para mapeamento
- [x] Criar cópia do template via Google Drive API
- [x] Aplicar substituições via Google Docs API

---

### Fase 3: Interface na Página do Projeto
**Arquivo:** `src/app/(main)/projects/[projectId]/page.tsx`

**Tarefas:**
- [x] Adicionar botão "Criar Cópia Customizada" na lista de contratos
- [x] Abrir modal de seleção de template
- [x] Mostrar preview dos placeholders detectados
- [x] Exibir status de preenchimento (preenchidos manual vs automático)
- [x] Permitir edição manual antes de criar

**Novo componente:** `src/components/app/custom-copy-modal.tsx`

---

### Fase 4: Interface na Página Gerar/Revisar
**Arquivo:** `src/app/(main)/gerar-exportar/page.tsx`

**Tarefas:**
- [x] Adicionar opção "Cópia Customizada" no fluxo de geração
- [x] Integrar com o `CustomCopyService`
- [x] Mostrar progresso de preenchimento

---

### Fase 5: Integração com File Search
**Melhoria existente:** O flow `generate-contract-in-docs.ts` já suporta File Search via `hasFileSearch`

**Tarefas:**
- [x] Garantir que o flag `hasFileSearch` seja passado corretamente
- [x] Adicionar fallback: se entidade não encontrada, buscar no File Search
- [x] Cachear resultados para evitar chamadas duplicadas (Nota: fallback implementado via Gemini 2.0 Flash)

---

## Estrutura de Dados

### Interface Placeholder
```typescript
interface DetectedPlaceholder {
  originalText: string;    // "<NOME_DO_CONTRATANTE>"
  normalizedKey: string;   // "NOME DO CONTRATANTE"
  format: 'angle' | 'double_brace' | 'bracket';
  line?: number;
  position?: { start: number; end: number };
}
```

### Interface MappingResult
```typescript
interface PlaceholderMapping {
  placeholder: DetectedPlaceholder;
  entityKey: string;
  value: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'entity' | 'file_search' | 'manual';
}
```

---

## Casos de Edge

1. **Placeholder sem entidade correspondente**
   - Deixar vazio ou marcar como "pendente"
   - Permitir preenchimento manual posterior

2. **Múltiplos valores para mesma entidade**
   - Usar o valor com maior confiança
   - Alertar usuário sobre ambiguidade

3. **Template sem placeholders**
   - Criar cópia sem modificações
   - Avisar usuário que não foram encontrados campos para preencher

4. **Projeto sem documentos iniciais**
   - Permitir criação da cópia
   - Todos os campos ficarão vazios para preenchimento manual

---

## Testes

### Testes Unitários
- [ ] `detectPlaceholders` com diferentes formatos
- [ ] Normalização de nomes (acentos, maiúsculas)
- [ ] Remoção de duplicatas

### Testes de Integração
- [ ] Fluxo completo: detectar → mapear → preencher
- [ ] Fallback para File Search
- [ ] Tratamento de erros

---

## Correção de Bug: MIME Type Inválido para File Search

### Problema
Erro ao indexar documentos no Google File Search:
```
* UploadToFileSearchStoreRequest.mime_type: When provided, MIME type must be in a valid type/subtype format (e.g., 'text/plain', 'application/pdf').
```

### Causa
O `file.type` do navegador pode estar vazio ou num formato inválido para arquivos como `.docx`, `.xlsx`, `.pptx`, etc.

### Solução
Criar um utilitário para mapear extensões de arquivo para MIME types válidos.

**Arquivo:** `src/lib/mime-type-utils.ts` (novo)

```typescript
// MIME types suportados pelo Google File Search
const SUPPORTED_MIME_TYPES = {
  'text/plain': ['.txt', '.md'],
  'text/markdown': ['.md'],
  'application/pdf': ['.pdf'],
  'text/html': ['.html', '.htm'],
};

const MIME_TYPE_MAP: Record<string, string> = {
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
};

export function getValidMimeType(fileName: string, fallbackMimeType?: string): string {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const mapped = MIME_TYPE_MAP[ext];

  if (mapped && SUPPORTED_MIME_TYPES[mapped]) {
    return mapped;
  }

  // Se o mimeType do navegador for válido, usar ele
  if (fallbackMimeType && SUPPORTED_MIME_TYPES[fallbackMimeType]) {
    return fallbackMimeType;
  }

  // Default para PDF ou texto plano
  return ext === '.pdf' ? 'application/pdf' : 'text/plain';
}
```

**Correção em:** `src/hooks/use-file-upload.ts` (linha 127)

```typescript
// Antes:
mimeType: file.type,

// Depois:
import { getValidMimeType } from '@/lib/mime-type-utils';
mimeType: getValidMimeType(file.name, file.type),
```

**Tarefas:**
- [ ] Criar utilitário `src/lib/mime-type-utils.ts`
- [ ] Atualizar `src/hooks/use-file-upload.ts` para usar o novo utilitário

---

## Cronograma Estimado

| Fase | Esforço | Descrição |
|------|---------|------------|
| Correção Bug | 1h | Corrigir MIME type inválido |
| Fase 1 | 2h | Detector de placeholders |
| Fase 2 | 4h | Serviço de cópia customizada |
| Fase 3 | 3h | Interface na página do projeto |
| Fase 4 | 2h | Interface na página Gerar/Revisar |
| Fase 5 | 2h | Integração com File Search |
| Testes | 3h | Testes unitários e integração |
| **Total** | **~17h** | |

---

## Referências

- Flow de extração de entidades: `src/ai/flows/extract-entities-from-documents.ts`
- Flow de matching: `src/ai/flows/match-entities-to-placeholders.ts`
- Flow de preenchimento Docs: `src/ai/flows/generate-contract-in-docs.ts`
- Hook de projetos: `src/hooks/use-projects.ts`
- Tipos: `src/lib/types.ts`

---

## Próximos Passos

1. Revisar e aprovar o plano
2. Criar o detector de placeholders
3. Implementar o serviço de cópia customizada
4. Adicionar interfaces nas páginas
5. Testar o fluxo completo
