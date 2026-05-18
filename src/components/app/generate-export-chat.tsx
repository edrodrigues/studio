"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { Loader2, Send, Sparkles, CheckCircle2, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthContext } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { generateContractGenerationStep } from "@/lib/actions/generate-export-actions";
import type { Contract } from "@/lib/types";

interface ChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: Date;
  action?: "proceed" | "open" | "done";
  actionLabel?: string;
  documentLink?: string;
}

interface GenerateExportChatProps {
  projectId: string | null;
  templateId: string | null;
  onGenerationComplete?: (contract: Contract) => void;
}

type GenerationStep = "idle" | "copy" | "customize" | "open" | "complete";

export function GenerateExportChat({ projectId, templateId, onGenerationComplete }: GenerateExportChatProps) {
  const { user } = useAuthContext();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content: "Olá! Selecione um projeto e um modelo de documento acima. Quando estiver pronto, clique em **Iniciar Geração** para começarmos.",
      timestamp: new Date(),
    },
  ]);
  const [isPending, setIsPending] = useState(false);
  const [currentStep, setCurrentStep] = useState<GenerationStep>("idle");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentLink, setDocumentLink] = useState<string | null>(null);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isPending]);

  const handleStartGeneration = async () => {
    if (!user || !projectId || !templateId) return;

    setCurrentStep("copy");
    setIsPending(true);

    const userMessage: ChatMessage = {
      role: "user",
      content: "Iniciar geração do documento",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const copyResult = await generateContractGenerationStep({
        userId: user.uid,
        projectId,
        templateId,
        step: "copy",
      });

      if (!copyResult.success) {
        setMessages((prev) => [...prev, {
          role: "model",
          content: `Erro ao copiar o documento: ${copyResult.error}`,
          timestamp: new Date(),
        }]);
        setIsPending(false);
        setCurrentStep("idle");
        return;
      }

      setDocumentId(copyResult.documentId || null);
      setDocumentLink(copyResult.documentLink || null);

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento copiado para o seu Google Drive com sucesso: **${copyResult.fileName}**`,
        timestamp: new Date(),
        action: "proceed",
        actionLabel: "Personalizar documento",
      }]);
      setIsPending(false);
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: "model",
        content: `Erro inesperado: ${error instanceof Error ? error.message : "Tente novamente."}`,
        timestamp: new Date(),
      }]);
      setIsPending(false);
      setCurrentStep("idle");
    }
  };

  const handleProceed = async () => {
    if (!user || !projectId || !templateId || !documentId) return;

    setIsPending(true);

    if (currentStep === "copy") {
      setCurrentStep("customize");

      const customizeResult = await generateContractGenerationStep({
        userId: user.uid,
        projectId,
        templateId,
        step: "customize",
        documentId,
      });

      if (!customizeResult.success) {
        setMessages((prev) => [...prev, {
          role: "model",
          content: `Erro ao personalizar o documento: ${customizeResult.error}`,
          timestamp: new Date(),
        }]);
        setIsPending(false);
        return;
      }

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento personalizado com sucesso. **${customizeResult.fieldsFilled}** campos foram preenchidos com base nos documentos do projeto.`,
        timestamp: new Date(),
        action: "open",
        actionLabel: "Abrir para inspeção",
      }]);
      setIsPending(false);
    } else if (currentStep === "customize") {
      setCurrentStep("open");

      setMessages((prev) => [...prev, {
        role: "model",
        content: `Documento aberto no Google Docs. Clique no link abaixo para inspecionar:`,
        timestamp: new Date(),
        action: "done",
        actionLabel: "Concluído",
        documentLink: documentLink || undefined,
      }]);

      setCurrentStep("complete");
      setIsPending(false);

      if (onGenerationComplete && documentId) {
        onGenerationComplete({
          id: "",
          name: `Contrato gerado - ${new Date().toLocaleDateString("pt-BR")}`,
          googleDocId: documentId,
          googleDocLink: documentLink || "",
          projectId,
          contractModelId: templateId,
          createdAt: new Date().toISOString(),
        } as Contract);
      }
    }
  };

  const canStart = projectId && templateId && currentStep === "idle";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
      <div className="bg-primary/95 p-4 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h2 className="flex items-center gap-1.5 font-serif text-lg font-bold">
              Alex
              <Sparkles className="h-3.5 w-3.5 text-accent" />
            </h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/75">
              {currentStep === "idle" && "Assistente de Geração"}
              {currentStep === "copy" && "Passo 1: Copiando documento..."}
              {currentStep === "customize" && "Passo 2: Personalizando..."}
              {currentStep === "open" && "Passo 3: Abrindo documento..."}
              {currentStep === "complete" && "Geração concluída"}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea ref={scrollAreaRef} className="flex-1 bg-muted/10 p-4">
        <div className="space-y-6 pb-2">
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              initial={{ opacity: 0, x: message.role === "user" ? 20 : -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              className={cn("flex flex-col gap-2", message.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[92%] rounded-2xl p-4 text-sm shadow-sm",
                  message.role === "user"
                    ? "rounded-tr-none bg-primary text-primary-foreground"
                    : "rounded-tl-none border border-border/60 bg-background text-foreground"
                )}
              >
                <ReactMarkdown className="prose prose-sm max-w-none break-words leading-6 dark:prose-invert">
                  {message.content}
                </ReactMarkdown>
                <span className={cn("mt-2 block text-[10px] opacity-60", message.role === "user" ? "text-right" : "text-left")}>
                  {format(message.timestamp, "HH:mm")}
                </span>

                {message.action && message.role === "model" && index === messages.length - 1 && (
                  <div className="mt-4 border-t border-border/40 pt-3">
                    {message.documentLink && (
                      <Button variant="outline" size="sm" asChild className="mb-3 w-full">
                        <a href={message.documentLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Docs
                        </a>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleProceed}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {message.action === "done" ? (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          {message.actionLabel}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start">
              <div className="rounded-2xl rounded-tl-none border border-border/60 bg-background p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Alex está trabalhando...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t bg-background/95 p-4 backdrop-blur-md">
        {canStart ? (
          <Button size="lg" className="w-full h-12 rounded-xl" onClick={handleStartGeneration}>
            <Sparkles className="mr-2 h-5 w-5" />
            Iniciar Geração
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            {currentStep === "complete"
              ? "Geração concluída. Selecione outro projeto/modelo para gerar um novo documento."
              : "Aguardando seleção de projeto e modelo..."}
          </p>
        )}
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          Alex pode cometer erros. Verifique informações importantes.
        </p>
      </div>
    </div>
  );
}
