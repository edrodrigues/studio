# Chatbot-Driven Document Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the button-driven document generation flow on `/gerar-exportar` with a conversational, step-by-step experience powered by Alex chatbot using Composio's agentic loop.

**Architecture:** Three-zone page layout (explanation card, selectors + inline Alex chat, generated documents history table). Alex runs inline instead of floating, receives project/template context as props, and uses `runComposioAgent` for step-by-step document generation.

**Tech Stack:** Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS, shadcn/ui, Composio v3 SDK, Genkit/Gemini, Firebase Firestore

---

### Task 1: Create the explanation card component

**Files:**
- Create: `src/components/app/generate-export-explanation.tsx`

**Step 1: Create the explanation card component**

```tsx
"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "generate-export-explanation-dismissed";

export function GenerateExportExplanation() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <div className="relative rounded-2xl border border-blue-200 bg-blue-50/60 p-6 dark:border-blue-800 dark:bg-blue-950/30">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-3 top-3 h-7 w-7 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Fechar explicação"
      >
        <X className="h-4 w-4" />
      </Button>

      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
            Como funciona esta página
          </h2>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Selecione um projeto e um modelo de documento abaixo. O Alex irá guiá-lo passo a passo para copiar, personalizar e abrir o documento no Google Drive.
          </p>

          <div className="flex items-center gap-3 pt-1">
            {["Copiar", "Personalizar", "Abrir"].map((step, i) => (
              <div key={step} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-700 dark:bg-blue-800 dark:text-blue-300">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {step}
                </span>
                {i < 2 && (
                  <span className="text-blue-400 dark:text-blue-600">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/app/generate-export-explanation.tsx
git commit -m "feat: add explanation card component for generate-export page"
```

---

### Task 2: Create the project + template selectors component

**Files:**
- Create: `src/components/app/generate-export-selectors.tsx`
- Read: `src/lib/types.ts` (for Project, Template types)

**Step 1: Create the selectors component**

```tsx
"use client";

import { useMemo } from "react";
import { Loader2, LayoutTemplate, FolderOpen } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Project, Template, ProjectDocument, DocumentStatus } from "@/lib/types";
import { summarizeTemplateValidation } from "@/lib/template-link-validation";

type ProjectRecord = Project & { id: string };
type ProjectDocRecord = ProjectDocument & { id: string };

interface GenerateExportSelectorsProps {
  selectedProjectId: string | null;
  selectedTemplateId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onTemplateChange: (templateId: string | null) => void;
}

function getTemplateHealthBadge(template: Template) {
  const summary = summarizeTemplateValidation(template);
  const badges: Record<string, { label: string; className: string; isSelectable: boolean }> = {
    ready_with_fallback: { label: summary.label, className: "bg-blue-50 text-blue-700 border-blue-200", isSelectable: true },
    ready_original: { label: summary.label, className: "bg-green-50 text-green-700 border-green-200", isSelectable: true },
    ready_custom: { label: summary.label, className: "bg-emerald-50 text-emerald-700 border-emerald-200", isSelectable: true },
    ready_fallback_only: { label: summary.label, className: "bg-amber-50 text-amber-800 border-amber-200", isSelectable: true },
    pending_validation: { label: summary.label, className: "bg-slate-50 text-slate-700 border-slate-200", isSelectable: false },
  };
  return badges[summary.health] ?? { label: summary.label, className: "bg-rose-50 text-rose-700 border-rose-200", isSelectable: false };
}

export function GenerateExportSelectors({
  selectedProjectId,
  selectedTemplateId,
  onProjectChange,
  onTemplateChange,
}: GenerateExportSelectorsProps) {
  const { user } = useUser();
  const { firestore } = useFirebase();

  // Fetch all projects for the user
  const projectsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, "projects"), where("createdBy", "==", user.uid), orderBy("updatedAt", "desc"));
  }, [firestore, user]);

  const { data: projects, isLoading: isLoadingProjects } = useCollection<Project>(projectsQuery);

  // Fetch indexed documents count per project
  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, "projectDocuments"), orderBy("uploadedAt", "desc"));
  }, [firestore, user]);

  const { data: projectDocs } = useCollection<ProjectDocument>(projectDocsQuery);

  // Compute indexed doc counts per project
  const indexedDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of projectDocs || []) {
      if (doc.status === DocumentStatus.INDEXED) {
        counts.set(doc.projectId, (counts.get(doc.projectId) || 0) + 1);
      }
    }
    return counts;
  }, [projectDocs]);

  // Filter projects with indexed documents
  const projectsWithDocs = useMemo(() => {
    return (projects || [])
      .filter((p) => (indexedDocCounts.get(p.id) || 0) > 0)
      .map((p) => ({
        ...p,
        indexedDocCount: indexedDocCounts.get(p.id) || 0,
      }));
  }, [projects, indexedDocCounts]);

  // Fetch templates
  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, "contractModels");
  }, [firestore, user]);

  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);

  // Filter templates by selected project's contract type
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const selectedProject = projects?.find((p) => p.id === selectedProjectId);
    if (!selectedProject?.contractType) return templates;
    return templates.filter((t) =>
      t.contractTypes?.some((ct) => ct.toLowerCase() === selectedProject.contractType!.toLowerCase())
    );
  }, [templates, projects, selectedProjectId]);

  const templateStatuses = useMemo(() => {
    return filteredTemplates.reduce((acc, t) => {
      acc[t.id] = getTemplateHealthBadge(t);
      return acc;
    }, {} as Record<string, ReturnType<typeof getTemplateHealthBadge>>);
  }, [filteredTemplates]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Project Selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className="h-4 w-4 text-blue-500" />
          Projeto (Contexto)
        </Label>
        <Select value={selectedProjectId ?? ""} onValueChange={(v) => onProjectChange(v || null)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione um projeto" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : projectsWithDocs.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nenhum projeto com documentos indexados
              </div>
            ) : (
              projectsWithDocs.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {project.indexedDocCount} doc(s)
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Template Selector */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <LayoutTemplate className="h-4 w-4 text-purple-500" />
          Modelo de Documento
        </Label>
        <Select
          value={selectedTemplateId ?? ""}
          onValueChange={(v) => onTemplateChange(v || null)}
          disabled={!selectedProjectId}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione um modelo" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {selectedProjectId ? "Nenhum modelo para este tipo de contrato" : "Selecione um projeto primeiro"}
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const status = templateStatuses[template.id];
                return (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    disabled={!status.isSelectable}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{template.name}</span>
                      <Badge variant="outline" className={cn("ml-2 text-[10px]", status.className)}>
                        {status.label}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/app/generate-export-selectors.tsx
git commit -m "feat: add project and template selectors for generate-export page"
```

---

### Task 3: Create the generated documents history table component

**Files:**
- Create: `src/components/app/generate-export-history.tsx`

**Step 1: Create the history table component**

```tsx
"use client";

import { useState } from "react";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, orderBy, deleteDoc, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { format } from "date-fns";
import { ExternalLink, Eye, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn, extractDocumentId, isValidDate, safeNewDate } from "@/lib/utils";
import type { Contract } from "@/lib/types";

type ContractRecord = Contract & { id: string };

interface GenerateExportHistoryProps {
  projectId: string | null;
  onPreview?: (contract: ContractRecord) => void;
}

export function GenerateExportHistory({ projectId, onPreview }: GenerateExportHistoryProps) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const contractsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !projectId) return null;
    return query(
      collection(firestore, "users", user.uid, "filledContracts"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );
  }, [firestore, user, projectId]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const sortedContracts = (contracts || [])
    .map((c) => ({ ...c, id: (c as any).id }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const handleDelete = async (contract: ContractRecord) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;
    setDeletingId(contract.id);
    try {
      const contractRef = doc(firestore, "users", user.uid, "filledContracts", contract.id);
      const contractDoc = await getDoc(contractRef);
      const contractData = contractDoc.exists() ? contractDoc.data() as Contract : null;
      await deleteDoc(contractRef);
      if (contractData?.projectContractId) {
        await deleteDoc(doc(firestore, "projectContracts", contractData.projectContractId));
      }
      if (contractData?.projectId) {
        await updateDoc(doc(firestore, "projects", contractData.projectId), {
          contractCount: increment(-1),
          updatedAt: new Date().toISOString(),
        });
      }
      toast({ title: "Documento excluído." });
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir." });
    } finally {
      setDeletingId(null);
    }
  };

  if (!projectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documentos Gerados</CardTitle>
          <CardDescription>Selecione um projeto para ver o histórico.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos Gerados</CardTitle>
        <CardDescription>Histórico de documentos gerados para este projeto.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedContracts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento gerado ainda para este projeto.
          </div>
        ) : (
          <div className="space-y-3 md:hidden">
            {sortedContracts.map((contract) => (
              <Card key={contract.id} className="border border-border/70 shadow-none">
                <CardContent className="space-y-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium">{contract.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {contract.generationMethod === "google-docs" && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                    )}
                    {contract.generationMethod === "ai-enriched" && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {contract.googleDocLink && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={contract.googleDocLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Google Docs
                        </a>
                      </Button>
                    )}
                    {onPreview && (
                      <Button variant="outline" size="sm" onClick={() => onPreview(contract)}>
                        <Eye className="mr-2 h-4 w-4" /> Visualizar
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(contract)}
                      disabled={deletingId === contract.id}
                    >
                      {deletingId === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Entidades</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedContracts.map((contract) => (
                <TableRow key={contract.id}>
                  <TableCell className="font-medium">
                    {contract.name}
                    {contract.googleDocLink && (
                      <a href={contract.googleDocLink} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                        <ExternalLink className="h-2 w-2" /> Google Docs
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {contract.generationMethod === "google-docs" && (
                        <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                      )}
                      {contract.generationMethod === "ai-enriched" && (
                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {contract.entityCount !== undefined ? (
                      <span className={cn(contract.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground")}>
                        {contract.entityCount > 0 ? `${contract.entityCount} preench.` : "Sem dados"}
                      </span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {contract.googleDocLink && (
                          <DropdownMenuItem asChild>
                            <a href={contract.googleDocLink} target="_blank" rel="noreferrer">
                              <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Docs
                            </a>
                          </DropdownMenuItem>
                        )}
                        {onPreview && (
                          <DropdownMenuItem onClick={() => onPreview(contract)}>
                            <Eye className="mr-2 h-4 w-4" /> Visualizar
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(contract)}
                          disabled={deletingId === contract.id}
                        >
                          {deletingId === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/app/generate-export-history.tsx
git commit -m "feat: add generated documents history table component"
```

---

### Task 4: Create the inline Alex chat component for document generation

**Files:**
- Create: `src/components/app/generate-export-chat.tsx`
- Read: `src/components/app/playbook-chat-widget.tsx` (for reference)
- Read: `src/lib/composio-gemini.ts` (for runComposioAgent)
- Read: `src/lib/actions/composio-actions.ts` (for server actions)

**Step 1: Create the inline chat component**

This component is an inline version of Alex that receives project/template context and orchestrates the step-by-step generation flow.

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Sparkles, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthContext } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { generateContractGenerationStep } from "@/lib/actions/generate-export-actions";
import type { Contract } from "@/lib/types";

interface ChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
  action?: "proceed" | "open" | "done";
  actionLabel?: string;
  documentLink?: string;
}

interface GenerateExportChatProps {
  projectId: string | null;
  templateId: string | null;
  onGenerationComplete?: (contract: Contract) => void;
}

type GenerationStep = "idle" | "copy" | "customize" | "open" | "complete";

const STEP_PROMPTS: Record<Exclude<GenerationStep, "idle" | "complete">, string> = {
  copy: "Copie o modelo de documento selecionado para o Google Drive do usuário.",
  customize: "Personalize o documento copiado preenchendo os placeholders com base nos documentos indexados do projeto.",
  open: "Abra o documento personalizado no Google Docs para inspeção do usuário.",
};

export function GenerateExportChat({ projectId, templateId, onGenerationComplete }: GenerateExportChatProps) {
  const { user } = useAuthContext();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content: "Olá! Selecione um projeto e um modelo de documento acima. Quando estiver pronto, clique em **Iniciar Geração** para começarmos.",
      timestamp: new Date(),
    },
  ]);
  const [isPending, setIsPending] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>("idle");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentLink, setDocumentLink] = useState<string | null>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isPending]);

  const handleStartGeneration = async () => {
    if (!user || !projectId || !templateId) return;

    setCurrentStep("copy");
    setIsPending(true);

    // Add user message
    const userMessage: ChatMessage = {
      role: "user",
      content: "Iniciar geração do documento",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Step 1: Copy
      const copyResult = await generateContractGenerationStep({
        userId: user.uid,
        projectId,
        templateId,
        step: "copy",
      });

      if (!copyResult.success) {
        setMessages((prev) => [...prev, {
          role: "model",
          content: `Erro ao copiar o documento: ${copyResult.error}`,
          timestamp: new Date(),
        }]);
        setIsPending(false);
        setCurrentStep("idle");
        return;
      }

      setDocumentId(copyResult.documentId || null);
      setDocumentLink(copyResult.documentLink || null);

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento copiado para o seu Google Drive com sucesso: **${copyResult.fileName}**`,
        timestamp: new Date(),
        action: "proceed",
        actionLabel: "Personalizar documento",
      }]);
      setIsPending(false);
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "model",
        content: `Erro inesperado: ${error instanceof Error ? error.message : "Tente novamente."}`,
        timestamp: new Date(),
      }]);
      setIsPending(false);
      setCurrentStep("idle");
    }
  };

  const handleProceed = async () => {
    if (!user || !projectId || !templateId || !documentId) return;

    setIsPending(true);

    if (currentStep === "copy") {
      // Step 2: Customize
      setCurrentStep("customize");

      const customizeResult = await generateContractGenerationStep({
        userId: user.uid,
        projectId,
        templateId,
        step: "customize",
        documentId,
      });

      if (!customizeResult.success) {
        setMessages((prev) => [...prev, {
          role: "model",
          content: `Erro ao personalizar o documento: ${customizeResult.error}`,
          timestamp: new Date(),
        }]);
        setIsPending(false);
        return;
      }

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento personalizado com sucesso. **${customizeResult.fieldsFilled}** campos foram preenchidos com base nos documentos do projeto.`,
        timestamp: new Date(),
        action: "open",
        actionLabel: "Abrir para inspeção",
      }]);
      setIsPending(false);
    } else if (currentStep === "customize") {
      // Step 3: Open
      setCurrentStep("open");

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento aberto no Google Docs. Clique no link abaixo para inspecionar:`,
        timestamp: new Date(),
        action: "done",
        actionLabel: "Concluído",
        documentLink: documentLink || undefined,
      }]);

      setCurrentStep("complete");
      setIsPending(false);

      // Notify parent of completion
      if (onGenerationComplete && documentId) {
        onGenerationComplete({
          id: "",
          name: `Contrato gerado - ${new Date().toLocaleDateString("pt-BR")}`,
          googleDocId: documentId,
          googleDocLink: documentLink || "",
          projectId,
          contractModelId: templateId,
          createdAt: new Date().toISOString(),
        } as Contract);
      }
    }
  };

  const canStart = projectId && templateId && currentStep === "idle";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
      {/* Header */}
      <div className="bg-primary/95 p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-serif text-lg font-bold">
              Alex
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/75">
              {currentStep === "idle" && "Assistente de Geração"}
              {currentStep === "copy" && "Passo 1: Copiando documento..."}
              {currentStep === "customize" && "Passo 2: Personalizando..."}
              {currentStep === "open" && "Passo 3: Abrindo documento..."}
              {currentStep === "complete" && "Geração concluída"}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 bg-muted/10 p-4">
        <div className="space-y-6 pb-2">
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, x: message.role === "user" ? 20 : -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl p-4 text-sm shadow-sm",
                  message.role === "user"
                    ? "rounded-tr-none bg-primary text-primary-foreground"
                    : "rounded-tl-none border border-border/60 bg-background text-foreground"
                )}
              >
                <ReactMarkdown className="prose prose-sm max-w-none break-words leading-6 dark:prose-invert">
                  {message.content}
                </ReactMarkdown>
                <span className={cn("mt-2 block text-[10px] opacity-60", message.role === "user" ? "text-right" : "text-left")}>
                  {format(message.timestamp, "HH:mm")}
                </span>

                {/* Action buttons */}
                {message.action && message.role === "model" && index === messages.length - 1 && (
                  <div className="mt-4 border-t border-border/40 pt-3">
                    {message.documentLink && (
                      <Button variant="outline" size="sm" asChild className="mb-3 w-full">
                        <a href={message.documentLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Docs
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleProceed}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {message.action === "done" ? (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          {message.actionLabel}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start">
              <div className="rounded-2xl rounded-tl-none border border-border/60 bg-background p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Alex está trabalhando...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t bg-background/95 p-4 backdrop-blur-md">
        {canStart ? (
          <Button size="lg" className="w-full h-12 rounded-xl" onClick={handleStartGeneration}>
            <Sparkles className="mr-2 h-5 w-5" />
            Iniciar Geração
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {currentStep === "complete"
              ? "Geração concluída. Selecione outro projeto/modelo para gerar um novo documento."
              : "Aguardando seleção de projeto e modelo..."}
          </p>
        )}
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Alex pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/app/generate-export-chat.tsx
git commit -m "feat: add inline Alex chat component for step-by-step document generation"
```

---

### Task 5: Create the server action for generation steps

**Files:**
- Create: `src/lib/actions/generate-export-actions.ts`
- Read: `src/lib/actions/composio-actions.ts` (for reference — uses `inspectTemplateForGeneration`, `generateContractDoc`)
- Read: `src/lib/composio-client.ts` (for `createComposioClient`)
- Read: `src/ai/flows/ai-enrich-contract.ts` (for `aiEnrichContract` flow)

**Note:** The server actions reuse existing functions from `composio-actions.ts` (`inspectTemplateForGeneration`, `generateContractDoc`) rather than reimplementing template resolution. The step-by-step flow is orchestrated client-side, with each step calling a focused server action.

**Step 1: Create the server action**

```tsx
'use server';

import { createComposioClient } from '@/lib/composio-client';
import { inspectTemplateForGeneration, generateContractDoc } from './composio-actions';
import { db } from '@/lib/firebase-server';
import { debugLog, debugError, generateRequestId } from '@/lib/utils/request-id';
import type { TemplateSourceField } from '@/lib/template-source';

export type GenerationStepInput = {
  userId: string;
  projectId: string;
  templateId: string;
  step: 'copy' | 'customize' | 'open';
  documentId?: string;
  templateName?: string;
  googleDocLink?: string;
  projectDocLink?: string;
};

export type GenerationStepResult = {
  success: boolean;
  documentId?: string;
  documentLink?: string;
  fileName?: string;
  fieldsFilled?: number;
  error?: string;
  requestId: string;
};

export async function generateContractGenerationStep(
  input: GenerationStepInput
): Promise<GenerationStepResult> {
  const requestId = generateRequestId();
  debugLog(requestId, 'generateContractGenerationStep', 'Starting step', {
    userId: input.userId,
    step: input.step,
  });

  try {
    if (input.step === 'copy') {
      return await handleCopyStep(input, requestId);
    } else if (input.step === 'customize') {
      return await handleCustomizeStep(input, requestId);
    } else {
      return await handleOpenStep(input, requestId);
    }
  } catch (error) {
    debugError(requestId, 'generateContractGenerationStep', 'Unhandled error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      requestId,
    };
  }
}

async function handleCopyStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  // Step 1: Inspect template to get placeholders and resolved source
  const inspection = await inspectTemplateForGeneration(input.userId, {
    templateId: input.templateId,
    templateName: input.templateName,
    googleDocLink: input.googleDocLink,
    projectDocLink: input.projectDocLink,
  });

  if (!inspection.success || !inspection.fileId) {
    return {
      success: false,
      error: inspection.error || 'Falha ao inspecionar o modelo.',
      requestId,
    };
  }

  // Step 2: Generate the document (copy + placeholder replacement)
  // We pass empty confirmedPlaceholders here — customization happens in next step
  const projectDoc = await db.collection('projects').doc(input.projectId).get();
  const projectName = projectDoc.exists ? projectDoc.data()?.name : 'Cliente';

  const generation = await generateContractDoc(input.userId, {
    templateId: input.templateId,
    templateName: inspection.templateName,
    googleDocLink: input.googleDocLink,
    projectDocLink: input.projectDocLink,
    preferredSource: inspection.resolvedSource as TemplateSourceField,
    clientName: projectName,
    confirmedPlaceholders: {},
    placeholderMatches: {},
    projectId: input.projectId,
    enrichWithAI: false,
  });

  if (!generation.success || !generation.documentId) {
    return {
      success: false,
      error: generation.error || 'Falha ao copiar o documento.',
      requestId,
    };
  }

  return {
    success: true,
    documentId: generation.documentId,
    documentLink: generation.documentLink,
    fileName: generation.fileName,
    requestId,
  };
}

async function handleCustomizeStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  if (!input.documentId) {
    return { success: false, error: 'documentId is required', requestId };
  }

  const client = await createComposioClient(input.userId);

  // Get placeholders from the copied document
  const placeholders = await client.getDocumentPlaceholders(input.documentId);

  if (placeholders.length === 0) {
    return {
      success: true,
      documentId: input.documentId,
      documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
      fieldsFilled: 0,
      requestId,
    };
  }

  // Fetch project documents for context
  const projectDocsSnapshot = await db.collection('projectDocuments')
    .where('projectId', '==', input.projectId)
    .where('status', '==', 'indexed')
    .get();

  // Build entity data from project documents metadata
  const entityData: Record<string, unknown> = {};
  for (const doc of projectDocsSnapshot.docs) {
    const data = doc.data();
    entityData[data.name || doc.id] = {
      documentType: data.documentType,
      fileType: data.fileType,
      fileUrl: data.fileUrl,
    };
  }

  // Use AI enrichment to fill placeholders
  const { aiEnrichContract } = await import('@/ai/flows/ai-enrich-contract');

  const enrichmentResult = await aiEnrichContract({
    userId: input.userId,
    documentId: input.documentId,
    templateId: input.templateId,
    placeholders: placeholders.map((p) => p.key),
    entityData,
    context: `Projeto: ${input.projectId}`,
    contractType: input.templateId,
  });

  if (enrichmentResult.success) {
    return {
      success: true,
      documentId: input.documentId,
      documentLink: enrichmentResult.documentLink,
      fieldsFilled: enrichmentResult.substitutions.length,
      requestId,
    };
  }

  return {
    success: true,
    documentId: input.documentId,
    documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    fieldsFilled: 0,
    requestId,
  };
}

async function handleOpenStep(
  input: GenerationStepInput,
  requestId: string
): Promise<GenerationStepResult> {
  if (!input.documentId) {
    return { success: false, error: 'documentId is required', requestId };
  }

  return {
    success: true,
    documentId: input.documentId,
    documentLink: `https://docs.google.com/document/d/${input.documentId}/edit`,
    requestId,
  };
}
```

**Step 2: Commit**

```bash
git add src/lib/actions/generate-export-actions.ts
git commit -m "feat: add server actions for step-by-step document generation"
```

---

### Task 6: Rewrite the `/gerar-exportar` page with the new 3-zone layout

**Files:**
- Modify: `src/app/(main)/gerar-exportar/page.tsx`

**Step 1: Rewrite the page**

Replace the entire page content with the new 3-zone layout:

```tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wand2 } from "lucide-react";
import { useAuthContext } from "@/context/auth-context";
import { ComposioConnection } from "@/components/app/composio-connection";
import { GenerateExportExplanation } from "@/components/app/generate-export-explanation";
import { GenerateExportSelectors } from "@/components/app/generate-export-selectors";
import { GenerateExportChat } from "@/components/app/generate-export-chat";
import { GenerateExportHistory } from "@/components/app/generate-export-history";
import type { Contract } from "@/lib/types";

export default function GerarExportarPage() {
  const { user } = useAuthContext();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectIdFromUrl);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [composioConnectPrompt, setComposioConnectPrompt] = useState(0);
  const [refreshHistory, setRefreshHistory] = useState(0);

  const handleGenerationComplete = () => {
    setRefreshHistory((prev) => prev + 1);
  };

  return (
    <div className="page-shell relative">
      <div className="page-width space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-title">Gerar e Revisar</h1>
          <p className="text-muted-foreground mt-2">
            Gere documentos de forma conversacional com o Alex.
          </p>
        </div>

        <ComposioConnection openSignal={composioConnectPrompt} />

        {/* Zone 1: Explanation */}
        <GenerateExportExplanation />

        {/* Zone 2: Selectors */}
        <GenerateExportSelectors
          selectedProjectId={selectedProjectId}
          selectedTemplateId={selectedTemplateId}
          onProjectChange={(id) => {
            setSelectedProjectId(id);
            setSelectedTemplateId(null);
          }}
          onTemplateChange={setSelectedTemplateId}
        />

        {/* Zone 2: Alex Chat */}
        <GenerateExportChat
          projectId={selectedProjectId}
          templateId={selectedTemplateId}
          onGenerationComplete={handleGenerationComplete}
        />

        {/* Zone 3: History */}
        <GenerateExportHistory
          key={`${selectedProjectId}-${refreshHistory}`}
          projectId={selectedProjectId}
        />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(main\)/gerar-exportar/page.tsx
git commit -m "feat: rewrite gerar-exportar page with chatbot-driven 3-zone layout"
```

---

### Task 7: Hide the floating Alex widget on `/gerar-exportar`

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/app/playbook-chat-widget.tsx`

**Step 1: Add pathname check to hide widget on gerar-exportar**

Modify `src/app/layout.tsx`:

```diff
 import { PlaybookChatWidget } from '@/components/app/playbook-chat-widget';
 import { Suspense } from 'react';
+import { headers } from 'next/headers';
```

And in the layout body:

```diff
-            <Suspense>
-              <PlaybookChatWidget />
-            </Suspense>
+            <Suspense>
+              <PlaybookChatWidgetWrapper />
+            </Suspense>
```

Create a server component wrapper in `src/components/app/playbook-chat-widget-wrapper.tsx`:

```tsx
import { headers } from 'next/headers';
import { PlaybookChatWidget } from '@/components/app/playbook-chat-widget';

export function PlaybookChatWidgetWrapper() {
  const pathname = headers().get('x-pathname') || '';
  if (pathname.includes('/gerar-exportar')) {
    return null;
  }
  return <PlaybookChatWidget />;
}
```

**Step 2: Add pathname middleware**

Create `src/middleware.ts`:

```tsx
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set('x-pathname', request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Step 3: Commit**

```bash
git add src/middleware.ts src/components/app/playbook-chat-widget-wrapper.tsx src/app/layout.tsx
git commit -m "feat: hide floating Alex widget on gerar-exportar page"
```

---

### Task 8: Integration testing and final verification

**Files:**
- All modified files

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors. If errors appear, fix type mismatches.

**Step 2: Run lint**

```bash
npm run lint
```

Expected: No errors.

**Step 3: Run dev server**

```bash
npm run dev
```

Navigate to `/gerar-exportar` and verify:
1. Explanation card is visible and dismissible
2. Project selector shows projects with indexed documents
3. Template selector is disabled until a project is selected
4. Alex chat shows "Iniciar Geração" button when both selectors have values
5. Clicking "Iniciar Geração" triggers the 3-step flow
6. Each step shows status + proceed button
7. History table shows generated documents
8. Floating Alex widget is hidden on this page

**Step 4: Commit**

```bash
git add .
git commit -m "fix: resolve type errors and integration issues"
```

---

### Task 9: Update the design doc reference

**Files:**
- Modify: `docs/plans/2026-05-18-chatbot-driven-document-generation-design.md`

**Step 1: Add implementation status**

Append to the design doc:

```markdown

## Implementation Status

- [x] Explanation card component
- [x] Project + template selectors
- [x] Generated documents history table
- [x] Inline Alex chat component
- [x] Server actions for generation steps
- [x] Page rewrite
- [x] Hide floating widget on gerar-exportar
- [x] Integration testing
```

**Step 2: Final commit**

```bash
git add docs/plans/2026-05-18-chatbot-driven-document-generation-design.md
git commit -m "docs: update design doc with implementation status"
```
