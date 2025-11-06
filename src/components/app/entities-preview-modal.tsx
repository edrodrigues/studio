
"use client";

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
import { FileDown } from "lucide-react";
import { saveAs } from "file-saver";

interface EntitiesPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonContent: string;
}

export function EntitiesPreviewModal({
  isOpen,
  onClose,
  jsonContent,
}: EntitiesPreviewModalProps) {
  let entities: Record<string, any> = {};
  let errorMessage = "";
  
  try {
    if (jsonContent) {
      // The AI response is a stringified JSON object containing another stringified JSON.
      // So we need to parse twice.
      const outerParsed = JSON.parse(jsonContent);
      entities = outerParsed;
    }
  } catch (e) {
      try {
        // Fallback for single-parsed JSON
        if (jsonContent) entities = JSON.parse(jsonContent);
      } catch (e2) {
        errorMessage = "O JSON retornado pela IA é inválido ou está vazio.";
        console.error("Error parsing entities JSON:", e2);
        console.error("Original content:", jsonContent);
      }
  }

  const handleExportJson = () => {
    if (!jsonContent) return;
    try {
        const formattedJson = JSON.stringify(entities, null, 2);
        const blob = new Blob([formattedJson], {
            type: "application/json;charset=utf-8",
        });
        saveAs(blob, `entidades_extraidas_${new Date().toISOString()}.json`);
    } catch (e) {
        // Fallback if formatting fails for some reason
        const blob = new Blob([jsonContent], {
            type: "text/plain;charset=utf-8",
        });
        saveAs(blob, `entidades_extraidas_raw_${new Date().toISOString()}.txt`);
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Entidades Extraídas</DialogTitle>
          <DialogDescription>
            Abaixo estão as entidades que a IA extraiu dos documentos. Você pode
            revisar e exportar o resultado como um arquivo JSON.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 rounded-md border bg-muted/50 p-4">
          {errorMessage ? (
            <p className="text-destructive">{errorMessage}</p>
          ) : Object.keys(entities).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(entities).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[1fr,2fr] gap-4 text-sm items-center">
                  <strong className="font-mono text-muted-foreground truncate text-right">{key}:</strong>
                  <span className="font-mono bg-background/50 rounded px-2 py-1">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-muted-foreground">Nenhuma entidade extraída.</p>
          )}
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleExportJson}
            disabled={!jsonContent || !!errorMessage}
          >
            <FileDown className="mr-2 h-4 w-4" />
            Exportar JSON
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
