"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ClearEntitiesButton() {
    const { toast } = useToast();

    const handleClear = () => {
        try {
            localStorage.removeItem('extractedEntities');
            toast({
                title: "Dados Limpos",
                description: "As entidades antigas foram removidas. Por favor, extraia as entidades novamente.",
            });
            // Reload the page to reflect changes
            window.location.reload();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Não foi possível limpar os dados.",
            });
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-2"
        >
            <Trash2 className="h-4 w-4" />
            Limpar Dados Antigos
        </Button>
    );
}
