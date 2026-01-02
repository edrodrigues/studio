
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Bot, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { handleAnalyzeDocumentConsistency } from "@/lib/actions";
import { type UploadedFile } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

interface ConsistencyAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    files: UploadedFile[];
}

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de IA especializado em análise de consistência de documentos para contratos de cooperação. Sua tarefa é comparar os documentos fornecidos e verificar se eles estão alinhados entre si.

Analise especificamente os seguintes aspectos:
1. **Prazos**: Verifique se os cronogramas e datas estão consistentes entre os documentos.
2. **Valores**: Compare os valores monetários e orçamentos para garantir que estejam alinhados.
3. **Quantidade de Bolsas**: Verifique se a quantidade de bolsas mencionada é consistente.
4. **Meses das Bolsas**: Confirme se os períodos das bolsas estão alinhados entre os documentos.

Você DEVE retornar:
- **consistencyPercentage**: Um número de 0 a 100 indicando o percentual de alinhamento geral entre os documentos.
- **analysis**: Uma análise detalhada em Markdown explicando os pontos de alinhamento e desalinhamento encontrados.
- **suggestions**: Uma lista de sugestões específicas e práticas para melhorar o alinhamento entre os documentos.

Seja objetivo, profissional e forneça exemplos específicos quando possível.`;

export function ConsistencyAnalysisModal({ isOpen, onClose, files }: ConsistencyAnalysisModalProps) {
    const router = useRouter();
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
    const [consistencyPercentage, setConsistencyPercentage] = useState<number | null>(null);
    const [analysis, setAnalysis] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const [hasCopied, setHasCopied] = useState(false);
    const { toast } = useToast();

    const handleGenerateAnalysis = async () => {
        if (files.length < 2) {
            toast({
                variant: "destructive",
                title: "Documentos insuficientes",
                description: "Carregue ao menos dois documentos para análise de consistência.",
            });
            return;
        }

        setConsistencyPercentage(null);
        setAnalysis("");
        setSuggestions([]);

        startTransition(async () => {
            try {
                const formData = new FormData();
                formData.append("systemPrompt", systemPrompt);

                files.forEach(({ file }) => {
                    formData.append("documents", file);
                });

                const result = await handleAnalyzeDocumentConsistency(formData);

                if (result.success && result.data) {
                    setConsistencyPercentage(result.data.consistencyPercentage);
                    setAnalysis(result.data.analysis);
                    setSuggestions(result.data.suggestions);
                } else {
                    throw new Error(result.error || "A resposta da IA não contém análise.");
                }
            } catch (error) {
                console.error("Error getting consistency analysis:", error);
                const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao gerar a análise.";
                setAnalysis(`**Erro ao gerar análise:**\n\n${errorMessage}`);
                toast({
                    variant: "destructive",
                    title: "Erro na Análise",
                    description: errorMessage,
                });
            }
        });
    };

    const handleCopy = () => {
        const fullText = `# Análise de Consistência de Documentos\n\n## Percentual de Alinhamento: ${consistencyPercentage}%\n\n## Análise\n\n${analysis}\n\n## Sugestões de Melhoria\n\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

        navigator.clipboard.writeText(fullText).then(() => {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
            toast({ title: "Análise copiada para a área de transferência!" });
        });
    };

    const handleClose = () => {
        setConsistencyPercentage(null);
        setAnalysis("");
        setSuggestions([]);
        onClose();
        router.push('/gerar-novo');
    };

    const getConsistencyColor = (percentage: number) => {
        if (percentage >= 80) return "text-green-600 dark:text-green-400";
        if (percentage >= 60) return "text-yellow-600 dark:text-yellow-400";
        return "text-red-600 dark:text-red-400";
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot /> Análise de Consistência de Documentos
                    </DialogTitle>
                    <DialogDescription>
                        Ajuste o prompt do sistema se desejar e clique em "Gerar Análise" para que a IA compare os documentos carregados.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
                    {/* Left Column: Prompt Editor */}
                    <div className="flex flex-col gap-4">
                        <Label htmlFor="system-prompt" className="font-semibold">Prompt de Sistema</Label>
                        <Textarea
                            id="system-prompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="flex-1 resize-none font-mono text-xs"
                            placeholder="Descreva como a IA deve analisar a consistência dos documentos..."
                            disabled={isPending}
                        />
                        <Button onClick={handleGenerateAnalysis} disabled={isPending || files.length < 2}>
                            {isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analisando...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Gerar Análise
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Right Column: Analysis Display */}
                    <div className="flex flex-col gap-4 min-h-0">
                        <div className="flex justify-between items-center">
                            <Label className="font-semibold">Resultado da Análise</Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                disabled={!analysis || consistencyPercentage === null}
                            >
                                {hasCopied ? (
                                    <>
                                        <Check className="mr-2 h-4 w-4 text-green-500" /> Copiado!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="mr-2 h-4 w-4" /> Copiar
                                    </>
                                )}
                            </Button>
                        </div>

                        <ScrollArea className="flex-1 rounded-md border bg-muted/50" role="status">
                            <div className="p-4" aria-live="polite">
                                {isPending && !analysis && (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                )}

                                {consistencyPercentage !== null && (
                                    <div className="mb-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold">Percentual de Alinhamento</span>
                                            <span className={`text-2xl font-bold ${getConsistencyColor(consistencyPercentage)}`}>
                                                {consistencyPercentage}%
                                            </span>
                                        </div>
                                        <Progress value={consistencyPercentage} className="h-2" />
                                    </div>
                                )}

                                {analysis && (
                                    <div className="mb-6">
                                        <h3 className="text-sm font-semibold mb-2">Análise Detalhada</h3>
                                        <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                                            {analysis}
                                        </ReactMarkdown>
                                    </div>
                                )}

                                {suggestions.length > 0 && (
                                    <div>
                                        <h3 className="text-sm font-semibold mb-2">Sugestões de Melhoria</h3>
                                        <ul className="list-disc list-inside space-y-1 text-sm">
                                            {suggestions.map((suggestion, index) => (
                                                <li key={index}>{suggestion}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {!isPending && !analysis && (
                                    <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                                        <p>A análise de consistência aparecerá aqui.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={handleClose}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
