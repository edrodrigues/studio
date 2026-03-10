
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
} from 'lucide-react';
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
import { isValidDate, safeNewDate } from "@/lib/utils";

// Active users indicator
function ActiveUsersIndicator({ projectId }: { projectId: string }) {
  const { activeUsers, updatePresence } = usePresence(projectId);

  useEffect(() => {
    updatePresence({ currentView: 'dashboard' });
  }, [updatePresence, projectId]);

  if (!activeUsers || activeUsers.length <= 1) return null;

  const otherUsers = activeUsers.filter(u => u.userId !== activeUsers[0]?.userId);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 3).map((user) => (
          <Avatar key={user.userId} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={user.userPhotoURL} />
            <AvatarFallback className="text-xs">
              {user.userName?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span>
        {otherUsers.length === 1
          ? `${otherUsers[0].userName} está online`
          : `${otherUsers.length} pessoas online`}
      </span>
    </div>
  );
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
  },
  [DocumentStatus.PROCESSING]: {
    label: 'Processando',
    icon: RefreshCw,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    badge: 'secondary' as const,
  },
  [DocumentStatus.UPLOADED]: {
    label: 'Aguardando Sync',
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    badge: 'outline' as const,
  },
  [DocumentStatus.ERROR]: {
    label: 'Erro',
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    badge: 'destructive' as const,
  },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  planOfWork: 'Plano de Trabalho',
  termOfExecution: 'Termo de Execução',
  budgetSpreadsheet: 'Planilha Orçamentária',
  other: 'Outro',
};

// Sync tab content
function SyncTab({ projectId }: { projectId: string }) {
  const { documents, isLoading } = useProjectDocuments(projectId);

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

  const indexedCount = documents.filter((d) => d.status === DocumentStatus.INDEXED).length;
  const processingCount = documents.filter((d) => d.status === DocumentStatus.PROCESSING).length;
  const errorCount = documents.filter((d) => d.status === DocumentStatus.ERROR).length;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold">{indexedCount}</p>
              <p className="text-xs text-muted-foreground">Indexados</p>
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

      {/* Document list */}
      <div className="space-y-3">
        {documents.map((doc) => {
          const statusCfg = SYNC_STATUS_CONFIG[doc.status as DocumentStatus] ?? SYNC_STATUS_CONFIG[DocumentStatus.UPLOADED];
          const StatusIcon = statusCfg.icon;
          return (
            <Card key={doc.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Status icon */}
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${statusCfg.bg}`}>
                    <StatusIcon className={`h-5 w-5 ${statusCfg.color} ${doc.status === DocumentStatus.PROCESSING ? 'animate-spin' : ''}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{doc.originalFileName}</p>
                      <Badge variant={statusCfg.badge} className="text-xs shrink-0">
                        {statusCfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs shrink-0">
                        v{doc.version}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType}
                      </span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{formatDate(doc.uploadedAt)}</span>
                      {doc.storageProvider === 'r2' && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground font-mono">Cloudflare R2</span>
                        </>
                      )}
                    </div>
                    {doc.status === DocumentStatus.ERROR && doc.processingError && (
                      <p className="text-xs text-red-600 mt-1">{doc.processingError}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Contracts tab content – merges projectContracts + user's filledContracts
function ContractsTab({ projectId, projectName }: { projectId: string, projectName: string }) {
  const { contracts: projectContracts, isLoading: projectLoading } = useProjectContracts(projectId);
  const { canEdit } = usePermission(projectId);
  const { user } = useUser();
  const { firestore } = useFirebase();
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);

  // Also fetch user-scope filled contracts (generated via /gerar-exportar)
  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore]);
  const { data: filledContracts, isLoading: filledLoading } = useCollection<Contract>(filledContractsQuery);

  // Fetch templates so we can resolve the original doc link per contract
  const templatesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'contractModels');
  }, [firestore]);
  const { data: templates } = useCollection<{ id: string; googleDocLink?: string }>(templatesQuery);

  // Build a lookup map: templateId → original googleDocLink
  const templateOriginalLinks = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    (templates ?? []).forEach(t => { map[t.id] = t.googleDocLink; });
    return map;
  }, [templates]);

  const isLoading = projectLoading || filledLoading;

  // Normalise both sets into a single unified shape
  const allContracts = useMemo(() => {
    const result: Array<{
      id: string;
      name: string;
      date: string | null;
      googleDocLink?: string;       // customized copy link
      contractModelId?: string;     // to look up original template link
      markdownContent?: string;
      source: 'project' | 'user';
    }> = [];

    (projectContracts ?? []).forEach(c => result.push({
      id: c.id,
      name: c.name,
      date: c.generatedAt ?? null,
      googleDocLink: c.googleDocLink ?? undefined,
      contractModelId: c.templateId ?? undefined,
      markdownContent: c.markdownContent,
      source: 'project',
    }));

    (filledContracts ?? []).forEach(c => result.push({
      id: c.id,
      name: c.name,
      date: c.createdAt ?? null,
      googleDocLink: c.googleDocLink ?? undefined,
      contractModelId: (c as any).contractModelId ?? undefined,
      markdownContent: c.markdownContent,
      source: 'user',
    }));

    return result.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return db - da;
    });
  }, [projectContracts, filledContracts]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (allContracts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum contrato gerado</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Gere documentos usando os modelos disponíveis na aba "Gerar e Revisar".
          </p>
          {canEdit && (
            <Button asChild>
              <Link href={`/gerar-exportar?projectId=${projectId}`}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar novo contrato
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allContracts.length} contrato{allContracts.length !== 1 ? 's' : ''} gerado{allContracts.length !== 1 ? 's' : ''}
        </p>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsCopyModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Cópia Customizada
            </Button>
            <Button size="sm" asChild>
              <Link href={`/gerar-exportar?projectId=${projectId}`}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar novo
              </Link>
            </Button>
          </div>
        )}
      </div>

      <CustomCopyModal 
        isOpen={isCopyModalOpen} 
        onClose={() => setIsCopyModalOpen(false)}
        projectId={projectId}
        projectName={projectName}
      />

      {allContracts.map((contract) => {
        const originalDocLink = contract.contractModelId
          ? templateOriginalLinks[contract.contractModelId]
          : undefined;

        return (
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
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  {/* Button 1 – Original template document */}
                  {originalDocLink ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={originalDocLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Documento Original
                      </a>
                    </Button>
                  ) : null}

                  {/* Button 2 – Customized copy */}
                  {contract.googleDocLink ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={contract.googleDocLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Cópia Customizada
                      </a>
                    </Button>
                  ) : contract.source === 'project' ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/projects/${projectId}/contracts/${contract.id}`}>
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        Cópia Customizada
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Activity tab content
function ActivityTab({ projectId }: { projectId: string }) {
  const { activities, isLoading } = useActivity(projectId, 20);

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

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      created: 'criou',
      uploaded: 'enviou',
      extracted: 'extraiu',
      edited: 'editou',
      generated: 'gerou',
      shared: 'compartilhou',
      joined: 'entrou em',
      left: 'saiu de',
      exported: 'exportou',
      deleted: 'excluiu',
    };
    return labels[action] || action;
  };

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={activity.userPhotoURL} />
            <AvatarFallback>{activity.userName?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm">
              <span className="font-medium">{activity.userName}</span>{' '}
              {getActionLabel(activity.action)}{' '}
              <span className="font-medium">{activity.targetName}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isValidDate(activity.timestamp) ? formatDistanceToNow(safeNewDate(activity.timestamp)!, {
                addSuffix: true,
                locale: ptBR,
              }) : 'Agora'}
            </p>
          </div>
        </div>
      ))}
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Contratos Gerados</h2>
          </div>
          <ContractsTab projectId={projectId} projectName={project.name} />
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
