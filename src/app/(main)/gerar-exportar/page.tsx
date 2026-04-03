"use client";

import { useState, useMemo, useTransition, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { collection, addDoc, doc, deleteDoc, query, where, getDoc, increment, updateDoc } from "firebase/firestore";
import {
  Loader2, CheckCircle2, FileText, LayoutTemplate,
  Wand2, Eye, Trash2, MoreHorizontal,
  ExternalLink, GitCompareArrows, Download, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { type ProjectDocument, type Template, type Contract, DocumentStatus } from "@/lib/types";
import { prepareContractData } from "@/lib/actions";
import { generateContractDoc, inspectTemplateForGeneration } from "@/lib/actions/google-docs-actions";
import { useAuthContext } from "@/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn, extractGoogleDocId, isValidDate, safeNewDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { exportToDocx } from "@/lib/export";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const ContractPreviewModal = dynamic(() => import("@/components/app/contract-preview-modal").then(mod => mod.ContractPreviewModal), { ssr: false });
const ComparisonModal = dynamic(() => import("@/components/app/comparison-modal").then(mod => mod.ComparisonModal), { ssr: false });
const EntityEditModal = dynamic(() => import("@/components/app/entity-edit-modal").then(mod => mod.EntityEditModal), { ssr: false });

interface TemplatePreparation {
  templateId: string;
  templateName: string;
  googleDocId: string;
  placeholderDefinitions: Array<{ key: string; matches: string[] }>;
  placeholderMatches: Record<string, string[]>;
}

function mergePlaceholderDefinitions(
  preparations: TemplatePreparation[]
): Array<{ key: string; matches: string[] }> {
  const merged = new Map<string, Set<string>>();

  for (const preparation of preparations) {
    for (const definition of preparation.placeholderDefinitions) {
      if (!merged.has(definition.key)) {
        merged.set(definition.key, new Set<string>());
      }

      for (const match of definition.matches) {
        merged.get(definition.key)!.add(match);
      }
    }
  }

  return Array.from(merged.entries())
    .map(([key, matches]) => ({
      key,
      matches: Array.from(matches).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function createPlaceholderMatchRecord(
  placeholderDefinitions: Array<{ key: string; matches: string[] }>
) {
  return placeholderDefinitions.reduce((acc, definition) => {
    acc[definition.key] = definition.matches;
    return acc;
  }, {} as Record<string, string[]>);
}

function GerarExportarContent() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { accessToken, signInWithGoogle } = useAuthContext();
  const { clientName } = useUserPreferences();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const projectIdFromUrl = searchParams.get("projectId");
  const currentProjectId = projectIdFromUrl || "default-project";

  const [isGenerating, startGeneration] = useTransition();
  const [activeTab, setActiveTab] = useState("gerar");
  const [projectName, setProjectName] = useState("Projeto");
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [isPreparingGeneration, setIsPreparingGeneration] = useState(false);
  const [customLinks, setCustomLinks] = useState<Record<string, string>>({});
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [templatePreparations, setTemplatePreparations] = useState<TemplatePreparation[]>([]);
  const [reviewPlaceholderDefinitions, setReviewPlaceholderDefinitions] = useState<Array<{ key: string; matches: string[] }>>([]);
  const [preparedEntities, setPreparedEntities] = useState<Record<string, string>>({});
  const [entityDescriptions, setEntityDescriptions] = useState<Record<string, string>>({});
  const [discardedEntities, setDiscardedEntities] = useState<Record<string, string>>({});

  useEffect(() => {
    if (projectIdFromUrl && firestore) {
      getDoc(doc(firestore, "projects", projectIdFromUrl)).then((docSnap) => {
        if (docSnap.exists()) {
          setProjectName(docSnap.data().name);
        }
      });
    }
  }, [projectIdFromUrl, firestore]);

  const contractTypeFilter = searchParams.get("contractType");
  const processTypeFilter = searchParams.get("processType");

  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    if (projectIdFromUrl) {
      return query(collection(firestore, "projectDocuments"), where("projectId", "==", projectIdFromUrl));
    }
    return collection(firestore, "projectDocuments");
  }, [user, firestore, projectIdFromUrl]);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, "contractModels");
  }, [user, firestore]);

  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    if (projectIdFromUrl) {
      return query(collection(firestore, "users", user.uid, "filledContracts"), where("projectId", "==", projectIdFromUrl));
    }
    return collection(firestore, "users", user.uid, "filledContracts");
  }, [user, firestore, projectIdFromUrl]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<ProjectDocument>(projectDocsQuery);
  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);
  const { data: contracts } = useCollection<Contract>(filledContractsQuery);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!contractTypeFilter) return templates;

    return templates.filter((template) => {
      const matchType = template.contractTypes?.some(type =>
        type.toLowerCase() === contractTypeFilter.toLowerCase()
      );

      if (processTypeFilter && template.contractTypes?.includes(processTypeFilter)) {
        return true;
      }

      return matchType;
    });
  }, [templates, contractTypeFilter, processTypeFilter]);

  const sortedContracts = useMemo(() => {
    if (!contracts) return [];
    return [...contracts].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [contracts]);

  const handleDocToggle = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handleTemplateToggle = (id: string) => {
    setSelectedTemplates(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const handlePrepareGeneration = async () => {
    if (selectedTemplates.length === 0 || !templates) {
      toast({ variant: "destructive", title: "Selecione ao menos um modelo." });
      return;
    }

    if (selectedDocs.length === 0) {
      toast({
        variant: "destructive",
        title: "Documentos não selecionados",
        description: "Por favor, selecione ao menos um documento inicial.",
      });
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
      const prepared = await prepareContractData({
        projectId: currentProjectId,
        documentIds: selectedDocs,
      });

      setPreparedEntities(prepared.success ? (prepared.entities || {}) : {});
      setEntityDescriptions(prepared.success ? (prepared.entityDescriptions || {}) : {});
      setDiscardedEntities(prepared.success ? (prepared.discardedEntities || {}) : {});

      const selectedTemplateRecords = selectedTemplates
        .map((templateId) => templates.find(template => template.id === templateId))
        .filter((template): template is Template & { id: string } => Boolean(template));

      const preparationErrors: string[] = [];
      const successfulPreparations: TemplatePreparation[] = [];

      for (const template of selectedTemplateRecords) {
        const linkToUse =
          customLinks[template.id]?.trim() ||
          template.projectDocLink?.trim() ||
          template.googleDocLink?.trim() ||
          "";

        const googleDocId = extractGoogleDocId(linkToUse);
        if (!googleDocId) {
          preparationErrors.push(`${template.name}: link do Google Docs inválido ou ausente.`);
          continue;
        }

        const inspection = await inspectTemplateForGeneration(
          accessToken,
          googleDocId,
          template.markdownContent
        );

        if (!inspection.success || !inspection.placeholders || inspection.placeholders.length === 0) {
          const inspectionError = "error" in inspection ? inspection.error : "não foi possível preparar o template.";
          preparationErrors.push(`${template.name}: ${inspectionError}`);
          continue;
        }

        successfulPreparations.push({
          templateId: template.id,
          templateName: template.name,
          googleDocId,
          placeholderDefinitions: inspection.placeholders,
          placeholderMatches: createPlaceholderMatchRecord(inspection.placeholders),
        });
      }

      if (successfulPreparations.length === 0) {
        toast({
          variant: "destructive",
          title: "Falha ao preparar templates",
          description: preparationErrors[0] || "Nenhum template pôde ser validado para geração.",
        });
        return;
      }

      if (preparationErrors.length > 0) {
        toast({
          variant: "destructive",
          title: "Alguns templates não puderam ser preparados",
          description: `${preparationErrors.length} template(s) foram ignorados. Primeiro erro: ${preparationErrors[0]}`,
        });
      } else if (prepared.discardedEntities && Object.keys(prepared.discardedEntities).length > 0) {
        toast({
          title: "Entidades inválidas descartadas",
          description: `${Object.keys(prepared.discardedEntities).length} valor(es) placeholder foram removidos antes da revisão.`,
        });
      }

      setTemplatePreparations(successfulPreparations);
      setReviewPlaceholderDefinitions(mergePlaceholderDefinitions(successfulPreparations));
      setIsEntityModalOpen(true);
    } catch (error) {
      console.error("[GerarExportar] Erro ao preparar geração:", error);
      toast({
        variant: "destructive",
        title: "Erro ao preparar geração",
        description: error instanceof Error ? error.message : "Falha ao preparar os dados da geração.",
      });
    } finally {
      setIsPreparingGeneration(false);
    }
  };

  const handleConfirmGeneration = (confirmedPlaceholders: Record<string, string>) => {
    if (!user || !firestore || !accessToken || templatePreparations.length === 0) {
      return;
    }

    setIsEntityModalOpen(false);

    startGeneration(async () => {
      let successCount = 0;
      const errors: string[] = [];

      for (const templatePreparation of templatePreparations) {
        try {
          const result = await generateContractDoc(
            accessToken,
            templatePreparation.googleDocId,
            templatePreparation.templateName,
            clientName || projectName || "Cliente",
            confirmedPlaceholders,
            templatePreparation.placeholderMatches,
            currentProjectId
          );

          if (!result.success || !result.documentId) {
            const generationError = "error" in result ? result.error : "falha desconhecida ao gerar documento.";
            errors.push(`${templatePreparation.templateName}: ${generationError}`);
            continue;
          }

          const generatedAt = new Date().toISOString();
          const filledPayload = JSON.stringify({
            placeholders: confirmedPlaceholders,
            sourceDocuments: selectedDocs,
            discardedEntities,
            extractionDate: generatedAt,
          });

          const projectContractRef = await addDoc(collection(firestore, "projectContracts"), {
            projectId: currentProjectId,
            templateId: templatePreparation.templateId,
            name: result.fileName,
            markdownContent: "",
            filledData: filledPayload,
            generatedBy: user.uid,
            generatedAt,
            googleDocId: result.documentId,
            googleDocLink: result.documentLink,
            version: 1,
          });

          await addDoc(collection(firestore, "users", user.uid, "filledContracts"), {
            projectContractId: projectContractRef.id,
            projectId: currentProjectId,
            contractModelId: templatePreparation.templateId,
            clientName: clientName || projectName || "Cliente",
            filledData: filledPayload,
            name: result.fileName,
            markdownContent: "",
            googleDocLink: result.documentLink,
            googleDocId: result.documentId,
            createdAt: generatedAt,
            sourceDocumentIds: selectedDocs,
            entityCount: Object.keys(confirmedPlaceholders).length,
            generationMethod: "google-docs",
            templateName: templatePreparation.templateName,
            extractionDate: generatedAt,
          });

          if (currentProjectId && currentProjectId !== "default-project") {
            await updateDoc(doc(firestore, "projects", currentProjectId), {
              contractCount: increment(1),
              updatedAt: generatedAt,
            });
          }

          successCount++;
        } catch (error) {
          console.error(error);
          errors.push(`${templatePreparation.templateName}: ${error instanceof Error ? error.message : "falha na comunicação com o servidor."}`);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Geração concluída!",
          description: `${successCount} documento(s) gerado(s) com sucesso.${errors.length > 0 ? ` ${errors.length} falha(s).` : ""}`,
        });
        setActiveTab("revisar");
      } else {
        toast({
          variant: "destructive",
          title: "Falha na geração",
          description: errors[0] || "Nenhum template selecionado ou encontrado.",
        });
      }
    });
  };

  const handleDeleteContract = async (id: string) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;

    try {
      const contractRef = doc(firestore, "users", user.uid, "filledContracts", id);
      const contractDoc = await getDoc(contractRef);
      const contractData = contractDoc.exists() ? contractDoc.data() as Contract : null;
      const contractProjectId = contractData?.projectId;

      await deleteDoc(contractRef);

      if (contractData?.projectContractId) {
        await deleteDoc(doc(firestore, "projectContracts", contractData.projectContractId));
      }

      if (contractProjectId && contractProjectId !== "default-project") {
        await updateDoc(doc(firestore, "projects", contractProjectId), {
          contractCount: increment(-1),
          updatedAt: new Date().toISOString(),
        });
      }

      toast({ title: "Documento excluído." });
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Erro ao excluir." });
    }
  };

  const handleExportSelected = () => {
    const toExport = sortedContracts.filter(contract => selectedContracts.includes(contract.id));
    toExport.forEach(contract => {
      if (contract.markdownContent) {
        exportToDocx(contract.markdownContent, contract.name.replace(/\s/g, "_"));
      }
    });
    toast({ title: "Exportação iniciada!" });
  };

  return (
    <div className="container py-10 max-w-6xl relative">
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md"
          >
            <div className="text-center space-y-6 max-w-md p-8 rounded-3xl bg-card shadow-2xl border border-border/50">
              <div className="relative mx-auto w-24 h-24">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                    borderRadius: ["20%", "50%", "20%"]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 3,
                    ease: "easeInOut"
                  }}
                  className="w-full h-full bg-primary/20 flex items-center justify-center"
                >
                  <Wand2 className="w-12 h-12 text-primary" />
                </motion.div>
                <motion.div
                  animate={{
                    scale: [1.2, 1, 1.2],
                    opacity: [0.5, 0.2, 0.5]
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="absolute inset-0 bg-primary/30 rounded-full -z-10 blur-xl"
                />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-primary">Gerando Documentos</h2>
                <p className="text-muted-foreground">O fluxo agora valida acesso ao template, cria a cópia e aplica os placeholders confirmados de forma determinística.</p>
              </div>
              <div className="flex justify-center gap-2">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-primary rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Gerar e Revisar</h1>
            <p className="text-muted-foreground mt-2">
              {projectIdFromUrl ? `Projeto: ${projectName}` : "Central de inteligência para seus contratos."}
            </p>
          </div>
          <TabsList className="grid w-[400px] grid-cols-2">
            <TabsTrigger value="gerar" className="flex gap-2">
              <Wand2 className="h-4 w-4" /> Gerar Novos
            </TabsTrigger>
            <TabsTrigger value="revisar" className="flex gap-2">
              <CheckCircle2 className="h-4 w-4" /> Documentos Gerados
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="gerar" className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <Card className="flex flex-col border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <FileText className="text-blue-500" /> 1. Documentos Iniciais
                </CardTitle>
                <CardDescription>Contexto sincronizado via File Search.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[350px] pr-4">
                  {isLoadingDocs ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
                    <div className="space-y-2">
                      {documents?.map(document => (
                        <div key={document.id} onClick={() => handleDocToggle(document.id)} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50", selectedDocs.includes(document.id) && "border-blue-500 bg-blue-50/50")}>
                          <Checkbox checked={selectedDocs.includes(document.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium">{document.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              {document.entityExtractionStatus === "processing" && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                                  <Loader2 className="h-2 w-2 animate-spin mr-1" />
                                  Extraindo...
                                </Badge>
                              )}
                              {document.entityExtractionStatus === "completed" && (document.entityCount || 0) > 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle2 className="h-2 w-2 mr-1" />
                                  {document.entityCount} entidades
                                </Badge>
                              )}
                              {document.entityExtractionStatus === "completed" && (document.entityCount || 0) === 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gray-50 text-gray-500 border-gray-200">
                                  Sem entidades
                                </Badge>
                              )}
                              {document.entityExtractionStatus === "failed" && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-50 text-red-700 border-red-200">
                                  <AlertTriangle className="h-2 w-2 mr-1" />
                                  Falha na extração
                                </Badge>
                              )}
                              {!document.entityExtractionStatus && document.status === DocumentStatus.INDEXED && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gray-50 text-gray-500 border-gray-200">
                                  Indexado
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {documents?.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground text-sm">
                          Nenhum documento sincronizado encontrado para este projeto.
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LayoutTemplate className="text-purple-500" /> 2. Modelos de Contrato
                </CardTitle>
                <CardDescription>
                  {contractTypeFilter
                    ? `Filtrados por: ${contractTypeFilter.toUpperCase()}`
                    : "Escolha os templates para preenchimento."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[450px] pr-4">
                  {isLoadingTemplates ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <Loader2 className="animate-spin h-8 w-8 text-purple-500" />
                      <p className="text-sm text-muted-foreground">Carregando modelos...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {filteredTemplates.map(template => (
                        <Card
                          key={template.id}
                          className={cn(
                            "relative overflow-hidden border transition-all duration-200 hover:shadow-md",
                            selectedTemplates.includes(template.id)
                              ? "border-purple-500 bg-purple-50/20 ring-1 ring-purple-500/20"
                              : "border-border/60 hover:border-purple-300"
                          )}
                        >
                          <div className="p-4 space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  id={`template-${template.id}`}
                                  checked={selectedTemplates.includes(template.id)}
                                  onCheckedChange={() => handleTemplateToggle(template.id)}
                                  className="h-5 w-5 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                />
                                <Label htmlFor={`template-${template.id}`} className="font-bold text-sm leading-none cursor-pointer hover:text-purple-700 transition-colors">
                                  {template.name}
                                </Label>
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      asChild
                                      className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                      disabled={!template.googleDocLink}
                                    >
                                      <a
                                        href={template.googleDocLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        aria-label="Ver documento original"
                                      >
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Ver documento original</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-2 px-1">
                              {template.description || "Sem descrição disponível para este modelo."}
                            </p>

                            <div className="space-y-2 pt-1">
                              <Label
                                htmlFor={`custom-link-${template.id}`}
                                className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70 pl-1"
                              >
                                Link do Modelo em Google Doc
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  id={`custom-link-${template.id}`}
                                  placeholder={template.projectDocLink || template.googleDocLink || "Cole o link do Google Doc..."}
                                  className="h-9 text-xs bg-background/50 border-border/40 focus-visible:ring-purple-500/30"
                                  value={customLinks[template.id] || ""}
                                  onChange={(event) => setCustomLinks(prev => ({ ...prev, [template.id]: event.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          {selectedTemplates.includes(template.id) && (
                            <motion.div
                              layoutId={`selected-indicator-${template.id}`}
                              className="absolute left-0 top-0 bottom-0 w-1 bg-purple-500"
                            />
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button
              size="lg"
              className="h-16 px-12 text-lg font-bold rounded-full"
              onClick={handlePrepareGeneration}
              disabled={selectedTemplates.length === 0 || isGenerating || isPreparingGeneration}
            >
              {isPreparingGeneration ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
              Gerar Documentos
            </Button>
            <p className="text-xs text-muted-foreground">
              Valida o acesso ao template, prepara os placeholders do Google Docs e abre a revisão final antes da cópia.
            </p>
          </div>
        </TabsContent>
        <TabsContent value="revisar" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Documentos</CardTitle>
                <CardDescription>Gerencie, visualize e exporte os documentos gerados.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsComparisonOpen(true)} disabled={selectedContracts.length < 2}>
                  <GitCompareArrows className="mr-2 h-4 w-4" /> Comparar ({selectedContracts.length})
                </Button>
                <Button size="sm" onClick={handleExportSelected} disabled={selectedContracts.length === 0}>
                  <Download className="mr-2 h-4 w-4" /> Exportar ({selectedContracts.length})
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                  {sortedContracts.map(contract => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Checkbox checked={selectedContracts.includes(contract.id)} onCheckedChange={() => setSelectedContracts(prev => prev.includes(contract.id) ? prev.filter(item => item !== contract.id) : [...prev, contract.id])} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {contract.name}
                        {contract.googleDocLink && (
                          <a href={contract.googleDocLink} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink className="h-2 w-2" /> Google Docs
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {contract.generationMethod === "google-docs" ? (
                          <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {contract.sourceDocumentIds && (
                          <span className="block text-[9px] text-muted-foreground mt-1">
                            {contract.sourceDocumentIds.length} doc(s)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {contract.entityCount !== undefined ? (
                          <span className={contract.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {contract.entityCount > 0 ? `${contract.entityCount} preench.` : "Sem dados"}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isValidDate(contract.createdAt)
                          ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm")
                          : "-"}
                      </TableCell>
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
                  {sortedContracts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum documento gerado ainda para este projeto.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedContract && (
        <ContractPreviewModal
          contract={selectedContract}
          isOpen={isPreviewOpen}
          initialEditMode={false}
          onClose={() => setIsPreviewOpen(false)}
          onSave={() => {}}
        />
      )}

      <ComparisonModal
        isOpen={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
        contracts={sortedContracts.filter(contract => selectedContracts.includes(contract.id))}
      />

      <EntityEditModal
        isOpen={isEntityModalOpen}
        onClose={() => setIsEntityModalOpen(false)}
        onConfirm={handleConfirmGeneration}
        placeholderDefinitions={reviewPlaceholderDefinitions}
        extractedEntities={preparedEntities}
        entityDescriptions={entityDescriptions}
      />
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
