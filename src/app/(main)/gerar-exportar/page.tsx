"use client";

import { useState, useMemo, useTransition, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, doc, deleteDoc, query, where, getDoc, increment, updateDoc } from "firebase/firestore";
import { 
  FilePlus2, Loader2, CheckCircle2, FileText, LayoutTemplate, 
  ArrowRight, Wand2, Eye, Pencil, Trash2, MoreHorizontal, 
  ExternalLink, GitCompareArrows, Download, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { type ProjectDocument, type Template, type Contract, DocumentStatus } from "@/lib/types";
import { prepareContractData } from "@/lib/actions";
import { generateContractDoc } from "@/lib/actions/google-docs-actions";
import { useAuthContext } from "@/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { cn, extractGoogleDocId, isValidDate, safeNewDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saveAs } from "file-saver";
import { exportToDocx } from "@/lib/export";
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from "framer-motion";

const ContractPreviewModal = dynamic(() => import('@/components/app/contract-preview-modal').then(mod => mod.ContractPreviewModal), { ssr: false });
const ComparisonModal = dynamic(() => import('@/components/app/comparison-modal').then(mod => mod.ComparisonModal), { ssr: false });

function GerarExportarContent() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { accessToken, signInWithGoogle } = useAuthContext();
  const { clientName } = useUserPreferences();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const projectIdFromUrl = searchParams.get('projectId');
  const currentProjectId = projectIdFromUrl || "default-project";
  
  const [isGenerating, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("gerar");
  const [projectName, setProjectName] = useState("Projeto");

  // Fetch project name if projectId exists
  useEffect(() => {
    if (projectIdFromUrl && firestore) {
      getDoc(doc(firestore, "projects", projectIdFromUrl)).then((docSnap) => {
        if (docSnap.exists()) {
          setProjectName(docSnap.data().name);
        }
      });
    }
  }, [projectIdFromUrl, firestore]);

  // Selection States
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  
  // Modal States
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [startInEditMode, setStartInEditMode] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [editableEntities, setEditableEntities] = useState<Record<string, string>>({});
  const [isExtractingForCopy, setIsExtractingForCopy] = useState(false);

  

  // Queries
  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    if (projectIdFromUrl) {
      return query(collection(firestore, 'projectDocuments'), where('projectId', '==', projectIdFromUrl));
    }
    return collection(firestore, 'projectDocuments');
  }, [user, firestore, projectIdFromUrl]);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'contractModels');
  }, [user, firestore]);

  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    if (projectIdFromUrl) {
      return query(collection(firestore, 'users', user.uid, 'filledContracts'), where('projectId', '==', projectIdFromUrl));
    }
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore, projectIdFromUrl]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<ProjectDocument>(projectDocsQuery);
  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);
  const { data: contracts, isLoading: isLoadingContracts } = useCollection<Contract>(filledContractsQuery);

  const sortedContracts = useMemo(() => {
    if (!contracts) return [];
    return [...contracts].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [contracts]);

// Handlers
  const handleDocToggle = (id: string) => {
    setSelectedDocs(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleTemplateToggle = (id: string) => {
    setSelectedTemplates(prev => prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]);
  };

  // Open Copy Custom Modal - extracts entities first
  const handleOpenCopyModal = async () => {
    if (selectedTemplates.length === 0 || !templates) {
      toast({ variant: "destructive", title: "Selecione ao menos um modelo." });
      return;
    }

    if (selectedDocs.length === 0) {
      toast({ 
        variant: "destructive", 
        title: "Documentos não selecionados", 
        description: "Por favor, selecione ao menos um documento inicial." 
      });
      return;
    }

    const hasGoogleDoc = selectedTemplates.some(id => {
      const t = templates.find(temp => temp.id === id);
      return t?.googleDocLink && extractGoogleDocId(t.googleDocLink);
    });

    if (!hasGoogleDoc) {
      toast({
        variant: "destructive",
        title: "Modelo sem Google Docs",
        description: "A Cópia Customizada requer pelo menos um modelo com Google Docs configurado."
      });
      return;
    }

    if (!accessToken) {
      toast({
        title: "Login com Google Necessário",
        description: "Conecte sua conta para usar a Cópia Customizada.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Conectar</Button>,
      });
      return;
    }

    // Extract entities before opening modal
    setIsExtractingForCopy(true);
    try {
      const result = await prepareContractData({
        projectId: currentProjectId,
        documentIds: selectedDocs
      });

      if (result.success && result.entities) {
        setEditableEntities(result.entities);
        setIsCopyModalOpen(true);
      } else {
        // Open modal anyway with empty entities - user can fill manually
        setEditableEntities({});
        setIsCopyModalOpen(true);
        toast({
          variant: "default",
          title: "Aviso",
          description: "Não foi possível extrair entidades. Você pode preencher manualmente."
        });
      }
    } catch (error) {
      console.error('[CopyModal] Erro ao extrair entidades:', error);
      setEditableEntities({});
      setIsCopyModalOpen(true);
    } finally {
      setIsExtractingForCopy(false);
    }
  };

  // Handle copy with edited entities
  const handleGenerateCopyWithEntities = () => {
    setIsCopyModalOpen(false);
    handleConfirmGeneration(editableEntities);
  };

  

  const handleConfirmGeneration = (editedEntities: Record<string, any>) => {
    if (!user || !firestore || !templates) return;

    startTransition(async () => {
      let successCount = 0;
      let errorCount = 0;
      let lastErrorMessage = "";
      
      for (const templateId of selectedTemplates) {
        const template = templates.find(t => t.id === templateId);
        if (!template) {
          console.warn(`Template ${templateId} not found`);
          continue;
        }

        const googleDocId = template.googleDocLink ? extractGoogleDocId(template.googleDocLink) : null;

        try {
          let generatedSuccessfully = false;

          if (googleDocId && accessToken) {
            // Google Docs Flow
            const result = await generateContractDoc(
              accessToken, googleDocId, template.name, 
              clientName || "Cliente", editedEntities, currentProjectId
            );

            if (result.success && result.documentId) {
              await addDoc(collection(firestore, 'users', user.uid, 'filledContracts'), {
                projectId: currentProjectId,
                contractModelId: template.id,
                clientName: clientName || "Cliente",
                filledData: JSON.stringify({ 
                  entities: editedEntities,
                  sourceDocuments: selectedDocs,
                  extractionDate: new Date().toISOString()
                }),
                name: result.fileName,
                markdownContent: "",
                googleDocLink: result.documentLink,
                googleDocId: result.documentId,
                createdAt: new Date().toISOString(),
                // NOVOS CAMPOS
                sourceDocumentIds: selectedDocs,
                entityCount: Object.keys(editedEntities).length,
                generationMethod: 'google-docs',
                templateName: template.name
              });
              generatedSuccessfully = true;
            } else {
              // Melhor tratamento de erros do Google Drive
              lastErrorMessage = result.error || "Erro na integração com Google Docs.";
              
              // Se houver instruções específicas para o usuário, adicionar ao toast
              if (result.userInstructions && result.userInstructions.length > 0) {
                console.error('[GerarExportar] Erro detalhado:', {
                  type: result.errorType,
                  message: result.error,
                  technical: result.technicalDetails
                });
              }
            }
          } else {
            // Sem Google Docs configurado - pular este template
            lastErrorMessage = "Modelo sem Google Docs configurado. Configure o link do Google Docs no modelo para gerar documentos.";
          }

          if (generatedSuccessfully) {
            // Increment contract count in project
            if (currentProjectId && currentProjectId !== "default-project") {
              const projectRef = doc(firestore, 'projects', currentProjectId);
              await updateDoc(projectRef, {
                contractCount: increment(1),
                updatedAt: new Date().toISOString(),
              });
            }
            successCount++;
          }
 else {
            errorCount++;
          }
        } catch (e) {
          console.error(e);
          errorCount++;
          lastErrorMessage = e instanceof Error ? e.message : "Falha na comunicação com o servidor.";
        }
      }

      if (successCount > 0) {
        toast({ 
          title: "Geração Concluída!", 
          description: `${successCount} documento(s) gerado(s) com sucesso.${errorCount > 0 ? ` ${errorCount} falha(s).` : ""}` 
        });
        setActiveTab("revisar");
      } else {
        toast({ 
          variant: "destructive",
          title: "Falha na Geração", 
          description: errorCount > 0 
            ? `Não foi possível gerar os documentos. Erro: ${lastErrorMessage}`
            : "Nenhum modelo selecionado ou encontrado."
        });
      }
    });
  };

  const handleDeleteContract = async (id: string) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;
    try {
      const contractRef = doc(firestore, 'users', user.uid, 'filledContracts', id);
      const contractDoc = await getDoc(contractRef);
      const contractData = contractDoc.exists() ? contractDoc.data() : null;
      const contractProjectId = contractData?.projectId;

      await deleteDoc(contractRef);
      
      // Decrement contract count in project
      if (contractProjectId && contractProjectId !== "default-project") {
        const projectRef = doc(firestore, 'projects', contractProjectId);
        await updateDoc(projectRef, {
          contractCount: increment(-1),
          updatedAt: new Date().toISOString(),
        });
      }

      toast({ title: "Documento excluído." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erro ao excluir." });
    }
  };

  const handleExportSelected = () => {
    const toExport = sortedContracts.filter(c => selectedContracts.includes(c.id));
    toExport.forEach(c => {
      if (c.markdownContent) {
        exportToDocx(c.markdownContent, c.name.replace(/\s/g, '_'));
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
                <p className="text-muted-foreground">O ALEX está utilizando inteligência artificial para preencher seus contratos com precisão.</p>
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
              {projectIdFromUrl ? `Projeto: ${currentProjectId}` : "Central de inteligência para seus contratos."}
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
            {/* Step 1 */}
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
                      {documents?.map(doc => (
                        <div key={doc.id} onClick={() => handleDocToggle(doc.id)} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50", selectedDocs.includes(doc.id) && "border-blue-500 bg-blue-50/50")}>
                          <Checkbox checked={selectedDocs.includes(doc.id)} />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium">{doc.name}</div>
                            {/* Status de extração de entidades */}
                            <div className="flex items-center gap-2 mt-1">
                              {doc.entityExtractionStatus === 'processing' && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                                  <Loader2 className="h-2 w-2 animate-spin mr-1" />
                                  Extraindo...
                                </Badge>
                              )}
                              {doc.entityExtractionStatus === 'completed' && (doc.entityCount || 0) > 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
                                  <CheckCircle2 className="h-2 w-2 mr-1" />
                                  {doc.entityCount} entidades
                                </Badge>
                              )}
                              {doc.entityExtractionStatus === 'completed' && (doc.entityCount || 0) === 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-gray-50 text-gray-500 border-gray-200">
                                  Sem entidades
                                </Badge>
                              )}
                              {doc.entityExtractionStatus === 'failed' && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-red-50 text-red-700 border-red-200">
                                  <AlertTriangle className="h-2 w-2 mr-1" />
                                  Falha na extração
                                </Badge>
                              )}
                              {!doc.entityExtractionStatus && doc.status === DocumentStatus.INDEXED && (
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

            {/* Step 2 */}
            <Card className="flex flex-col border-2 border-primary/10">
              <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <LayoutTemplate className="text-purple-500" /> 2. Modelos de Contrato
                </CardTitle>
                <CardDescription>Escolha os templates para preenchimento.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ScrollArea className="h-[350px] pr-4">
                  {isLoadingTemplates ? <Loader2 className="animate-spin mx-auto mt-10" /> : (
                    <div className="space-y-2">
                      {templates?.map(t => (
                        <div key={t.id} onClick={() => handleTemplateToggle(t.id)} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50", selectedTemplates.includes(t.id) && "border-purple-500 bg-purple-50/50")}>
                          <Checkbox checked={selectedTemplates.includes(t.id)} />
                          <div className="flex-1">
                            <div className="text-sm font-medium">{t.name}</div>
                            {t.googleDocLink && <Badge variant="outline" className="text-[9px] h-3 px-1 mt-1 text-blue-600">Google Docs Ready</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          

          <div className="flex flex-col items-center gap-4">
            <Button size="lg" className="h-16 px-12 text-lg font-bold rounded-full" onClick={handleOpenCopyModal} disabled={selectedTemplates.length === 0 || isGenerating || isExtractingForCopy}>
              {isExtractingForCopy ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
              Gerar Documentos
            </Button>
            <p className="text-xs text-muted-foreground">
              Gera documentos preenchendo os modelos Google Docs selecionados com os dados extraídos.
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
                  {sortedContracts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Checkbox checked={selectedContracts.includes(c.id)} onCheckedChange={() => setSelectedContracts(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} />
                      </TableCell>
                      <TableCell className="font-medium">
                        {c.name}
                        {c.googleDocLink && (
                          <a href={c.googleDocLink} target="_blank" className="block text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink className="h-2 w-2" /> Google Docs
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.generationMethod === 'google-docs' ? (
                          <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        {c.sourceDocumentIds && (
                          <span className="block text-[9px] text-muted-foreground mt-1">
                            {c.sourceDocumentIds.length} doc(s)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.entityCount !== undefined ? (
                          <span className={c.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {c.entityCount > 0 ? `${c.entityCount} preench.` : 'Sem dados'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isValidDate(c.createdAt) 
                          ? format(safeNewDate(c.createdAt)!, "dd/MM/yyyy HH:mm") 
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => { setSelectedContract(c); setIsPreviewOpen(true); }}><Eye className="mr-2 h-4 w-4" /> Visualizar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteContract(c.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Deletar</DropdownMenuItem>
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
          initialEditMode={startInEditMode}
          onClose={() => setIsPreviewOpen(false)}
          onSave={() => {}}
        />
      )}

      <ComparisonModal
        isOpen={isComparisonOpen}
        onOpenChange={setIsComparisonOpen}
        contracts={sortedContracts.filter(c => selectedContracts.includes(c.id))}
      />

      {/* Copy Custom Modal */}
      <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FilePlus2 className="h-5 w-5" />
              Cópia Customizada
            </DialogTitle>
            <DialogDescription>
              Revise e edite as entidades extraídas antes de gerar o documento no Google Docs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground">
              <p className="mb-2">Entidades detectadas nos documentos selecionados:</p>
              {Object.keys(editableEntities).length === 0 ? (
                <p className="italic text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                  Nenhuma entidade detectada. Preencha manualmente os campos necessários no documento.
                </p>
              ) : (
                <div className="max-h-[300px] overflow-y-auto space-y-2 bg-muted/30 p-3 rounded-lg">
                  {Object.entries(editableEntities).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground min-w-[120px] truncate">{key}:</span>
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => setEditableEntities(prev => ({ ...prev, [key]: e.target.value }))}
                        className="flex-1 text-sm px-2 py-1 bg-background border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
              <strong>Modelos selecionados:</strong> {selectedTemplates.length} modelo(s)
              <br />
              <strong>Documentos fonte:</strong> {selectedDocs.length} documento(s)
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleGenerateCopyWithEntities} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Gerar Documento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
