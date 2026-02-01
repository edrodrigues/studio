
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Bot,
    Loader2,
    Send,
    X,
    Minus,
    MessageCircle,
    Smile,
    Meh,
    Frown,
    Check,
    Sparkles
} from "lucide-react";
import { handleGetPlaybookAssistance, handleSavePlaybookFeedback } from "@/lib/actions";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useAuthContext } from "@/context/auth-context";

interface Message {
    role: "user" | "model";
    content: string;
    timestamp: Date;
    feedback?: 'positive' | 'neutral' | 'negative';
}

export function PlaybookChatWidget() {
    const { user } = useAuthContext();
    const [isOpen, setIsOpen] = useState(false);
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
        setInput("");

        startTransition(async () => {
            const history = newMessages.map(m => ({ role: m.role, content: m.content }));
            const res = await handleGetPlaybookAssistance({
                query: input,
                history: history.slice(-6),
            });

            if (res.success && res.data) {
                const assistantMessage: Message = {
                    role: "model",
                    content: res.data.answer,
                    timestamp: new Date()
                };
                setMessages((prev) => [...prev, assistantMessage]);
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
                        <div className="bg-primary/90 p-5 flex items-center justify-between text-primary-foreground backdrop-blur-sm">
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
                                        placeholder="Tire suas dúvidas agora..."
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
