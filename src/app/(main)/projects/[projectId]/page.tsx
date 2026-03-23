
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen,
  Users,
  FileText,
  Activity,
  Settings,
  Plus,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Database,
  ExternalLink,
  Eye,
  History,
  ChevronDown,
  ChevronRight,
  Download,
  FileSignature,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DocumentStatus, type Contract } from '@/lib/types';
import { formatFileSize } from '@/lib/storage';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection } from 'firebase/firestore';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { useUser } from '@/firebase/provider';
import {
  useProject,
  useProjectMembers,
  useProjectContracts,
  useProjectDocuments,
  useActivity,
  usePresence,
  usePermission
} from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectDocumentsUploader } from './components/ProjectDocumentsUploader';
import { TemplatesGrid } from './components/TemplatesGrid';
import { isValidDate, safeNewDate } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const VIEW_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  documents: 'Documentos',
  sync: 'Sincronização',
  contracts: 'Contratos',
  activity: 'Atividade',
  settings: 'Configurações',
  placeholders: 'Variáveis',
  members: 'Membros',
};

// Active users indicator with enhanced UI
function ActiveUsersIndicator({ projectId }: { projectId: string }) {
  const { activeUsers, updatePresence } = usePresence(projectId);

  useEffect(() => {
    updatePresence({ currentView: 'dashboard' });
  }, [updatePresence, projectId]);

  if (!activeUsers || activeUsers.length <= 1) return null;

  const otherUsers = activeUsers.filter(u => u.userId !== activeUsers[0]?.userId);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="text-sm font-medium">
            {otherUsers.length} online
          </span>
        </div>
        
        <div className="flex -space-x-3">
          {otherUsers.slice(0, 5).map((user, index) => (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar 
                    className="h-8 w-8 border-2 border-background ring-2 ring-background"
                    style={{ zIndex: 10 - index }}
                  >
                    <AvatarImage src={user.userPhotoURL} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {user.userName?.charAt(0)?.toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator dot */}
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 bg-emerald-500 border-2 border-background rounded-full"></span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="space-y-1">
                <p className="font-medium">{user.userName}</p>
                {user.currentView && (
                  <p className="text-xs text-muted-foreground">
                    📄 {VIEW_LABELS[user.currentView] || user.currentView}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Visto há {formatTimeAgo(user.lastSeenAt)}
                </p>
              </TooltipContent>
            </Tooltip>
          ))}
          {otherUsers.length > 5 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted border-2 border-background text-xs font-medium">
                  +{otherUsers.length - 5}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{otherUsers.length - 5} mais</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'alguns segundos';
  if (diffMins === 1) return '1 minuto';
  if (diffMins < 60) return `${diffMins} minutos`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours === 1) return '1 hora';
  if (diffHours < 24) return `${diffHours} horas`;
  
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 dia';
  return `${diffDays} dias`;
}

// Documents tab content
function DocumentsTab({ projectId }: { projectId: string }) {
  return <ProjectDocumentsUploader projectId={projectId} />;
}

// Sync status helpers
const SYNC_STATUS_CONFIG = {
  [DocumentStatus.INDEXED]: {
    label: 'Indexado',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badge: 'default' as const,
    isIndexed: true,
  },
  [DocumentStatus.PROCESSING]: {
    label: 'Processando',
    icon: RefreshCw,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    badge: 'secondary' as const,
    isIndexed: false,
  },
  [DocumentStatus.UPLOADED]: {
    label: 'Aguardando Sync',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'outline' as const,
    isIndexed: false,
  },
  [DocumentStatus.ERROR]: {
    label: 'Erro',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'destructive' as const,
    isIndexed: false,
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  planOfWork: 'Plano de Trabalho',
  termOfExecution: 'Termo de Execução',
  budgetSpreadsheet: 'Planilha Orçamentária',
  other: 'Outro',
};

// Sync tab content with version grouping
function SyncTab({ projectId }: { projectId: string }) {
  const { documents, isLoading } = useProjectDocuments(projectId);
  const { user } = useUser();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum documento sincronizado</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Carregue documentos na aba &quot;Documentos&quot; e clique em
            &quot;Sincronizar Arquivos&quot; para indexar o conteúdo no contexto de IA.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group documents by type
  const documentsByType = useMemo(() => {
    const groups: Record<string, typeof documents> = {};
    documents.forEach(doc => {
      const type = doc.documentType || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(doc);
    });
    // Sort each group by version descending
    Object.keys(groups).forEach(type => {
      groups[type].sort((a, b) => b.version - a.version);
    });
    return groups;
  }, [documents]);

  const indexedCount = documents.filter((d) => d.status === DocumentStatus.INDEXED).length;
  const processingCount = documents.filter((d) => d.status === DocumentStatus.PROCESSING).length;
  const errorCount = documents.filter((d) => d.status === DocumentStatus.ERROR).length;

  const formatIndexedDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleDownload = async (doc: any) => {
    if (!user) return;
    try {
      const { getDownloadUrl } = await import('@/lib/actions/storage-actions');
      let downloadUrl = doc.fileUrl;
      if (doc.storageProvider === 'r2') {
        const result = await getDownloadUrl(projectId, user.uid, doc.storagePath);
        if (result.success && result.url) {
          downloadUrl = result.url;
        }
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const renderDocumentVersion = (doc: any, isLatest: boolean) => {
    const statusCfg = SYNC_STATUS_CONFIG[doc.status as DocumentStatus] ?? SYNC_STATUS_CONFIG[DocumentStatus.UPLOADED];
    const StatusIcon = statusCfg.icon;
    const isIndexed = doc.status === DocumentStatus.INDEXED;

    return (
      <div 
        key={doc.id} 
        className={`flex items-start gap-3 py-3 ${!isLatest ? 'border-t border-border/50' : ''}`}
      >
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${statusCfg.bg}`}>
          <StatusIcon className={`h-4 w-4 ${statusCfg.color} ${doc.status === DocumentStatus.PROCESSING ? 'animate-spin' : ''}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm truncate">{doc.originalFileName}</span>
            {!isLatest && (
              <Badge variant="outline" className="text-xs bg-muted/50">
                v{doc.version} (anterior)
              </Badge>
            )}
            {isIndexed && isLatest && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 text-xs shrink-0">
                <span className="mr-1">✨</span> No contexto ALEX
              </Badge>
            )}
            {!isIndexed && (
              <Badge variant={statusCfg.badge} className="text-xs shrink-0">
                {statusCfg.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
            <span>Enviado: {formatDate(doc.uploadedAt)}</span>
            {isIndexed && doc.fileSearchIndexedAt && (
              <>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400">Indexado: {formatIndexedDate(doc.fileSearchIndexedAt)}</span>
              </>
            )}
            <span>•</span>
            <span>{formatFileSize(doc.fileSize)}</span>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => handleDownload(doc)}
          className="shrink-0"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{indexedCount}</p>
              <p className="text-xs text-muted-foreground">No contexto do ALEX</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-4 flex items-center gap-3">
            <RefreshCw className="h-8 w-8 text-amber-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{processingCount}</p>
              <p className="text-xs text-muted-foreground">Processando</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Com erro</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info banner */}
      {indexedCount > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {indexedCount} documento{indexedCount > 1 ? 's' : ''} disponível{indexedCount > 1 ? 'is' : ''} no contexto do ALEX
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                Apenas a versão mais recente de cada tipo está no contexto do ALEX para garantir respostas atualizadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Document list grouped by type with version history */}
      <div className="space-y-4">
        {Object.entries(documentsByType).map(([type, docs]) => {
          const latestDoc = docs[0];
          const hasHistory = docs.length > 1;
          const isLatestIndexed = latestDoc.status === DocumentStatus.INDEXED;

          return (
            <Collapsible key={type} defaultOpen={true}>
              <Card className={isLatestIndexed ? 'border-emerald-200 dark:border-emerald-800' : ''}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isLatestIndexed ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
                          <FileText className={`h-5 w-5 ${isLatestIndexed ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-base">
                            {DOC_TYPE_LABELS[type] || type}
                          </CardTitle>
                          <CardDescription>
                            {docs.length} versão{docs.length > 1 ? 'ões' : ''} • 
                            {isLatestIndexed ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium"> Última versão no ALEX</span>
                            ) : (
                              <span className="text-amber-600"> Sincronize para adicionar ao ALEX</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      {hasHistory && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <History className="h-4 w-4" />
                          <span className="text-sm">Histórico</span>
                          <ChevronDown className="h-4 w-4 data-[state=open]:rotate-180 transition-transform" />
                        </div>
                      )}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {renderDocumentVersion(latestDoc, true)}
                    {hasHistory && (
                      <div className="pl-11">
                        <p className="text-xs text-muted-foreground mb-2">Versões anteriores:</p>
                        {docs.slice(1).map(doc => renderDocumentVersion(doc, false))}
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}

// Contracts tab content – shows templates as cards + generated contracts history
function ContractsTab({ projectId, project }: { projectId: string, project: { name: string, contractType?: string } }) {
  const { contracts: projectContracts, isLoading: projectLoading } = useProjectContracts(projectId);
  const { canEdit } = usePermission(projectId);
  const { user } = useUser();
  const { firestore } = useFirebase();

  // Also fetch user-scope filled contracts (generated via /gerar-exportar)
  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore]);
  const { data: filledContracts, isLoading: filledLoading } = useCollection<Contract>(filledContractsQuery);

  const isLoading = projectLoading || filledLoading;

  // Normalise both sets into a single unified shape
  const allContracts = useMemo(() => {
    const result: Array<{
      id: string;
      name: string;
      date: string | null;
      googleDocLink?: string;
      source: 'project' | 'user';
    }> = [];

    (projectContracts ?? []).forEach(c => result.push({
      id: c.id,
      name: c.name,
      date: c.generatedAt ?? null,
      googleDocLink: c.googleDocLink ?? undefined,
      source: 'project',
    }));

    (filledContracts ?? []).forEach(c => result.push({
      id: c.id,
      name: c.name,
      date: c.createdAt ?? null,
      googleDocLink: c.googleDocLink ?? undefined,
      source: 'user',
    }));

    return result.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
  }, [projectContracts, filledContracts]);

  // If contract type is not configured, show configuration prompt
  if (!project.contractType) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <FileSignature className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Configurar Tipo de Contrato</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Este projeto ainda não possui um tipo de contrato definido. Configure-o para visualizar os modelos disponíveis.
          </p>
          <Button asChild>
            <Link href={`/projects/${projectId}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Configurar Tipo de Contrato
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Templates Grid Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Modelos de Contrato</h3>
            <p className="text-sm text-muted-foreground">
              Modelos disponíveis para <strong>{project.contractType}</strong>
            </p>
          </div>
          {canEdit && (
            <Button size="sm" asChild>
              <Link href={`/gerar-exportar?projectId=${projectId}`}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar Contrato
              </Link>
            </Button>
          )}
        </div>

        <TemplatesGrid
          contractType={project.contractType}
          projectId={projectId}
          canEdit={canEdit}
        />
      </div>

      {/* Generated Contracts Section */}
      {allContracts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Contratos Gerados</h3>
            <p className="text-sm text-muted-foreground">
              {allContracts.length} contrato{allContracts.length !== 1 ? 's' : ''} gerado{allContracts.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-3">
            {allContracts.map((contract) => (
              <Card key={`${contract.source}-${contract.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Icon */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{contract.name}</p>
                        {contract.googleDocLink && (
                          <Badge variant="outline" className="text-xs text-blue-600 border-blue-200 shrink-0">
                            Google Docs
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isValidDate(contract.date)
                          ? format(safeNewDate(contract.date)!, "dd/MM/yyyy 'às' HH:mm")
                          : 'Data desconhecida'}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {contract.googleDocLink ? (
                        <Button variant="outline" size="sm" asChild>
                          <a href={contract.googleDocLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            Abrir
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Activity tab content with filters and grouping
function ActivityTab({ projectId }: { projectId: string }) {
  const { activities, isLoading, hasMore, loadMore } = useActivity(projectId, 30);
  const [filterAction, setFilterAction] = useState<string | null>(null);

  const ACTION_CONFIG: Record<string, { label: string; icon: any; color: string; bgColor: string }> = {
    created: { label: 'criou', icon: Plus, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
    uploaded: { label: 'enviou', icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
    extracted: { label: 'extraiu entidades de', icon: Activity, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
    edited: { label: 'editou', icon: FileText, color: 'text-amber-600', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
    generated: { label: 'gerou', icon: FileText, color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
    shared: { label: 'compartilhou', icon: Users, color: 'text-indigo-600', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
    joined: { label: 'entrou em', icon: Users, color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
    left: { label: 'saiu de', icon: Users, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-900/30' },
    exported: { label: 'exportou', icon: Download, color: 'text-teal-600', bgColor: 'bg-teal-100 dark:bg-teal-900/30' },
    deleted: { label: 'excluiu', icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30' },
    synced: { label: 'sincronizou', icon: RefreshCw, color: 'text-violet-600', bgColor: 'bg-violet-100 dark:bg-violet-900/30' },
    role_changed: { label: 'alterou cargo de', icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
    commented: { label: 'comentou em', icon: FileText, color: 'text-pink-600', bgColor: 'bg-pink-100 dark:bg-pink-900/30' },
  };

  const getDefaultConfig = (action: string) => ({
    label: action,
    icon: Activity,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100 dark:bg-gray-900/30',
  });

  // Group activities by time period
  const groupedActivities = useMemo(() => {
    if (!activities) return {};
    
    const filtered = filterAction 
      ? activities.filter(a => a.action === filterAction)
      : activities;
    
    const groups: Record<string, typeof filtered> = {
      hoje: [],
      ontem: [],
      'esta-semana': [],
      'este-mes': [],
      anteriores: [],
    };
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    filtered.forEach(activity => {
      const activityDate = safeNewDate(activity.timestamp);
      if (!activityDate) {
        groups.hoje.push(activity);
        return;
      }
      
      if (activityDate >= today) {
        groups.hoje.push(activity);
      } else if (activityDate >= yesterday) {
        groups.ontem.push(activity);
      } else if (activityDate >= weekAgo) {
        groups['esta-semana'].push(activity);
      } else if (activityDate >= monthAgo) {
        groups['este-mes'].push(activity);
      } else {
        groups.anteriores.push(activity);
      }
    });
    
    return groups;
  }, [activities, filterAction]);

  const GROUP_LABELS: Record<string, string> = {
    hoje: 'Hoje',
    ontem: 'Ontem',
    'esta-semana': 'Esta semana',
    'este-mes': 'Este mês',
    anteriores: 'Anteriores',
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sem atividades</h3>
          <p className="text-muted-foreground">
            As atividades do projeto aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2 pb-2 border-b">
        <Button
          variant={filterAction === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterAction(null)}
        >
          Todas
        </Button>
        {Object.entries(ACTION_CONFIG).slice(0, 6).map(([action, config]) => {
          const Icon = config.icon;
          return (
            <Button
              key={action}
              variant={filterAction === action ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterAction(filterAction === action ? null : action)}
              className="gap-1"
            >
              <Icon className="h-3 w-3" />
              {config.label}
            </Button>
          );
        })}
      </div>

      {/* Activity groups */}
      {Object.entries(groupedActivities).map(([group, groupActivities]) => {
        if (groupActivities.length === 0) return null;
        
        return (
          <div key={group}>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
              {GROUP_LABELS[group]}
            </h3>
            <div className="space-y-3">
              {groupActivities.map((activity) => {
                const config = ACTION_CONFIG[activity.action] || getDefaultConfig(activity.action);
                const Icon = config.icon;
                
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bgColor}`}>
                      <Icon className={`h-4 w-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{activity.userName}</span>{' '}
                        <span className="text-muted-foreground">{config.label}</span>{' '}
                        <span className="font-medium">{activity.targetName}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {isValidDate(activity.timestamp) ? formatDistanceToNow(safeNewDate(activity.timestamp)!, {
                          addSuffix: true,
                          locale: ptBR,
                        }) : 'Agora'}
                      </p>
                    </div>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={activity.userPhotoURL} />
                      <AvatarFallback className="text-xs">
                        {activity.userName?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}

// Main project page component
export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;

  const { project, isLoading: projectLoading, error } = useProject(projectId);
  const { documents, isLoading: documentsLoading } = useProjectDocuments(projectId);
  const { contracts, isLoading: contractsLoading } = useProjectContracts(projectId);
  const { members, isLoading: membersLoading } = useProjectMembers(projectId);
  const { canEdit } = usePermission(projectId);

  const syncedCount = documents?.filter(d => d.status === DocumentStatus.INDEXED).length ?? 0;

  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível carregar o projeto. {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="container py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="grid gap-4 md:grid-cols-3 mt-8">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Projeto não encontrado</AlertTitle>
          <AlertDescription>
            O projeto que você está procurando não existe ou você não tem acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link
            href="/projects"
            className="inline-flex items-center hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Projetos
          </Link>
          <span>/</span>
          <span>{project.name}</span>
        </div>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground mt-2 max-w-2xl">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-4">
              <ActiveUsersIndicator projectId={projectId} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/members`}>
                <Users className="mr-2 h-4 w-4" />
                Membros
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Documentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {documentsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : documents?.length || 0}
              </div>
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sincronizados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {documentsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : syncedCount}
              </div>
              <Database className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contratos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {contractsLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : contracts?.length || 0}
              </div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Membros</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                {membersLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : members?.length || 1}
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[400px]">
          <TabsTrigger value="documents">Documentos</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Documentos</h2>
          </div>
          <DocumentsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="sync">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Sincronização com IA</h2>
          </div>
          <SyncTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractsTab projectId={projectId} project={project} />
        </TabsContent>

        <TabsContent value="activity">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Atividades Recentes</h2>
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/activity`}>
                Ver todas
              </Link>
            </Button>
          </div>
          <ActivityTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
