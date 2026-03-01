"use client";

import { useState, useMemo, useTransition, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, addDoc, doc, deleteDoc, query, where } from "firebase/firestore";
import { 
  FilePlus2, Loader2, CheckCircle2, FileText, LayoutTemplate, 
  ArrowRight, Wand2, Eye, Pencil, Trash2, MoreHorizontal, 
  ExternalLink, GitCompareArrows, Download
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
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { type ProjectDocument, type Template, type Contract } from "@/lib/types";
import { handleGenerateContract } from "@/lib/actions";
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

const EntityEditModal = dynamic(() => import('@/components/app/entity-edit-modal').then(mod => mod.EntityEditModal), { ssr: false });
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

  // Selection States
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  
  // Modal States
  const [isEntityModalOpen, setIsEntityModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [startInEditMode, setStartInEditMode] = useState(false);

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

  const handleStartGeneration = () => {
    if (selectedTemplates.length === 0 || !templates) {
      toast({ variant: "destructive", title: "Selecione ao menos um modelo." });
      return;
    }

    const hasGoogleDoc = selectedTemplates.some(id => {
      const t = templates.find(temp => temp.id === id);
      return t?.googleDocLink && extractGoogleDocId(t.googleDocLink);
    });

    if (hasGoogleDoc && !accessToken) {
      toast({
        title: "Login com Google Necessário",
        description: "Conecte sua conta para gerar no Google Docs.",
        action: <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>Conectar</Button>,
      });
      return;
    }

    setIsEntityModalOpen(true);
  };

  const handleConfirmGeneration = (editedEntities: Record<string, any>) => {
    if (!user || !firestore || !templates) return;
    setIsEntityModalOpen(false);

    startTransition(async () => {
      let successCount = 0;
      
      for (const templateId of selectedTemplates) {
        const template = templates.find(t => t.id === templateId);
        if (!template) continue;

        const googleDocId = template.googleDocLink ? extractGoogleDocId(template.googleDocLink) : null;

        try {
          if (googleDocId && accessToken) {
            // Google Docs Flow
            const result = await generateContractDoc(
              accessToken, googleDocId, template.name, 
              clientName || "Cliente", editedEntities, currentProjectId
            );

            await addDoc(collection(firestore, 'users', user.uid, 'filledContracts'), {
              projectId: currentProjectId,
              contractModelId: template.id,
              clientName: clientName || "Cliente",
              filledData: JSON.stringify({ entities: editedEntities }),
              name: result.fileName,
              markdownContent: "",
              googleDocLink: result.documentLink,
              googleDocId: result.documentId,
              createdAt: new Date().toISOString(),
            });
          } else {
            // Markdown Flow
            const result = await handleGenerateContract({
              projectId: currentProjectId,
              userId: user.uid,
              documentIds: selectedDocs,
            });

            if (result.success) {
              await addDoc(collection(firestore, 'users', user.uid, 'filledContracts'), {
                projectId: currentProjectId,
                contractModelId: template.id,
                clientName: clientName || "Cliente",
                filledData: JSON.stringify({ entities: editedEntities }),
                name: `Contrato de ${template.name}`,
                markdownContent: result.data?.contractDraft || "",
                createdAt: new Date().toISOString(),
              });
            }
          }
          successCount++;
        } catch (e) {
          console.error(e);
        }
      }

      toast({ title: "Geração Concluída!", description: `${successCount} documentos gerados.` });
      setActiveTab("revisar");
    });
  };

  const handleDeleteContract = async (id: string) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'filledContracts', id));
      toast({ title: "Documento excluído." });
    } catch (e) {
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
    <div className="container py-10 max-w-6xl">
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
                          <div className="flex-1 truncate text-sm font-medium">{doc.name}</div>
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
            <Button size="lg" className="h-16 px-12 text-lg font-bold rounded-full" onClick={handleStartGeneration} disabled={selectedTemplates.length === 0 || isGenerating}>
              {isGenerating ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
              Gerar Documentos com IA
            </Button>
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
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
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

      <EntityEditModal
        isOpen={isEntityModalOpen}
        onClose={() => setIsEntityModalOpen(false)}
        onConfirm={handleConfirmGeneration}
        selectedTemplates={templates?.filter(t => selectedTemplates.includes(t.id)) || []}
        extractedEntities={{}} // Context comes from File Search
      />

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
