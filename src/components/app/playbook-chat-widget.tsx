
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
    Check
} from "lucide-react";
import { handleGetPlaybookAssistance, handleSavePlaybookFeedback } from "@/lib/actions";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Message {
    role: "user" | "model";
    content: string;
    timestamp: Date;
    feedback?: 'positive' | 'neutral' | 'negative';
}

export function PlaybookChatWidget() {
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
                history: history.slice(-6), // Keep last 3 turns
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

        // Find the user query that triggered this answer
        const query = prevUserMessage?.role === 'user' ? prevUserMessage.content : 'N/A';

        setMessages(prev => {
            const next = [...prev];
            next[index] = { ...next[index], feedback: type };
            return next;
        });

        // Save to Firebase
        startTransition(async () => {
            await handleSavePlaybookFeedback({
                query,
                answer: message.content,
                feedback: type,
            });
        });
    };

    if (!isOpen) {
        return (
            <Button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl hover:scale-110 transition-transform bg-primary"
                size="icon"
            >
                <MessageCircle className="h-6 w-6" />
            </Button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[400px] h-[600px] flex flex-col rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-300 z-50">
            {/* Header */}
            <div className="bg-primary p-4 flex items-center justify-between text-primary-foreground">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Avatar className="h-10 w-10 border-2 border-primary-foreground/20">
                            <AvatarImage src="/bot-avatar.png" alt="Alex" />
                            <AvatarFallback className="bg-white text-primary font-bold">AX</AvatarFallback>
                        </Avatar>
                        <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-400 border-2 border-primary rounded-full shadow-sm" />
                    </div>
                    <div>
                        <h2 className="font-bold leading-none">Alex</h2>
                        <p className="text-[10px] opacity-80 mt-1 uppercase tracking-wider">Especialista V-Lab | AI</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/20 text-white"
                        onClick={() => setIsOpen(false)}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-white/20 text-white"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Chat Area */}
            <ScrollArea className="flex-1 p-4 bg-muted/30" ref={scrollAreaRef}>
                <div className="space-y-6">
                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={cn(
                                "flex flex-col gap-1",
                                message.role === "user" ? "items-end" : "items-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[85%] rounded-2xl p-4 text-sm shadow-sm relative group",
                                    message.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-none"
                                        : "bg-white dark:bg-zinc-800 text-foreground rounded-tl-none border border-border/50"
                                )}
                            >
                                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none overflow-hidden break-words">
                                    {message.content}
                                </ReactMarkdown>

                                {/* Timestamp */}
                                <span className={cn(
                                    "text-[10px] opacity-50 block mt-2",
                                    message.role === "user" ? "text-right" : "text-left"
                                )}>
                                    {format(message.timestamp, "HH:mm")}
                                </span>

                                {/* Feedback Section for Bot Messages */}
                                {message.role === "model" && index === messages.length - 1 && !isPending && (
                                    <div className="mt-4 pt-4 border-t border-border/50">
                                        <p className="text-[11px] font-medium mb-3 text-center opacity-70">
                                            {message.feedback ? "Obrigado pelo feedback!" : "Esta resposta foi útil?"}
                                        </p>
                                        <div className="flex justify-center gap-4">
                                            {message.feedback ? (
                                                <div className="flex items-center gap-1 text-primary text-xs font-bold">
                                                    <Check className="h-4 w-4" /> Feedback Enviado
                                                </div>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleFeedback(index, 'negative')}
                                                        className="p-2 rounded-full hover:bg-red-50 text-red-400 transition-colors"
                                                    >
                                                        <Frown className="h-6 w-6 transition-transform hover:scale-125" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleFeedback(index, 'neutral')}
                                                        className="p-2 rounded-full hover:bg-yellow-50 text-yellow-400 transition-colors"
                                                    >
                                                        <Meh className="h-6 w-6 transition-transform hover:scale-125" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleFeedback(index, 'positive')}
                                                        className="p-2 rounded-full hover:bg-green-50 text-green-500 transition-colors"
                                                    >
                                                        <Smile className="h-6 w-6 transition-transform hover:scale-125" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isPending && (
                        <div className="flex flex-col items-start gap-1">
                            <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-none p-4 shadow-sm border border-border/50">
                                <div className="flex gap-1.5 h-6 items-center">
                                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t bg-white">
                <form onSubmit={handleSubmit} className="flex items-end gap-2">
                    <div className="flex-1 bg-muted rounded-xl p-1 focus-within:ring-2 ring-primary/20 transition-all">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSubmit(e);
                                }
                            }}
                            placeholder="Pergunte sobre o Playbook..."
                            className="w-full bg-transparent border-none focus:ring-0 text-sm p-3 resize-none max-h-32 min-h-[44px]"
                            disabled={isPending}
                            rows={1}
                        />
                    </div>
                    <Button
                        type="submit"
                        size="icon"
                        disabled={isPending || !input.trim()}
                        className="h-11 w-11 rounded-xl shadow-md transition-all active:scale-95"
                    >
                        {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                </form>
            </div>
        </div>
    );
}
