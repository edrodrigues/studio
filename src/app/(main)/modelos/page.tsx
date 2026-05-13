
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Plus, File as FileIcon, Trash2, Copy, Check, Wand2, FileText, Loader2 } from "lucide-react";
import { collection, doc, addDoc, query, where } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFirebase, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { handleExtractTemplateFromDocument } from "@/lib/actions";
import { handleValidateTemplateLinksForSave } from "@/lib/actions/template-validation-actions";
import { useAuthContext } from "@/context/auth-context";


const contractTypeOptions = [
    "TED",
    "Acordo de Parceria (Lei de Inovação)",
    "Acordo de Parceria (Embrapii)",
    "Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)"
];

const renderMessages = (messages: string[]) => (
    <div className="space-y-1">
        {messages.map((message) => (
            <p key={message} className="text-xs leading-relaxed">{message}</p>
        ))}
    </div>
);


function TemplateEditor({
    template,
    onTemplateChange,
    onSave,
    onCancel,
}: {
    template: Template | null;
    onTemplateChange: (field: keyof Omit<Template, 'id'>, value: string | string[]) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    if (!template) return null;

    const handleContractTypeChange = (type: string, checked: boolean) => {
        const currentTypes = template.contractTypes || [];
        const newTypes = checked
            ? [...currentTypes, type]
            : currentTypes.filter(t => t !== type);
        onTemplateChange("contractTypes", newTypes);
    };

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
                        <Label>Tipo de Contrato</Label>
                        <div className="space-y-2 rounded-md border p-4">
                            {contractTypeOptions.map(type => (
                                <div key={type} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`type-${type}`}
                                        checked={template.contractTypes?.includes(type)}
                                        onCheckedChange={(checked) => handleContractTypeChange(type, !!checked)}
                                    />
                                    <Label htmlFor={`type-${type}`} className="font-normal">{type}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="template-doc-link">
                            Link do Modelo Base em Google Doc
                        </Label>
                        <Input
                            id="template-doc-link"
                            value={template.googleDocLink || ""}
                            onChange={(e) => onTemplateChange("googleDocLink", e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                        />
                        <p className="text-xs text-muted-foreground">Este campo é obrigatório para gerar contratos.</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="project-doc-link">
                            Link da Versão do Projeto em Google Doc
                        </Label>
                        <Input
                            id="project-doc-link"
                            value={template.projectDocLink || ""}
                            onChange={(e) => onTemplateChange("projectDocLink", e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                        />
                        <p className="text-xs text-muted-foreground">Link do documento original do projeto (versão editável). Ele é opcional, mas recomendado como fallback.</p>
                    </div>
                    {!template.projectDocLink?.trim() && (
                        <Alert>
                            <Wand2 className="h-4 w-4" />
                            <AlertTitle>Fallback recomendado</AlertTitle>
                            <AlertDescription>
                                Se o link original ficar indisponível, a geração só continua automaticamente quando existir uma versão customizada válida do projeto.
                            </AlertDescription>
                        </Alert>
                    )}
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
    const { signInWithGoogle } = useAuthContext();

    const templatesQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'contractModels');
    }, [user, firestore]);

    const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

    // Query for user's documents to extract templates from
    const documentsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return collection(firestore, 'projectDocuments');
    }, [user, firestore]);
    const { data: allDocuments } = useCollection<any>(documentsQuery);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const { toast } = useToast();

    // Extract template dialog state
    const [isExtractDialogOpen, setIsExtractDialogOpen] = useState(false);
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractedTemplate, setExtractedTemplate] = useState<string | null>(null);

    // Effect to select the first template by default
    useEffect(() => {
        if (!isLoading && templates && templates.length > 0 && !selectedTemplateId && !editingTemplate) {
            setSelectedTemplateId(templates[0].id);
        }
    }, [isLoading, templates, selectedTemplateId, editingTemplate]);

    // Effect to load the selected template into the editor for editing an existing one
    useEffect(() => {
        if (selectedTemplateId && templates && !editingTemplate?.isNew) {
            const templateToEdit = templates.find(t => t.id === selectedTemplateId);
            if (templateToEdit) {
                setEditingTemplate(JSON.parse(JSON.stringify(templateToEdit))); // Deep copy
            }
        }
    }, [selectedTemplateId, templates, editingTemplate?.isNew]);


    const startEditing = useCallback((template: Template) => {
        setSelectedTemplateId(template.id);
        setEditingTemplate(JSON.parse(JSON.stringify(template)));
    }, []);

    const handleNewTemplate = useCallback(() => {
        const newTemplate: Template = {
            id: `new-${Date.now()}`,
            name: "Novo Modelo sem Título",
            description: "",
            markdownContent: "",
            googleDocLink: "",
            projectDocLink: "",
            contractTypes: [],
            isNew: true,
        };
        startEditing(newTemplate);
    }, [startEditing]);

    // Extract template handlers
    const handleOpenExtractDialog = useCallback(() => {
        setIsExtractDialogOpen(true);
        setSelectedDocumentId(null);
        setExtractedTemplate(null);
    }, []);

    const handleExtractTemplate = useCallback(async () => {
        if (!selectedDocumentId || !user) return;

        setIsExtracting(true);
        try {
            const result = await handleExtractTemplateFromDocument({
                documentId: selectedDocumentId,
                projectId: '', // Not needed for extraction
                userId: user.uid,
            });

            if (result.success && result.templateContent) {
                setExtractedTemplate(result.templateContent);
                toast({
                    title: "Template Extraído!",
                    description: "O template foi extraído com sucesso. Clique em 'Usar este Template' para criar um novo modelo.",
                });
            } else {
                toast({
                    variant: "destructive",
                    title: "Erro",
                    description: result.error || "Não foi possível extrair o template.",
                });
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Erro",
                description: "Ocorreu um erro ao extrair o template.",
            });
        } finally {
            setIsExtracting(false);
        }
    }, [selectedDocumentId, user, toast]);

    const handleUseExtractedTemplate = useCallback(() => {
        if (!extractedTemplate) return;

        const selectedDoc = allDocuments?.find(d => d.id === selectedDocumentId);
        const newTemplate: Template = {
            id: `new-${Date.now()}`,
            name: `Template de ${selectedDoc?.originalFileName || 'Documento'}`,
            description: `Template extraído automaticamente em ${new Date().toLocaleDateString('pt-BR')}`,
            markdownContent: extractedTemplate,
            googleDocLink: "",
            projectDocLink: "",
            contractTypes: [],
            isNew: true,
        };
        
        setIsExtractDialogOpen(false);
        startEditing(newTemplate);
    }, [extractedTemplate, selectedDocumentId, allDocuments, startEditing]);

    const handleSelectTemplate = useCallback((id: string) => {
        if (editingTemplate && !window.confirm("Você tem alterações não salvas. Deseja descartá-las?")) {
            return;
        }
        setEditingTemplate(null);
        setSelectedTemplateId(id);
    }, [editingTemplate]);

    const handleTemplateChange = useCallback((field: keyof Omit<Template, 'id'>, value: string | string[]) => {
        if (editingTemplate) {
            setEditingTemplate(prev => prev ? { ...prev, [field]: value } : null);
        }
    }, [editingTemplate]);

    const handleSaveTemplate = useCallback(async () => {
        if (!editingTemplate || !user || !firestore) return;

        // Validation
        if (!editingTemplate.name?.trim()) {
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: "Por favor, insira o nome do modelo.",
            });
            return;
        }

        if (!editingTemplate.googleDocLink?.trim() && !editingTemplate.projectDocLink?.trim()) {
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: "Preencha ao menos o link original do modelo ou a versao customizada do projeto.",
            });
            return;
        }

        if (!user) {
            toast({
                title: "Conecte sua conta Google",
                description: "Precisamos validar os links dos templates antes de salvar.",
                action: (
                    <Button variant="outline" size="sm" onClick={async () => {
                        try {
                            await signInWithGoogle();
                        } catch (error) {
                            console.error("Sign in error:", error);
                        }
                    }}>
                        Conectar
                    </Button>
                ),
            });
            return;
        }

        const validation = await handleValidateTemplateLinksForSave({
            userId: user.uid,
            googleDocLink: editingTemplate.googleDocLink,
            projectDocLink: editingTemplate.projectDocLink,
        });

        if (!validation.success || !validation.canSave) {
            toast({
                variant: "destructive",
                title: "Erro ao Salvar",
                description: renderMessages(validation.blockingErrors),
            });
            return;
        }

        if (validation.warnings.length > 0) {
            toast({
                title: "Modelo salvo com observações",
                description: renderMessages(validation.warnings),
            });
        }

        const { id, isNew, ...templateData } = editingTemplate;

        const templateToSave = {
            name: templateData.name,
            description: templateData.description,
            markdownContent: templateData.markdownContent,
            googleDocLink: templateData.googleDocLink || "",
            projectDocLink: templateData.projectDocLink || "",
            contractTypes: templateData.contractTypes || [],
            linkValidation: validation.validations,
        };

        if (isNew) {
            // Add new document
            const collectionRef = collection(firestore, 'contractModels');
            const newDocRef = await addDocumentNonBlocking(collectionRef, templateToSave);
            toast({
                title: "Modelo Criado!",
                description: `O modelo "${templateToSave.name}" foi salvo com sucesso.`,
            });
            if (newDocRef) {
                setSelectedTemplateId(newDocRef.id);
            }
        } else {
            // Update existing document
            const templateRef = doc(firestore, 'contractModels', id);
            setDocumentNonBlocking(templateRef, templateToSave, { merge: true });
            toast({
                title: "Modelo Salvo!",
                description: `O modelo "${templateToSave.name}" foi salvo com sucesso.`,
            });
        }

        // Exit editing mode
        setEditingTemplate(null);

    }, [editingTemplate, firestore, signInWithGoogle, toast, user]);

    const handleCancelEditing = useCallback(() => {
        setEditingTemplate(null);
    }, []);


    const handleDeleteTemplate = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!user || !firestore) return;

        if (window.confirm("Tem certeza que deseja deletar este modelo?")) {
            const templateRef = doc(firestore, 'contractModels', id);
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

    const isEditing = !!editingTemplate;

    return (
        <>
            <div className="page-shell">
                {/* Sidebar */}
                <div className="page-width-wide grid gap-6 xl:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)]">
                <aside className="surface-panel flex flex-col gap-4 p-4 xl:sticky xl:top-28 xl:max-h-[calc(100svh-8rem)]">
                    <div className="space-y-2 mb-4">
                        <Button className="w-full" onClick={handleNewTemplate} disabled={!user}>
                            <Plus className="mr-2 h-4 w-4" /> Novo Modelo
                        </Button>
                    </div>
                    <h2 className="text-lg font-semibold mb-2 px-2">Modelos Salvos</h2>
                    <div className="max-h-[22rem] overflow-y-auto xl:max-h-none xl:flex-1">
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
                                                selectedTemplateId === template.id && !isEditing
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
                <main className="min-w-0">
                    <div className="space-y-8">
                        {isEditing ? (
                            <TemplateEditor
                                template={editingTemplate}
                                onTemplateChange={handleTemplateChange}
                                onSave={handleSaveTemplate}
                                onCancel={handleCancelEditing}
                            />
                        ) : (
                            <Card className="flex items-center justify-center p-8 border-dashed bg-card/50 min-h-[400px]">
                                <div className="text-center">
                                    <h3 className="text-xl font-semibold">Selecione um modelo para editar</h3>
                                    <p className="text-muted-foreground mt-2">Escolha um modelo na barra lateral para visualizar e editar, ou clique em "Novo Modelo" para começar do zero.</p>
                                    <div className="mt-6 space-y-2">
                                        <Button variant="outline" onClick={handleOpenExtractDialog} disabled={!allDocuments?.length}>
                                            <Wand2 className="mr-2 h-4 w-4" /> Criar template de um documento
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>
                </main>
                </div>
            </div>

            {/* Extract Template Dialog */}
            <Dialog open={isExtractDialogOpen} onOpenChange={setIsExtractDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Criar Template de Documento</DialogTitle>
                        <DialogDescription>
                            Selecione um documento para extrair um modelo genérico. A IA identificará as variáveis e as substituirá por placeholders.
                        </DialogDescription>
                    </DialogHeader>
                    
                    {!extractedTemplate ? (
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Selecione um documento</Label>
                                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                                    {allDocuments?.filter(d => d.status === 'uploaded' || d.status === 'indexed').length === 0 ? (
                                        <p className="text-sm text-muted-foreground p-2">
                                            Nenhum documento disponível. Carregue documentos em um projeto primeiro.
                                        </p>
                                    ) : (
                                        allDocuments?.filter(d => d.status === 'uploaded' || d.status === 'indexed').map(doc => (
                                            <div
                                                key={doc.id}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors",
                                                    selectedDocumentId === doc.id
                                                        ? "bg-primary/10 border border-primary"
                                                        : "hover:bg-muted"
                                                )}
                                                onClick={() => setSelectedDocumentId(doc.id)}
                                            >
                                                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">{doc.originalFileName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {doc.documentType} • v{doc.version}
                                                    </p>
                                                </div>
                                                {selectedDocumentId === doc.id && (
                                                    <Check className="h-4 w-4 text-primary shrink-0" />
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                                <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                                    Template extraído com sucesso!
                                </p>
                                <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                                    O template foi gerado e está pronto para ser personalizado.
                                </p>
                            </div>
                            <div className="bg-muted rounded-lg p-4 max-h-60 overflow-y-auto">
                                <pre className="text-xs whitespace-pre-wrap font-mono">
                                    {extractedTemplate}
                                </pre>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!extractedTemplate ? (
                            <>
                                <Button variant="outline" onClick={() => setIsExtractDialogOpen(false)}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleExtractTemplate} disabled={!selectedDocumentId || isExtracting}>
                                    {isExtracting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Extraindo...
                                        </>
                                    ) : (
                                        <>
                                            <Wand2 className="mr-2 h-4 w-4" />
                                            Extrair Template
                                        </>
                                    )}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="outline" onClick={() => {
                                    setExtractedTemplate(null);
                                    setSelectedDocumentId(null);
                                }}>
                                    Extrair Outro
                                </Button>
                                <Button onClick={handleUseExtractedTemplate}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Usar este Template
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
