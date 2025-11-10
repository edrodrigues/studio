
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection } from "firebase/firestore";
import { File, Loader2, Wand2, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Template } from "@/lib/types";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import useLocalStorage from "@/hooks/use-local-storage";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";


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
                       Vá para a aba "Documentos Iniciais", carregue seus arquivos e clique em "Indexar Documentos" para extrair as entidades.
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
    selectedTemplateId,
    onSelectTemplate
} : {
    templates: (Template & {id: string})[] | null,
    isLoading: boolean,
    selectedTemplateId: string | null,
    onSelectTemplate: (id: string) => void
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
            {templates.map(template => (
                 <button
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3",
                        selectedTemplateId === template.id
                            ? "border-primary bg-primary/10 ring-2 ring-primary"
                            : "bg-card hover:bg-muted"
                    )}
                >
                    <File className="h-5 w-5 text-primary"/>
                    <div className="flex-1">
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{template.description}</p>
                    </div>
                    {selectedTemplateId === template.id && <ArrowRight className="h-5 w-5 text-primary" />}
                </button>
            ))}
        </div>
    )
}

export default function GerarNovoContratoPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { user } = useUser();
  const { firestore } = useFirebase();
  const [storedEntities] = useLocalStorage<Record<string, any> | null>("extractedEntities", null);
  const { toast } = useToast();
  const router = useRouter();
  const [isGenerating, startGeneration] = useTransition();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'contractModels');
  }, [user, firestore]);

  const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

  const handleGenerateContract = () => {
    if (!selectedTemplateId || !templates || !user || !firestore) {
        toast({
            variant: "destructive",
            title: "Requisitos não atendidos",
            description: "Por favor, selecione um modelo e certifique-se de que as entidades foram extraídas.",
        });
        return;
    }

    const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
    
    if (!selectedTemplate || !selectedTemplate.markdownContent) {
        toast({
            variant: "destructive",
            title: "Erro no Modelo",
            description: "O modelo selecionado está vazio ou não pôde ser carregado. Tente salvar o modelo novamente.",
        });
        return;
    }

    startGeneration(async () => {
        try {
            let filledContent = selectedTemplate.markdownContent;
            
            const placeholders = filledContent.match(/{{(.*?)}}/g) || [];
            
            placeholders.forEach(placeholder => {
                const key = placeholder.replace(/{{|}}/g, '').trim();
                if (storedEntities && Object.prototype.hasOwnProperty.call(storedEntities, key)) {
                    filledContent = filledContent.replace(new RegExp(placeholder, 'g'), String(storedEntities[key]));
                } else {
                    const highlightedPlaceholder = `<span class="bg-yellow-200 text-yellow-800 font-mono px-1 py-0.5 rounded text-xs">${placeholder}</span>`;
                    filledContent = filledContent.replace(new RegExp(placeholder, 'g'), highlightedPlaceholder);
                }
            });
            
            const clientName = storedEntities?.NOME_DA_ENTIDADE_PARCEIRA || 'Cliente não especificado';

            const newContract = {
                contractModelId: selectedTemplate.id,
                clientName: clientName,
                filledData: JSON.stringify(storedEntities),
                name: `Contrato de ${selectedTemplate.name} - ${clientName} - ${new Date().toLocaleDateString('pt-BR')}`,
                markdownContent: filledContent,
                createdAt: new Date().toISOString(),
            };

            const filledContractsRef = collection(firestore, 'users', user.uid, 'filledContracts');
            const docRef = await addDocumentNonBlocking(filledContractsRef, newContract);
            
            router.push(`/preencher/${docRef.id}`);

        } catch (error) {
            console.error("Error generating contract:", error);
            toast({
                variant: "destructive",
                title: "Erro ao Gerar Contrato",
                description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
            });
        }
    });
  };

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:leading-[1.1]">
          Gerar Novo Contrato
        </h1>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground sm:text-lg">
          Selecione um modelo e use as entidades extraídas para gerar uma nova minuta de contrato preenchida com IA.
        </p>
      </div>
      
      <div className="mt-12 mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">1. Entidades para Preenchimento</h2>
            <EntitiesCard entities={storedEntities} isLoading={!isClient} />
        </div>

        <div className="space-y-6">
            <h2 className="text-xl font-semibold">2. Escolha um Modelo</h2>
             <TemplatesList
                templates={templates}
                isLoading={isLoading}
                selectedTemplateId={selectedTemplateId}
                onSelectTemplate={setSelectedTemplateId}
            />
        </div>
      </div>
      
       <section className="mt-12 flex flex-col items-center justify-center gap-4 py-8">
            <Button
                size="lg"
                onClick={handleGenerateContract}
                disabled={!selectedTemplateId || !storedEntities || Object.keys(storedEntities).length === 0 || isGenerating || !isClient}
                className="w-full max-w-md"
            >
                {isGenerating ? (
                    <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Gerando Minuta...
                    </>
                ) : (
                    <>
                        <Wand2 className="mr-2 h-5 w-5" />
                        Gerar Contrato com IA
                    </>
                )}
            </Button>
            <p className="text-xs text-muted-foreground">
                O contrato será salvo e você será redirecionado para o editor.
            </p>
        </section>
    </div>
  );
}
