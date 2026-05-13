# Spec Impact Matrix — V-Lab Assistant

> Matriz de rastreabilidade: qual componente impacta qual coleção/entidade.
> Gerado pelo Architect em 2026-05-03 | Nível: Completo

---

## Matriz de Impacto

| Componente | Projects | Members | Documents | Placeholders | Contracts | Activity | Invites | Presence | SyncConfigs | SyncEvents | Templates | Notifications | FAQ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Auth Context** | R | | | | | | | | | | | | |
| **Project Dashboard** | R, C | R | | | | R | | | | | | | |
| **Project Detail** | R, U | R | | | | R | | R | | | | | |
| **Document Uploader** | U | | C, U | | | R | | | | | | | |
| **Placeholder Reviewer** | | | R | C, R, U | | | | | | | | | |
| **Contract Editor** | | | R | R | C, R, U | | | | R | | | | |
| **Members Page** | | C, R, U, D | | | | R | C, R, U, D | | | | | | |
| **Templates Page** | | | | | | | | | | | C, R, U | | |
| **Admin Pages** | | | | | | | | | | | R | R | R |
| **ALEX Chat Widget** | | | R | | | | | | | | | | R |
| **AI Flows (Genkit)** | | | C, U | C, U | C, U | | | | | | | | |
| **CRON Sync Templates** | | | | | | | | | | | C, U | | |
| **CRON Sync FAQ** | | | | | | | | | | | | | C, U |
| **Composio OAuth** | | | | | R, U | | | | | | | | |
| **Notifications System** | | | | | | | | | | | | C, R, U | |

**Legenda:** R = Read, C = Create, U = Update, D = Delete

---

## Matriz por Coleção Firestore

### projects
| Componente | Operação | Gatilho |
|---|---|---|
| Project Dashboard | READ, CREATE | Listar projetos, criar novo |
| Project Detail | READ, UPDATE | Ver detalhes, atualizar metadata |
| Members Page | READ | Ver info do projeto |
| Auth Context | READ | Verificar propriedade |

### projectMembers
| Componente | Operação | Gatilho |
|---|---|---|
| Members Page | CREATE, READ, UPDATE, DELETE | Convidar, listar, alterar role, remover |
| Project Dashboard | READ | Contar membros |
| Auth Context | READ | Verificar membership |

### projectDocuments
| Componente | Operação | Gatilho |
|---|---|---|
| Document Uploader | CREATE, UPDATE, DELETE | Upload, update status, delete |
| Placeholder Reviewer | READ | Ver documento fonte |
| Contract Editor | READ | Ver documentos do projeto |
| AI Flows | CREATE, UPDATE | Extrair entidades, indexar |

### projectPlaceholders
| Componente | Operação | Gatilho |
|---|---|---|
| Placeholder Reviewer | CREATE, READ, UPDATE, DELETE | Extrair, listar, editar, confirmar |
| Contract Editor | READ | Preencher template |
| AI Flows | CREATE, UPDATE | Match entidades para placeholders |

### projectContracts
| Componente | Operação | Gatilho |
|---|---|---|
| Contract Editor | CREATE, READ, UPDATE, DELETE | Gerar, editar, exportar, deletar |
| Composio OAuth | READ, UPDATE | Sync com Google Docs |
| AI Flows | CREATE, UPDATE | Enrich, review contracts |

### activity
| Componente | Operação | Gatilho |
|---|---|---|
| Project Dashboard | READ | Ver atividade recente |
| Project Detail | READ | Ver log completo |
| All Components | CREATE | Log ações automaticamente |

### invites
| Componente | Operação | Gatilho |
|---|---|---|
| Members Page | CREATE, READ, UPDATE, DELETE | Convidar, listar, aceitar, cancelar |

### presence
| Componente | Operação | Gatilho |
|---|---|---|
| Project Detail | CREATE, READ, UPDATE, DELETE | Heartbeat, listar, atualizar, disconnect |

### syncConfigs
| Componente | Operação | Gatilho |
|---|---|---|
| Contract Editor | CREATE, READ, UPDATE, DELETE | Configurar sync Google Docs |
| Composio OAuth | READ, UPDATE | Verificar config de sync |

### syncEvents
| Componente | Operação | Gatilho |
|---|---|---|
| Contract Editor | CREATE, READ | Log eventos de sync |
| Composio OAuth | CREATE | Registrar sync operations |

### templates
| Componente | Operação | Gatilho |
|---|---|---|
| Templates Page | READ, UPDATE | Listar, editar templates |
| CRON Sync | CREATE, UPDATE | Sync automático com fontes oficiais |
| Contract Editor | READ | Usar template para gerar contrato |

### notifications
| Componente | Operação | Gatilho |
|---|---|---|
| Notifications Dropdown | READ, UPDATE | Listar, marcar como lida |
| CRON Sync | CREATE | Notificar mudanças de template |
| Template System | CREATE | Notificar updates de template |

### faqContent
| Componente | Operação | Gatilho |
|---|---|---|
| ALEX Chat Widget | READ | Buscar conteúdo FAQ |
| CRON Sync FAQ | CREATE, UPDATE | Scrap e update automático |

### faqContentSyncs
| Componente | Operação | Gatilho |
|---|---|---|
| Admin Pages | READ | Ver status de sync |
| CRON Sync FAQ | CREATE | Log de sync |

### officialTemplateSyncs
| Componente | Operação | Gatilho |
|---|---|---|
| Admin Pages | READ | Ver logs de sync |
| CRON Sync Templates | CREATE | Log de sync |

### developer_feedback
| Componente | Operação | Gatilho |
|---|---|---|
| Feedback Modal | CREATE | Usuário envia feedback |
| Admin Pages | READ | Dashboard de feedback |

### playbook_feedback
| Componente | Operação | Gatilho |
|---|---|---|
| AI Review | CREATE | Feedback sobre review de IA |
| Admin Pages | READ | Dashboard de feedback |

### emailQueue
| Componente | Operação | Gatilho |
|---|---|---|
| Invite System | CREATE | Enviar email de convite (TODO) |

---

## Matriz de Dependência de AI Flows

| Flow | Inputs | Outputs | Depende de |
|---|---|---|---|
| `extractEntitiesFromDocuments` | Document content, fileUrl | Entities list | Gemini API |
| `matchEntitiesToPlaceholders` | Entities, existing placeholders | Matched placeholders | `extractEntitiesFromDocuments` |
| `aiEnrichContract` | Contract markdown, context | Enriched contract | Gemini API |
| `aiReviewContract` | Contract markdown, playbook rules | Review suggestions | Gemini API, Playbook |
| `analyzeDocumentConsistency` | Multiple documents | Consistency report | Gemini API |
| `generateContractInDocs` | Template, placeholders, Composio connection | Google Doc ID | Gemini API, Composio, Google Docs |
| `getAssistanceFromGemini` | User question, context | AI response | Gemini API |
| `getDocumentFeedback` | Document content | Feedback | Gemini API |
| `getPlaybookAssistance` | User question, playbook | AI response | Gemini API, Playbook |
| `extractTemplateFromDocument` | Document content | Template structure | Gemini API |
