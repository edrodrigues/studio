"use client";

import { useState, useCallback, memo } from "react";
import { Plus, Trash2, FileText, Copy, Book } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";

const PROMPT_EXAMPLE = `Crie um modelo de contrato administrativo de cooperação em Markdown entre o V-Lab e a UFPE. O modelo deve ser completo, com seções claras para:
- Objeto
- Vigência
- Valor e Dotação Orçamentária
- Obrigações das Partes
- Propriedade Intelectual
- Rescisão
- Foro

Use variáveis no formato {{NOME_DA_VARIAVEL}} para campos que serão preenchidos posteriormente, como:
- {{NUMERO_PROCESSO}}
- {{NOME_PROJETO}}
- {{OBJETO_CONTRATO}}
- {{VALOR_TOTAL}}
- {{COORDENADOR_VLAB}}
- {{COORDENADOR_UFPE}}
- {{DATA_ASSINATURA}}
`;

const WelcomeScreenMemoized = memo(function WelcomeScreen() {
    const { toast } = useToast();

    const copyPrompt = useCallback(() => {
        navigator.clipboard.writeText(PROMPT_EXAMPLE);
        toast({ title: "Prompt copiado para a área de transferência!" });
    }, [toast]);

    return (
        <div className="flex h-full items-center justify-center">
            <Card className="max-w-2xl text-center">
                <CardHeader>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Book size={28}/>
                    </div>
                    <CardTitle>Gerencie Seus Modelos de Contrato</CardTitle>
                    <CardDescription>
                        Crie, edite e visualize seus modelos aqui. Para começar, crie um novo modelo ou selecione um existente na barra lateral.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Use uma IA para gerar a base do seu modelo. Copie o prompt abaixo e cole no seu assistente de IA preferido:
                    </p>
                    <div className="relative rounded-md bg-muted p-4 text-left">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-7 w-7"
                            onClick={copyPrompt}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>
                        <pre className="whitespace-pre-wrap font-mono text-xs">
                            {PROMPT_EXAMPLE}
                        </pre>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
});
WelcomeScreenMemoized.displayName = "WelcomeScreen";

function TemplateEditor({
  template,
  onSave,
  onCancel,
}: {
  template: Template;
  onSave: (template: Template) => void;
  onCancel: () => void;
}) {
  const [editedTemplate, setEditedTemplate] = useState(template);

  const handleSave = () => {
    onSave(editedTemplate);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setEditedTemplate(prev => ({ ...prev, [id]: value }));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-1 pr-4">
        <div>
          <Label htmlFor="name">Nome do Modelo</Label>
          <Input
            id="name"
            value={editedTemplate.name}
            onChange={handleInputChange}
            className="text-lg font-semibold"
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
          <Label htmlFor="googleDocLink">Link do Google Doc (Opcional)</Label>
          <Input
            id="googleDocLink"
            value={editedTemplate.googleDocLink || ""}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="content">Conteúdo do Modelo (Markdown)</Label>
            <Textarea
              id="content"
              value={editedTemplate.content}
              onChange={handleInputChange}
              className="min-h-[400px] font-mono"
            />
            <p className="text-xs text-muted-foreground">Use variáveis como {{'{'}}{'{'}NOME_VARIAVEL{'}'}{'}'}}.</p>
          </div>
          <div>
            <Label>Pré-visualização</Label>
            <ScrollArea className="h-[425px] rounded-md border p-4">
              <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">
                {editedTemplate.content}
              </ReactMarkdown>
            </ScrollArea>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={handleSave}>Salvar Modelo</Button>
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
      content: "# Novo Modelo\n\nEste é um novo modelo de contrato. Edite o conteúdo aqui.",
    };
    setTemplates([...templates, newTemplate]);
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

  const activeTemplate = templates.find((t) => t.id === activeTemplateId) || null;

  return (
    <div className="container mx-auto h-[calc(100vh-4rem)] p-4">
      <div className="grid h-full grid-cols-1 md:grid-cols-[300px_1fr] md:gap-8">
        <aside className="flex flex-col rounded-lg border bg-card">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-lg font-semibold">Modelos</h2>
            <Button size="sm" onClick={handleNewTemplate}>
              <Plus className="mr-2 h-4 w-4" /> Novo
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <ul className="p-2">
              {templates.map((template) => (
                <li key={template.id} className="group">
                  <button
                    onClick={() => setActiveTemplateId(template.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md p-2 text-left hover:bg-accent hover:text-accent-foreground",
                      activeTemplateId === template.id && "bg-accent text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{template.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTemplate(template.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </aside>

        <main className="overflow-hidden">
          {activeTemplate ? (
            <TemplateEditor
              key={activeTemplate.id}
              template={activeTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => setActiveTemplateId(null)}
            />
          ) : (
            <WelcomeScreenMemoized />
          )}
        </main>
      </div>
    </div>
  );
}
