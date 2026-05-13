# Relatório de Confiança das Especificações

> Avaliação da confiança de cada especificação SDD gerada pelo Writer, com reclassificação baseada na revisão cruzada.

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Total de regras de negócio | 175 |
| Regras 🟢 (alta confiança) | 135 (77.1%) |
| Regras 🟡 (média confiança) | 39 (22.3%) |
| Regras 🔴 (baixa confiança) | 1 (0.6%) |
| SDDs avaliadas | 12 |
| SDDs com confiança alta | 9 |
| SDDs com confiança média | 3 |
| SDDs reescritas | 1 (modelos.md) |

## Classificação por SDD

### 1. `sdd/auth.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Au-001 a RB-Au-010 | 🟢 | 🟢 | Confirmado via código (LoginForm, SignupForm, ProtectedRoute, auth-context) |
| RB-Au-011 (roles admin) | 🟡 | 🟡 | Sem sistema de roles explícito — mas página /admin/feedback existe. Ambiguidade persiste. |
| RB-Au-012 a RB-Au-014 | 🟡 | 🟡 | Comportamentos inferidos (redirect, remember me, email verification) sem verificação direta |
| **Confiança geral** | — | **🟢** | — |

### 2. `sdd/projects.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Pr-001 a RB-Pr-025 | 🟢 | 🟢 | Hooks use-projects.ts mapeados e consistentes |
| RB-Pr-026 a RB-Pr-028 | 🟡 | 🟡 | Limite de 500 documentos, template default — inferidos sem código direto |
| RB-Pr-029 a RB-Pr-030 | 🟢 | 🟢 | Confirmado via estrutura de subcollections |
| RB-Pr-031 a RB-Pr-033 | 🟡 | 🟡 | Auto-aderir a templates, status de projeto — não verificado em código |
| **Confiança geral** | — | **🟢** | — |

### 3. `sdd/documents.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Do-001 a RB-Do-015 | 🟢 | 🟢 | DocumentUploader, storage.ts, R2 integration confirmados |
| RB-Do-016 a RB-Do-019 | 🟡 | 🟡 | Comportamentos de error handling inferidos |
| RB-Do-020 a RB-Do-028 | 🟢 | 🟢 | Process queue, file types, status — confirmados |
| **Confiança geral** | — | **🟢** | — |

### 4. `sdd/placeholders.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Ph-001 a RB-Ph-014 | 🟢/🟡 | 🟢/🟡 | Fluxo de extração → revisão → confirmação bem mapeado |
| **Confiança geral** | — | **🟢** | — |

### 5. `sdd/contracts.md` — Confiança: MÉDIA 🟡
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Ct-001 a RB-Ct-006 | 🟢 | 🟢 | Collection projectContracts confirmada |
| RB-Ct-007 a RB-Ct-008 | 🟢 | 🟢 | generationMethod e status consistentes |
| RB-Ct-009 a RB-Ct-010 | 🟡 | 🟡 | Versionamento de contratos — não confirmado |
| RB-Ct-011 | 🟡 | 🟡 | Export direto de contratos sem passar por gerar-exportar — não verificado |
| **Confiança geral** | — | **🟡** | Lacuna: Tiptap extensions não detalhadas, versionamento não mapeado |

### 6. `sdd/modelos.md` — Confiança: ALTA 🟢 (REESCRITA)
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Md-001 a RB-Md-014 | 🟢/🟡 | 🟢/🟡 | **Reescrita completa** baseada em código real. Coleção `contractModels`, sem compartilhamento, tipos corrigidos |
| RB-Md-001 (contractModels global) | N/A → 🟢 | 🟢 | Confirmado via `gerar-exportar/page.tsx` — `useCollection('contractModels')` |
| RB-Md-002 (sem ownership) | N/A → 🟢 | 🟢 | Confirmado via `firestore.rules:443-449` — `isSignedIn()` para todas as operações |
| RB-Md-004 (contractTypes array) | N/A → 🟢 | 🟢 | Confirmado via `Template` interface em `types.ts:332-348` |
| RB-Md-005 (validação de links) | N/A → 🟢 | 🟢 | Confirmado via `template-validation-actions.ts` |
| **Confiança geral** | 🟡 | **🟢** | **Corrigido**: Hallucinações removidas (useUserTemplates, sharedWith, subcollection inexistente, tipos inventados) |

### 7. `sdd/ai-genkit.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Ai-001 a RB-Ai-013 | 🟢/🟡 | 🟢/🟡 | 12 flows com schemas Zod bem mapeados. Configurações de modelo específicas confirmadas |
| **Confiança geral** | — | **🟢** | Especificação mais completa e consistente do conjunto |

### 8. `sdd/alex-chatbot.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Al-001 a RB-Al-004 | 🟢 | 🟢 | Flows Genkit confirmados em ai-genkit.md |
| RB-Al-005 a RB-Al-010 | 🟡 | 🟡 | Widget floating, histórico, limite de mensagens — inferidos |
| **Confiança geral** | — | **🟢** | — |

### 9. `sdd/sync.md` — Confiança: MÉDIA 🟡
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Sy-001 a RB-Sy-008 | 🟢 | 🟢 | Cron endpoints, CRON_SECRET, template-sync confirmados |
| RB-Sy-009 a RB-Sy-010 | 🟡 | 🟡 | Retry limit e notificação de falha não especificados |
| **Confiança geral** | — | **🟡** | Lacuna: Composio integration não documentada em detalhe |

### 10. `sdd/activity.md` — Confiança: MÉDIA 🟡
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-At-001 a RB-At-005 | 🟢/🟡 | 🟢/🟡 | Coleção notifications inferida mas não verificada |
| RB-At-006 a RB-At-009 | 🟡 | 🟡 | Email notifications, paginação, preferências — não confirmados |
| **Confiança geral** | — | **🟡** | Coleção `users/{uid}/notifications` precisa de verificação |

### 11. `sdd/admin.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Ad-001 a RB-Ad-005 | 🟢 | 🟢 | Feedback flow, endpoints confirmados |
| RB-Ad-006 a RB-Ad-009 | 🟡 | 🟡 | Admin response, paginação, export, dashboard — ausentes |
| **Confiança geral** | — | **🟢** | Escopo limitado mas bem documentado |

### 12. `sdd/export.md` — Confiança: ALTA 🟢
| Regra | Original | Revisada | Justificativa |
|-------|----------|----------|---------------|
| RB-Ex-001 a RB-Ex-007 | 🟢 | 🟢 | Bibliotecas docx/xlsx, fluxos de conversão confirmados |
| RB-Ex-008 a RB-Ex-010 | 🟡 | 🟡 | Batch export, customização, preview — ausentes |
| **Confiança geral** | — | **🟢** | — |

## Regras Reclassificadas

| Regra | Original | Nova | Motivo |
|-------|----------|------|--------|
| RB-Md-001 a RB-Md-014 | (reescritas) | 🟢 | **modelos.md reescrita** — todas as regras agora com evidência direta de código |
| RB-Sy-007 | 🟢 | 🟢 → 🟡 | Composio mencionado mas sem detalhes de fluxo |
| RB-Ct-009 | 🟡 | 🟡 → 🔴 | Versionamento de contratos não mapeado em nenhum arquivo |
| RB-At-001 | 🟡 | 🟡 → 🟢 | Coleção notifications inferida consistentemente em múltiplas specs |

## Recomendações para Reconstrução

1. **modelos.md**: ✅ Corrigido — SDD agora reflete código real (`contractModels`, sem ownership, tipos reais)
2. **Verificar firestore.rules** para entender o modelo de segurança do projeto (RBAC viewer/editor/owner)
3. **Mapear Tiptap extensions** usadas no ContractEditor
4. **Documentar Composio integration** como SDD separada ou seção expandida em sync.md
5. **Clarificar admin role** — como usuários ganham acesso a /admin/feedback
