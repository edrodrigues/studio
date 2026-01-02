
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Plus, File as FileIcon, Trash2, Copy, Check } from "lucide-react";
import { collection, doc, addDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFirebase, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking, addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Checkbox } from "@/components/ui/checkbox";


const contractTypeOptions = [
    "TED",
    "Acordo de Parceria (Lei de Inovação)",
    "Acordo de Parceria (Embrapii)",
    "Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)"
];


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
                        <Label htmlFor="template-doc-link">Link do Modelo em Google Doc (Opcional)</Label>
                        <Input
                            id="template-doc-link"
                            value={template.googleDocLink || ""}
                            onChange={(e) => onTemplateChange("googleDocLink", e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Conteúdo do Modelo</Label>
                        <RichTextEditor
                            value={template.markdownContent}
                            onChange={(value) => onTemplateChange("markdownContent", value)}
                            placeholder="Escreva o conteúdo do seu modelo aqui..."
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
        return collection(firestore, 'contractModels');
    }, [user, firestore]);

    const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const { toast } = useToast();

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
            id: `new-${Date.now()}`, // Temporary ID for a new template
            name: "Novo Modelo sem Título",
            description: "",
            markdownContent: "# Novo Modelo\n\nComece a editar...",
            googleDocLink: "",
            contractTypes: [],
            isNew: true,
        };
        startEditing(newTemplate);
    }, [startEditing]);

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

        const { id, isNew, ...templateData } = editingTemplate;

        const templateToSave = {
            name: templateData.name,
            description: templateData.description,
            markdownContent: templateData.markdownContent,
            googleDocLink: templateData.googleDocLink || "",
            contractTypes: templateData.contractTypes || [],
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

    }, [editingTemplate, user, firestore, toast]);

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
            <main className="flex-1 p-8 overflow-y-auto">
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
                            </div>
                        </Card>
                    )}
                </div>
            </main>

        </div>
    );
}





