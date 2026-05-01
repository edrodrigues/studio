"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, deleteDoc, doc, getDoc, increment, orderBy, query, updateDoc, where } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Eye, FileText, GitCompareArrows, LayoutTemplate, Loader2, MoreHorizontal, Sparkles, Trash2, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { prepareContractData } from "@/lib/actions";
import { inspectTemplateForGeneration, generateContractDoc, reviewContractWithAI, applyReviewEdits, revertReviewEdits } from "@/lib/actions/composio-actions";
import { checkComposioConnectionStatus } from "@/lib/actions/composio-connection-actions";
import { ComposioConnection } from "@/components/app/composio-connection";
import { exportToDocx } from "@/lib/export";
import {
  type TemplateSourceDiagnostic,
  type TemplateSourceField,
} from "@/lib/template-source";
import { Contract, DocumentStatus, ProjectDocument, Template } from "@/lib/types";
import { summarizeTemplateValidation } from "@/lib/template-link-validation";
import { cn, extractDocumentId, isValidDate, safeNewDate } from "@/lib/utils";

const ContractPreviewModal = dynamic(() => import("@/components/app/contract-preview-modal").then((mod) => mod.ContractPreviewModal), { ssr: false });
const ComparisonModal = dynamic(() => import("@/components/app/comparison-modal").then((mod) => mod.ComparisonModal), { ssr: false });
const EntityEditModal = dynamic(() => import("@/components/app/entity-edit-modal").then((mod) => mod.EntityEditModal), { ssr: false });

type ProjectDocumentRecord = ProjectDocument & { id: string };
type ContractRecord = Contract & { id: string };
type PlaceholderDef = { key: string; matches: string[] };
type TemplateSourceDiagnostics = Record<TemplateSourceField, TemplateSourceDiagnostic>;
type TemplatePreparation = {
  templateId: string;
  templateName: string;
  googleDocLink?: string;
  projectDocLink?: string;
  resolvedFileId: string;
  resolvedSource: TemplateSourceField;
  fallbackUsed: boolean;
  sourceDiagnostics: TemplateSourceDiagnostics;
  warnings: string[];
  placeholderDefinitions: PlaceholderDef[];
  placeholderMatches: Record<string, string[]>;
};

const mergePlaceholderDefinitions = (preparations: TemplatePreparation[]) =>
  Array.from(
    preparations.reduce((acc, preparation) => {
      preparation.placeholderDefinitions.forEach((definition) => {
        if (!acc.has(definition.key)) acc.set(definition.key, new Set<string>());
        definition.matches.forEach((match) => acc.get(definition.key)!.add(match));
      });
      return acc;
    }, new Map<string, Set<string>>()).entries()
  )
    .map(([key, matches]) => ({ key, matches: Array.from(matches).sort() }))
    .sort((a, b) => a.key.localeCompare(b.key));

const createPlaceholderMatchRecord = (definitions: PlaceholderDef[]) =>
  definitions.reduce((acc, definition) => {
    acc[definition.key] = definition.matches;
    return acc;
  }, {} as Record<string, string[]>);

const getTemplateHealthBadge = (template: Template, fallbackInUse = false) => {
  const summary = summarizeTemplateValidation(template);

  if (fallbackInUse) {
    return {
      label: "Fallback em uso",
      className: "bg-amber-50 text-amber-800 border-amber-200",
      description: "O link original falhou e a geração usará a versão customizada do projeto.",
      isSelectable: true,
    };
  }

  switch (summary.health) {
    case "ready_with_fallback":
      return {
        label: summary.label,
        className: "bg-blue-50 text-blue-700 border-blue-200",
        description: summary.description,
        isSelectable: true,
      };
    case "ready_original":
      return {
        label: summary.label,
        className: "bg-green-50 text-green-700 border-green-200",
        description: summary.description,
        isSelectable: true,
      };
    case "ready_custom":
      return {
        label: summary.label,
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        description: summary.description,
        isSelectable: true,
      };
    case "ready_fallback_only":
      return {
        label: summary.label,
        className: "bg-amber-50 text-amber-800 border-amber-200",
        description: summary.description,
        isSelectable: true,
      };
    case "pending_validation":
      return {
        label: summary.label,
        className: "bg-slate-50 text-slate-700 border-slate-200",
        description: summary.description,
        isSelectable: false,
      };
    default:
      return {
        label: summary.label,
        className: "bg-rose-50 text-rose-700 border-rose-200",
        description: summary.description,
        isSelectable: false,
      };
  }
};

const renderErrors = (errors: string[]) => (
  <div className="space-y-1">
    {errors.map((error) => <p key={error} className="text-xs leading-relaxed">{error}</p>)}
  </div>
);

const formatInspectionFailure = (
  template: Pick<Template, "name">,
  inspection: {
    error?: string;
    technicalDetails?: string;
    userInstructions?: string[];
    failedSource?: TemplateSourceField;
    sourceDiagnostics?: TemplateSourceDiagnostics;
  }
) => {
  const failedDiagnostic = inspection.failedSource
    ? inspection.sourceDiagnostics?.[inspection.failedSource]
    : undefined;
  const details = [
    inspection.error,
    failedDiagnostic?.fileName && failedDiagnostic?.mimeType
      ? `Arquivo detectado: ${failedDiagnostic.fileName} (${failedDiagnostic.mimeType}).`
      : null,
    inspection.userInstructions?.[0] || null,
  ].filter(Boolean);

  return `${template.name}: ${details.join(" ")}`;
};

function getLatestDocuments(documents: ProjectDocumentRecord[] | null | undefined) {
  const byType = new Map<string, ProjectDocumentRecord>();
  for (const item of documents || []) {
    const type = item.documentType || item.name || item.id;
    const current = byType.get(type);
    if (!current) {
      byType.set(type, item);
      continue;
    }
    const currentTime = new Date(current.uploadedAt || 0).getTime();
    const nextTime = new Date(item.uploadedAt || 0).getTime();
    if (nextTime > currentTime || (nextTime === currentTime && (item.version || 0) > (current.version || 0))) {
      byType.set(type, item);
    }
  }
  return Array.from(byType.values()).sort((a, b) => {
    const timeDiff = new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
    return timeDiff !== 0 ? timeDiff : (b.version || 0) - (a.version || 0);
  });
}

function GerarExportarContent() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { signInWithGoogle } = useAuthContext();
  const { clientName } = useUserPreferences();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const projectIdFromUrl = searchParams.get("projectId");
  const contractTypeFilter = searchParams.get("contractType");
  const processTypeFilter = searchParams.get("processType");
  const currentProjectId = projectIdFromUrl || "default-project";

  const [isGenerating, startGeneration] = useTransition();
  const [activeTab, setActiveTab] = useState("gerar");
  const [projectName, setProjectName] = useState("Projeto");
  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isPreparingGeneration, setIsPreparingGeneration] = useState(false);
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [templatePreparations, setTemplatePreparations] = useState<TemplatePreparation[]>([]);
  const [reviewPlaceholderDefinitions, setReviewPlaceholderDefinitions] = useState<PlaceholderDef[]>([]);
  const [preparedEntities, setPreparedEntities] = useState<Record<string, string>>({});
  const [entityDescriptions, setEntityDescriptions] = useState<Record<string, string>>({});
  const [discardedEntities, setDiscardedEntities] = useState<Record<string, string>>({});
  const [enrichWithAI, setEnrichWithAI] = useState(false);
  const [isAIReviewOpen, setIsAIReviewOpen] = useState(false);
  const [aiReviewingContract, setAiReviewingContract] = useState<ContractRecord | null>(null);
  const [isAIReviewing, setIsAIReviewing] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<{
    success: boolean;
    summary: string;
    overallQuality: "good" | "needs_work" | "requires_revision";
    suggestions: Array<{
      section: string;
      originalText: string;
      suggestedText: string;
      reason: string;
      severity?: string;
      confidence?: string;
    }>;
    reviewedAt: string;
    error?: string;
  } | null>(null);
  const [selectedEditIndexes, setSelectedEditIndexes] = useState<Set<number>>(new Set());
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);
  const [appliedReviewEdits, setAppliedReviewEdits] = useState<Array<{
    section: string;
    originalText: string;
    suggestedText: string;
    reason?: string;
    severity?: string;
    confidence?: string;
  }> | null>(null);
  const [contractWithAppliedReview, setContractWithAppliedReview] = useState<ContractRecord | null>(null);
  const [isUndoConfirmOpen, setIsUndoConfirmOpen] = useState(false);
  const [isRevertingEdits, setIsRevertingEdits] = useState(false);
  const [composioConnectPrompt, setComposioConnectPrompt] = useState(0);

  useEffect(() => {
    if (!projectIdFromUrl || !firestore) return;
    getDoc(doc(firestore, "projects", projectIdFromUrl)).then((docSnap) => {
      if (docSnap.exists()) setProjectName(docSnap.data().name);
    });
  }, [firestore, projectIdFromUrl]);

  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return projectIdFromUrl
      ? query(collection(firestore, "projectDocuments"), where("projectId", "==", projectIdFromUrl), orderBy("uploadedAt", "desc"))
      : query(collection(firestore, "projectDocuments"), orderBy("uploadedAt", "desc"));
  }, [firestore, projectIdFromUrl, user]);

  const templatesQuery = useMemoFirebase(() => (!user || !firestore ? null : collection(firestore, "contractModels")), [firestore, user]);
  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return projectIdFromUrl
      ? query(collection(firestore, "users", user.uid, "filledContracts"), where("projectId", "==", projectIdFromUrl))
      : collection(firestore, "users", user.uid, "filledContracts");
  }, [firestore, projectIdFromUrl, user]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<ProjectDocument>(projectDocsQuery);
  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);
  const { data: contracts } = useCollection<Contract>(filledContractsQuery);

  const latestDocuments = useMemo(() => getLatestDocuments(documents as ProjectDocumentRecord[] | null | undefined), [documents]);
  const latestDocumentsByType = useMemo(() => latestDocuments.reduce((acc, item) => {
    acc[item.documentType || item.name || item.id] = item;
    return acc;
  }, {} as Record<string, ProjectDocumentRecord>), [latestDocuments]);
  const selectedDocs = useMemo(() => selectedDocTypes.map((type) => latestDocumentsByType[type]?.id).filter((id): id is string => Boolean(id)), [latestDocumentsByType, selectedDocTypes]);
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!contractTypeFilter) return templates;
    return templates.filter((template) => {
      const exactType = template.contractTypes?.some((type) => type.toLowerCase() === contractTypeFilter.toLowerCase());
      return exactType || Boolean(processTypeFilter && template.contractTypes?.includes(processTypeFilter));
    });
  }, [contractTypeFilter, processTypeFilter, templates]);
  const templateStatuses = useMemo(
    () =>
      filteredTemplates.reduce((acc, template) => {
        acc[template.id] = getTemplateHealthBadge(template);
        return acc;
      }, {} as Record<string, ReturnType<typeof getTemplateHealthBadge>>),
    [filteredTemplates]
  );
  const preparedTemplateMap = useMemo(
    () =>
      templatePreparations.reduce((acc, preparation) => {
        acc[preparation.templateId] = preparation;
        return acc;
      }, {} as Record<string, TemplatePreparation>),
    [templatePreparations]
  );
  const sortedContracts = useMemo(() => [...((contracts || []) as ContractRecord[])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [contracts]);

  useEffect(() => {
    setSelectedDocTypes((prev) => prev.filter((type) => Boolean(latestDocumentsByType[type])));
  }, [latestDocumentsByType]);

  useEffect(() => {
    setSelectedTemplates((prev) =>
      prev.filter((templateId) => templateStatuses[templateId]?.isSelectable)
    );
  }, [templateStatuses]);

  const toggleDocType = (type: string) => {
    setSelectedDocTypes((prev) => prev.includes(type) ? prev.filter((value) => value !== type) : [...prev, type]);
  };

  const toggleTemplate = (template: Template) => {
    const templateStatus = templateStatuses[template.id] || getTemplateHealthBadge(template);

    if (!templateStatus.isSelectable) {
      toast({
        variant: "destructive",
        title: "Modelo indisponível para geração",
        description: `${template.name}: ${templateStatus.description}`,
      });
      return;
    }

    setSelectedTemplates((prev) =>
      prev.includes(template.id) ? prev.filter((value) => value !== template.id) : [...prev, template.id]
    );
  };

  const handlePrepareGeneration = async () => {
    if (!templates || selectedTemplates.length === 0) {
      toast({ variant: "destructive", title: "Selecione ao menos um modelo." });
      return;
    }
    if (selectedDocs.length === 0) {
      toast({ variant: "destructive", title: "Documentos não selecionados", description: "Selecione ao menos uma última versão de documento inicial." });
      return;
    }
    if (!user) {
      toast({
        title: "Login Necessário",
        description: "Autentique-se para validar o template e gerar contratos via Google Docs.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Conectar</Button>,
      });
      return;
    }

    const connectionStatus = await checkComposioConnectionStatus(user.uid);
    if (!connectionStatus.connected) {
      setComposioConnectPrompt((value) => value + 1);
      toast({
        title: "Conecte o Google Docs",
        description: "Autorize o acesso via Composio para gerar contratos automaticamente nos links do Google Docs.",
      });
      return;
    }

    setIsPreparingGeneration(true);
    try {
      const prepared = await prepareContractData({ projectId: currentProjectId, documentIds: selectedDocs });
      setPreparedEntities(prepared.success ? (prepared.entities || {}) : {});
      setEntityDescriptions(prepared.success ? (prepared.entityDescriptions || {}) : {});
      setDiscardedEntities(prepared.success ? (prepared.discardedEntities || {}) : {});

      const selectedTemplateRecords = selectedTemplates
        .map((templateId) => templates.find((template) => template.id === templateId))
        .filter((template): template is Template & { id: string } => Boolean(template));

      const errors: string[] = [];
      const warnings: string[] = [];
      const ready: TemplatePreparation[] = [];

      for (const template of selectedTemplateRecords) {
        console.info("[GerarExportar] Validando template", {
          templateId: template.id,
          templateName: template.name,
          googleDocLink: template.googleDocLink,
          projectDocLink: template.projectDocLink,
        });
        const inspection = await inspectTemplateForGeneration(user.uid, {
          templateId: template.id,
          templateName: template.name,
          googleDocLink: template.googleDocLink,
          projectDocLink: template.projectDocLink,
          fallbackMarkdownContent: template.markdownContent,
        });
        if (!inspection.success || !inspection.placeholders || inspection.placeholders.length === 0) {
          const inspectionError = "error" in inspection
            ? formatInspectionFailure(template, inspection)
            : `${template.name}: não foi possível preparar o template.`;
          errors.push(inspectionError);
          console.warn("[GerarExportar] Falha no preflight", {
            templateId: template.id,
            templateName: template.name,
            inspectionError,
            sourceDiagnostics: "sourceDiagnostics" in inspection ? inspection.sourceDiagnostics : undefined,
          });
          continue;
        }
        warnings.push(...(inspection.warnings || []).map((warning) => `${template.name}: ${warning}`));
        ready.push({
          templateId: template.id,
          templateName: template.name,
          googleDocLink: template.googleDocLink,
          projectDocLink: template.projectDocLink,
          resolvedFileId: inspection.fileId,
          resolvedSource: inspection.resolvedSource,
          fallbackUsed: inspection.fallbackUsed,
          sourceDiagnostics: inspection.sourceDiagnostics,
          warnings: inspection.warnings || [],
          placeholderDefinitions: inspection.placeholders,
          placeholderMatches: createPlaceholderMatchRecord(inspection.placeholders),
        });
      }

      if (ready.length === 0) {
        toast({ variant: "destructive", title: "Falha ao preparar templates", description: renderErrors(errors) });
        return;
      }
      if (errors.length > 0) {
        toast({ variant: "destructive", title: "Alguns templates não puderam ser preparados", description: renderErrors(errors) });
      }
      if (warnings.length > 0) {
        toast({ title: "Templates preparados com fallback", description: renderErrors(warnings) });
      } else if (prepared.discardedEntities && Object.keys(prepared.discardedEntities).length > 0) {
        toast({ title: "Entidades inválidas descartadas", description: `${Object.keys(prepared.discardedEntities).length} valor(es) placeholder foram removidos antes da revisão.` });
      }

      setTemplatePreparations(ready);
      setReviewPlaceholderDefinitions(mergePlaceholderDefinitions(ready));
      setIsEntityModalOpen(true);
    } catch (error) {
      console.error("[GerarExportar] Erro ao preparar geração:", error);
      toast({ variant: "destructive", title: "Erro ao preparar geração", description: error instanceof Error ? error.message : "Falha ao preparar os dados da geração." });
    } finally {
      setIsPreparingGeneration(false);
    }
  };

  const handleConfirmGeneration = (confirmedPlaceholders: Record<string, string>) => {
    if (!user || !firestore || templatePreparations.length === 0) return;
    setIsEntityModalOpen(false);
    startGeneration(async () => {
      let successCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      for (const templatePreparation of templatePreparations) {
        try {
          const result = await generateContractDoc(user.uid, {
            templateId: templatePreparation.templateId,
            templateName: templatePreparation.templateName,
            googleDocLink: templatePreparation.googleDocLink,
            projectDocLink: templatePreparation.projectDocLink,
            preferredSource: templatePreparation.resolvedSource,
            clientName: clientName || projectName || "Cliente",
            confirmedPlaceholders,
            placeholderMatches: templatePreparation.placeholderMatches,
            projectId: currentProjectId,
            enrichWithAI,
            entityData: preparedEntities,
          });
          if (!result.success || !result.documentId) {
            errors.push(`${templatePreparation.templateName}: ${"error" in result ? result.error : "falha desconhecida ao gerar documento."}`);
            continue;
          }
          warnings.push(...(result.warnings || []).map((warning) => `${templatePreparation.templateName}: ${warning}`));
          const generatedAt = new Date().toISOString();
          const filledPayload = JSON.stringify({ placeholders: confirmedPlaceholders, sourceDocuments: selectedDocs, discardedEntities, extractionDate: generatedAt });
          const projectContractRef = await addDoc(collection(firestore, "projectContracts"), {
            projectId: currentProjectId, templateId: templatePreparation.templateId, name: result.fileName, markdownContent: "",
            filledData: filledPayload, generatedBy: user.uid, generatedAt, googleDocId: result.documentId, googleDocLink: result.documentLink, version: 1,
            templateSource: result.resolvedSource, fallbackUsed: result.fallbackUsed,
          });
          await addDoc(collection(firestore, "users", user.uid, "filledContracts"), {
            projectContractId: projectContractRef.id, projectId: currentProjectId, contractModelId: templatePreparation.templateId,
            clientName: clientName || projectName || "Cliente", filledData: filledPayload, name: result.fileName, markdownContent: "",
            googleDocLink: result.documentLink, googleDocId: result.documentId, createdAt: generatedAt, sourceDocumentIds: selectedDocs,
            entityCount: Object.keys(confirmedPlaceholders).length, generationMethod: result.aiEnriched ? "ai-enriched" : "google-docs", templateName: templatePreparation.templateName, extractionDate: generatedAt,
            templateSource: result.resolvedSource, fallbackUsed: result.fallbackUsed,
          });
          if (currentProjectId && currentProjectId !== "default-project") {
            await updateDoc(doc(firestore, "projects", currentProjectId), { contractCount: increment(1), updatedAt: generatedAt });
          }
          successCount++;
        } catch (error) {
          console.error(error);
          errors.push(`${templatePreparation.templateName}: ${error instanceof Error ? error.message : "falha na comunicação com o servidor."}`);
        }
      }
      if (successCount > 0) {
        toast({ title: "Geração concluída!", description: `${successCount} documento(s) gerado(s) com sucesso.${errors.length > 0 ? ` ${errors.length} falha(s).` : ""}` });
        if (warnings.length > 0) {
          toast({ title: "Geração com fallback", description: renderErrors(warnings) });
        }
        setActiveTab("revisar");
      } else {
        toast({ variant: "destructive", title: "Falha na geração", description: renderErrors(errors.length ? errors : ["Nenhum template selecionado ou encontrado."]) });
      }
    });
  };

  const handleDeleteContract = async (id: string) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;
    try {
      const contractRef = doc(firestore, "users", user.uid, "filledContracts", id);
      const contractDoc = await getDoc(contractRef);
      const contractData = contractDoc.exists() ? contractDoc.data() as Contract : null;
      await deleteDoc(contractRef);
      if (contractData?.projectContractId) await deleteDoc(doc(firestore, "projectContracts", contractData.projectContractId));
      if (contractData?.projectId && contractData.projectId !== "default-project") {
        await updateDoc(doc(firestore, "projects", contractData.projectId), { contractCount: increment(-1), updatedAt: new Date().toISOString() });
      }
      toast({ title: "Documento excluído." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao excluir." });
    }
  };

  const handleExportSelected = () => {
    sortedContracts.filter((contract) => selectedContracts.includes(contract.id)).forEach((contract) => {
      if (contract.markdownContent) exportToDocx(contract.markdownContent, contract.name.replace(/\s/g, "_"));
    });
    toast({ title: "Exportação iniciada!" });
  };

  return (
    <div className="page-shell relative">
      <AnimatePresence>
        {isGenerating && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="text-center space-y-6 max-w-md p-8 rounded-3xl bg-card shadow-2xl border border-border/50">
              <div className="relative mx-auto w-24 h-24">
                <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360], borderRadius: ["20%", "50%", "20%"] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="w-full h-full bg-primary/20 flex items-center justify-center">
                  <Wand2 className="w-12 h-12 text-primary" />
                </motion.div>
                <motion.div animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.2, 0.5] }} transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }} className="absolute inset-0 bg-primary/30 rounded-full -z-10 blur-xl" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-primary">Gerando Documentos</h2>
                <p className="text-muted-foreground">O fluxo valida o template no Google Docs, cria a cópia e aplica os placeholders confirmados.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="page-width space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title">Gerar e Revisar</h1>
            <p className="text-muted-foreground mt-2">{projectIdFromUrl ? `Projeto: ${projectName}` : "Central de inteligência para seus contratos."}</p>
          </div>
          <TabsList className="grid w-full grid-cols-2 lg:w-[26rem]">
            <TabsTrigger value="gerar" className="flex gap-2"><Wand2 className="h-4 w-4" /> Gerar Novos</TabsTrigger>
            <TabsTrigger value="revisar" className="flex gap-2"><CheckCircle2 className="h-4 w-4" /> Documentos Gerados</TabsTrigger>
          </TabsList>
        </div>

        <ComposioConnection openSignal={composioConnectPrompt} />

        <TabsContent value="gerar" className="space-y-10">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
            <Card className="flex flex-col border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl"><FileText className="text-blue-500" /> 1. Documentos Iniciais</CardTitle>
                <CardDescription>Somente as últimas versões indexadas no contexto do projeto.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[320px] pr-4 sm:h-[350px]">
                  {isLoadingDocs ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
                    <div className="space-y-3">
                      {latestDocuments.map((item) => {
                        const type = item.documentType || item.name || item.id;
                        const isSelected = selectedDocTypes.includes(type);
                        return (
                          <div key={item.id} onClick={() => toggleDocType(type)} className={cn("rounded-xl border p-4 cursor-pointer transition-colors hover:bg-muted/40", isSelected && "border-blue-500 bg-blue-50/50")}>
                            <div className="flex items-start gap-3">
                              <Checkbox checked={isSelected} />
                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">{item.name}</div>
                                    <div className="truncate text-xs text-muted-foreground">{item.originalFileName}</div>
                                  </div>
                                  <Badge variant="outline" className="shrink-0 text-[10px]">v{item.version || 1}</Badge>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-slate-50 text-slate-600 border-slate-200">Última versão</Badge>
                                  {item.entityExtractionStatus === "processing" && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200"><Loader2 className="h-2 w-2 animate-spin mr-1" />Extraindo...</Badge>}
                                  {item.entityExtractionStatus === "completed" && (item.entityCount || 0) > 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="h-2 w-2 mr-1" />{item.entityCount} entidades</Badge>}
                                  {item.entityExtractionStatus === "completed" && (item.entityCount || 0) === 0 && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gray-50 text-gray-500 border-gray-200">Sem entidades</Badge>}
                                  {item.entityExtractionStatus === "failed" && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-50 text-red-700 border-red-200"><AlertTriangle className="h-2 w-2 mr-1" />Falha na extração</Badge>}
                                  {!item.entityExtractionStatus && item.status === DocumentStatus.INDEXED && <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gray-50 text-gray-500 border-gray-200">Indexado</Badge>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {latestDocuments.length === 0 && <div className="text-center py-10 text-muted-foreground text-sm">Nenhum documento sincronizado encontrado para este projeto.</div>}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl"><LayoutTemplate className="text-purple-500" /> 2. Modelos de Contrato</CardTitle>
                <CardDescription>{contractTypeFilter ? `Filtrados por: ${contractTypeFilter.toUpperCase()}` : "Selecione os modelos prontos para geração."}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[360px] pr-4 sm:h-[450px]">
                  {isLoadingTemplates ? <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="animate-spin h-8 w-8 text-purple-500" /><p className="text-sm text-muted-foreground">Carregando modelos...</p></div> : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredTemplates.map((template) => {
                        const validationSummary = summarizeTemplateValidation(template);
                        const templateStatus = getTemplateHealthBadge(template, preparedTemplateMap[template.id]?.fallbackUsed);
                        const isSelected = selectedTemplates.includes(template.id);
                        const previewLink =
                          validationSummary.original.status === "valid_google_doc"
                            ? template.googleDocLink
                            : validationSummary.custom.status === "valid_google_doc"
                              ? template.projectDocLink
                              : template.googleDocLink || template.projectDocLink;
                        return (
                        <Card key={template.id} className={cn("relative overflow-hidden border transition-all duration-200 hover:shadow-md", isSelected ? "border-purple-500 bg-purple-50/20 ring-1 ring-purple-500/20" : "border-border/60 hover:border-purple-300", !templateStatus.isSelectable && "border-rose-200 bg-rose-50/40 hover:border-rose-200")}>
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Checkbox id={`template-${template.id}`} checked={isSelected} disabled={!templateStatus.isSelectable} onCheckedChange={() => toggleTemplate(template)} className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600" />
                                <div className="min-w-0 space-y-2">
                                  <Label htmlFor={`template-${template.id}`} className="block font-bold text-sm leading-none cursor-pointer hover:text-purple-700 transition-colors truncate">{template.name}</Label>
                                  <Badge variant="outline" className={cn("text-[10px]", templateStatus.className)}>{templateStatus.label}</Badge>
                                  <p className="text-xs text-muted-foreground">{templateStatus.description}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" asChild={Boolean(previewLink)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" disabled={!previewLink}>
                                {previewLink ? <a href={previewLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir modelo no Google Docs" title="Abrir modelo no Google Docs"><ExternalLink className="h-4 w-4" /></a> : <span aria-hidden="true"><ExternalLink className="h-4 w-4" /></span>}
                              </Button>
                            </div>
                          </div>
                          {isSelected && <motion.div layoutId={`selected-indicator-${template.id}`} className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />}
                        </Card>
                      )})}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          <div className="sticky bottom-4 z-10 flex flex-col items-center gap-4 rounded-3xl bg-background/90 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-3 w-full max-w-md px-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Wand2 className="h-3.5 w-3.5 text-primary" />
                  Enriquecer com IA
                </p>
                <p className="text-[10px] text-muted-foreground">Usa Gemini para inferir valores de placeholders a partir dos documentos carregados</p>
              </div>
              <Switch checked={enrichWithAI} onCheckedChange={setEnrichWithAI} />
            </div>
            <Button size="lg" className="h-14 w-full max-w-md rounded-2xl px-8 text-base font-semibold sm:h-16 sm:text-lg" onClick={handlePrepareGeneration} disabled={selectedTemplates.length === 0 || selectedDocs.length === 0 || isGenerating || isPreparingGeneration}>
              {isPreparingGeneration ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}Gerar Documentos
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-xl">A geração tenta primeiro o link original do modelo e, quando ele não está acessível por falta de permissão ou arquivo inexistente, usa a versão customizada do projeto como fallback operacional.</p>
          </div>
        </TabsContent>

        <TabsContent value="revisar" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Histórico de Documentos</CardTitle>
                <CardDescription>Gerencie, visualize e exporte os documentos gerados.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" onClick={() => setIsComparisonOpen(true)} disabled={selectedContracts.length < 2}><GitCompareArrows className="mr-2 h-4 w-4" /> Comparar ({selectedContracts.length})</Button>
                <Button size="sm" onClick={handleExportSelected} disabled={selectedContracts.length === 0}><Download className="mr-2 h-4 w-4" /> Exportar ({selectedContracts.length})</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:hidden">
                {sortedContracts.map((contract) => (
                  <Card key={contract.id} className="border border-border/70 shadow-none">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="truncate font-medium">{contract.name}</p>
                          <p className="text-xs text-muted-foreground">{isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}</p>
                        </div>
                        <Checkbox checked={selectedContracts.includes(contract.id)} onCheckedChange={() => setSelectedContracts((prev) => prev.includes(contract.id) ? prev.filter((value) => value !== contract.id) : [...prev, contract.id])} />
                      </div>
<div className="flex flex-wrap gap-2 text-xs">
                        {contract.generationMethod === "google-docs" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>}
                        {contract.generationMethod === "ai-enriched" && <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>}
                        {contract.templateSource === "projectDocLink" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Fallback</Badge>}
                        <Badge variant="outline">{contract.entityCount !== undefined ? `${contract.entityCount} entidade(s)` : "Sem dados"}</Badge>
                        <Badge variant="outline">{contract.sourceDocumentIds?.length || 0} documento(s)</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contract.googleDocLink ? <Button variant="outline" size="sm" asChild><a href={contract.googleDocLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Google Docs</a></Button> : null}
                        <Button variant="outline" size="sm" onClick={() => { setSelectedContract(contract); setIsPreviewOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Visualizar</Button>
                        <Button variant="outline" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={async () => {
                          const docId = extractDocumentId(contract.googleDocLink ?? '');
                          if (!user?.uid || !docId) return;
                          setIsAIReviewing(true);
                          setAiReviewingContract(contract);
                          setAiReviewResult(null);
                          setSelectedEditIndexes(new Set());
                          setIsAIReviewOpen(true);
                          try {
                            const result = await reviewContractWithAI(user.uid, {
                              documentId: docId,
                              documentName: contract.name,
                              reviewFocus: "all",
                            });
                            setAiReviewResult(result);
                            // Pre-select all suggestions
                            if (result.success && result.suggestions.length > 0) {
                              setSelectedEditIndexes(new Set(result.suggestions.map((_, i) => i)));
                            }
                          } catch (e) {
                            setAiReviewResult({ success: false, summary: "", overallQuality: "requires_revision", suggestions: [], reviewedAt: new Date().toISOString(), error: String(e) });
                          } finally {
                            setIsAIReviewing(false);
                          }
                        }} disabled={!extractDocumentId(contract.googleDocLink ?? '') || isAIReviewing || isApplyingEdits}>
                          {isAIReviewing && aiReviewingContract?.id === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                          Revisar com IA
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteContract(contract.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>
                        {contractWithAppliedReview?.id === contract.id && appliedReviewEdits && appliedReviewEdits.length > 0 && (
                          <Button variant="outline" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => setIsUndoConfirmOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Desfazer Revisão
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {sortedContracts.length === 0 && <div className="py-10 text-center text-sm text-muted-foreground">Nenhum documento gerado ainda para este projeto.</div>}
              </div>
              <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"><Checkbox /></TableHead>
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
                      <TableCell><Checkbox checked={selectedContracts.includes(contract.id)} onCheckedChange={() => setSelectedContracts((prev) => prev.includes(contract.id) ? prev.filter((value) => value !== contract.id) : [...prev, contract.id])} /></TableCell>
                      <TableCell className="font-medium">
                        {contract.name}
                        {contract.googleDocLink && <a href={contract.googleDocLink} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1"><ExternalLink className="h-2 w-2" /> Google Docs</a>}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                        {contract.generationMethod === "google-docs" && <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>}
                        {contract.generationMethod === "ai-enriched" && <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>}
                        {contract.templateSource === "projectDocLink" && <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-700 border-amber-200">Fallback</Badge>}
                        </div>
                        {contract.sourceDocumentIds && <span className="block text-[9px] text-muted-foreground mt-1">{contract.sourceDocumentIds.length} doc(s)</span>}
                      </TableCell>
                      <TableCell className="text-xs">{contract.entityCount !== undefined ? <span className={contract.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>{contract.entityCount > 0 ? `${contract.entityCount} preench.` : "Sem dados"}</span> : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { setSelectedContract(contract); setIsPreviewOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => {
                              const docId = extractDocumentId(contract.googleDocLink ?? '');
                              if (!user?.uid || !docId) return;
                              setIsAIReviewing(true);
                              setAiReviewingContract(contract);
                              setAiReviewResult(null);
                              setSelectedEditIndexes(new Set());
                              setIsAIReviewOpen(true);
                              try {
                                const result = await reviewContractWithAI(user.uid, {
                                  documentId: docId,
                                  documentName: contract.name,
                                  reviewFocus: "all",
                                });
                                setAiReviewResult(result);
                                if (result.success && result.suggestions.length > 0) {
                                  setSelectedEditIndexes(new Set(result.suggestions.map((_, i) => i)));
                                }
                              } catch (e) {
                                setAiReviewResult({ success: false, summary: "", overallQuality: "requires_revision", suggestions: [], reviewedAt: new Date().toISOString(), error: String(e) });
                              } finally {
                                setIsAIReviewing(false);
                              }
                            }} disabled={!extractDocumentId(contract.googleDocLink ?? '') || isAIReviewing || isApplyingEdits} className={extractDocumentId(contract.googleDocLink ?? '') ? "text-purple-600" : ""}>
                              {isAIReviewing && aiReviewingContract?.id === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                              Revisar com IA
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteContract(contract.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Deletar</DropdownMenuItem>
                            {contractWithAppliedReview?.id === contract.id && appliedReviewEdits && appliedReviewEdits.length > 0 && (
                              <DropdownMenuItem onClick={() => setIsUndoConfirmOpen(true)} className="text-orange-600"><Sparkles className="mr-2 h-4 w-4" /> Desfazer Revisão</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedContracts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum documento gerado ainda para este projeto.</TableCell></TableRow>}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedContract && <ContractPreviewModal contract={selectedContract} isOpen={isPreviewOpen} initialEditMode={false} onClose={() => setIsPreviewOpen(false)} onSave={() => {}} />}
      <ComparisonModal isOpen={isComparisonOpen} onOpenChange={setIsComparisonOpen} contracts={sortedContracts.filter((contract) => selectedContracts.includes(contract.id))} />
      <EntityEditModal isOpen={isEntityModalOpen} onClose={() => setIsEntityModalOpen(false)} onConfirm={handleConfirmGeneration} placeholderDefinitions={reviewPlaceholderDefinitions} extractedEntities={preparedEntities} entityDescriptions={entityDescriptions} />

      {/* AI Review Dialog */}
      <Dialog open={isAIReviewOpen} onOpenChange={(open) => {
        setIsAIReviewOpen(open);
        if (!open) {
          setAiReviewResult(null);
          setSelectedEditIndexes(new Set());
          setAiReviewingContract(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Revisão com IA
            </DialogTitle>
            <DialogDescription>
              {aiReviewingContract?.name}
              {aiReviewResult?.success && aiReviewResult.summary && (
                <span className="block mt-1 text-sm font-medium text-foreground">{aiReviewResult.summary}</span>
              )}
            </DialogDescription>
          </DialogHeader>

          {isAIReviewing && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <span className="ml-3 text-muted-foreground">Revisando documento com IA...</span>
            </div>
          )}

          {aiReviewResult && !aiReviewResult.success && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
              {aiReviewResult.error || "Erro ao revisar documento."}
            </div>
          )}

          {aiReviewResult?.success && aiReviewResult.suggestions.length === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700">
              O documento está em boa qualidade! Nenhuma sugestão de melhoria encontrada.
            </div>
          )}

          {aiReviewResult?.success && aiReviewResult.suggestions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{aiReviewResult.suggestions.length} sugestão(ões) encontrada(s)</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selectedEditIndexes.size === aiReviewResult.suggestions.length) {
                      setSelectedEditIndexes(new Set());
                    } else {
                      setSelectedEditIndexes(new Set(aiReviewResult.suggestions.map((_, i) => i)));
                    }
                  }}
                >
                  {selectedEditIndexes.size === aiReviewResult.suggestions.length ? "Desmarcar Todas" : "Selecionar Todas"}
                </Button>
              </div>

              <div className="space-y-3">
                {aiReviewResult.suggestions.map((suggestion, idx) => (
                  <div key={idx} className={cn(
                    "border rounded-lg p-3 transition-colors",
                    selectedEditIndexes.has(idx)
                      ? "border-purple-300 bg-purple-50/50"
                      : "border-border"
                  )}>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={selectedEditIndexes.has(idx)}
                        onCheckedChange={() => {
                          const newSet = new Set(selectedEditIndexes);
                          if (newSet.has(idx)) {
                            newSet.delete(idx);
                          } else {
                            newSet.add(idx);
                          }
                          setSelectedEditIndexes(newSet);
                        }}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">{suggestion.section}</span>
                          {suggestion.severity && (
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              suggestion.severity === "critical" ? "bg-red-100 text-red-700" :
                              suggestion.severity === "suggestion" ? "bg-amber-100 text-amber-700" :
                              "bg-gray-100 text-gray-600"
                            )}>
                              {suggestion.severity}
                            </span>
                          )}
                          {suggestion.confidence && (
                            <span className="text-[10px] text-muted-foreground">
                              Confiança: {suggestion.confidence}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-red-600 font-mono bg-red-50 px-1.5 py-0.5 rounded border border-red-100 shrink-0" style={{ fontSize: "10px" }}>-</span>
                            <p className="text-xs text-red-700 font-mono leading-relaxed">{suggestion.originalText}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-xs text-green-600 font-mono bg-green-50 px-1.5 py-0.5 rounded border border-green-100 shrink-0" style={{ fontSize: "10px" }}>+</span>
                            <p className="text-xs text-green-700 font-mono leading-relaxed">{suggestion.suggestedText}</p>
                          </div>
                        </div>
                        {suggestion.reason && (
                          <p className="text-xs text-muted-foreground mt-2 italic">{suggestion.reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsAIReviewOpen(false);
                setAiReviewResult(null);
                setSelectedEditIndexes(new Set());
                setAiReviewingContract(null);
              }}
            >
              Cancelar
            </Button>
            {aiReviewResult?.success && aiReviewResult.suggestions.length > 0 && (
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const docId = extractDocumentId(aiReviewingContract?.googleDocLink ?? '');
                    if (!user?.uid || !docId || selectedEditIndexes.size === 0) return;
                    setIsApplyingEdits(true);
                    try {
                      const editsToApply = Array.from(selectedEditIndexes).map((i) => aiReviewResult!.suggestions[i]);
                      const applyResult = await applyReviewEdits(user.uid, {
                        documentId: docId,
                        contractId: aiReviewingContract?.id,
                        edits: editsToApply.map((s) => ({
                          section: s.section,
                          originalText: s.originalText,
                          suggestedText: s.suggestedText,
                          reason: s.reason,
                          severity: s.severity as "critical" | "suggestion" | "optional",
                          confidence: s.confidence as "HIGH" | "MEDIUM" | "LOW",
                        })),
                      });
                      if (applyResult.success) {
                        // Store applied edits for potential undo
                        setAppliedReviewEdits(editsToApply.map((s) => ({
                          section: s.section,
                          originalText: s.originalText,
                          suggestedText: s.suggestedText,
                          reason: s.reason,
                          severity: s.severity,
                          confidence: s.confidence,
                        })));
                        // Track the contract for undo so button persists even after dialog closes
                        setContractWithAppliedReview(aiReviewingContract);
                        setIsAIReviewOpen(false);
                        setAiReviewResult(null);
                        setSelectedEditIndexes(new Set());
                        setAiReviewingContract(null);
                        toast({ title: "Edições aplicadas", description: `${applyResult.editsApplied} edição(ões) aplicada(s) com sucesso. Você pode desfazer em até 24h.` });
                      } else {
                        toast({ title: "Erro", description: applyResult.error || "Falha ao aplicar edições.", variant: "destructive" });
                      }
                    } catch (e) {
                      toast({ title: "Erro", description: String(e), variant: "destructive" });
                    } finally {
                      setIsApplyingEdits(false);
                    }
                  }}
                  disabled={selectedEditIndexes.size === 0 || isApplyingEdits}
                >
                  {isApplyingEdits ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Aplicar {selectedEditIndexes.size} edição(ões)
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Undo Confirmation AlertDialog */}
      <AlertDialog open={isUndoConfirmOpen} onOpenChange={setIsUndoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer revisão?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá reverter as {appliedReviewEdits?.length ?? 0} edição(ões) aplicadas pelo AI Review e restaurar o texto original no Google Docs.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!user?.uid || !contractWithAppliedReview || !appliedReviewEdits) return;
                const docId = extractDocumentId(contractWithAppliedReview.googleDocLink ?? '');
                if (!docId) return;
                setIsRevertingEdits(true);
                try {
                  const revertResult = await revertReviewEdits(user.uid, {
                    documentId: docId,
                    contractId: contractWithAppliedReview?.id,
                    edits: appliedReviewEdits!.map((s) => ({
                      section: s.section,
                      originalText: s.originalText,
                      suggestedText: s.suggestedText,
                      reason: s.reason ?? "",
                      severity: s.severity as "critical" | "suggestion" | "optional",
                      confidence: s.confidence as "HIGH" | "MEDIUM" | "LOW",
                    })),
                  });
                  if (revertResult.success) {
                    setAppliedReviewEdits(null);
                    setContractWithAppliedReview(null);
                    toast({ title: "Revisão desfeita", description: `${revertResult.editsReverted} edição(ões) revertida(s) com sucesso.` });
                  } else {
                    toast({ title: "Erro", description: revertResult.error || "Falha ao desfazer.", variant: "destructive" });
                  }
                } catch (e) {
                  toast({ title: "Erro", description: String(e), variant: "destructive" });
                } finally {
                  setIsRevertingEdits(false);
                  setIsUndoConfirmOpen(false);
                }
              }}
            >
              {isRevertingEdits ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function GerarExportarPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>}>
      <GerarExportarContent />
    </Suspense>
  );
}
