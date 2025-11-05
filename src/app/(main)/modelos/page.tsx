"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { Plus, Upload, File as FileIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import useLocalStorage from "@/hooks/use-local-storage";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";

const initialTemplates: Template[] = [
    {
      id: "template-1",
      name: "Acordo de Cooperação Técnica",
      description: "Modelo padrão para cooperação técnica sem transferência de recursos financeiros.",
      content: `# Acordo de Cooperação Técnica
  
  ## CLÁUSULA PRIMEIRA - DO OBJETO
  O presente Acordo de Cooperação tem por objeto o estabelecimento de mútua cooperação entre os partícipes, visando ao desenvolvimento de {{NOME_DO_PROJETO}}.
  
  ## CLÁUSULA SEGUNDA - DAS OBRIGAÇÕES
  {{DESCREVER_OBRIGACOES}}
  
  ## CLÁUSULA TERCEIRA - DA VIGÊNCIA
  O prazo de vigência deste instrumento será de {{PRAZO_EM_MESES}} meses, a contar da data de sua assinatura.`
    },
    {
      id: "template-2",
      name: "Termo de Confidencialidade",
      description: "Termo para garantir a confidencialidade das informações trocadas.",
      content: `# Termo de Confidencialidade
  
  ## CLÁUSULA PRIMEIRA - INFORMAÇÕES CONFIDENCIAIS
  Para os fins deste Acordo, "Informação Confidencial" significa toda informação, seja ela de natureza técnica, comercial, financeira, estratégica ou outra, revelada por uma Parte (a "Parte Reveladora") à outra (a "Parte Receptora").
  
  ## CLÁUSULA SEGUNDA - DEVER DE SIGILO
  A Parte Receptora se compromete a manter em absoluto sigilo e a não revelar, divulgar, ou de qualquer forma dar conhecimento a terceiros das Informações Confidenciais da Parte Reveladora.`
    }
];

function TemplateEditor({
    template,
    onTemplateChange,
    onSave,
    onCancel,
}: {
    template: Template | null;
    onTemplateChange: (field: keyof Template, value: string) => void;
    onSave: () => void;
    onCancel: () => void;
}) {
    if (!template) return null;

    return (
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileIcon className="h-5 w-5" /> Editar Modelo
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
                             value={template.content}
                             onChange={(e) => onTemplateChange("content", e.target.value)}
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
    const [templates, setTemplates] = useLocalStorage<Template[]>("templates", initialTemplates);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id ?? null);
    const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const selectedTemplate = useMemo(() => {
        if (editingTemplate) return editingTemplate;
        return templates.find((t) => t.id === selectedTemplateId) ?? null;
    }, [templates, selectedTemplateId, editingTemplate]);

    const startEditing = (template: Template) => {
        setEditingTemplate(JSON.parse(JSON.stringify(template))); // Deep copy
        setSelectedTemplateId(template.id);
    };

    const handleNewTemplate = () => {
        const newTemplate: Template = {
            id: `template-${Date.now()}`,
            name: "Novo Modelo sem Título",
            description: "",
            content: "# Novo Modelo\n\nComece a editar...",
        };
        startEditing(newTemplate);
    };

    const handleSelectTemplate = (id: string) => {
        if (editingTemplate) {
             toast({
                title: "Salve ou cancele suas alterações",
                description: "Você precisa salvar ou cancelar a edição atual antes de selecionar outro modelo.",
                variant: "destructive"
            });
            return;
        }
        setSelectedTemplateId(id);
    };

    const handleTemplateChange = (field: keyof Template, value: string) => {
        if (editingTemplate) {
            setEditingTemplate({ ...editingTemplate, [field]: value });
        }
    };

    const handleSaveTemplate = useCallback(() => {
        if (!editingTemplate) return;

        const isNew = !templates.some(t => t.id === editingTemplate.id);

        setTemplates(prev =>
            isNew
                ? [...prev, editingTemplate]
                : prev.map(t => (t.id === editingTemplate.id ? editingTemplate : t))
        );

        toast({
            title: "Modelo Salvo!",
            description: `O modelo "${editingTemplate.name}" foi salvo com sucesso.`,
        });

        setSelectedTemplateId(editingTemplate.id);
        setEditingTemplate(null);
    }, [editingTemplate, setTemplates, templates, toast]);

    const handleCancelEditing = useCallback(() => {
        setEditingTemplate(null);
        if (!templates.some(t => t.id === selectedTemplateId)) {
            setSelectedTemplateId(templates[0]?.id ?? null);
        }
    }, [templates, selectedTemplateId]);

    const handleDeleteTemplate = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Tem certeza que deseja deletar este modelo?")) {
            setTemplates(prev => prev.filter(t => t.id !== id));
            if (selectedTemplateId === id) {
                setSelectedTemplateId(templates[0]?.id ?? null);
            }
            toast({ title: "Modelo deletado." });
        }
    };
    
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            const newTemplate: Template = {
                id: `template-${Date.now()}`,
                name: file.name.replace(/\.md$/, ""),
                description: "Importado de arquivo Markdown.",
                content: content,
            };
            startEditing(newTemplate);
            toast({ title: "Arquivo importado", description: "O modelo foi carregado no editor." });
        };
        reader.readAsText(file);
        
        // Reset file input
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] bg-muted/20">
            {/* Sidebar */}
            <aside className="w-1/4 min-w-[250px] max-w-[300px] border-r bg-background p-4">
                <div className="flex flex-col h-full">
                    <Button className="w-full mb-4" onClick={handleNewTemplate}>
                        <Plus className="mr-2 h-4 w-4" /> Novo Modelo
                    </Button>
                    <h2 className="text-lg font-semibold mb-2 px-2">Modelos Salvos</h2>
                    <ul className="space-y-1 overflow-y-auto flex-1">
                        {templates.map((template) => (
                            <li key={template.id}>
                                <button
                                    onClick={() => handleSelectTemplate(template.id)}
                                    className={cn(
                                        "w-full text-left p-2 rounded-md transition-colors text-sm flex justify-between items-center group",
                                        selectedTemplateId === template.id && !editingTemplate
                                            ? "bg-primary text-primary-foreground"
                                            : "hover:bg-muted"
                                    )}
                                >
                                    <span className="truncate">{template.name}</span>
                                     <Trash2 
                                        className="h-4 w-4 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => handleDeleteTemplate(e, template.id)}
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>

            {/* Main Content */}
            <main className="w-1/2 p-8 overflow-y-auto">
                 {!editingTemplate ? (
                    <div className="space-y-8">
                         <Card>
                             <CardHeader>
                                 <CardTitle>Importar Modelo de Arquivo Markdown (.md)</CardTitle>
                                 <CardDescription>
                                     Faça o upload de um arquivo .md para configurar um novo modelo automaticamente. O sistema usará os cabeçalhos de nível 1 (# Título) como títulos das cláusulas.
                                 </CardDescription>
                             </CardHeader>
                             <CardContent>
                                  <input 
                                     type="file" 
                                     className="hidden" 
                                     ref={fileInputRef} 
                                     onChange={handleFileUpload}
                                     accept=".md"
                                 />
                                 <Button onClick={() => fileInputRef.current?.click()}>
                                     <Upload className="mr-2 h-4 w-4" />
                                     Carregar Modelo
                                 </Button>
                             </CardContent>
                         </Card>
                         <Card className="flex items-center justify-center p-8 border-dashed">
                            <div className="text-center">
                                <h3 className="text-xl font-semibold">Selecione um modelo</h3>
                                <p className="text-muted-foreground">Escolha um modelo na barra lateral para visualizar ou clique em "Novo Modelo" para começar um do zero.</p>
                            </div>
                        </Card>
                    </div>
                ) : (
                    <TemplateEditor 
                        template={editingTemplate} 
                        onTemplateChange={handleTemplateChange}
                        onSave={handleSaveTemplate}
                        onCancel={handleCancelEditing}
                    />
                )}
            </main>

            {/* Preview */}
            <aside className="w-1/4 min-w-[300px] border-l bg-background p-6">
                <div className="sticky top-0">
                    <h2 className="text-xl font-semibold mb-4">Visualização em Tempo Real</h2>
                    {selectedTemplate ? (
                        <Card className="h-[calc(100vh-10rem)]">
                            <CardContent className="p-6 h-full overflow-y-auto">
                                <ReactMarkdown
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    components={{
                                        p: ({node, ...props}) => <p className="mb-4" {...props} />,
                                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-4" {...props} />,
                                        h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-6 mb-2" {...props} />,
                                    }}
                                >
                                    {selectedTemplate.content}
                                </ReactMarkdown>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center text-muted-foreground mt-16">
                            <p>Selecione um modelo para visualizar.</p>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
