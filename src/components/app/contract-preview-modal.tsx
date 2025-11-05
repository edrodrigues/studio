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
import ReactMarkdown from "react-markdown";
import { Contract } from "@/lib/types";
import { exportToDocx } from "@/lib/export";
import { saveAs } from "file-saver";
import { FileDown, FileText } from "lucide-react";

interface ContractPreviewModalProps {
  contract: Contract | null;
  isOpen: boolean;
  onClose: () => void;
}

const highlightUnfilled = (text: string) => {
  return text.replace(/{{(.*?)}}/g, (match) => {
    return `<span class="bg-yellow-200 text-yellow-800 font-mono px-1 rounded">${match}</span>`;
  });
};

export function ContractPreviewModal({ contract, isOpen, onClose }: ContractPreviewModalProps) {
  if (!contract) return null;

  const handleExportMD = () => {
    const blob = new Blob([contract.content], { type: "text/markdown;charset=utf-8" });
    saveAs(blob, `${contract.name.replace(/\s/g, '_')}.md`);
  };

  const handleExportDocx = () => {
    exportToDocx(contract.content, contract.name.replace(/\s/g, '_'));
  };

  // This is a bit of a hack to render HTML within ReactMarkdown.
  // In a real app, a more robust solution like rehype-raw would be better.
  const processedContent = highlightUnfilled(contract.content);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh]">
        <DialogHeader>
          <DialogTitle>Visualizar e Exportar: {contract.name}</DialogTitle>
          <DialogDescription>
            Revise o contrato abaixo. Variáveis não preenchidas estão destacadas em amarelo.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[calc(90vh-10rem)] rounded-md border">
            <ReactMarkdown 
              className="prose prose-sm max-w-none p-6 dark:prose-invert"
              components={{
                span: ({node, ...props}) => {
                    if (props.dangerouslySetInnerHTML) {
                        return <span {...props} />;
                    }
                    return <span {...props}>{props.children}</span>
                }
              }}
            >
              {processedContent}
            </ReactMarkdown>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={handleExportMD}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar MD
          </Button>
          <Button onClick={handleExportDocx}>
            <FileText className="mr-2 h-4 w-4" />
            Exportar Word (.docx)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
