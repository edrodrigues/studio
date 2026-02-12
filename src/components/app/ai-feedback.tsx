"use client";

import { Smile, Frown, Meh } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AIFeedbackProps {
    className?: string;
}

export function AIFeedback({ className }: AIFeedbackProps) {
    const { toast } = useToast();

    const handleFeedback = (type: "positive" | "neutral" | "negative") => {
        // In a real application, you would send this to your backend/analytics
        console.log(`AI Feedback received: ${type}`);

        toast({
            title: "Feedback recebido!",
            description: "Obrigado por nos ajudar a melhorar as análises da IA.",
        });
    };

    return (
        <div className={cn("flex flex-col items-center gap-4 py-6", className)}>
            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/70 font-bold">
                Feedback
            </span>
            <div className="flex items-center gap-8">
                <button
                    onClick={() => handleFeedback("negative")}
                    className="group flex flex-col items-center gap-2 transition-transform hover:scale-110 active:scale-95"
                    title="Não gostei"
                >
                    <div className="p-2 rounded-full transition-colors group-hover:bg-red-50 dark:group-hover:bg-red-950/20">
                        <Frown className="h-8 w-8 text-red-400 group-hover:text-red-500 transition-colors" strokeWidth={1.5} />
                    </div>
                </button>

                <button
                    onClick={() => handleFeedback("neutral")}
                    className="group flex flex-col items-center gap-2 transition-transform hover:scale-110 active:scale-95"
                    title="Neutro"
                >
                    <div className="p-2 rounded-full transition-colors group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20">
                        <Meh className="h-8 w-8 text-amber-400 group-hover:text-amber-500 transition-colors" strokeWidth={1.5} />
                    </div>
                </button>

                <button
                    onClick={() => handleFeedback("positive")}
                    className="group flex flex-col items-center gap-2 transition-transform hover:scale-110 active:scale-95"
                    title="Gostei"
                >
                    <div className="p-2 rounded-full transition-colors group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/20">
                        <Smile className="h-8 w-8 text-emerald-400 group-hover:text-emerald-500 transition-colors" strokeWidth={1.5} />
                    </div>
                </button>
            </div>
        </div>
    );
}
