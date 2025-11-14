
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc } from "firebase/firestore";
import { File, Loader2, Wand2, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Template } from "@/lib/types";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import useLocalStorage from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";


function EntitiesCard({ entities, isLoading }: { entities: Record<string, any> | null, isLoading: boolean }) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                </CardContent>
            </Card>
        );
    }
    
    if (!entities || Object.keys(entities).length === 0) {
        return (
            <Card className="bg-muted/30">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Nenhuma Entidade Encontrada
                    </CardTitle>
                    <CardDescription>
                       Vá para a aba "Documentos Iniciais", carregue seus arquivos e clique em "Extrair Entidades dos Documentos" para extrair as entidades.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Entidades para Preenchimento</CardTitle>
                <CardDescription>
                    Estas são as variáveis extraídas dos seus documentos iniciais que serão usadas para preencher o modelo.
                </CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto space-y-2 pr-6">
                {Object.entries(entities).map(([key, value]) => (
                     <div key={key} className="grid grid-cols-[1fr,2fr] gap-4 text-sm items-center">
                        <strong className="font-mono text-muted-foreground truncate text-right text-xs">{key}:</strong>
                        <span className="font-mono bg-muted rounded px-2 py-1 text-xs">{String(value)}</span>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}

function TemplatesList({
    templates,
    isLoading,
    selectedTemplateIds,
    onSelectionChange,
    generationStatus,
} : {
    templates: (Template & {id: string})[] | null,
    isLoading: boolean,
    selectedTemplateIds: string[],
    onSelectionChange: (id: string) => void,
    generationStatus: GenerationStatus
}) {

    if (isLoading) {
        return <div className="space-y-2">
            {[...Array(3)].map((_,i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
    }
    
    if (!templates || templates.length === 0) {
        return (
             <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                <File className="h-8 w-8 mb-4" />
                <p className="font-semibold">Nenhum modelo encontrado</p>
                <p className="text-sm">Crie um modelo na aba "Gerenciar Modelos" para começar.</p>
            </div>
        )
    }

    return (
         <div className="space-y-2">
            {templates.map(template => {
                const isSelected = selectedTemplateIds.includes(template.id);
                const isGenerating = generationStatus.generating && generationStatus.currentTemplateId === template.id;
                const isCompleted = generationStatus.completed.includes(template.id);
                
                return (
                 <Label
                    key={template.id}
                    htmlFor={`template-${template.id}`}
                    className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-4 cursor-pointer",
                        isSelected && !isGenerating && !isCompleted && "border-primary bg-primary/10 ring-2 ring-primary",
                        isGenerating && "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500",
                        isCompleted && "border-green-500 bg-green-500/10",
                        !isSelected && "bg-card hover:bg-muted"
                    )}
                >
                    <Checkbox
                        id={`template-${template.id}`}
                        checked={isSelected}
                        onCheckedChange={() => onSelectionChange(template.id)}
                        disabled={generationStatus.generating}
                    />
                    <File className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")}/>
                    <div className="flex-1">
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    </div>
                    {isGenerating && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                    {isCompleted && <CheckCircle className="h-5 w-5 text-green-500" />}
                </Label>
            )})}
        </div>
    )
}

interface GenerationStatus {
    generating: boolean;
    currentTemplateId: string | null;
    completed: string[];
    total: number;
}

export default function GerarNovoContratoPage() {
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const { user } = useUser();
  const { firestore } = useFirebase();
  const [storedEntities] = useLocalStorage<Record<string, any> | null>("extractedEntities", null);
  const [clientName] = useLocalStorage("clientName", "Cliente não especificado");
  const { toast } = useToast();
  const router = useRouter();
  const [isGenerating, startGeneration] = useTransition();
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>({
      generating: false,
      currentTemplateId: null,
      completed: [],
      total: 0
  });

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'contractModels');
  }, [user, firestore]);

  const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

  const handleSelectionChange = (id: string) => {
    setSelectedTemplateIds(prev =>
        prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };
  
  const handleGenerateContracts = () => {
    if (selectedTemplateIds.length === 0 || !templates || !user || !firestore) {
        toast({
            variant: "destructive",
            title: "Requisitos não atendidos",
            description: "Por favor, selecione pelo menos um modelo e certifique-se de que as entidades foram extraídas.",
        });
        return;
    }

    startGeneration(async () => {
        setGenerationStatus({
            generating: true,
            currentTemplateId: null,
            completed: [],
            total: selectedTemplateIds.length
        });
        
        let generatedCount = 0;

        for (const templateId of selectedTemplateIds) {
            setGenerationStatus(prev => ({ ...prev, currentTemplateId: templateId }));
            
            const selectedTemplate = templates.find(t => t.id === templateId);
            
            if (!selectedTemplate || !selectedTemplate.markdownContent) {
                 toast({
                    variant: "destructive",
                    title: `Erro no Modelo: ${selectedTemplate?.name}`,
                    description: "O modelo selecionado está vazio ou não pôde ser carregado. Pulando para o próximo.",
                });
                continue;
            }

            try {
                let filledContent = selectedTemplate.markdownContent;
                if (storedEntities) {
                    const placeholders = filledContent.match(/{{(.*?)}}|<(.*?)>/g) || [];
                    
                    const caseInsensitiveEntities = Object.entries(storedEntities.entities).reduce((acc, [key, value]) => {
                        acc[key.toLowerCase()] = value;
                        return acc;
                    }, {} as Record<string, any>);

                    placeholders.forEach(placeholder => {
                        const key = placeholder.replace(/{{|}}|'<'|'>'/g, '').trim().toLowerCase();
                        
                        if (Object.prototype.hasOwnProperty.call(caseInsensitiveEntities, key)) {
                            filledContent = filledContent.replace(new RegExp(placeholder, 'g'), String(caseInsensitiveEntities[key]));
                        } else {
                            const highlightedPlaceholder = `<span class="bg-yellow-200 text-yellow-800 font-mono px-1 py-0.5 rounded text-xs">${placeholder}</span>`;
                            filledContent = filledContent.replace(new RegExp(placeholder, 'g'), highlightedPlaceholder);
                        }
                    });
                }

                const newContract = {
                    contractModelId: selectedTemplate.id,
                    clientName: clientName,
                    filledData: JSON.stringify(storedEntities),
                    name: `Contrato de ${selectedTemplate.name} - ${clientName} - ${new Date().toLocaleDateString('pt-BR')}`,
                    markdownContent: filledContent,
                    createdAt: new Date().toISOString(),
                };

                const filledContractsRef = collection(firestore, 'users', user.uid, 'filledContracts');
                await addDoc(filledContractsRef, newContract);

                generatedCount++;
                setGenerationStatus(prev => ({...prev, completed: [...prev.completed, templateId] }));

            } catch (error) {
                console.error(`Error generating contract for template ${templateId}:`, error);
                toast({
                    variant: "destructive",
                    title: `Erro ao Gerar Contrato para ${selectedTemplate.name}`,
                    description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
                });
            }
        }
        
        setGenerationStatus({ generating: false, currentTemplateId: null, completed: [], total: 0 });

        if (generatedCount > 0) {
            toast({
                title: "Geração Concluída!",
                description: `${generatedCount} de ${selectedTemplateIds.length} contratos foram gerados com sucesso.`,
            });
            router.push('/gerar-exportar');
        } else {
            toast({
                variant: "destructive",
                title: "Nenhum Contrato Gerado",
                description: `Não foi possível gerar nenhum dos contratos selecionados.`,
            });
        }
    });
  };

  const buttonText = () => {
    if (isGenerating) {
        const completedCount = generationStatus.completed.length;
        const totalCount = generationStatus.total;
        return `Gerando ${completedCount + 1} de ${totalCount}...`;
    }
    return 'Gerar Contratos com IA';
  }


  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:leading-[1.1]">
          Gerar Contratos
        </h1>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground sm:text-lg">
          Selecione um ou mais modelos e use as entidades extraídas para gerar novas minutas de contrato preenchidas com IA.
        </p>
      </div>
      
      <div className="mt-12 mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">1. Entidades para Preenchimento</h2>
            <EntitiesCard entities={storedEntities?.entities ?? null} isLoading={!isClient} />
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-semibold">2. Escolha os Modelos</h2>
             <TemplatesList
                templates={templates}
                isLoading={isLoading}
                selectedTemplateIds={selectedTemplateIds}
                onSelectionChange={handleSelectionChange}
                generationStatus={generationStatus}
            />
        </div>
      </div>
      
       <section className="mt-12 flex flex-col items-center justify-center gap-4 py-8">
            <Button
                size="lg"
                onClick={handleGenerateContracts}
                disabled={selectedTemplateIds.length === 0 || !storedEntities || Object.keys(storedEntities).length === 0 || isGenerating || !isClient}
                className="w-full max-w-md"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {buttonText()}
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-5 w-5" />
                        {buttonText()}
                    </>
                )}
            </Button>
            <p className="text-xs text-muted-foreground">
                Os contratos serão salvos e você será redirecionado para a lista de revisão.
            </p>
        </section>
    </div>
  );
}
