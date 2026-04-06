# Assistente de Contratos V-LAB

Aplicação web para gestão e análise de contratos jurídicos com suporte a múltiplos projetos, colaboração em tempo real e integração com Inteligência Artificial.

## Funcionalidades Principais

- **Gestão de Projetos Avançada**: Crie e organize múltiplos projetos de contratos com abas e formulários otimizados.
- **Colaboração em Tempo Real**: Convide membros com diferentes funções (Proprietário, Editor, Visualizador, e flexibilidade para o Cliente).
- **Extração de Variáveis Otimizada**: Identifique e preencha placeholders e entidades automaticamente de forma inteligente.
- **Análise de Consistência por IA (Genkit)**: Receba feedback instantâneo sobre coerência, completude e consistência contratual através da integração com o Google Genkit.
- **Chatbot ALEX (Playbook Assistente)**: Assistente interativo potencializado pelo Gemini 1.5 Pro, treinado com o Playbook institucional e páginas de FAQs oficiais, para tirar dúvidas em tempo real.
- **Editor de Contratos**: Edite documentos através de um editor robusto integrado (Tiptap) com suporte a formatação avançada de Rich Text.
- **Exportação e Google Docs**: Exporte contratos em múltiplos formatos ou crie templates e instâncias de contrato diretamente no Google Docs.
- **Central de Notificações Pop-up**: Receba avisos de status, ações e alertas através de um Notification Dropdown gerenciado perfeitamente via Firestore.
- **Sincronização de Templates Oficiais**: Mantenha modelos atualizados e compare automaticamente com as exigências oficiais da instituição, incluindo dados precisos da última data do _Status de Sincronização_ acessíveis direto na UI.
- **Armazenamento de Dados Resiliente**: Arquitetura híbrida para armazenamento, unindo o Firebase Storage a integrações modernas com o Cloudflare R2 usando o SDK da AWS S3 para maior escala e velocidade.

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend/Storage**: Firebase (Firestore, Auth, Storage, Admin SDK) + Integrações Cloudflare R2
- **Inteligência Artificial**: Google Genkit e APIs Google GenAI / VertexAI
- **UI Components**: Shadcn UI, Radix, Framer Motion
- **Editor e Arquivos**: Tiptap, pdf-parse, mammoth, docx, xlsx

## Começando

### Pré-requisitos

- Node.js 18+ (suporte testado em v18 e v20)
- Projeto no Firebase Dev/Produção configurado
- Conta AWS/Cloudflare para instâncias R2 (Opcional)

### Instalação

```bash
npm install
```

### Configuração e Ambiente

1. Crie seu projeto pelo [Firebase Console](https://console.firebase.google.com).
2. Ative os serviços de Authentication, Firestore e Storage (aplique a hierarquia definida em `firestore.rules`).
3. Monte o sistema declarando as variáveis de ambiente necessárias em `.env.local`:

```bash
# Integrações de IA Generativa
GOOGLE_GENAI_API_KEY=
GOOGLE_API_KEY=
GEMINI_API_KEY=

# Integração de Rede Distribuída Avançada (R2 / S3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# CRON Job Segurança
CRON_SECRET=

# Sistema e Rotas do Parser Institucional
OFFICIAL_TEMPLATES_CACHE_TTL=86400  # 24 horas de TTL referencial
OFFICIAL_TEMPLATES_URL=https://contratos.cin.ufpe.br/faq-templates
```

> **Dica**: Use o script `tsx scripts/check-env.ts` para checar as credenciais que a aplicação carrega pelo contexto e debugar as dependências ativas.

### Executando o Projeto

```bash
# Inicia o portal Next.js (Fast Refresh com turbopack)
npm run dev

# (Terminal Secundário) Inicia de forma separada o servidor base Genkit 
# que permite o playground UI da IA local
npm run genkit:dev
```

A aplicação estará disponível em `http://localhost:3000`.

## Estrutura de Diretórios 

```text
src/
├── ai/                   # Fluxos Genkit (Google AI), Playbook actions e definições para Inteligência Gen.
├── app/                  # Páginas do Next.js 
│   ├── (main)/           # Rotas seguras da aplicação (Projetos, Exportar, Feedback, Modelos)
│   ├── api/              # Rotas para cron jobs e ações server-side
│   └── auth/             # Rotas do portal de login/autenticação
├── components/
│   ├── app/              # Componentes sistêmicos de alto nível (Chatbot, Editor, Notificações)
│   └── ui/               # Módulos reutilizáveis da base do Shadcn
├── config, errors/       # Helpers, Listeners e Emitters nativos
├── firebase/             # Configurações para deploy client-side do portal Firebase
├── hooks/                # React Hooks para abstração de Stores e Queries
└── lib/                  # Ações de banco (Firestore, Storage, Google Docs, Parsers, R2)
scripts/                  # Utilitários globais do repositório (Diagnóstico, Auth checks e Migrate R2)
```

## Tarefas Agendadas (CRON Jobs) e Sincronização

A manutenção e consistência normativa de formulários dentro do Assistente se baseiam na raspagem (`parsing` do Google Sites) regular operando em Serverless, por meio de rotas Vercel Cron.

Configurações ativas (`vercel.json`):
1. **Templates Oficiais**: Roda sempre que provocado, ou **às 06:00 diariamente**, puxando a grade atual de arquivos essenciais.
2. **Atualização da Base de Respostas de FAQ (Chatbot)**: Integrado para atualizar metadados sem interferir em registros ativos, garantindo uma fonte segura do Playbook **aos domingos, às 03:00**.

Para testar ou forçar uma resincronização via terminal local (tenha em mãos sua `CRON_SECRET`):

```bash
curl -H "Authorization: Bearer your-secret-key" http://localhost:3000/api/cron/sync-templates
curl -H "Authorization: Bearer your-secret-key" http://localhost:3000/api/cron/sync-faq-content
curl http://localhost:3000/api/admin/test-sync   # Sem validação estrita (test environment)
```

## Licença

Distribuído sob a licença MIT.
