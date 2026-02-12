"use client";

import { Smile, Frown, Meh } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AIFeedbackProps {
    className?: string;
    disabled?: boolean;
    onFeedbackSubmitted?: () => void;
}

export function AIFeedback({ className, disabled = false, onFeedbackSubmitted }: AIFeedbackProps) {
    const { toast } = useToast();

    const handleFeedback = (type: "positive" | "neutral" | "negative") => {
        if (disabled) return;
        
        console.log(`AI Feedback received: ${type}`);

        toast({
            title: "Feedback recebido!",
            description: "Obrigado por nos ajudar a melhorar as análises da IA.",
        });
        
        onFeedbackSubmitted?.();
    };

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <span className={cn(
                "text-[11px] uppercase tracking-[0.15em] font-bold",
                disabled ? "text-muted-foreground/30" : "text-muted-foreground/70"
            )}>
                Feedback
            </span>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => handleFeedback("negative")}
                    disabled={disabled}
                    className={cn(
                        "group flex flex-col items-center gap-1 transition-all",
                        disabled 
                            ? "cursor-not-allowed opacity-30" 
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                    )}
                    title={disabled ? "Aguarde o resultado" : "Não gostei"}
                >
                    <div className={cn(
                        "p-1.5 rounded-full transition-colors",
                        !disabled && "group-hover:bg-red-50 dark:group-hover:bg-red-950/20"
                    )}>
                        <Frown 
                            className={cn(
                                "h-5 w-5 transition-colors",
                                disabled ? "text-red-300" : "text-red-400 group-hover:text-red-500"
                            )} 
                            strokeWidth={1.5} 
                        />
                    </div>
                </button>

                <button
                    onClick={() => handleFeedback("neutral")}
                    disabled={disabled}
                    className={cn(
                        "group flex flex-col items-center gap-1 transition-all",
                        disabled 
                            ? "cursor-not-allowed opacity-30" 
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                    )}
                    title={disabled ? "Aguarde o resultado" : "Neutro"}
                >
                    <div className={cn(
                        "p-1.5 rounded-full transition-colors",
                        !disabled && "group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20"
                    )}>
                        <Meh 
                            className={cn(
                                "h-5 w-5 transition-colors",
                                disabled ? "text-amber-300" : "text-amber-400 group-hover:text-amber-500"
                            )} 
                            strokeWidth={1.5} 
                        />
                    </div>
                </button>

                <button
                    onClick={() => handleFeedback("positive")}
                    disabled={disabled}
                    className={cn(
                        "group flex flex-col items-center gap-1 transition-all",
                        disabled 
                            ? "cursor-not-allowed opacity-30" 
                            : "hover:scale-110 active:scale-95 cursor-pointer"
                    )}
                    title={disabled ? "Aguarde o resultado" : "Gostei"}
                >
                    <div className={cn(
                        "p-1.5 rounded-full transition-colors",
                        !disabled && "group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/20"
                    )}>
                        <Smile 
                            className={cn(
                                "h-5 w-5 transition-colors",
                                disabled ? "text-emerald-300" : "text-emerald-400 group-hover:text-emerald-500"
                            )} 
                            strokeWidth={1.5} 
                        />
                    </div>
                </button>
            </div>
        </div>
    );
}
