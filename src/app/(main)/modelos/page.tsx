
"use client";

import { useState, useMemo, useCallback, useRef, useTransition, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, Upload, File as FileIcon, Trash2, Wand2, Loader2, Check } from "lucide-react";
import { collection, doc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { handleExtractTemplate } from "@/lib/actions";
import { useFirebase, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";

const fileToDataURI = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

function TemplateExtractor({ onTemplateExtracted }: { onTemplateExtracted: (template: Template) => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [isPending, startTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };
    
    const handleExtract = () => {
        if (!file) {
            toast({
                title: "Nenhum arquivo selecionado",
                description: "Por favor, carregue um arquivo para extrair o modelo.",
                variant: "destructive",
            });
            return;
        }

        startTransition(async () => {
            try {
                const dataUri = await fileToDataURI(file);
                const formData = new FormData();
                formData.append("document", dataUri);
                formData.append("fileName", file.name);

                const result = await handleExtractTemplate(formData);

                if (result.success && result.data?.templateContent) {
                    const newTemplate: Template = {
                        id: `template-${Date.now()}`,
                        name: `Modelo de ${file.name.replace(/\.[^/.]+$/, "")}`,
                        description: `Extraído de ${file.name}`,
                        markdownContent: result.data.templateContent,
                    };
                    onTemplateExtracted(newTemplate);
                    toast({
                        title: "Modelo Extraído!",
                        description: "O modelo foi carregado no editor abaixo.",
                    });
                    setFile(null); // Clear file after extraction
                } else {
                    throw new Error(result.error || "Falha ao extrair o modelo do documento.");
                }

            } catch (error) {
                console.error(error);
                toast({
                    variant: "destructive",
                    title: "Erro na Extração",
                    description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Extrair Modelo de Documento com IA</CardTitle>
                <CardDescription>
                    Faça o upload de um contrato existente (PDF, DOCX) e a IA criará um modelo genérico para você.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                 <input
                    type="file"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.doc,.docx"
                />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto">
                    {file ? <Check className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
                    {file ? (file.name.length > 20 ? `${file.name.slice(0,17)}...` : file.name) : "Carregar Documento"}
                </Button>
                <Button onClick={handleExtract} disabled={isPending || !file} className="w-full sm:w-auto">
                    {isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Extraindo...
                        </>
                    ) : (
                        <>
                            <Wand2 className="mr-2 h-4 w-4" />
                            Extrair Modelo
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}


function TemplateEditor({
    template,
    onTemplateChange,
    onSave,
    onCancel,
}: {
    template: Template | null;
    onTemplateChange: (field: keyof Omit<Template, 'id'>, value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    if (!template) return null;

    return (
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileIcon className="h-5 w-5" /> Editor de Modelo
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="template-name">Nome do Modelo</Label>
                        <Input
                            id="template-name"
                            value={template.name}
                            onChange={(e) => onTemplateChange("name", e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-description">Descrição</Label>
                        <Input
                            id="template-description"
                            value={template.description}
                            onChange={(e) => onTemplateChange("description", e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-doc-link">Link do Modelo em Google Doc (Opcional)</Label>
                        <Input
                            id="template-doc-link"
                            value={template.googleDocLink || ""}
                            onChange={(e) => onTemplateChange("googleDocLink", e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-content">Conteúdo do Modelo (Markdown)</Label>
                        <Textarea
                            id="template-content"
                            value={template.markdownContent}
                            onChange={(e) => onTemplateChange("markdownContent", e.target.value)}
                            className="min-h-[250px] font-mono"
                            placeholder="Escreva o conteúdo do seu modelo em Markdown aqui..."
                        />
                    </div>
                </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    Cancelar
                </Button>
                <Button onClick={onSave}>
                    Salvar Modelo
                </Button>
            </div>
        </div>
    );
}

export default function ModelosPage() {
    const { user } = useUser();
    const { firestore } = useFirebase();
    
    const templatesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'users', user.uid, 'contractModels');
    }, [user, firestore]);

    const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!isLoading && templates && templates.length > 0 && !selectedTemplateId && !editingTemplate) {
            const firstTemplate = templates[0];
            if (firstTemplate) {
                startEditing(firstTemplate);
            }
        }
    }, [isLoading, templates, selectedTemplateId, editingTemplate]);
    
    const templateForPreview = useMemo(() => {
        if (editingTemplate) return editingTemplate;
        return templates?.find((t) => t.id === selectedTemplateId) ?? null;
    }, [templates, selectedTemplateId, editingTemplate]);

    const startEditing = useCallback((template: Template) => {
        setEditingTemplate(JSON.parse(JSON.stringify(template))); // Deep copy
        setSelectedTemplateId(template.id);
    }, []);

    const handleNewTemplate = useCallback(() => {
        const newTemplate: Template = {
            id: `template-${Date.now()}`,
            name: "Novo Modelo sem Título",
            description: "",
            markdownContent: "# Novo Modelo\n\nComece a editar...",
            googleDocLink: "",
        };
        startEditing(newTemplate);
    }, [startEditing]);

    const handleSelectTemplate = useCallback((id: string) => {
        if (editingTemplate?.id === id) return;

        const templateToEdit = templates?.find(t => t.id === id);
        if (templateToEdit) {
            startEditing(templateToEdit);
        }
    }, [editingTemplate, templates, startEditing]);

    const handleTemplateChange = useCallback((field: keyof Omit<Template, 'id'>, value: string) => {
        if (editingTemplate) {
            setEditingTemplate(prev => prev ? { ...prev, [field]: value } : null);
        }
    }, [editingTemplate]);

    const handleSaveTemplate = useCallback(() => {
        if (!editingTemplate || !user || !firestore) return;

        const { id, ...templateData } = editingTemplate;
        // Construct the object to save with all required fields.
        const templateToSave = {
            name: templateData.name,
            description: templateData.description,
            markdownContent: templateData.markdownContent,
            googleDocLink: templateData.googleDocLink || "",
        };

        const templateRef = doc(firestore, 'users', user.uid, 'contractModels', id);

        // Use the non-blocking update.
        setDocumentNonBlocking(templateRef, templateToSave, { merge: true });

        toast({
            title: "Modelo Salvo!",
            description: `O modelo "${editingTemplate.name}" foi salvo com sucesso.`,
        });
        
        // After saving, reset editing mode and keep selection
        const savedId = editingTemplate.id;
        setEditingTemplate(null);
        setSelectedTemplateId(savedId);

    }, [editingTemplate, user, firestore, toast]);

    const handleCancelEditing = useCallback(() => {
        const wasNew = editingTemplate && !templates?.some(t => t.id === editingTemplate.id);
        setEditingTemplate(null);
        if (wasNew && templates && templates.length > 0) {
            setSelectedTemplateId(templates[0].id);
        } else if (!wasNew && editingTemplate) {
            setSelectedTemplateId(editingTemplate.id);
        }
    }, [editingTemplate, templates]);


    const handleDeleteTemplate = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!user || !firestore) return;

        if (window.confirm("Tem certeza que deseja deletar este modelo?")) {
            const templateRef = doc(firestore, 'users', user.uid, 'contractModels', id);
            deleteDocumentNonBlocking(templateRef);
           
            toast({ title: "Modelo deletado." });

            if (selectedTemplateId === id) {
                const remainingTemplates = templates?.filter(t => t.id !== id);
                setSelectedTemplateId(remainingTemplates?.[0]?.id ?? null);
            }
            if (editingTemplate?.id === id) {
                setEditingTemplate(null);
            }
        }
    }, [selectedTemplateId, editingTemplate, user, firestore, templates, toast]);
    
    const handleTemplateExtracted = useCallback((newTemplate: Template) => {
        startEditing(newTemplate);
    }, [startEditing]);

    const isInEditMode = !!editingTemplate;

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-transparent">
            {/* Sidebar */}
            <aside className="w-1/4 min-w-[250px] max-w-[300px] border-r bg-background/80 p-4 flex flex-col">
                <Button className="w-full mb-4" onClick={handleNewTemplate} disabled={!user}>
                    <Plus className="mr-2 h-4 w-4" /> Novo Modelo
                </Button>
                <h2 className="text-lg font-semibold mb-2 px-2">Modelos Salvos</h2>
                <div className="overflow-y-auto flex-1">
                    {isLoading ? <p className="p-2 text-sm text-muted-foreground">Carregando...</p> : (
                        <ul className="space-y-1">
                            {templates?.map((template) => (
                                <li key={template.id}>
                                    <div
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSelectTemplate(template.id)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSelectTemplate(template.id)}
                                        className={cn(
                                            "w-full text-left p-2 rounded-md transition-colors text-sm flex justify-between items-center group cursor-pointer",
                                            (editingTemplate?.id === template.id || (!editingTemplate && selectedTemplateId === template.id))
                                                ? "bg-primary text-primary-foreground"
                                                : "hover:bg-muted"
                                        )}
                                    >
                                        <span className="truncate">{template.name}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={(e) => handleDeleteTemplate(e, template.id)}
                                            aria-label={`Deletar modelo ${template.name}`}
                                        >
                                            <Trash2
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <main className="w-1/2 p-8 overflow-y-auto">
                <div className="space-y-8">
                     <TemplateExtractor onTemplateExtracted={handleTemplateExtracted} />
                    {editingTemplate ? (
                        <TemplateEditor
                            template={editingTemplate}
                            onTemplateChange={handleTemplateChange}
                            onSave={handleSaveTemplate}
                            onCancel={handleCancelEditing}
                        />
                    ) : (
                        <Card className="flex items-center justify-center p-8 border-dashed bg-card/50 min-h-[400px]">
                            <div className="text-center">
                                <h3 className="text-xl font-semibold">Selecione ou crie um modelo</h3>
                                <p className="text-muted-foreground mt-2">Escolha um modelo na barra lateral para visualizar e editar, ou clique em "Novo Modelo" para começar do zero.</p>
                            </div>
                        </Card>
                    )}
                </div>
            </main>

            {/* Preview */}
            <aside className="w-1/4 min-w-[300px] border-l bg-background/80 p-6">
                <div className="sticky top-0">
                    <h2 className="text-xl font-semibold mb-4">Visualização em Tempo Real</h2>
                    {templateForPreview ? (
                        <Card className="h-[calc(100vh-10rem)] bg-card/50">
                            <CardContent className="p-6 h-full overflow-y-auto">
                                <ReactMarkdown
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    components={{
                                        p: ({ node, ...props }) => <p className="mb-4" {...props} />,
                                        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-4" {...props} />,
                                        h2: ({ node, ...props }) => <h2 className="text-lg font-semibold mt-6 mb-2" {...props} />,
                                    }}
                                >
                                    {templateForPreview.markdownContent}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="flex items-center justify-center h-[calc(100vh-10rem)] text-center text-muted-foreground border rounded-lg border-dashed bg-card/50">
                            <p>Selecione ou crie um modelo para visualizar.</p>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
