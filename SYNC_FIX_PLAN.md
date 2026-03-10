# Plano de Correção do Arquivo de Sincronização (Sync Fix Plan)

## 1. Problema Principal (Falha no Upload do File Search)
Os logs e o screenshot indicam o erro:
`UploadToFileSearchStoreRequest.mime_type: When provided, MIME type must be in a valid type/subtype format (e.g., 'text/plain', 'application/pdf'). status: INVALID_ARGUMENT`.

Esse erro ocorre durante a execução da server action `handleSyncToFileSearch` localizada em `src/lib/actions.ts`, especificamente ao sincronizar arquivos (como `.docx` ou `.xlsx`) com o Google GenAI via File Search API.

A API do File Search possui restrições quanto aos MIME Types aceitos. Atualmente o código envia o `buffer` cru com o `docData.mimeType` nativo do arquivo (como `application/vnd.openxmlformats-officedocument.wordprocessingml...`), que pode ser considerado inválido pela API, ou ser um arquivo que requer conversão (exemplo: PDF e TXT são os preferidos, e a conversão de DOCX para texto é mais coesa).

### Plano Estratégico:
- Atualizar a função `handleSyncToFileSearch` em `src/lib/actions.ts` para processar o `buffer` do arquivo antes do upload.
- Utilizar a função `convertBufferToText` (existente em `src/lib/document-converter.ts`) para extrair o texto limpo caso o formato não seja puramente texto ou PDF (como no caso de planilhas e Word).
- Caso o arquivo seja convertido para texto puro:
  - Transformar o texto resultante num novo `Buffer` usando utf-8.
  - Atualizar a variável de upload para enviar com o mime type `text/plain`.
  - (Opcional) Ajustar o nome do arquivo para ter a extensão `.txt` na API da Google, assim fica com o formato condizente.

## 2. Erros de Console Adicionais

### Arquivo `/bot-avatar.png` 404 Not Found
- O console indicou: `Failed to load resource: the server responded with a status of 404 () /bot-avatar.png`
- **Ação:** Identificar o componente de chat ou de exibição que está tentando buscar o avatar em `/bot-avatar.png` e substituí-lo por um ícone default (do React Icons, Lucide, etc) ou garantir que a imagem correspondente esteja hospedada na pasta pública (`public/bot-avatar.png`).

### An error occurred in the Server Components render
- O erro de Server Component pode ser originado pelo fato de que o fallback ou captura do erro durante falhas (como a da sincronização) pode estar resultando no retorno de objetos de erro não serilizáveis, ou que o File Search / Actions falhou em parsear a resposta. 
- **Ação:** Assegurar que os catch-blocks dentro das actions de `src/lib/actions.ts` não tentem retornar instâncias da classe `Error` de volta para o cliente, sempre retornando simples `strings` com o map da mensagem de alerta (ex: `return { success: false, error: errorMessage };`), o que o código base tenta fazer. A aplicação da melhoria do MimeType provavelmente mitigará a exibição dessa falha no frontend.

## 3. Passo a Passo Técnico

1. Ir no arquivo `src/lib/actions.ts`.
2. Importar `convertBufferToText` e `getValidMimeType`.
3. No block do `handleSyncToFileSearch`:
   ```typescript
   let uploadBuffer = buffer;
   let uploadMimeType = getValidMimeType(docData.name, docData.mimeType);
   let uploadName = docData.name;

   // Se a função detectou o arquivo e nos deu text/plain, porém sabemos que originalmente
   // o arquivo era DOCX/XLSX (e geramos o texto via mammoth ou sheet_to_csv)
   if (uploadMimeType === 'text/plain' && !docData.name.toLowerCase().endsWith('.txt')) {
       try {
           const extractedText = await convertBufferToText(buffer, docData.mimeType, docData.name);
           uploadBuffer = Buffer.from(extractedText, 'utf-8');
           uploadName = docData.name + '.txt';
       } catch (e) {
           console.warn("Fallo convertendo formato; enviando original", e);
       }
   }

   const result = await uploadFileToProjectStore(
       projectId,
       uploadBuffer,
       uploadName,
       uploadMimeType
   );
   ```
4. Salvar as alterações, testar o recarregamento na interface e validar a sincronização.
