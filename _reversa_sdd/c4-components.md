# C4 Components — V-Lab Assistant

> Diagrama de componentes (C4 Level 3) para os containers mais relevantes.
> Gerado pelo Architect em 2026-05-03 | Nível: Completo

---

## Container: Next.js SPA

```mermaid
graph TB
    subgraph Layout["Layout Components"]
        RootLayout["Root Layout<br/>(providers wrapper)"]
        MainLayout["Main Layout<br/>(sidebar + navbar)"]
        AuthLayout["Auth Layout<br/>(login/signup)"]
        ProtectedRoute["ProtectedRoute<br/>(auth guard)"]
    end

    subgraph Pages["Page Components"]
        Dashboard["Project Dashboard<br/>(projects list)"]
        ProjectDetail["Project Detail<br/>(presence + activity)"]
        DocumentsPage["Documents Page<br/>(file management)"]
        PlaceholdersPage["Placeholders Page<br/>(review + confirm)"]
        ContractsPage["Contracts Page<br/>(generate + edit)"]
        MembersPage["Members Page<br/>(invite + roles)"]
        ModelsPage["Templates Page<br/>(template management)"]
        AdminPage["Admin Pages<br/>(feedback, settings)"]
    end

    subgraph Shared["Shared Components"]
        ContractEditor["Contract Editor<br/>(Tiptap rich text)"]
        PlaybookWidget["ALEX Chat Widget<br/>(chatbot UI)"]
        NotificationsDropdown["Notifications Dropdown"]
        PresenceIndicators["Presence Indicators<br/>(real-time avatars)"]
        DocumentUploader["ProjectDocumentsUploader<br/>(R2 upload)"]
        TemplatesGrid["Templates Grid<br/>(template cards)"]
    end

    subgraph Providers["Context Providers"]
        AuthProvider["Auth Context<br/>(Firebase Auth state)"]
        FirebaseProvider["Firebase Provider<br/>(services initialization)"]
        ToastProvider["Toast Provider<br/>(notifications)"]
        ThemeProvider["Theme Provider<br/>(dark/light mode)"]
    end

    RootLayout --> FirebaseProvider
    FirebaseProvider --> AuthProvider
    AuthProvider --> ProtectedRoute
    ProtectedRoute --> MainLayout
    MainLayout --> Dashboard
    MainLayout --> ProjectDetail
    MainLayout --> DocumentsPage
    MainLayout --> PlaceholdersPage
    MainLayout --> ContractsPage
    MainLayout --> MembersPage
    MainLayout --> ModelsPage

    ProjectDetail --> PresenceIndicators
    DocumentsPage --> DocumentUploader
    ContractsPage --> ContractEditor
    ContractsPage --> PlaybookWidget
    ModelsPage --> TemplatesGrid
    MainLayout --> NotificationsDropdown
```

---

## Container: Genkit AI Flows

```mermaid
graph TB
    subgraph Extraction["Extraction Flows"]
        ExtractEntities["extractEntitiesFromDocuments<br/>(Document → Entities)"]
        ExtractTemplate["extractTemplateFromDocument<br/>(Document → Template)"]
        MatchPlaceholders["matchEntitiesToPlaceholders<br/>(Entities → Placeholders)"]
    end

    subgraph Generation["Generation Flows"]
        GenerateContract["generateContractInDocs<br/>(Placeholders → Google Doc)"]
        AiEnrich["aiEnrichContract<br/>(Contract + Context → Enriched)"]
    end

    subgraph Review["Review Flows"]
        AiReview["aiReviewContract<br/>(Contract + Playbook → Review)"]
        Consistency["analyzeDocumentConsistency<br/>(Multi-doc analysis)"]
        DocFeedback["getDocumentFeedback<br/>(Document → Feedback)"]
    end

    subgraph Assistance["Assistance Flows"]
        GeminiAssist["getAssistanceFromGemini<br/>(Question → Answer)"]
        PlaybookAssist["getPlaybookAssistance<br/>(Question + Playbook → Answer)"]
    end

    ExtractEntities --> MatchPlaceholders
    ExtractTemplate --> GenerateContract
    MatchPlaceholders --> GenerateContract
    GenerateContract --> AiEnrich
    AiReview --> Consistency
    PlaybookAssist --> GeminiAssist
    DocFeedback --> Consistency
```

---

## Container: Server Actions

```mermaid
graph TB
    subgraph Auth["Auth Actions"]
        SignInAction["signInWithEmail<br/>signUpWithEmail<br/>signInWithGoogle<br/>logout"]
    end

    subgraph Storage["Storage Actions"]
        UploadToR2["uploadToR2<br/>(presigned PUT)"]
        GetDownloadUrl["getDownloadUrl<br/>(presigned GET)"]
        MigrateToR2["migrateToR2<br/>(Firebase → R2)"]
    end

    subgraph Sync["Sync Actions"]
        SyncFileSearch["syncFileSearchToProject<br/>(documents → index)"]
        SyncTemplates["syncOfficialTemplates<br/>(scrape → update)"]
        SyncFAQ["syncFaqContent<br/>(scrape → store)"]
        ValidateLinks["validateTemplateLinks<br/>(audit URLs)"]
    end

    subgraph AI["AI Actions"]
        AiAssistance["getAiAssistance<br/>(chat streaming)"]
        AiReview["submitAiReview<br/>(contract review)"]
        AiEnrich["submitAiEnrich<br/>(contract enrich)"]
    end

    subgraph Google["Google Actions"]
        CreateGoogleDoc["createGoogleDoc<br/>(new document)"]
        UpdateGoogleDoc["updateGoogleDoc<br/>(sync content)"]
        GetDocContent["getGoogleDocContent<br/>(read content)"]
    end

    subgraph Feedback["Feedback Actions"]
        SubmitFeedback["submitFeedback<br/>(user feedback)"]
        GetPlaybookFeedback["getPlaybookFeedback<br/>(admin dashboard)"]
    end

    SignInAction --> Auth
    UploadToR2 --> Storage
    SyncFileSearch --> Sync
    SyncTemplates --> Sync
    SyncFAQ --> Sync
    AiAssistance --> AI
    AiReview --> AI
    AiEnrich --> AI
    CreateGoogleDoc --> Google
    UpdateGoogleDoc --> Google
    SubmitFeedback --> Feedback
```

---

## Component Dependency Matrix

| Component | Depende de | Fornece para |
|---|---|---|
| `ProtectedRoute` | `AuthProvider`, `useUser` | Todas as páginas protegidas |
| `DocumentUploader` | `uploadToR2`, `useProjectDocuments` | `DocumentsPage` |
| `ContractEditor` | `useProjectContracts`, `Tiptap` | `ContractsPage` |
| `PlaybookWidget` | `getAiAssistance`, `FaqContent` | `ContractsPage`, `ProjectDetail` |
| `PresenceIndicators` | `usePresence`, `UserPresence` | `ProjectDetail` |
| `NotificationsDropdown` | `useNotifications`, `TemplateNotification` | `MainLayout` |
| `TemplatesGrid` | `useTemplates`, `OfficialTemplate` | `ModelsPage` |
| `aiEnrichContract` | `genkit`, `gemini-3-flash-preview` | Server Actions |
| `aiReviewContract` | `genkit`, `playbook rules` | Server Actions |
| `generateContractInDocs` | `genkit`, `Composio`, `Google Docs API` | Server Actions |
