
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
import { FileDown, FileText, Pencil, Save, X, ExternalLink } from "lucide-react";
import rehypeRaw from "rehype-raw";
import { useState, useEffect } from "react";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { getDoc, doc } from "firebase/firestore";
import { useFirebase } from "@/firebase";
import { Template } from "@/lib/types";

interface ContractPreviewModalProps {
    contract: Contract | null;
    isOpen: boolean;
    onClose: () => void;
    onSave?: (newContent: string) => void;
    initialEditMode?: boolean;
}

export function ContractPreviewModal({ contract, isOpen, onClose, onSave, initialEditMode = false }: ContractPreviewModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState("");
    const [resolvedGoogleDocLink, setResolvedGoogleDocLink] = useState<string | null>(null);
    const { firestore } = useFirebase();

    useEffect(() => {
        if (contract) {
            setEditedContent(contract.markdownContent);

            // Resolve Google Doc Link
            if (contract.googleDocLink) {
                setResolvedGoogleDocLink(contract.googleDocLink);
            } else if (contract.contractModelId && firestore) {
                // Backward compatibility: fetch template to get the link
                const fetchTemplateLink = async () => {
                    try {
                        const templateRef = doc(firestore, 'contractModels', contract.contractModelId!);
                        const templateSnap = await getDoc(templateRef);
                        if (templateSnap.exists()) {
                            const templateData = templateSnap.data() as Template;
                            setResolvedGoogleDocLink(templateData.googleDocLink || null);
                        }
                    } catch (error) {
                        console.error("Error fetching template for link:", error);
                    }
                };
                fetchTemplateLink();
            } else {
                setResolvedGoogleDocLink(null);
            }
        }
        setIsEditing(initialEditMode);
    }, [contract, isOpen, initialEditMode, firestore]);

    if (!contract) return null;

    const handleExportMD = () => {
        // Removes any HTML-like tags for a clean markdown export.
        const cleanedContent = editedContent.replace(/<[^>]*>?/gm, '');
        const blob = new Blob([cleanedContent], { type: "text/markdown;charset=utf-8" });
        saveAs(blob, `${contract.name.replace(/\s/g, '_')}.md`);
    };

    const handleExportDocx = () => {
        exportToDocx(editedContent, contract.name.replace(/\s/g, '_'));
    };

    const handleSave = () => {
        if (onSave) {
            onSave(editedContent);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedContent(contract.markdownContent);
        setIsEditing(false);
    };

    // Sanitize content for preview:
    // 1. First, escape potential placeholders (e.g., <NOME>) so they aren't stripped as invalid HTML.
    // We assume placeholders start with an uppercase letter to differentiate from most HTML variable tags,
    // or just match the specific pattern used in templates.
    const escapedContent = editedContent.replace(/<([A-Z][\w\s\-]+)>/g, '&lt;$1&gt;');

    // 2. Remove non-standard HTML tags that React can't render, keeping our specific highlighting spans.
    const previewContent = escapedContent.replace(/<(?!\/?span\b)[^>]*>/gi, '');


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Visualizar e Exportar: {contract.name}</DialogTitle>
                    <DialogDescription>
                        Revise o contrato abaixo. Variáveis não preenchidas estão destacadas.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-hidden py-4">
                    {isEditing ? (
                        <RichTextEditor
                            value={editedContent}
                            onChange={setEditedContent}
                            className="h-full"
                        />
                    ) : (
                        <ScrollArea className="h-full rounded-md border">
                            <div className="p-6">
                                <ReactMarkdown
                                    rehypePlugins={[rehypeRaw]}
                                    className="prose prose-sm max-w-none dark:prose-invert"
                                >
                                    {previewContent}
                                </ReactMarkdown>
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter className="flex-shrink-0">
                    {isEditing ? (
                        <>
                            <Button variant="outline" onClick={handleCancel}>
                                <X className="mr-2 h-4 w-4" />
                                Cancelar
                            </Button>
                            <Button onClick={handleSave}>
                                <Save className="mr-2 h-4 w-4" />
                                Salvar Alterações
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setIsEditing(true)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                            </Button>
                            {resolvedGoogleDocLink && (
                                <Button
                                    variant="outline"
                                    onClick={() => window.open(resolvedGoogleDocLink, '_blank')}
                                    className="border-green-600/30 text-green-700 hover:bg-green-50 hover:text-green-800 dark:text-green-400 dark:hover:bg-green-950/30"
                                >
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Abrir no Google Docs
                                </Button>
                            )}
                            <Button variant="outline" onClick={handleExportMD}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Exportar MD
                            </Button>
                            <Button onClick={handleExportDocx}>
                                <FileText className="mr-2 h-4 w-4" />
                                Exportar Word (.docx)
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
