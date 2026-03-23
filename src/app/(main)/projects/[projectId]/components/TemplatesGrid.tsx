'use client';

import { useState } from 'react';
import { FileText, ExternalLink, Pencil, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { type Template } from '@/lib/types';
import { EditLinkModal } from './EditLinkModal';

interface TemplatesGridProps {
  contractType: string;
  projectId: string;
  canEdit: boolean;
}

export function TemplatesGrid({ contractType, projectId, canEdit }: TemplatesGridProps) {
  const { firestore } = useFirebase();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Query templates that match the contract type
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !contractType) return null;
    return query(
      collection(firestore, 'contractModels'),
      where('contractTypes', 'array-contains', contractType)
    );
  }, [firestore, contractType]);

  const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!templates || templates.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum modelo encontrado</h3>
          <p className="text-muted-foreground mb-2">
            Não existem modelos cadastrados para o tipo de contrato <strong>{contractType}</strong>.
          </p>
          <p className="text-sm text-muted-foreground">
            Vá para a aba &quot;Modelos&quot; para criar modelos compatíveis com este tipo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs mt-1">
                    {template.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col gap-2">
              {/* Documento Original Button */}
              {template.googleDocLink ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  asChild
                >
                  <a
                    href={template.googleDocLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center"
                  >
                    <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">Documento Original</span>
                  </a>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  disabled
                >
                  <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate text-muted-foreground">Sem link original</span>
                </Button>
              )}

              {/* Link Customizado Button + Edit */}
              <div className="flex gap-2">
                {template.projectDocLink ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start"
                    asChild
                  >
                    <a
                      href={template.projectDocLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center"
                    >
                      <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">Link Customizado</span>
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-start"
                    disabled
                  >
                    <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate text-muted-foreground">Adicionar Link</span>
                  </Button>
                )}

                {/* Edit Button - Discreet */}
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setEditingTemplate(template)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Contract Type Badge */}
              <Badge variant="secondary" className="mt-auto self-start text-xs">
                {contractType}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Link Modal */}
      <EditLinkModal
        template={editingTemplate}
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        projectId={projectId}
      />
    </>
  );
}
