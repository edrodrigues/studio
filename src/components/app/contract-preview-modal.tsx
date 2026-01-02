
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
import rehypeRaw from "rehype-raw";

interface ContractPreviewModalProps {
    contract: Contract | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ContractPreviewModal({ contract, isOpen, onClose }: ContractPreviewModalProps) {

    if (!contract) return null;

    const handleExportMD = () => {
        // Removes any HTML-like tags for a clean markdown export.
        const cleanedContent = contract.markdownContent.replace(/<[^>]*>?/gm, '');
        const blob = new Blob([cleanedContent], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `${contract.name.replace(/\s/g, '_')}.md`);
    };

    const handleExportDocx = () => {
        exportToDocx(contract.markdownContent, contract.name.replace(/\s/g, '_'));
    };

    // Sanitize content for preview:
    // 1. First, escape potential placeholders (e.g., <NOME>) so they aren't stripped as invalid HTML.
    // We assume placeholders start with an uppercase letter to differentiate from most HTML variable tags,
    // or just match the specific pattern used in templates.
    const escapedContent = contract.markdownContent.replace(/<([A-Z][\w\s\-]+)>/g, '&lt;$1&gt;');

    // 2. Remove non-standard HTML tags that React can't render, keeping our specific highlighting spans.
    const previewContent = escapedContent.replace(/<(?!\/?span\b)[^>]*>/gi, '');


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
                            {previewContent}
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
