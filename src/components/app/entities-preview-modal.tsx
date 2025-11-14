
"use client";

import { useState, useEffect } from "react";
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
import { FileDown, Loader2 } from "lucide-react";
import { saveAs } from "file-saver";

interface EntitiesPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  jsonContent: string;
}

interface ParsedEntities {
  entities: Record<string, any>;
  schema: {
    properties: Record<string, { description: string }>;
  };
}

export function EntitiesPreviewModal({
  isOpen,
  onClose,
  jsonContent,
}: EntitiesPreviewModalProps) {
  const [parsedData, setParsedData] = useState<ParsedEntities | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (jsonContent) {
      setIsLoading(true);
      setErrorMessage("");
      setParsedData(null);
      try {
        const data = JSON.parse(jsonContent);
        if (data.entities && data.schema && data.schema.properties) {
          setParsedData(data);
        } else {
          setErrorMessage("O JSON retornado pela IA não possui a estrutura esperada (entities/schema).");
        }
      } catch (e) {
        setErrorMessage("O JSON retornado pela IA é inválido ou está vazio.");
        console.error("Error parsing entities JSON:", e);
        console.error("Original content:", jsonContent);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
      setErrorMessage("");
      setParsedData(null);
    }
  }, [jsonContent]);

  const handleExportJson = () => {
    if (!jsonContent) return;
    try {
      const formattedJson = JSON.stringify(JSON.parse(jsonContent), null, 2);
      const blob = new Blob([formattedJson], {
        type: "application/json;charset=utf-8",
      });
      saveAs(blob, `entidades_extraidas_${new Date().toISOString()}.json`);
    } catch (e) {
      const blob = new Blob([jsonContent], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `entidades_extraidas_raw_${new Date().toISOString()}.txt`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Revisar Entidades Extraídas</DialogTitle>
          <DialogDescription>
            Abaixo estão as variáveis que a IA extraiu e descreveu dos seus
            documentos. Revise os dados antes de prosseguir para a geração do contrato.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 rounded-md border bg-muted/50 p-4">
          {isLoading ? (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : errorMessage ? (
            <p className="text-destructive">{errorMessage}</p>
          ) : parsedData && Object.keys(parsedData.entities).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(parsedData.entities).map(([key, value]) => (
                <div key={key} className="grid grid-cols-[2fr,3fr] gap-4 items-start text-sm border-b pb-4 last:border-b-0">
                  <div className="text-right space-y-1">
                    <strong className="font-mono text-muted-foreground break-all">{key}</strong>
                    <p className="text-xs text-muted-foreground/80">
                      {parsedData.schema.properties[key]?.description || "Sem descrição."}
                    </p>
                  </div>
                  <span className="font-mono bg-background/50 rounded px-2 py-1 self-center">{String(value)}</span>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-muted-foreground">Nenhuma entidade foi extraída dos documentos.</p>
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
