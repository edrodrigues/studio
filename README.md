# 📜 Assistente de Contratos V-LAB

> **A plataforma definitiva para gestão, análise e geração inteligente de contratos jurídicos.**

O **Assistente de Contratos V-LAB** é uma solução avançada que combina o poder do **Next.js**, **Firebase** e **Inteligência Artificial (Genkit)** para transformar o fluxo de trabalho jurídico. Da extração automática de dados à análise de consistência, o V-LAB foi desenhado para oferecer precisão e agilidade.

---

![Next.js](https://img.shields.io/badge/Next.js-000?style=for-the-badge&logo=next.js&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Genkit](https://img.shields.io/badge/Google_Genkit-4285F4?style=for-the-badge&logo=google&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

---

## ✨ Funcionalidades Principais

| Recurso | Descrição |
| :--- | :--- |
| **🚀 Gestão de Projetos** | Controle múltiplos projetos com permissões granulares (Proprietário, Editor, Visualizador). |
| **🧠 IA & Genkit** | Extração inteligente de placeholders e análise de conformidade contratual com o Playbook institucional. |
| **💬 ALEX Chatbot** | Assistente virtual treinado para responder dúvidas e auxiliar na redação de cláusulas. |
| **✍️ Editor Tiptap** | Experiência de edição rica e integrada, permitindo formatação avançada diretamente no navegador. |
| **📄 Automação de Documentos** | Geração automática via Google Docs com suporte a templates customizados por projeto. |
| **📦 Exportação Versátil** | Converta seus contratos instantaneamente para **DOCX**, **PDF** ou planilhas **XLSX**. |
| **🔔 Colaboração Real-time** | Notificações instantâneas e sincronização fluida entre membros da equipe. |

---

## 🛠️ Tecnologias Utilizadas

### Core & Framework
- **Frontend:** [Next.js 14/15](https://nextjs.org/) (App Router), [React 18/19](https://reactjs.org/)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)

### Cloud & AI
- **Backend:** [Firebase](https://firebase.google.com/) (Firestore, Auth, Cloud Functions)
- **Engine de IA:** [Google Genkit](https://firebase.google.com/docs/genkit) & [Gemini API](https://ai.google.dev/)
- **Storage:** Firebase Storage + [Cloudflare R2](https://www.cloudflare.com/products/r2/) (compatível com S3)

### UI/UX
- **Componentes:** [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/)
- **Editor:** [Tiptap](https://tiptap.dev/)
- **Ícones:** [Lucide React](https://lucide.dev/)

---

## 🚀 Como Começar

### 1. Clonar e Instalar
```bash
git clone https://github.com/edrodrigues/Product-Design-AI.git
cd studio
npm install
```

### 2. Configurar Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto:
```env
# Inteligência Artificial
GOOGLE_GENAI_API_KEY=seu_api_key_aqui
GEMINI_API_KEY=seu_api_key_aqui

# Armazenamento Cloudflare R2 (Opcional)
R2_ACCOUNT_ID=seu_account_id
R2_ACCESS_KEY_ID=sua_access_key
R2_SECRET_ACCESS_KEY=sua_secret_key
R2_BUCKET_NAME=nome_do_bucket

# Segurança
CRON_SECRET=sua_chave_secreta
```

### 3. Rodar o Desenvolvimento
```bash
npm run dev
```
Acesse: [http://localhost:3000](http://localhost:3000)

---

## 📂 Estrutura do Projeto

```text
src/
├── app/              # Configuração de rotas e páginas (App Router)
│   ├── (main)/       # Telas protegidas do sistema
│   ├── api/          # Endpoints da aplicação
│   └── auth/         # Fluxo de autenticação
├── components/
│   ├── app/          # Componentes específicos do negócio
│   └── ui/           # Componentes base e primitivos (Shadcn)
├── ai/               # Lógica de Inteligência Artificial e fluxos Genkit
├── firebase/         # Inicialização e configurações do Firebase
├── hooks/            # Hooks customizados para estado e interações
└── lib/              # Funções utilitárias, actions e parsers
```

---

## 🧪 Comandos Úteis

| Comando | Descrição |
| :--- | :--- |
| `npm run dev` | Inicia o servidor em modo desenvolvimento |
| `npm run build` | Compila a aplicação para produção |
| `npm run genkit:dev` | Inicia o dashboard de desenvolvedor do Genkit |
| `npm run typecheck` | Validação estática de tipos TypeScript |
| `npm run test` | Executa a suite de testes com Vitest |
| `npm run test:e2e` | Executa os testes de ponta a ponta com Playwright |

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---
Desenvolvido com ❤️ pela equipe **V-LAB**.