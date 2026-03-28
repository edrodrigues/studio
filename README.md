# Assistente de Contratos V-LAB

Aplicação web para gestão e análise de contratos jurídicos com suporte a múltiplos projetos, colaboração em tempo real e integração com IA.

## Funcionalidades Principais

- **Gestão de Projetos**: Crie e organize múltiplos projetos de contratos
- **Colaboração em Tempo Real**: Convide membros com diferentes funções (Proprietário, Editor, Visualizador)
- **Extração de Variáveis**: Identifique e preencha placeholders automaticamente
- **Análise de IA**: Receba feedback inteligente sobre consistência contratual
- **Editor de Contratos**: Edite documentos com formatação rica
- **Exportação**: Exporte contratos em múltiplos formatos
- **Sincronização de Templates**: Mantenha modelos atualizados com versões oficiais do CIn/UFPE
- **Sincronização Offline**: Continue trabalhando sem conexão

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Firebase (Firestore, Auth, Storage)
- **UI Components**: Shadcn UI
- **Editor**: Tiptap (Rich Text Editor)

## Começando

### Pré-requisitos

- Node.js 18+
- Firebase Project configurado

### Instalação

```bash
npm install
```

### Configuração

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com)
2. Ative Authentication, Firestore e Storage
3. Configure as variáveis de ambiente em `.env.local`

### Executando

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`

## Estrutura de Pastas

```
src/
├── app/                    # Páginas Next.js
│   ├── (main)/            # Rotas autenticadas
│   │   ├── projects/     # Gestão de projetos
│   │   ├── documentos-iniciais/
│   │   ├── preencher/
│   │   └── ...
│   └── auth/              # Autenticação
├── components/
│   ├── app/              # Componentes da aplicação
│   ├── ui/               # Componentes UI (Shadcn)
│   └── auth/             # Componentes de autenticação
├── context/              # React Context
├── firebase/             # Configuração Firebase
├── hooks/                # Custom Hooks
└── lib/                  # Utilitários e tipos
```

## Sincronização de Templates Oficiais

O sistema verifica automaticamente os modelos oficiais do CIn/UFPE na página FAQ-Templates e sincroniza com os templates locais.

### Como Funciona

1. **Parser Automático**: Extrai templates da página oficial a cada 24h
2. **Comparação Inteligente**: Compara templates por similaridade de nomes
3. **Sincronização**: Atualiza links automaticamente quando detecta mudanças
4. **Notificações**: Alerta administradores sobre atualizações

### Configuração

Adicione ao `.env.local`:

```bash
# CRON Job
CRON_SECRET=your-secret-key-here

# Configuração do Parser
OFFICIAL_TEMPLATES_CACHE_TTL=86400  # 24 horas
OFFICIAL_TEMPLATES_URL=https://contratos.cin.ufpe.br/faq-templates
```

### CRON Job

Configurado no `vercel.json` para executar diariamente às 06:00:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-templates",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Testes

```bash
# Testar parser manualmente
curl http://localhost:3000/api/admin/test-sync

# Executar sincronização (requer CRON_SECRET)
curl -H "Authorization: Bearer your-secret-key" \
  http://localhost:3000/api/cron/sync-templates
```

Veja mais detalhes em `src/lib/__tests__/README.md`.

## Funcionalidades por Implementar

- Integração com Google Docs API
- Sistema de sincronização offline
- Interface de migração de contratos legados
- Extensões Firebase (envio de emails)

## Licença

MIT
