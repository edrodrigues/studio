"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where } from "firebase/firestore";
import { FilePlus2, Loader2, CheckCircle2, FileText, LayoutTemplate, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { type ProjectDocument, type Template } from "@/lib/types";
import { handleGenerateContract } from "@/lib/actions";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

export default function GerarExportarPage() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [isGenerating, startTransition] = useTransition();

  // Selections
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  // Queries
  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    // In a real app, we'd filter by current project. 
    // For now, let's fetch all project documents accessible to the user or globally.
    return collection(firestore, 'projectDocuments');
  }, [user, firestore]);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'contractModels');
  }, [user, firestore]);

  const { data: documents, isLoading: isLoadingDocs } = useCollection<ProjectDocument>(projectDocsQuery);
  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);

  const handleDocToggle = (id: string) => {
    setSelectedDocs(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleTemplateToggle = (id: string) => {
    setSelectedTemplates(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    if (selectedDocs.length === 0 || selectedTemplates.length === 0) {
      toast({
        variant: "destructive",
        title: "Seleção incompleta",
        description: "Selecione ao menos um documento de contexto e um modelo de contrato."
      });
      return;
    }

    startTransition(async () => {
      try {
        toast({
          title: "Iniciando geração...",
          description: `Gerando ${selectedTemplates.length} documento(s) com base em ${selectedDocs.length} documento(s) de contexto.`
        });

        // Loop through selected templates and generate each
        // In a real implementation, handleGenerateContract might need to take templateId
        for (const templateId of selectedTemplates) {
          const template = templates?.find(t => t.id === templateId);
          const result = await handleGenerateContract({
            projectId: "default-project", // Should be dynamic
            userId: user?.uid,
            documentIds: selectedDocs,
          });

          if (!result.success) {
            throw new Error(`Erro ao gerar ${template?.name}: ${result.error}`);
          }
        }

        toast({
          title: "Sucesso!",
          description: "Os documentos foram gerados e salvos no seu projeto.",
        });

        // Redirect to a dashboard or a list of generated contracts if needed
        // router.push('/projects/default-project/contracts');
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erro na Geração",
          description: error instanceof Error ? error.message : "Falha ao gerar documentos."
        });
      }
    });
  };

  return (
    <div className="container py-10 max-w-6xl">
      <header className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
          Gerar Documentos
        </h1>
        <p className="mt-4 text-xl text-muted-foreground">
          Selecione o contexto e os modelos para criar novos contratos inteligentes.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Step 1: Context Selection */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="text-blue-500" /> 1. Documentos Iniciais
                </CardTitle>
                <CardDescription>
                  Selecione os documentos que servirão de base para a IA.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="h-6">
                {selectedDocs.length} selecionados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ScrollArea className="h-[400px] pr-4">
              {isLoadingDocs ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {documents?.map((doc) => (
                    <div 
                      key={doc.id}
                      onClick={() => handleDocToggle(doc.id)}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                        selectedDocs.includes(doc.id) ? "border-blue-500 bg-blue-50/50" : "border-transparent"
                      )}
                    >
                      <Checkbox checked={selectedDocs.includes(doc.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Sincronizado: {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                  {documents?.length === 0 && (
                    <p className="text-center text-muted-foreground py-10">Nenhum documento encontrado.</p>
                  )}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="bg-muted/50 border-t p-4">
            <p className="text-xs text-muted-foreground">
              Apenas documentos sincronizados com o File Search estão listados.
            </p>
          </CardFooter>
        </Card>

        {/* Step 2: Template Selection */}
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <LayoutTemplate className="text-purple-500" /> 2. Modelos de Contrato
                </CardTitle>
                <CardDescription>
                  Escolha quais tipos de contrato deseja gerar agora.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="h-6">
                {selectedTemplates.length} selecionados
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <ScrollArea className="h-[400px] pr-4">
              {isLoadingTemplates ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {templates?.map((template) => (
                    <div 
                      key={template.id}
                      onClick={() => handleTemplateToggle(template.id)}
                      className={cn(
                        "flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                        selectedTemplates.includes(template.id) ? "border-purple-500 bg-purple-50/50" : "border-transparent"
                      )}
                    >
                      <Checkbox checked={selectedTemplates.includes(template.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{template.name}</p>
                        <div className="flex gap-1 mt-1 overflow-x-hidden">
                          {template.contractTypes?.map(type => (
                            <Badge key={type} variant="outline" className="text-[10px] py-0 px-1">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
          <CardFooter className="bg-muted/50 border-t p-4">
            <p className="text-xs text-muted-foreground">
              Você pode gerenciar esses modelos na aba "Modelos".
            </p>
          </CardFooter>
        </Card>
      </div>

      <Separator className="my-10" />

      <div className="flex flex-col items-center justify-center gap-6 pb-20">
        <div className="text-center space-y-2">
          <h3 className="text-lg font-semibold">Resumo da Geração</h3>
          <p className="text-muted-foreground">
            {selectedTemplates.length} contratos serão criados usando {selectedDocs.length} documentos como referência.
          </p>
        </div>
        
        <Button 
          size="lg" 
          className="h-16 px-10 text-xl font-bold rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105"
          onClick={handleGenerate}
          disabled={selectedDocs.length === 0 || selectedTemplates.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-3 h-6 w-6 animate-spin" />
              Gerando Documentos...
            </>
          ) : (
            <>
              Gerar Documentos Selecionados
              <ArrowRight className="ml-3 h-6 w-6" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// Helper function for conditional classes
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
