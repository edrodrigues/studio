
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
import { fileToDataURI } from "@/lib/utils";
import { type UploadedFile } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";
import { AIFeedback } from "./ai-feedback";

interface FeedbackModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  files: UploadedFile[];
}

const DEFAULT_SYSTEM_PROMPT = `Você é um Auditor Sênior de Contratos de Inovação. Sua missão é validar a conformidade dos documentos apresentados.

Abaixo, você encontrará o CONTEÚDO DOS DOCUMENTOS e, ao final, uma REFERÊNCIA OBRIGATÓRIA (PLAYBOOK) com as regras de preenchimento.

## Seus Objetivos:
1.  **Conferência Cruzada:** Verifique se as informações batem entre os documentos (ex: Valor total na Planilha vs. Valor no Plano de Trabalho).
2.  **Validação via Playbook:** Para cada campo essencial listado no Playbook, verifique se o preenchimento no documento está adequado.

## Formato de Resposta (Obrigatório):
Use Markdown. Para cada ponto de verificação, use o seguinte padrão:
- **[Nome do Campo/Regra]**: 
  - Status: ✅ OK / ⚠️ Atenção / ❌ Erro
  - Análise: [Breve explicação comparando o documento com a regra do Playbook]
  - Sugestão: [Ação corretiva se necessário]

Seja direto e aponte apenas desvios relevantes ou confirmações importantes.`;


export function FeedbackModal({ isOpen, onOpenChange, files }: FeedbackModalProps) {
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

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFeedback(""); // Reset feedback when closing
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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
                  <>
                    <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                      {feedback}
                    </ReactMarkdown>
                    <AIFeedback className="border-t mt-8" />
                  </>
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
