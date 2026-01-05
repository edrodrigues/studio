
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
import { Bot, Loader2, Sparkles, Copy, Check, GitCompareArrows } from "lucide-react";
import { handleGetFeedback } from "@/lib/actions";
import { type Contract } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import { useToast } from "@/hooks/use-toast";

interface ComparisonModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: (Contract & { id: string })[];
}

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de IA especializado em análise comparativa de documentos jurídicos. Sua tarefa é revisar os contratos fornecidos e fornecer um feedback detalhado e comparativo.

Seu feedback deve incluir:
1.  **Análise de Diferenças e Similaridades:** Identifique as cláusulas ou seções que são idênticas, semelhantes ou significativamente diferentes entre os documentos.
2.  **Identificação de Inconsistências:** Aponte quaisquer contradições ou discrepâncias lógicas entre os contratos selecionados.
3.  **Sugestões de Melhoria e Harmonização:** Com base nas diferenças, ofereça sugestões para harmonizar os documentos, se aplicável, ou para melhorar a clareza e precisão.
4.  **Pontos de Atenção:** Destaque cláusulas ou termos em um documento que não estão presentes nos outros e que podem ter implicações importantes.

Organize seu feedback em seções claras usando Markdown. Seja objetivo, preciso e profissional. Inicie a análise listando os nomes dos contratos que estão sendo comparados.`;

const markdownToDataURI = (markdown: string, name: string) => {
  const base64 = Buffer.from(markdown).toString('base64');
  return {
    name,
    dataUri: `data:text/markdown;base64,${base64}`
  };
};

export function ComparisonModal({ isOpen, onOpenChange, contracts }: ComparisonModalProps) {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [feedback, setFeedback] = useState("");
  const [isPending, startTransition] = useTransition();
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerateFeedback = async () => {
    if (contracts.length < 2) {
      toast({
        variant: "destructive",
        title: "Seleção insuficiente",
        description: "Selecione ao menos dois contratos para comparar.",
      });
      return;
    }

    setFeedback("");
    startTransition(async () => {
      try {
        const documentsWithData = contracts.map(c =>
          markdownToDataURI(c.markdownContent, c.name)
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
      setTimeout(() => setHasCopied(false), 2000);
      toast({ title: "Feedback copiado para a área de transferência!" });
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFeedback("");
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows /> Comparar Contratos com IA
          </DialogTitle>
          <DialogDescription>
            Ajuste o prompt do sistema e clique em "Gerar Comparação" para que a IA analise os {contracts.length} contratos selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
          <div className="flex flex-col gap-4">
            <Label htmlFor="system-prompt" className="font-semibold">Prompt de Sistema</Label>
            <Textarea
              id="system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="flex-1 resize-none font-mono text-xs"
              placeholder="Descreva como a IA deve comparar os documentos..."
              disabled={isPending}
            />
            <Button onClick={handleGenerateFeedback} disabled={isPending || contracts.length < 2}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Gerar Comparação
                </>
              )}
            </Button>
          </div>

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
                    <p>O resultado da comparação aparecerá aqui.</p>
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
