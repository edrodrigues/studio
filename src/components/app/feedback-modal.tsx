
"use client";

import { useState, useTransition } from "react";
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
import { Bot, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { handleGetFeedback } from "@/lib/actions";
import { fileToDataURI } from "@/app/(main)/documentos-iniciais/page";
import { type UploadedFile } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: UploadedFile[];
}

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de IA especializado em análise de documentos para contratos de cooperação. Sua tarefa é revisar os documentos fornecidos e fornecer um feedback detalhado e construtivo.

Seu feedback deve incluir:
1.  **Análise de Completude:** Verifique se todas as informações necessárias estão presentes nos documentos (ex: objeto, metas, cronograma, orçamento detalhado).
2.  **Identificação de Inconsistências:** Aponte quaisquer contradições entre os diferentes documentos (ex: cronograma do plano de trabalho vs. termo de execução).
3.  **Sugestões de Melhoria:** Ofereça sugestões claras para melhorar a clareza, precisão e conformidade dos documentos.
4.  **Pontos de Atenção:** Destaque cláusulas ou seções que podem gerar ambiguidades ou riscos futuros.

Organize seu feedback em seções claras usando Markdown. Seja objetivo e profissional.`;


export function FeedbackModal({ isOpen, onClose, files }: FeedbackModalProps) {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerateFeedback = async () => {
    if (files.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum arquivo",
        description: "Carregue ao menos um documento para obter feedback.",
      });
      return;
    }

    setFeedback("");
    startTransition(async () => {
      try {
        const documentsWithData = await Promise.all(
          files.map(async ({ file }) => ({
            name: file.name,
            dataUri: await fileToDataURI(file),
          }))
        );

        const result = await handleGetFeedback({
          systemPrompt,
          documents: documentsWithData,
        });

        if (result.success && result.data?.feedback) {
          setFeedback(result.data.feedback);
        } else {
          throw new Error(result.error || "A resposta da IA não contém feedback.");
        }
      } catch (error) {
        console.error("Error getting feedback:", error);
        const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro desconhecido ao gerar o feedback.";
        setFeedback(`**Erro ao gerar feedback:**\n\n${errorMessage}`);
        toast({
            variant: "destructive",
            title: "Erro na Geração do Feedback",
            description: errorMessage,
        });
      }
    });
  };

  const handleCopy = () => {
    if (!feedback) return;
    navigator.clipboard.writeText(feedback).then(() => {
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000); // Reset after 2 seconds
        toast({ title: "Feedback copiado para a área de transferência!" });
    });
  };

  const handleClose = () => {
    setFeedback(""); // Reset feedback when closing
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot /> Feedback de IA sobre os Documentos
          </DialogTitle>
          <DialogDescription>
            Ajuste o prompt do sistema se desejar e clique em "Gerar Feedback" para que a IA analise os documentos carregados.
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
                    placeholder="Descreva como a IA deve analisar os documentos..."
                    disabled={isPending}
                />
                 <Button onClick={handleGenerateFeedback} disabled={isPending || files.length === 0}>
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analisando...
                        </>
                    ) : (
                        <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Gerar Feedback
                        </>
                    )}
                </Button>
            </div>
            
            {/* Right Column: Feedback Display */}
            <div className="flex flex-col gap-4 min-h-0">
                <div className="flex justify-between items-center">
                    <Label htmlFor="feedback-output" className="font-semibold">Resultado da Análise</Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopy}
                        disabled={!feedback}
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
                <ScrollArea id="feedback-output" className="flex-1 rounded-md border bg-muted/50" role="status">
                   <div className="p-4" aria-live="polite">
                     {isPending && !feedback && (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                     )}
                     {feedback ? (
                        <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                            {feedback}
                        </ReactMarkdown>
                     ) : !isPending && (
                        <div className="flex items-center justify-center h-full text-center text-muted-foreground p-8">
                            <p>O feedback da IA aparecerá aqui.</p>
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
