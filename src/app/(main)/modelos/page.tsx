
"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, File as FileIcon, Trash2, Copy, Check } from "lucide-react";
import { collection, doc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useFirebase, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";


const INSTRUCTIONS_PROMPT = `Você é um especialista em criar modelos de documentos. Analise o contrato preenchido abaixo e crie um modelo genérico em formato Markdown.

Sua tarefa é identificar as partes que são variáveis (como nomes, datas, valores, descrições específicas) e substituí-las por placeholders no formato {{NOME_DA_VARIAVEL_EM_MAIUSCULAS}}.

O output deve ser APENAS o texto do modelo em Markdown, usando cabeçalhos de nível 1 (# TÍTULO DA CLÁUSULA) para cada cláusula. Não adicione nenhuma explicação extra.

Conteúdo do Contrato:
[COLE SEU CONTEÚDO DE CONTRATO AQUI]
`;

function InstructionsCard() {
    const { toast } = useToast();
    const [hasCopied, setHasCopied] = useState(false);

    const handleCopyPrompt = () => {
        navigator.clipboard.writeText(INSTRUCTIONS_PROMPT).then(() => {
            setHasCopied(true);
            toast({ title: "Prompt copiado para a área de transferência!" });
            setTimeout(() => setHasCopied(false), 3000);
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Instruções para Gerar Modelo com ChatGPT</CardTitle>
                <CardDescription>
                    Siga os passos abaixo para criar um modelo de contrato usando uma IA externa como o ChatGPT.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>1. Copie o Prompt</Label>
                    <p className="text-xs text-muted-foreground">
                        Use o prompt abaixo como base para sua solicitação no ChatGPT.
                    </p>
                    <div className="relative">
                        <Textarea
                            readOnly
                            value={INSTRUCTIONS_PROMPT}
                            className="h-32 resize-none font-mono text-xs"
                        />
                        <Button
                            size="sm"
                            variant="ghost"
                            className="absolute right-2 top-2"
                            onClick={handleCopyPrompt}
                        >
                            {hasCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label>2. Gere o Modelo no ChatGPT</Label>
                    <p className="text-xs text-muted-foreground">
                        Abra o <a href="https://chatgpt.com/" target="_blank" rel="noreferrer" className="underline font-semibold">ChatGPT</a>, cole o prompt e, em seguida, cole o conteúdo do seu contrato no local indicado.
                    </p>
                </div>
                 <div className="space-y-2">
                    <Label>3. Crie e Cole o Modelo</Label>
                    <p className="text-xs text-muted-foreground">
                        Clique em "Novo Modelo", cole o resultado gerado pela IA no campo "Conteúdo do Modelo" e salve.
                    </p>
                </div>
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

    // Effect to select the first template by default
    useEffect(() => {
        if (!isLoading && templates && templates.length > 0 && !selectedTemplateId && !editingTemplate) {
            setSelectedTemplateId(templates[0].id);
        }
    }, [isLoading, templates, selectedTemplateId, editingTemplate]);

    // Effect to load the selected template into the editor
    useEffect(() => {
        if (selectedTemplateId && templates) {
            const templateToEdit = templates.find(t => t.id === selectedTemplateId);
            if (templateToEdit) {
                setEditingTemplate(JSON.parse(JSON.stringify(templateToEdit))); // Deep copy
            }
        }
    }, [selectedTemplateId, templates]);
    
    const templateForPreview = useMemo(() => {
        // Preview should always show the content from the editor if it's open
        if (editingTemplate) return editingTemplate;
        // Otherwise, show the selected (and saved) template from the list
        return templates?.find((t) => t.id === selectedTemplateId) ?? null;
    }, [templates, selectedTemplateId, editingTemplate]);

    const startEditing = useCallback((template: Template) => {
        setSelectedTemplateId(template.id);
        setEditingTemplate(JSON.parse(JSON.stringify(template)));
    }, []);

    const handleNewTemplate = useCallback(() => {
        const newId = `template-${Date.now()}`;
        const newTemplate: Template = {
            id: newId,
            name: "Novo Modelo sem Título",
            description: "",
            markdownContent: "# Novo Modelo\n\nComece a editar...",
            googleDocLink: "",
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

    const handleTemplateChange = useCallback((field: keyof Omit<Template, 'id'>, value: string) => {
        if (editingTemplate) {
            setEditingTemplate(prev => prev ? { ...prev, [field]: value } : null);
        }
    }, [editingTemplate]);

    const handleSaveTemplate = useCallback(() => {
        if (!editingTemplate || !user || !firestore) return;

        const { id, ...templateData } = editingTemplate;
        
        // Ensure all fields are present for saving
        const templateToSave = {
            name: templateData.name,
            description: templateData.description,
            markdownContent: templateData.markdownContent,
            googleDocLink: templateData.googleDocLink || "",
        };

        const templateRef = doc(firestore, 'users', user.uid, 'contractModels', id);

        setDocumentNonBlocking(templateRef, templateToSave, { merge: true });

        toast({
            title: "Modelo Salvo!",
            description: `O modelo "${editingTemplate.name}" foi salvo com sucesso.`,
        });
        
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
            <main className="w-1/2 p-8 overflow-y-auto">
                <div className="space-y-8">
                     <InstructionsCard />
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

    
