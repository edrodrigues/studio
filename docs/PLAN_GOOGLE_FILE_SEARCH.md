# Plano de Implantação: Google's File Search (RAG) - V-Lab

Este documento descreve o roteiro técnico para substituir a injeção manual de contexto (prompt stuffing) pelo uso da ferramenta nativa **File Search** do Google Gemini, integrada ao Genkit.

---

## 1. Visão Geral da Arquitetura

O objetivo é criar um sistema de **RAG (Retrieval-Augmented Generation)** gerenciado pelo Google, onde:
- **Playbook Global:** Fica em um *File Search Store* permanente.
- **Documentos de Projeto:** Cada `projectId` possui seu próprio *File Search Store* isolado.
- **ALEX:** Consulta ambos os repositórios para responder dúvidas e auditar contratos.

---

## 2. Fase 1: Preparação do Ambiente

### 2.1 Atualização de Dependências
O suporte ao `file_search` é mais robusto no SDK mais recente do Google GenAI.
- **Ação:** Instalar o SDK oficial do Google Generative AI (Node.js).
- **Comando:** `npm install @google/generative-ai`

### 2.2 Configuração da API
- Garantir que a API Key em `.env` tenha permissões para o serviço de **Generative Language API** no Google Cloud Console.
- Habilitar o modelo `gemini-1.5-flash` ou `gemini-2.0-flash-exp` no Genkit (mínimo necessário para suporte a ferramentas de busca).

---

## 3. Fase 2: Infraestrutura de Dados (Ingestão)

### 3.1 Criação de Stores (Repositórios)
Implementar uma utilitária em `src/lib/google-ai-stores.ts`:
- `createProjectStore(projectId)`: Cria um repositório no Google para o projeto.
- `uploadToStore(storeId, fileBuffer, fileName)`: Sincroniza arquivos do R2/Firebase para o Google.

### 3.2 Gatilho de Sincronização
Alterar o fluxo de upload em `src/lib/actions.ts`:
- Sempre que um documento for salvo no `projectDocuments` (Firestore), disparar uma rotina que envia o arquivo para o *File Search Store* do respectivo projeto.

---

## 4. Fase 3: Integração com Genkit (Fluxos de IA)

### 4.1 Definição da Tool de Busca
No arquivo `src/ai/genkit.ts`, registrar a ferramenta de busca:
```typescript
// Exemplo conceitual
const fileSearchTool = ai.defineTool({
  name: 'fileSearchTool',
  description: 'Busca informações no Playbook e documentos do projeto',
  // ... configuração da ferramenta file_search do Google
});
```

### 4.2 Atualização do Especialista ALEX
Modificar `src/ai/flows/get-playbook-assistance.ts`:
- Remover a leitura manual de `fs.readFileSync(playbookPath)`.
- Configurar o `ai.definePrompt` para incluir a ferramenta `file_search` apontando para o Store ID do Playbook e do Projeto.

---

## 5. Fase 4: Geração de Contratos e Google Docs

### 5.1 Extração de Dados para Templates
Criar um novo fluxo `extract-entities-with-search.ts`:
- A IA usa o File Search para localizar dados específicos (Datas, Valores, Nomes) em todos os documentos do projeto.
- O resultado alimenta o `handleGenerateContract` para preencher o Google Docs via API com precisão de 100%.

### 5.2 Validação de Consistência
Atualizar `analyze-document-consistency.ts`:
- Em vez de enviar o texto completo dos documentos no prompt (o que pode falhar em arquivos grandes), a IA usa a busca para encontrar cláusulas conflitantes entre o Edital e o Contrato gerado.

---

## 6. Fase 5: UI/UX e Transparência

### 6.1 Exibição de Citações
- Alterar o componente de chat (`playbook-chat-widget.tsx`) para processar o objeto `citations` retornado pela Gemini API.
- Mostrar ao usuário o nome do arquivo e a página de onde a informação foi extraída.

---

## 7. Cronograma de Implementação

| Passo | Descrição | Esforço |
| :--- | :--- | :--- |
| **1** | Setup do SDK e atualização do modelo no Genkit | Baixo |
| **2** | Implementação da lógica de sincronização R2 -> Google Store | Médio |
| **3** | Migração do Playbook para Store Global | Baixo |
| **4** | Refatoração do ALEX para usar a ferramenta de busca | Médio |
| **5** | Implementação de citações na interface do usuário | Médio |

---

## 8. Considerações de Segurança
- **Isolamento:** Cada projeto deve obrigatoriamente usar um `store_id` único para evitar vazamento de dados entre clientes.
- **Limpeza:** Implementar uma rotina para deletar os arquivos do Google Store quando um documento ou projeto for excluído no sistema principal.
