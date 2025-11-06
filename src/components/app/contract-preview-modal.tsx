
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
import { useEffect, useState } from "react";
import rehypeRaw from "rehype-raw";

interface ContractPreviewModalProps {
  contract: Contract | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ContractPreviewModal({ contract, isOpen, onClose }: ContractPreviewModalProps) {
    const [processedContent, setProcessedContent] = useState('');

    useEffect(() => {
        if (contract?.content) {
            const highlightedContent = contract.content.replace(/{{(.*?)}}/g, (_match, variable) => {
                return `<span class="bg-yellow-200 text-yellow-800 font-mono px-1 py-0.5 rounded text-xs">${`{{${variable}}}`}</span>`;
            });
            setProcessedContent(highlightedContent);
        }
    }, [contract?.content]);

    if (!contract) return null;

    const handleExportMD = () => {
        const blob = new Blob([contract.content], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `${contract.name.replace(/\s/g, '_')}.md`);
    };

    const handleExportDocx = () => {
        exportToDocx(contract.content, contract.name.replace(/\s/g, '_'));
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh]">
                <DialogHeader>
                    <DialogTitle>Visualizar e Exportar: {contract.name}</DialogTitle>
                    <DialogDescription>
                        Revise o contrato abaixo. Variáveis não preenchidas estão destacadas.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[calc(90vh-10rem)] rounded-md border">
                    <div className="p-6">
                        <ReactMarkdown
                            rehypePlugins={[rehypeRaw]}
                            className="prose prose-sm max-w-none dark:prose-invert"
                        >
                            {processedContent}
                        </ReactMarkdown>
                    </div>
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

