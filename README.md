# Assistente de Contratos V-LAB

Plataforma web para gestão, análise e geração de contratos jurídicos com suporte a múltiplos projetos e integração com Inteligência Artificial.

## Funcionalidades

| Categoria | Recursos |
|-----------|----------|
| **Gestão** | Múltiplos projetos, convites com funções (Proprietário, Editor, Visualizador), sincronização de templates oficiais |
| **Extração** | Identificação automática de placeholders e entidades a partir de documentos |
| **Geração** | Criação de contratos via Google Docs com fallback automático para versões customizadas por projeto |
| **IA** | Análise de consistência contratual (Genkit), Chatbot ALEX treinado com Playbook institucional |
| **Editor** | Editor Rico (Tiptap) integrado, exportação em múltiplos formatos (DOCX, PDF) |
| **Colaboração** | Notificações em tempo real, sincronização de documentos, versionamento |

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage, Admin SDK)
- **Armazenamento**: Firebase Storage + Cloudflare R2 (AWS S3 SDK)
- **IA**: Google Genkit, Gemini API
- **UI**: Shadcn UI, Radix, Framer Motion, Tiptap

## Quick Start

```bash
# Instalar dependências
npm install

# Executar desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

### Variáveis de Ambiente

Crie um arquivo `.env.local`:

```bash
# IA
GOOGLE_GENAI_API_KEY=
GEMINI_API_KEY=

# Armazenamento (opcional)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

# Cron
CRON_SECRET=
```

## Estrutura

```
src/
├── app/                    # Rotas Next.js
│   ├── (main)/             # Páginas autenticadas
│   ├── api/                # API routes
│   └── auth/               # Login
├── components/
│   ├── app/                # Componentes de negócio
│   └── ui/                 # UI base (Shadcn)
├── ai/                     # Fluxos Genkit
├── firebase/               # Configuração Firebase
├── hooks/                  # React hooks
└── lib/                    # Ações, parsers, utilitários
scripts/                    # Scripts de diagnóstico
```

## Scripts Úteis

```bash
npm run dev                 # Desenvolvimento
npm run build              # Build produção
npm run typecheck          # Verificar tipos
npm run lint               # Linting
npm run test               # Testes unitários
```

## Licença

MIT