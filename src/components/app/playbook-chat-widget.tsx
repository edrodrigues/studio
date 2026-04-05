"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { useParams, useSearchParams } from "next/navigation";
import {
  Check,
  Frown,
  Loader2,
  Meh,
  MessageCircle,
  Minus,
  Send,
  Smile,
  Sparkles,
  X,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthContext } from "@/context/auth-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { handleGetPlaybookAssistance, handleSavePlaybookFeedback } from "@/lib/actions";

interface Message {
  role: "user" | "model";
  content: string;
  timestamp: Date;
  feedback?: "positive" | "neutral" | "negative";
}

function useCurrentProjectId(): string | undefined {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromPath = params?.projectId as string | undefined;
  const fromQuery = searchParams.get("projectId");
  return fromPath || fromQuery || undefined;
}

export function PlaybookChatWidget() {
  const { user } = useAuthContext();
  const isMobile = useIsMobile();
  const projectId = useCurrentProjectId();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      content: "Olá! Sou o **Alex**, seu especialista no Playbook de Contratos do V-Lab. Como posso ajudar você hoje?",
      timestamp: new Date(),
    },
  ]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isOpen, isPending]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isPending) return;

    const userMessage: Message = { role: "user", content: input, timestamp: new Date() };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");

    startTransition(async () => {
      const history = nextMessages.map((message) => ({ role: message.role, content: message.content }));
      const response = await handleGetPlaybookAssistance({
        query: userMessage.content,
        history: history.slice(-6),
        projectId,
      });

      const message: Message = {
        role: "model",
        content: response.success && response.data
          ? response.data.answer
          : `Desculpe, ocorreu um erro: ${response.error || "Tente novamente mais tarde."}`,
        timestamp: new Date(),
      };

      setMessages((current) => [...current, message]);
    });
  };

  const handleFeedback = (index: number, type: "positive" | "neutral" | "negative") => {
    const message = messages[index];
    const previousUserMessage = messages[index - 1];
    const query = previousUserMessage?.role === "user" ? previousUserMessage.content : "N/A";

    setMessages((current) => {
      const next = [...current];
      next[index] = { ...next[index], feedback: type };
      return next;
    });

    startTransition(async () => {
      await handleSavePlaybookFeedback({
        query,
        answer: message.content,
        feedback: type,
        userId: user?.uid,
        userName: user?.displayName || user?.email?.split("@")[0],
      });
    });
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen ? (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary p-0 text-primary-foreground shadow-2xl transition-transform hover:scale-110 active:scale-95"
              aria-label="Abrir assistente Alex"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen ? (
          <motion.section
            initial={{ y: 100, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "circOut" }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-border/60 bg-background shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
              isMobile
                ? "inset-x-0 bottom-0 h-[min(85svh,46rem)] rounded-t-[1.75rem] safe-bottom"
                : "bottom-6 right-6 h-[min(75svh,42rem)] w-[min(26rem,calc(100vw-2rem))] rounded-3xl"
            )}
          >
            <div className="bg-primary/95 p-4 text-primary-foreground sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 border border-white/20 bg-white/10">
                    <AvatarFallback className="bg-transparent text-primary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="flex items-center gap-1.5 font-serif text-lg font-bold">
                      Alex
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                    </h2>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/75">IA do V-Lab Studio</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                    onClick={() => setIsOpen(false)}
                    aria-label="Minimizar assistente"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                    onClick={() => setIsOpen(false)}
                    aria-label="Fechar assistente"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <ScrollArea ref={scrollAreaRef} className="flex-1 bg-muted/10 p-4 sm:p-5">
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

                      {message.role === "model" && index === messages.length - 1 && !isPending ? (
                        <div className="mt-4 border-t border-border/40 pt-3">
                          <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            {message.feedback ? "Feedback Recebido" : "Feedback"}
                          </p>
                          {message.feedback ? (
                            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary">
                              <Check className="h-3.5 w-3.5" />
                              Enviado com sucesso
                            </div>
                          ) : (
                            <div className="flex justify-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleFeedback(index, "negative")}
                                className="rounded-full p-2.5 text-red-400 transition-all hover:scale-110 hover:bg-red-50 dark:hover:bg-red-950/20"
                                aria-label="Marcar resposta como negativa"
                              >
                                <Frown className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFeedback(index, "neutral")}
                                className="rounded-full p-2.5 text-amber-400 transition-all hover:scale-110 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                                aria-label="Marcar resposta como neutra"
                              >
                                <Meh className="h-5 w-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleFeedback(index, "positive")}
                                className="rounded-full p-2.5 text-emerald-500 transition-all hover:scale-110 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                                aria-label="Marcar resposta como positiva"
                              >
                                <Smile className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </motion.div>
                ))}

                {isPending ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start">
                    <div className="rounded-2xl rounded-tl-none border border-border/60 bg-background p-4 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Alex está analisando…</span>
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </ScrollArea>

            <div className="border-t bg-background/95 p-4 backdrop-blur-md sm:p-5">
              <form onSubmit={handleSubmit} className="flex items-end gap-3">
                <div className="flex-1 rounded-2xl border border-border/70 bg-muted/60 p-1.5 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        handleSubmit(event);
                      }
                    }}
                    placeholder="Tire suas dúvidas agora…"
                    className="min-h-[44px] max-h-32 w-full resize-none border-none bg-transparent p-3 text-sm focus:ring-0"
                    disabled={isPending}
                    rows={1}
                  />
                </div>
                <Button
                  type="submit"
                  size="icon"
                  disabled={isPending || !input.trim()}
                  className="h-12 w-12 rounded-2xl bg-primary hover:bg-primary/90"
                  aria-label="Enviar mensagem"
                >
                  {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </form>
              <p className="mt-3 text-center text-[10px] text-muted-foreground">Alex pode cometer erros. Verifique informações importantes.</p>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  );
}
