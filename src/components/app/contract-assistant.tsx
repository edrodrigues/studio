
"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Loader2, Send } from "lucide-react";
import { handleGetAssistance } from "@/lib/actions";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ContractAssistantProps {
  contractContent: string;
  clauseContent: string;
}

export function ContractAssistant({ contractContent, clauseContent }: ContractAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isPending, startTransition] = useTransition();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [messages]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isPending) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    startTransition(async () => {
      const res = await handleGetAssistance({
        query: input,
        contractContent,
        clauseContent,
      });

      if (res.success && res.data) {
        const assistantMessage: Message = { role: "assistant", content: res.data.answer };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorMessage: Message = {
          role: "assistant",
          content: `Desculpe, ocorreu um erro: ${res.error || "Tente novamente mais tarde."}`,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    });
  };

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="flex items-center gap-2 border-b p-4">
        <Bot className="h-6 w-6 text-primary" />
        <h2 className="text-lg font-semibold">Assistente Gemini</h2>
      </div>
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div role="log" aria-live="polite" className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>IA</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg p-3 text-sm",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          {isPending && (
             <div className="flex items-start gap-3 justify-start" role="status">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>IA</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg p-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre a cláusula..."
            disabled={isPending}
            aria-label="Pergunta para o assistente de IA"
          />
          <Button type="submit" size="icon" disabled={isPending || !input.trim()} aria-label="Enviar pergunta">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
