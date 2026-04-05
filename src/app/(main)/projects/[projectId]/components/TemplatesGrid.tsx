'use client';

import { useState, useMemo } from 'react';
import { FileText, ExternalLink, Pencil, Loader2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { type Template, type OfficialTemplateSync } from '@/lib/types';
import { EditLinkModal } from './EditLinkModal';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplatesGridProps {
  contractType: string;
  projectId: string;
  canEdit: boolean;
}

export function TemplatesGrid({ contractType, projectId, canEdit }: TemplatesGridProps) {
  const { firestore } = useFirebase();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Normalise contract type to match database standards
  const normalizedContractType = useMemo(() => {
    if (!contractType) return '';
    const type = contractType.toLowerCase();
    
    // Exact match map for common legacy/lowercase values
    const typeMap: Record<string, string> = {
      'ted': 'TED',
      'acordo de parceria (lei de inovação)': 'Acordo de Parceria (Lei de Inovação)',
      'acordo de parceria (embrapii)': 'Acordo de Parceria (Embrapii)',
      'contrato de extensão tecnológica': 'Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)',
      'contrato de extensão tecnológica (prestação de serviços técnicos)': 'Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)'
    };

    return typeMap[type] || contractType;
  }, [contractType]);

  // Query templates that match the contract type
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore || !normalizedContractType) return null;
    return query(
      collection(firestore, 'contractModels'),
      where('contractTypes', 'array-contains', normalizedContractType)
    );
  }, [firestore, normalizedContractType]);

  const { data: templates, isLoading } = useCollection<Template>(templatesQuery);

  // Get the latest official template sync log
  const syncLogsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'officialTemplateSyncs'),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
  }, [firestore]);

  const { data: syncLogs } = useCollection<OfficialTemplateSync>(syncLogsQuery);
  const lastSync = syncLogs?.[0];

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

              {/* Link Customizado / Fallback Button + Edit */}
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
                      <span className="truncate">Versão Customizada</span>
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
                    <span className="truncate text-muted-foreground">Adicionar Fallback</span>
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

              {/* Sync Status Badge */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="mt-2">
                      {template.syncStatus === 'synced' && (
                        <Badge className="bg-green-500 hover:bg-green-600 cursor-pointer">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> 
                          Sincronizado
                        </Badge>
                      )}
                      {template.syncStatus === 'outdated' && (
                        <Badge className="bg-yellow-500 hover:bg-yellow-600 cursor-pointer">
                          <AlertCircle className="mr-1 h-3 w-3" /> 
                          Atualização Pendente
                        </Badge>
                      )}
                      {template.syncStatus === 'error' && (
                        <Badge variant="destructive" className="cursor-pointer">
                          <AlertCircle className="mr-1 h-3 w-3" /> 
                          Erro na Sincronização
                        </Badge>
                      )}
                      {!template.syncStatus && (
                        <Badge variant="outline" className="text-muted-foreground whitespace-nowrap">
                          <RefreshCw className="mr-1 h-3 w-3" /> 
                          {lastSync 
                            ? `Check: ${format(new Date(lastSync.timestamp), "dd/MM 'às' HH:mm", { locale: ptBR })}`
                            : 'Aguardando Sync'
                          }
                        </Badge>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-2">
                      <p className="font-medium">
                        {template.syncStatus === 'synced' && 'Template sincronizado com versão oficial'}
                        {template.syncStatus === 'outdated' && 'Nova versão disponível no site oficial'}
                        {template.syncStatus === 'error' && 'Erro ao sincronizar com versão oficial'}
                        {!template.syncStatus && 'Ainda não sincronizado com versão oficial'}
                      </p>
                      {template.lastOfficialSync ? (
                        <p className="text-xs text-muted-foreground">
                          Última verificação: {formatDistanceToNow(new Date(template.lastOfficialSync), { addSuffix: true, locale: ptBR })}
                        </p>
                      ) : lastSync && (
                        <p className="text-xs text-muted-foreground">
                          Última checagem geral: {formatDistanceToNow(new Date(lastSync.timestamp), { addSuffix: true, locale: ptBR })}
                        </p>
                      )}
                      {template.officialSourceUrl && (
                        <p className="text-xs truncate">
                          Fonte: <a href={template.officialSourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{template.officialSourceUrl}</a>
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
