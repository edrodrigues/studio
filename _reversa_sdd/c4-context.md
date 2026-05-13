# C4 Context — V-Lab Assistant

> Diagrama de contexto do sistema (C4 Level 1).
> Gerado pelo Architect em 2026-05-03 | Nível: Completo

---

## Diagrama C4 — System Context

```mermaid
graph TB
    subgraph Users["Usuários"]
        ALEX_USER["Usuário Final<br/>(Advogado/Paralegal)"]
        ADMIN["Administrador V-LAB"]
    end

    subgraph System["Sistema"]
        VLAB["V-Lab Assistant<br/>Plataforma de Gestão<br/>e Geração de Contratos"]
    end

    subgraph External["Sistemas Externos"]
        FIREBASE["Firebase Platform<br/>(Auth, Firestore, Storage)"]
        GEMINI["Google Gemini AI<br/>(Genkit Engine)"]
        GOOGLE_DOCS["Google Docs/Drive<br/>(via Composio OAuth)"]
        R2["Cloudflare R2<br/>(Object Storage)"]
        GOOGLE_AI["Google AI File Search<br/>(Semantic Index)"]
        VLAB_SITE["Site Oficial V-LAB<br/>(Páginas FAQ)"]
        VERCEL["Vercel<br/>(Hosting + Cron Jobs)"]
    end

    ALEX_USER -->|"HTTPS<br/>Next.js App Router<br/>Browser"| VLAB
    ADMIN -->|"HTTPS<br/>Next.js App Router<br/>Browser"| VLAB

    VLAB -->|"HTTPS<br/>Firebase SDK<br/>Auth, Firestore, Storage"| FIREBASE
    VLAB -->|"HTTPS<br/>Genkit SDK<br/>gemini-3-flash-preview"| GEMINI
    VLAB -->|"HTTPS<br/>Composio API<br/>OAuth + Google Workspace"| GOOGLE_DOCS
    VLAB -->|"HTTPS<br/>AWS SDK v3<br/>S3-compatible"| R2
    VLAB -->|"HTTPS<br/>VertexAI SDK<br/>File Search API"| GOOGLE_AI
    VLAB -.->|"HTTPS<br/>CRON semanal<br/>Cheerio scraping"| VLAB_SITE
    VLAB -->|"HTTPS<br/>Deploy +<br/>Cron Jobs"| VERCEL
```

---

## Personas e Usuários

| Persona | Descrição | Interação Principal |
|---|---|---|
| **Advogado/Paralegal** | Usuário final que gerencia contratos | Criar projetos, enviar documentos, revisar placeholders, gerar contratos |
| **Administrador V-LAB** | Admin da plataforma | Gerenciar templates, monitorar syncs, revisar feedback |
| **Sistema CRON** | Job agendado no Vercel | Sync diário de templates, sync semanal de FAQ |

---

## Sistemas Externos

| Sistema | Propósito | Protocolo | Direção | Crítico? |
|---|---|---|---|---|
| **Firebase Auth** | Autenticação (email/senha + Google OAuth) | HTTPS (SDK) | Bidirecional | 🔴 Sim |
| **Firestore** | Banco de dados principal (19 coleções) | HTTPS (SDK) | Bidirecional | 🔴 Sim |
| **Firebase Storage** | Storage fallback para documentos | HTTPS (SDK) | Bidirecional | 🟡 Parcial |
| **Google Gemini AI** | 12 flows Genkit (extração, review, geração) | HTTPS (Genkit SDK) | Bidirecional | 🔴 Sim |
| **Composio** | OAuth e API wrapper para Google Workspace | HTTPS (REST) | Bidirecional | 🔴 Sim |
| **Google Docs/Drive** | Criação, edição, export de contratos | Via Composio | Bidirecional | 🔴 Sim |
| **Cloudflare R2** | Storage primário para documentos | HTTPS (AWS SDK v3) | Bidirecional | 🟡 Parcial |
| **Google AI File Search** | Index semântico de documentos para ALEX | HTTPS (VertexAI SDK) | Bidirecional | 🟡 Parcial |
| **Site Oficial V-LAB** | Fonte de templates e FAQ oficiais | HTTPS (scraping cheerio) | Inbound | 🟡 Parcial |
| **Vercel** | Hosting + Cron Jobs (sync templates/FAQ) | HTTPS | Inbound | 🔴 Sim |

---

## Fluxos Principais

1. **Autenticação**: Usuário → V-Lab → Firebase Auth → Sessão
2. **Gestão de Projetos**: Usuário → V-Lab → Firestore
3. **Upload de Documentos**: Usuário → V-Lab → R2 (presigned URL) → Firestore metadata
4. **Extração de Entidades**: Documento → Genkit → Gemini AI → Placeholders
5. **Geração de Contratos**: Placeholders + Template → Gemini → Google Docs (via Composio)
6. **Review de Contratos**: Contrato → Genkit → Gemini → Playbook Rules → Sugestões
7. **ALEX Chat**: Pergunta → ALEX → FAQ Content + File Search → Gemini → Resposta
8. **Template Sync**: CRON → Site V-LAB (scrape) → Templates → Notificações
9. **FAQ Sync**: CRON → Site V-LAB (scrape) → FAQ Content → ALEX Knowledge Base
