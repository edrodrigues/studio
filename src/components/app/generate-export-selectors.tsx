"use client";

import { useMemo } from "react";
import { Loader2, LayoutTemplate, FolderOpen } from "lucide-react";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Project, Template, ProjectDocument, DocumentStatus } from "@/lib/types";
import { summarizeTemplateValidation } from "@/lib/template-link-validation";

type ProjectRecord = Project & { id: string };

interface GenerateExportSelectorsProps {
  selectedProjectId: string | null;
  selectedTemplateId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onTemplateChange: (templateId: string | null) => void;
}

function getTemplateHealthBadge(template: Template) {
  const summary = summarizeTemplateValidation(template);
  const badges: Record<string, { label: string; className: string; isSelectable: boolean }> = {
    ready_with_fallback: { label: summary.label, className: "bg-blue-50 text-blue-700 border-blue-200", isSelectable: true },
    ready_original: { label: summary.label, className: "bg-green-50 text-green-700 border-green-200", isSelectable: true },
    ready_custom: { label: summary.label, className: "bg-emerald-50 text-emerald-700 border-emerald-200", isSelectable: true },
    ready_fallback_only: { label: summary.label, className: "bg-amber-50 text-amber-800 border-amber-200", isSelectable: true },
    pending_validation: { label: summary.label, className: "bg-slate-50 text-slate-700 border-slate-200", isSelectable: false },
  };
  return badges[summary.health] ?? { label: summary.label, className: "bg-rose-50 text-rose-700 border-rose-200", isSelectable: false };
}

export function GenerateExportSelectors({
  selectedProjectId,
  selectedTemplateId,
  onProjectChange,
  onTemplateChange,
}: GenerateExportSelectorsProps) {
  const { user } = useUser();
  const { firestore } = useFirebase();

  const projectsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, "projects"), where("createdBy", "==", user.uid));
  }, [firestore, user]);

  const { data: projects, isLoading: isLoadingProjects } = useCollection<Project>(projectsQuery);

  const projectDocsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, "projectDocuments"), orderBy("uploadedAt", "desc"));
  }, [firestore, user]);

  const { data: projectDocs } = useCollection<ProjectDocument>(projectDocsQuery);

  const indexedDocCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const doc of projectDocs || []) {
      if (doc.status === DocumentStatus.INDEXED) {
        counts.set(doc.projectId, (counts.get(doc.projectId) || 0) + 1);
      }
    }
    return counts;
  }, [projectDocs]);

  const projectsWithDocs = useMemo(() => {
    return (projects || [])
      .filter((p) => (indexedDocCounts.get(p.id) || 0) > 0)
      .map((p) => ({
        ...p,
        indexedDocCount: indexedDocCounts.get(p.id) || 0,
      }))
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
  }, [projects, indexedDocCounts]);

  const templatesQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, "contractModels");
  }, [firestore, user]);

  const { data: templates, isLoading: isLoadingTemplates } = useCollection<Template>(templatesQuery);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const selectedProject = projects?.find((p) => p.id === selectedProjectId);
    if (!selectedProject?.contractType) return templates;
    return templates.filter((t) =>
      t.contractTypes?.some((ct) => ct.toLowerCase() === selectedProject.contractType!.toLowerCase())
    );
  }, [templates, projects, selectedProjectId]);

  const templateStatuses = useMemo(() => {
    return filteredTemplates.reduce((acc, t) => {
      acc[t.id] = getTemplateHealthBadge(t);
      return acc;
    }, {} as Record<string, ReturnType<typeof getTemplateHealthBadge>>);
  }, [filteredTemplates]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <FolderOpen className="h-4 w-4 text-blue-500" />
          Projeto (Contexto)
        </Label>
        <Select value={selectedProjectId ?? ""} onValueChange={(v) => onProjectChange(v || null)}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione um projeto" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingProjects ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : projectsWithDocs.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                Nenhum projeto com documentos indexados
              </div>
            ) : (
              projectsWithDocs.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{project.name}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      {project.indexedDocCount} doc(s)
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <LayoutTemplate className="h-4 w-4 text-purple-500" />
          Modelo de Documento
        </Label>
        <Select
          value={selectedTemplateId ?? ""}
          onValueChange={(v) => onTemplateChange(v || null)}
          disabled={!selectedProjectId}
        >
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Selecione um modelo" />
          </SelectTrigger>
          <SelectContent>
            {isLoadingTemplates ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {selectedProjectId ? "Nenhum modelo para este tipo de contrato" : "Selecione um projeto primeiro"}
              </div>
            ) : (
              filteredTemplates.map((template) => {
                const status = templateStatuses[template.id];
                return (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    disabled={!status.isSelectable}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{template.name}</span>
                      <Badge variant="outline" className={cn("ml-2 text-[10px]", status.className)}>
                        {status.label}
                      </Badge>
                    </div>
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
