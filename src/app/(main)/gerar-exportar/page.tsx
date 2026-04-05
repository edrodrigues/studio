"use client";

import { Suspense, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { addDoc, collection, deleteDoc, doc, getDoc, increment, orderBy, query, updateDoc, where } from "firebase/firestore";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, Eye, FileText, GitCompareArrows, LayoutTemplate, Loader2, MoreHorizontal, Trash2, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { prepareContractData } from "@/lib/actions";
import { generateContractDoc, inspectTemplateForGeneration } from "@/lib/actions/google-docs-actions";
import { exportToDocx } from "@/lib/export";
import { Contract, DocumentStatus, ProjectDocument, Template } from "@/lib/types";
import { cn, extractGoogleDocId, isValidDate, safeNewDate } from "@/lib/utils";

const ContractPreviewModal = dynamic(() => import("@/components/app/contract-preview-modal").then((mod) => mod.ContractPreviewModal), { ssr: false });
const ComparisonModal = dynamic(() => import("@/components/app/comparison-modal").then((mod) => mod.ComparisonModal), { ssr: false });
const EntityEditModal = dynamic(() => import("@/components/app/entity-edit-modal").then((mod) => mod.EntityEditModal), { ssr: false });

type ProjectDocumentRecord = ProjectDocument & { id: string };
type ContractRecord = Contract & { id: string };
type PlaceholderDef = { key: string; matches: string[] };
type TemplatePreparation = {
  templateId: string;
  templateName: string;
  googleDocId: string;
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

const renderErrors = (errors: string[]) => (
  <div className="space-y-1">
    {errors.map((error) => <p key={error} className="text-xs leading-relaxed">{error}</p>)}
  </div>
);

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
  const { accessToken, signInWithGoogle } = useAuthContext();
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
  const sortedContracts = useMemo(() => [...((contracts || []) as ContractRecord[])].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()), [contracts]);

  useEffect(() => {
    setSelectedDocTypes((prev) => prev.filter((type) => Boolean(latestDocumentsByType[type])));
  }, [latestDocumentsByType]);

  const toggleDocType = (type: string) => {
    setSelectedDocTypes((prev) => prev.includes(type) ? prev.filter((value) => value !== type) : [...prev, type]);
  };

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) => prev.includes(templateId) ? prev.filter((value) => value !== templateId) : [...prev, templateId]);
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
    if (!accessToken) {
      toast({
        title: "Login com Google Necessário",
        description: "Conecte sua conta para validar o template e gerar a cópia no Google Docs.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Conectar</Button>,
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
      const ready: TemplatePreparation[] = [];

      for (const template of selectedTemplateRecords) {
        const link = template.googleDocLink?.trim() || "";
        if (!link) {
          errors.push(`${template.name}: preencha o campo "Link do Modelo em Google Doc" para este modelo.`);
          console.warn("[GerarExportar] Template sem googleDocLink", { templateId: template.id, templateName: template.name });
          continue;
        }
        const googleDocId = extractGoogleDocId(link);
        if (!googleDocId) {
          errors.push(`${template.name}: o campo "Link do Modelo em Google Doc" está inválido.`);
          console.warn("[GerarExportar] googleDocLink inválido", { templateId: template.id, templateName: template.name, googleDocLink: link });
          continue;
        }
        console.info("[GerarExportar] Validando template", { templateId: template.id, templateName: template.name, googleDocId });
        const inspection = await inspectTemplateForGeneration(accessToken, googleDocId, template.markdownContent);
        if (!inspection.success || !inspection.placeholders || inspection.placeholders.length === 0) {
          const inspectionError = "error" in inspection ? inspection.error : "não foi possível preparar o template.";
          errors.push(`${template.name}: ${inspectionError}`);
          console.warn("[GerarExportar] Falha no preflight", { templateId: template.id, templateName: template.name, googleDocId, inspectionError });
          continue;
        }
        ready.push({
          templateId: template.id,
          templateName: template.name,
          googleDocId,
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
    if (!user || !firestore || !accessToken || templatePreparations.length === 0) return;
    setIsEntityModalOpen(false);
    startGeneration(async () => {
      let successCount = 0;
      const errors: string[] = [];
      for (const templatePreparation of templatePreparations) {
        try {
          const result = await generateContractDoc(accessToken, templatePreparation.googleDocId, templatePreparation.templateName, clientName || projectName || "Cliente", confirmedPlaceholders, templatePreparation.placeholderMatches, currentProjectId);
          if (!result.success || !result.documentId) {
            errors.push(`${templatePreparation.templateName}: ${"error" in result ? result.error : "falha desconhecida ao gerar documento."}`);
            continue;
          }
          const generatedAt = new Date().toISOString();
          const filledPayload = JSON.stringify({ placeholders: confirmedPlaceholders, sourceDocuments: selectedDocs, discardedEntities, extractionDate: generatedAt });
          const projectContractRef = await addDoc(collection(firestore, "projectContracts"), {
            projectId: currentProjectId, templateId: templatePreparation.templateId, name: result.fileName, markdownContent: "",
            filledData: filledPayload, generatedBy: user.uid, generatedAt, googleDocId: result.documentId, googleDocLink: result.documentLink, version: 1,
          });
          await addDoc(collection(firestore, "users", user.uid, "filledContracts"), {
            projectContractId: projectContractRef.id, projectId: currentProjectId, contractModelId: templatePreparation.templateId,
            clientName: clientName || projectName || "Cliente", filledData: filledPayload, name: result.fileName, markdownContent: "",
            googleDocLink: result.documentLink, googleDocId: result.documentId, createdAt: generatedAt, sourceDocumentIds: selectedDocs,
            entityCount: Object.keys(confirmedPlaceholders).length, generationMethod: "google-docs", templateName: templatePreparation.templateName, extractionDate: generatedAt,
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
                      {filteredTemplates.map((template) => (
                        <Card key={template.id} className={cn("relative overflow-hidden border transition-all duration-200 hover:shadow-md", selectedTemplates.includes(template.id) ? "border-purple-500 bg-purple-50/20 ring-1 ring-purple-500/20" : "border-border/60 hover:border-purple-300")}>
                          <div className="p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Checkbox id={`template-${template.id}`} checked={selectedTemplates.includes(template.id)} onCheckedChange={() => toggleTemplate(template.id)} className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600" />
                                <div className="min-w-0 space-y-2">
                                  <Label htmlFor={`template-${template.id}`} className="block font-bold text-sm leading-none cursor-pointer hover:text-purple-700 transition-colors truncate">{template.name}</Label>
                                  <Badge variant="outline" className={cn("text-[10px]", template.googleDocLink ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>{template.googleDocLink ? "Link configurado" : "Link pendente"}</Badge>
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" asChild={Boolean(template.googleDocLink)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors" disabled={!template.googleDocLink}>
                                {template.googleDocLink ? <a href={template.googleDocLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir modelo no Google Docs" title="Abrir modelo no Google Docs"><ExternalLink className="h-4 w-4" /></a> : <span aria-hidden="true"><ExternalLink className="h-4 w-4" /></span>}
                              </Button>
                            </div>
                          </div>
                          {selectedTemplates.includes(template.id) && <motion.div layoutId={`selected-indicator-${template.id}`} className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500" />}
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          <div className="sticky bottom-4 z-10 flex flex-col items-center gap-4 rounded-3xl bg-background/90 py-2 backdrop-blur-sm">
            <Button size="lg" className="h-14 w-full max-w-md rounded-2xl px-8 text-base font-semibold sm:h-16 sm:text-lg" onClick={handlePrepareGeneration} disabled={selectedTemplates.length === 0 || selectedDocs.length === 0 || isGenerating || isPreparingGeneration}>
              {isPreparingGeneration ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}Gerar Documentos
            </Button>
            <p className="text-xs text-muted-foreground text-center max-w-xl">A geração usa apenas o campo "Link do Modelo em Google Doc", valida o acesso antes da revisão e aplica os placeholders confirmados na cópia do usuário.</p>
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
                        {contract.generationMethod === "google-docs" ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge> : null}
                        <Badge variant="outline">{contract.entityCount !== undefined ? `${contract.entityCount} entidade(s)` : "Sem dados"}</Badge>
                        <Badge variant="outline">{contract.sourceDocumentIds?.length || 0} documento(s)</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {contract.googleDocLink ? <Button variant="outline" size="sm" asChild><a href={contract.googleDocLink} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Google Docs</a></Button> : null}
                        <Button variant="outline" size="sm" onClick={() => { setSelectedContract(contract); setIsPreviewOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Visualizar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteContract(contract.id)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</Button>
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
                        {contract.generationMethod === "google-docs" ? <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge> : <span className="text-muted-foreground">-</span>}
                        {contract.sourceDocumentIds && <span className="block text-[9px] text-muted-foreground mt-1">{contract.sourceDocumentIds.length} doc(s)</span>}
                      </TableCell>
                      <TableCell className="text-xs">{contract.entityCount !== undefined ? <span className={contract.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>{contract.entityCount > 0 ? `${contract.entityCount} preench.` : "Sem dados"}</span> : <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { setSelectedContract(contract); setIsPreviewOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteContract(contract.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Deletar</DropdownMenuItem>
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
