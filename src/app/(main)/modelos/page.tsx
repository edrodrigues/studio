
"use client";

import { useState, useCallback, memo, useRef, ChangeEvent } from "react";
import { Plus, Trash2, FileText, UploadCloud, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import useLocalStorage from "@/hooks/use-local-storage";
import { type Template } from "@/lib/types";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

const WelcomeScreen = memo(() => {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30 rounded-lg">
      <Card className="w-full max-w-lg text-center shadow-none border-0 bg-transparent">
        <CardHeader>
          <CardTitle>Bem-vindo ao Gerenciador de Modelos</CardTitle>
          <CardDescription>
            Selecione um modelo na barra lateral para editar ou crie um novo para começar.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
});
WelcomeScreen.displayName = "WelcomeScreen";

function TemplateEditor({
  template: initialTemplate,
  onSave,
  onCancel,
  onImport,
}: {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
  onImport: (file: File) => void;
}) {
  const [editedTemplate, setEditedTemplate] = useState(initialTemplate);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(editedTemplate);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setEditedTemplate(prev => ({ ...prev, [id]: value }));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImport(file);
    }
  };

  const triggerFileSelect = () => fileInputRef.current?.click();


  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
      <div className="flex flex-col gap-8">
        {/* Import Card */}
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
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".md, .txt"
            />
            <Button onClick={triggerFileSelect}>
              <UploadCloud className="mr-2 h-4 w-4" />
              Carregar Modelo
            </Button>
          </CardContent>
        </Card>

        {/* Edit Card */}
        <Card className="flex-1">
          <CardHeader>
            <div className="flex items-center gap-2">
                <Edit className="h-5 w-5" />
                <CardTitle>Editar Modelo</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nome do Modelo</Label>
              <Input
                id="name"
                value={editedTemplate.name}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={editedTemplate.description}
                onChange={handleInputChange}
              />
            </div>
            <div>
              <Label htmlFor="googleDocLink">Link do Modelo em Google Doc (Opcional)</Label>
              <Input
                id="googleDocLink"
                value={editedTemplate.googleDocLink || ""}
                onChange={handleInputChange}
                placeholder="https://docs.google.com/document/d/..."
              />
            </div>
             <div>
                <Label htmlFor="content">Conteúdo do Modelo (Markdown)</Label>
                <Textarea
                id="content"
                value={editedTemplate.content}
                onChange={handleInputChange}
                className="min-h-[200px] font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">Use variáveis como {{'{'}}{'{'}NOME_VARIAVEL{'}'}{'}'}}.</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Preview Column */}
      <div className="flex flex-col">
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>Visualização em Tempo Real</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <ScrollArea className="h-full rounded-md border p-4">
                <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                    {`# ${editedTemplate.name}\n\n*${editedTemplate.description}*\n\n---\n\n${editedTemplate.content}`}
                </ReactMarkdown>
            </ScrollArea>
          </CardContent>
        </Card>
        <div className="mt-4 flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onCancel}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">Salvar Modelo</Button>
        </div>
      </div>
    </div>
  );
}

export default function ModelosPage() {
  const [templates, setTemplates] = useLocalStorage<Template[]>("templates", []);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

  const handleNewTemplate = () => {
    const newTemplate: Template = {
      id: `template-${Date.now()}`,
      name: "Novo Modelo Sem Título",
      description: "Descrição do novo modelo.",
      content: "# Cláusula 1\n\nEdite o conteúdo da cláusula aqui.",
    };
    setTemplates(prev => [...prev, newTemplate]);
    setActiveTemplateId(newTemplate.id);
  };

  const handleSaveTemplate = (updatedTemplate: Template) => {
    setTemplates(
      templates.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );
    setActiveTemplateId(null);
  };

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter((t) => t.id !== id));
    if (activeTemplateId === id) {
      setActiveTemplateId(null);
    }
  };

    const handleImportFromFile = (file: File) => {
        if (!activeTemplateId) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            setTemplates(templates.map(t => 
                t.id === activeTemplateId 
                ? { ...t, name: file.name.replace(/\.md$/, ''), content: content }
                : t
            ));
        };
        reader.readAsText(file);
    };

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) || null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-muted/20">
      <aside className="flex w-[280px] flex-col border-r bg-background p-4">
        <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={handleNewTemplate}>
          <Plus className="mr-2 h-4 w-4" /> Novo Modelo
        </Button>
        <ScrollArea className="flex-1 mt-4">
          <ul className="space-y-1">
            {templates.map((template) => (
              <li key={template.id} className="group">
                <button
                  onClick={() => setActiveTemplateId(template.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md p-2 text-left text-sm font-normal",
                    activeTemplateId === template.id 
                        ? "bg-green-600 text-white font-semibold" 
                        : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                  )}
                >
                  <span className="truncate">{template.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "h-7 w-7 opacity-0 group-hover:opacity-100",
                         activeTemplateId === template.id ? "text-white hover:bg-green-700" : "text-destructive hover:bg-destructive/10"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTemplate(template.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </button>
              </li>
            ))}
             {templates.length === 0 && (
                <p className="p-2 text-center text-xs text-muted-foreground">
                    Nenhum modelo criado.
                </p>
            )}
          </ul>
        </ScrollArea>
      </aside>

      <main className="flex-1 overflow-auto p-8">
        {activeTemplate ? (
          <TemplateEditor
            key={activeTemplate.id}
            template={activeTemplate}
            onSave={handleSaveTemplate}
            onCancel={() => setActiveTemplateId(null)}
            onImport={handleImportFromFile}
          />
        ) : (
          <WelcomeScreen />
        )}
      </main>
    </div>
  );
}


    