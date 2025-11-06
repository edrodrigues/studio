
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
  const handleExportJson = () => {
    if (!jsonContent) return;
    const blob = new Blob([jsonContent], {
      type: "application/json;charset=utf-8",
    });
    saveAs(blob, `entidades_extraidas_${new Date().toISOString()}.json`);
  };

  let formattedJson = "";
  try {
    const parsed = JSON.parse(jsonContent);
    formattedJson = JSON.stringify(parsed, null, 2);
  } catch {
    formattedJson = "JSON inválido ou vazio.";
  }

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
        <ScrollArea className="flex-1 rounded-md border bg-muted/50">
          <pre className="p-4 text-sm">
            <code>{formattedJson}</code>
          </pre>
        </ScrollArea>
        <DialogFooter className="mt-auto">
          <Button
            variant="outline"
            onClick={handleExportJson}
            disabled={!jsonContent}
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
