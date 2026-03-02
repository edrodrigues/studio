"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    Send,
    X,
    Minus,
    MessageCircle,
    Smile,
    Meh,
    Frown,
    Check,
    Sparkles,
    FolderOpen,
    ChevronDown,
    CheckCircle2,
    XCircle,
    Clock
} from "lucide-react";
import { handleGetPlaybookAssistance, handleSavePlaybookFeedback, checkDocumentIndexingStatus } from "@/lib/actions";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuthContext } from "@/context/auth-context";
import { useParams, useSearchParams } from "next/navigation";
import { useProject, useProjectDocuments } from "@/hooks/use-projects";
import { DocumentStatus } from "@/lib/types";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface Message {
    role: "user" | "model";
    content: string;
    timestamp: Date;
    feedback?: 'positive' | 'neutral' | 'negative';
}

function useCurrentProjectId(): string | undefined {
    const params = useParams();
    const searchParams = useSearchParams();
    const fromPath = params?.projectId as string | undefined;
    const fromQuery = searchParams.get('projectId');
    return fromPath || fromQuery || undefined;
}

export function PlaybookChatWidget() {
    const { user } = useAuthContext();
    const projectId = useCurrentProjectId();
    const { project } = useProject(projectId ?? null);
    const { documents } = useProjectDocuments(projectId ?? null);
    const indexedDocs = useMemo(() => documents?.filter(d => d.status === DocumentStatus.INDEXED) ?? [], [documents]);
    const [isOpen, setIsOpen] = useState(false);
    const [docsExpanded, setDocsExpanded] = useState(false);
    const [indexingStatus, setIndexingStatus] = useState<{
        isSynced: boolean;
        storeId: string | null;
        lastSyncedAt: Date | string | null;
    } | null>(null);
    const [lastAnswerUsedFileSearch, setLastAnswerUsedFileSearch] = useState<boolean | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "model",
            content: "Olá! Sou o **Alex**, seu especialista no Playbook de Contratos do V-Lab. Como posso ajudar você hoje?",
            timestamp: new Date(),
        }
    ]);
    const [input, setInput] = useState("");
    const [isPending, startTransition] = useTransition();
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollAreaRef.current) {
            const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (viewport) {
                viewport.scrollTop = viewport.scrollHeight;
            }
        }
    }, [messages, isOpen, isPending]);

    useEffect(() => {
        async function fetchIndexingStatus() {
            if (projectId) {
                const status = await checkDocumentIndexingStatus(projectId);
                setIndexingStatus(status);
            }
        }
        fetchIndexingStatus();
    }, [projectId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isPending) return;

        const userMessage: Message = {
            role: "user",
            content: input,
            timestamp: new Date()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        const currentInput = input;
        setInput("");

        startTransition(async () => {
            const history = newMessages.map(m => ({ role: m.role, content: m.content }));
            const res = await handleGetPlaybookAssistance({
                query: currentInput,
                history: history.slice(-6),
                projectId,
            });

            if (res.success && res.data) {
                const assistantMessage: Message = {
                    role: "model",
                    content: res.data.answer,
                    timestamp: new Date()
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setLastAnswerUsedFileSearch(res.data.usedFileSearch ?? false);
            } else {
                const errorMessage: Message = {
                    role: "model",
                    content: `Desculpe, ocorreu um erro: ${res.error || "Tente novamente mais tarde."}`,
                    timestamp: new Date()
                };
                setMessages((prev) => [...prev, errorMessage]);
            }
        });
    };

    const handleFeedback = (index: number, type: 'positive' | 'neutral' | 'negative') => {
        const message = messages[index];
        const prevUserMessage = messages[index - 1];
        const query = prevUserMessage?.role === 'user' ? prevUserMessage.content : 'N/A';

        setMessages(prev => {
            const next = [...prev];
            next[index] = { ...next[index], feedback: type };
            return next;
        });

        startTransition(async () => {
            await handleSavePlaybookFeedback({
                query,
                answer: message.content,
                feedback: type,
                userId: user?.uid,
                userName: user?.displayName || user?.email?.split('@')[0],
            });
        });
    };

    return (
        <>
            <AnimatePresence>
                {!isOpen && (
                    <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-6 right-6 z-50"
                    >
                        <Button
                            onClick={() => setIsOpen(true)}
                            className="h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground transition-transform hover:scale-110 active:scale-95 flex items-center justify-center p-0"
                        >
                            <MessageCircle className="h-6 w-6" />
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ y: 100, opacity: 0, scale: 0.95 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 100, opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                        className="fixed bottom-6 right-6 w-[400px] h-[600px] flex flex-col rounded-3xl overflow-hidden glass dark:glass-dark shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50"
                    >
                        {/* Header */}
                        <div className="bg-primary/90 p-5 flex flex-col gap-2 text-primary-foreground backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <Avatar className="h-12 w-12 border-2 border-white/20 shadow-lg">
                                            <AvatarImage src="/bot-avatar.png" alt="Alex" />
                                            <AvatarFallback className="bg-accent text-accent-foreground font-serif font-bold text-lg">AX</AvatarFallback>
                                        </Avatar>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-400 border-2 border-primary rounded-full"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="font-serif font-bold text-xl leading-none flex items-center gap-1.5">
                                            Alex <Sparkles className="h-3.5 w-3.5 text-accent" />
                                        </h2>
                                        <p className="text-[10px] opacity-70 mt-1 uppercase tracking-[0.2em] font-medium">IA do V-Lab Studio</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 hover:bg-white/10 text-white rounded-full"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 hover:bg-white/10 text-white rounded-full"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                            {projectId && (
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <Collapsible open={docsExpanded} onOpenChange={setDocsExpanded}>
                                        <CollapsibleTrigger className="w-full flex items-center gap-1.5 bg-white/10 hover:bg-white/15 transition-colors rounded-lg px-2.5 py-1.5 text-[10px] font-medium tracking-wider cursor-pointer">
                                            <FolderOpen className="h-3 w-3 shrink-0" />
                                            <span className="truncate flex-1 text-left">
                                                {project?.name ? (
                                                    <><span className="font-bold">{project.name}</span> — Playbook + Documentos</>
                                                ) : (
                                                    <>Contexto do projeto ativo — Playbook + Documentos</>
                                                )}
                                            </span>
                                            {indexedDocs.length > 0 && (
                                                <span className="bg-white/15 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums shrink-0">
                                                    {indexedDocs.length}
                                                </span>
                                            )}
                                            <ChevronDown className={cn(
                                                "h-3 w-3 shrink-0 transition-transform duration-200",
                                                docsExpanded && "rotate-180"
                                            )} />
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <div className="mt-1.5 bg-white/5 rounded-lg px-2.5 py-2 space-y-1 max-h-[120px] overflow-y-auto">
                                                {documents && documents.length > 0 ? (
                                                    documents.map(doc => (
                                                        <div key={doc.id} className="flex items-center gap-1.5 text-[10px] opacity-80">
                                                            {doc.status === DocumentStatus.INDEXED && (
                                                                <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-green-400" />
                                                            )}
                                                            {doc.status === DocumentStatus.PROCESSING && (
                                                                <Loader2 className="h-2.5 w-2.5 shrink-0 text-amber-400 animate-spin" />
                                                            )}
                                                            {doc.status === DocumentStatus.ERROR && (
                                                                <XCircle className="h-2.5 w-2.5 shrink-0 text-red-400" />
                                                            )}
                                                            {doc.status === DocumentStatus.UPLOADED && (
                                                                <Clock className="h-2.5 w-2.5 shrink-0 opacity-50" />
                                                            )}
                                                            <span className="truncate">{doc.name}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] opacity-50 italic">
                                                        Nenhum documento no projeto. Faça upload de documentos primeiro.
                                                    </p>
                                                )}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                </motion.div>
                            )}
                        </div>

                        {/* File Search Status Indicator */}
                        {projectId && indexingStatus && (
                            <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={cn(
                                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium",
                                    indexingStatus.isSynced && indexingStatus.storeId
                                        ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                )}
                            >
                                {indexingStatus.isSynced && indexingStatus.storeId ? (
                                    <>
                                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                                        <span>Documentos Indexados</span>
                                        {lastAnswerUsedFileSearch === true && (
                                            <span className="ml-1 opacity-60">(usando busca)</span>
                                        )}
                                        {lastAnswerUsedFileSearch === false && (
                                            <span className="ml-1 opacity-60">(playbook)</span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Clock className="h-3 w-3 shrink-0" />
                                        <span>Documentos Não Indexados</span>
                                    </>
                                )}
                            </motion.div>
                        )}

                        {/* Chat Area */}
                        <ScrollArea className="flex-1 p-5 bg-transparent" ref={scrollAreaRef}>
                            <div className="space-y-8 pb-4">
                                {messages.map((message, index) => (
                                    <motion.div
                                        initial={{ opacity: 0, x: message.role === "user" ? 20 : -20, y: 10 }}
                                        animate={{ opacity: 1, x: 0, y: 0 }}
                                        key={index}
                                        className={cn(
                                            "flex flex-col gap-1.5",
                                            message.role === "user" ? "items-end" : "items-start"
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                "max-w-[88%] rounded-2xl p-4 text-sm relative group transition-all",
                                                message.role === "user"
                                                    ? "bg-primary text-primary-foreground rounded-tr-none shadow-md"
                                                    : "bg-background/80 dark:bg-zinc-900/80 backdrop-blur-sm text-foreground rounded-tl-none border border-border/50 shadow-lg"
                                            )}
                                        >
                                            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words leading-relaxed font-outfit">
                                                {message.content}
                                            </ReactMarkdown>

                                            <span className={cn(
                                                "text-[9px] opacity-40 font-medium tracking-tight block mt-2.5",
                                                message.role === "user" ? "text-right" : "text-left"
                                            )}>
                                                {format(message.timestamp, "HH:mm")}
                                            </span>

                                            {message.role === "model" && index === messages.length - 1 && !isPending && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="mt-5 pt-4 border-t border-border/30"
                                                >
                                                    <p className="text-[10px] font-bold mb-3 text-center uppercase tracking-widest opacity-40">
                                                        {message.feedback ? "Feedback Recebido" : "Feedback"}
                                                    </p>
                                                    <div className="flex justify-center gap-6">
                                                        {message.feedback ? (
                                                            <div className="flex items-center gap-1.5 text-primary text-[11px] font-bold">
                                                                <Check className="h-3.5 w-3.5" /> Enviado com sucesso
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button onClick={() => handleFeedback(index, 'negative')} className="p-2.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/20 text-red-400 transition-all hover:scale-125">
                                                                    <Frown className="h-6 w-6" />
                                                                </button>
                                                                <button onClick={() => handleFeedback(index, 'neutral')} className="p-2.5 rounded-full hover:bg-amber-50 dark:hover:bg-amber-950/20 text-amber-400 transition-all hover:scale-125">
                                                                    <Meh className="h-6 w-6" />
                                                                </button>
                                                                <button onClick={() => handleFeedback(index, 'positive')} className="p-2.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-500 transition-all hover:scale-125">
                                                                    <Smile className="h-6 w-6" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                                {isPending && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-start gap-1"
                                    >
                                        <div className="bg-background/80 dark:bg-zinc-900/80 backdrop-blur-sm rounded-2xl rounded-tl-none p-5 shadow-lg border border-border/50">
                                            <div className="flex gap-2 items-center">
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-2 h-2 bg-primary rounded-full" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-2 h-2 bg-primary rounded-full" />
                                                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-2 h-2 bg-primary rounded-full" />
                                                <span className="text-[10px] text-muted-foreground ml-2 font-bold uppercase tracking-widest">Alex está analisando...</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input Area */}
                        <div className="p-5 border-t bg-background/50 backdrop-blur-md">
                            <form onSubmit={handleSubmit} className="flex items-end gap-3">
                                <div className="flex-1 bg-muted/80 backdrop-blur-sm rounded-2xl p-1.5 focus-within:ring-2 ring-primary/20 transition-all group">
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSubmit(e);
                                            }
                                        }}
                                        placeholder={projectId ? "Pergunte sobre o Playbook ou os documentos do projeto..." : "Tire suas dúvidas agora..."}
                                        className="w-full bg-transparent border-none focus:ring-0 text-sm p-3 resize-none max-h-32 min-h-[44px] font-outfit"
                                        disabled={isPending}
                                        rows={1}
                                    />
                                </div>
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={isPending || !input.trim()}
                                    className="h-12 w-12 rounded-2xl shadow-lg transition-all active:scale-90 bg-primary hover:bg-primary/90"
                                >
                                    {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </form>
                            <p className="text-[9px] text-center mt-3 text-muted-foreground italic font-medium">Alex pode cometer erros. Verifique informações importantes.</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
