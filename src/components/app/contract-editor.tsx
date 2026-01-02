
"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { ArrowLeft, ArrowRight, Save, CheckCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ContractEditorProps {
  initialContent: string;
  onContentChange: (newContent: string) => void;
  onClauseChange?: (newClauseContent: string) => void;
}

const parseClauses = (content: string) => {
  if (!content) return [{ title: "Contrato", content: "" }];

  const clauses = content.split(/(\n#{1,3}\s.*)/).filter(Boolean);
  const result: { title: string; content: string }[] = [];

  for (let i = 0; i < clauses.length; i += 2) {
    const title = clauses[i]?.trim() || "Introdução";
    const content = clauses[i + 1] || "";
    result.push({ title, content });
  }

  return result.length > 0 ? result : [{ title: "Contrato", content }];
};

export function ContractEditor({ initialContent, onContentChange, onClauseChange }: ContractEditorProps) {
  const [clauses, setClauses] = useState(() => parseClauses(initialContent || ""));
  const [currentClauseIndex, setCurrentClauseIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, startSaving] = useTransition();

  const currentClause = clauses[currentClauseIndex];

  useEffect(() => {
    // When the initialContent from props changes (e.g., after async load), re-parse clauses.
    setClauses(parseClauses(initialContent || ""));
    setCurrentClauseIndex(0);
  }, [initialContent]);


  useEffect(() => {
    if (currentClause && onClauseChange) {
      onClauseChange(currentClause.title + '\n' + currentClause.content);
    }
  }, [currentClause, onClauseChange]);

  const handleClauseContentChange = (newClauseContent: string) => {
    setIsSaved(false);
    const updatedClauses = clauses.map((c, index) =>
      index === currentClauseIndex ? { ...c, content: newClauseContent } : c
    );
    setClauses(updatedClauses);
  };

  const handleSave = () => {
    startSaving(() => {
      const fullContent = clauses
        .map((c) => `${c.title}\n${c.content}`)
        .join("\n");
      onContentChange(fullContent);
      setIsSaved(true);
    });
  };

  const goToNext = () => {
    if (currentClauseIndex < clauses.length - 1) {
      setCurrentClauseIndex(currentClauseIndex + 1);
    }
  };

  const goToPrev = () => {
    if (currentClauseIndex > 0) {
      setCurrentClauseIndex(currentClauseIndex - 1);
    }
  };

  if (!currentClause) {
    return null; // Or a loading state
  }

  return (
    <div className="flex h-full flex-col rounded-lg border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Editor de Cláusulas</h2>
        <span className="text-sm text-muted-foreground">
          Cláusula {currentClauseIndex + 1} de {clauses.length}
        </span>
      </div>
      <div className="mb-4 rounded-md border bg-muted p-4">
        <ReactMarkdown className="prose prose-sm max-w-none dark:prose-invert">{currentClause.title}</ReactMarkdown>
      </div>
      <RichTextEditor
        value={currentClause.content}
        onChange={(value) => handleClauseContentChange(value)}
        placeholder="Preencha o conteúdo da cláusula aqui..."
        className="flex-1"
      />
      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" onClick={goToPrev} disabled={currentClauseIndex === 0}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
        </Button>
        <Button variant="secondary" onClick={handleSave} disabled={isSaving || isSaved}>
          {isSaving ? (<>Salvando...</>) : isSaved ?
            (<><CheckCircle className="mr-2 h-4 w-4" /> Salvo</>) :
            (<><Save className="mr-2 h-4 w-4" /> Salvar Progresso</>)}
        </Button>
        <Button variant="outline" onClick={goToNext} disabled={currentClauseIndex === clauses.length - 1}>
          Próximo <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
