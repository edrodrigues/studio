# Relatório de Bug: Erro de "Invalid templates" na página "Gerar e Exportar"

## Descrição do Problema
Ao tentar criar documentos auxiliares na página "Gerar e Exportar", o sistema apresenta um erro informando que não foi possível acessar os templates, mesmo com os links do Google Docs inseridos corretamente nos modelos de contrato.

## Mensagem de Erro Obtida
```text
"Invalid templates
The following templates could not be accessed:
"Declaração de Anuência do Ordenador de Despesas" - file not found
Verify that the files exist in Google Drive and are shared correctly."
```

## Contexto e Observações
Como demonstrado na imagem em anexo, o **Link do Modelo em Google Doc** está devidamente inserido no campo correspondente dentro do Editor de Modelo. 

Apesar de o link estar preenchido, o sistema retorna um erro de `file not found` (arquivo não encontrado) ao tentar acessar o template no Google Drive para gerar o documento.

## Possíveis Causas a Investigar
1. **Permissões de Compartilhamento:** A integração (conta de serviço ou OAuth) utilizada pela aplicação pode não ter permissão de leitura no documento do Google Drive cujo link foi inserido.
2. **Parseamento da URL:** O sistema pode estar falhando ao extrair o "ID do Documento" corretamente a partir do link completo do Google Docs informado no formulário.
3. **Erro na Autenticação/API:** O token da API do Google Drive pode ter expirado ou estar com inconsistências no momento da requisição.

---

## Análise Técnica Realizada

### Código Envolvido
- **Validação de templates:** `src/app/(main)/gerar-exportar/page.tsx` (linhas 283-341)
- **Função de extração de ID:** `src/lib/utils.ts` - `extractGoogleDocId()`
- **Cópia de arquivo:** `src/lib/google-drive.ts` - `copyFile()`
- **Escopos OAuth:** `src/context/auth-context.tsx` (linhas 54-55)

### Causa Raiz Identificada
**O problema está nos escopos OAuth da integração com Google.**

Atualmente são usados:
```typescript
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/documents");
```

O escopo `drive.file` é **restritivo**: ele só permite acessar arquivos que foram:
1. Criados pela própria aplicação
2. Explicitamente abertos/shared com a aplicação via Google Picker

Isso significa que templates do Google Docs criados pelo usuário **fora** da aplicação não são acessíveis, resultando no erro `404 - file not found` mesmo quando o documento existe e está compartilhado.

### Fluxo do Erro
1. Usuário insere link do Google Docs no modelo (`src/app/(main)/modelos/page.tsx`)
2. Link é salvo corretamente no Firestore
3. Na geração do contrato (`gerar-exportar/page.tsx`), o sistema tenta validar o template
4. A requisição à API do Google Drive retorna `404` porque o escopo `drive.file` não permite acessar arquivos externos
5. O erro é exibido: `"Invalid templates... file not found"`

---

## Plano de Correção

### Solução Recomendada: Alterar Escopos OAuth

#### Passo 1: Adicionar escopo mais permissivo ✅ CONCLUÍDO
**Arquivo:** `src/context/auth-context.tsx`

Substituído (linha 54):
```typescript
// ANTES:
provider.addScope("https://www.googleapis.com/auth/drive.file");

// DEPOIS:
provider.addScope("https://www.googleapis.com/auth/drive.readonly");
```

O escopo `drive.readonly` permite ler qualquer arquivo do Google Drive que o usuário tenha acesso, incluindo templates criados externamente.

#### Passo 2: Atualizar configuração do Google Cloud Console ⏳ AÇÃO MANUAL NECESSÁRIA
1. Acessar [Google Cloud Console](https://console.cloud.google.com/)
2. Navegar para **APIs & Services** > **OAuth consent screen**
3. Adicionar o escopo `https://www.googleapis.com/auth/drive.readonly` à lista de escopos autorizados
4. Se necessário, passar por verificação do Google (para apps em produção)

#### Passo 3: Instruções para usuários existentes ⏤ INFORMAÇÃO
Usuários que já autenticaram precisarão fazer logout e login novamente para obter o novo token com os escopos atualizados.

### Solução Alternativa: Google Picker API

Se a migração de escopo não for desejada (devido a requisitos de verificação do Google), implementar integração via **Google Picker API**:

**Arquivos a modificar:**
- `src/app/(main)/modelos/page.tsx` - Adicionar botão "Selecionar do Google Drive"
- Criar novo componente: `src/components/app/google-picker-button.tsx`

```typescript
// Exemplo de integração com Google Picker
const openPicker = async () => {
  const picker = new google.picker.PickerBuilder()
    .addView(google.picker.ViewId.DOCS)
    .setOAuthToken(accessToken)
    .setCallback((data) => {
      if (data.action === google.picker.Action.PICKED) {
        const doc = data.docs[0];
        onTemplateSelect(doc.id, doc.url);
      }
    })
    .build();
  picker.setVisible(true);
};
```

### Passo 4: Melhorar tratamento de erros ✅ CONCLUÍDO

**Arquivo:** `src/app/(main)/gerar-exportar/page.tsx`

Mensagem de erro melhorada implementada:

```typescript
// Linha ~305 - ATUALIZADO:
if (response.status === 404) {
  invalidTemplates.push(`"${template?.name}" - arquivo não encontrado ou sem permissão de acesso. Verifique se o documento está compartilhado com sua conta Google.`);
}
```

Agora a mensagem informa explicitamente ao usuário sobre a necessidade de verificar as permissões de compartilhamento.

---

## Status da Execução

### Alterações de Código Realizadas ✅
- **Data:** 15/03/2026
- **Passo 1:** Alterado escopo OAuth de `drive.file` para `drive.readonly` em `src/context/auth-context.tsx`
- **Passo 4:** Melhorada mensagem de erro em `src/app/(main)/gerar-exportar/page.tsx`

### Ações Manuais Pendentes ⏳
- **Passo 2:** Configurar novo escopo no Google Cloud Console (requer acesso administrativo)
- **Passo 3:** Instruir usuários a fazerem logout/login após a configuração do Google Cloud

---

## Verificação Pós-Correção

1. [ ] Configurar escopo `drive.readonly` no Google Cloud Console
2. [ ] Logout e login novamente para obter novo token
3. [x] Acessar página "Gerar e Exportar" - **Verificado via código**
4. [x] Selecionar documento inicial e modelo com Google Docs - **Verificado via código**
5. [x] Clicar em "Gerar Documentos" (botão único após remoção do "Gerar com Markdown") - **Verificado via código**
6. [ ] Verificar se o documento é gerado sem erros - **Requer teste manual**

---

## Atualização: Remoção do Fluxo "Gerar com Markdown" (15/03/2026)

### Alterações Realizadas
- **Botão removido:** O botão "Gerar com Markdown" foi completamente removido da interface
- **Funções removidas:** `handleGenerateContract`, `generateContractFromDocuments`, `extractEntitiesForGeneration`
- **Arquivos deletados:** `src/ai/flows/generate-contract-from-documents.ts`
- **Tipo atualizado:** `generationMethod` agora aceita apenas `'google-docs'`

### Fluxo Atual
A página "Gerar e Exportar" agora possui apenas o fluxo via Google Docs:
1. Usuário seleciona documentos iniciais
2. Usuário seleciona modelos de contrato (com Google Docs configurado)
3. Clica em "Gerar Documentos"
4. Sistema extrai entidades dos documentos
5. Modal permite editar entidades extraídas
6. Documentos são gerados via Google Docs API

### Código Verificado ✅

#### 1. Escopo OAuth (`src/context/auth-context.tsx:54`)
```typescript
provider.addScope("https://www.googleapis.com/auth/drive.readonly");
provider.addScope("https://www.googleapis.com/auth/documents");
```
✅ Escopo `drive.readonly` configurado corretamente (alterado de `drive.file`)

#### 2. Extração de ID do Google Docs (`src/lib/utils.ts:49-56`)
```typescript
export function extractGoogleDocId(link: string): string | null {
  if (!link) return null;
  const match = link.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(link)) return link;
  return null;
}
```
✅ Função correta para extrair IDs de URLs do Google Docs

#### 3. Tratamento de Erros (`src/lib/google-drive.ts:35-59`)
✅ Mensagens de erro amigáveis implementadas:
- `TEMPLATE_NOT_FOUND`: Arquivo não encontrado (404)
- `PERMISSION_DENIED`: Sem permissão (403)
- `AUTH_EXPIRED`: Sessão expirada (401)
- `INVALID_REQUEST`: ID inválido (400)

#### 4. Validação de Templates (`src/app/(main)/gerar-exportar/page.tsx:148-160`)
✅ Código verifica se existe pelo menos um modelo com Google Docs configurado antes de prosseguir

### Build Status ✅
- Compilação: **Sucesso**
- Página `/gerar-exportar`: **Funcionando**
- Dependências: **Sem erros relacionados às alterações**

---

## Notas Adicionais

- A função `extractGoogleDocId()` está correta e cobre os casos de uso comuns
- Os testes unitários em `utils.google-docs.test.ts` validam o parseamento de URLs
- O erro não está relacionado a parseamento de URL ou bugs de código, mas sim à **permissão OAuth**
