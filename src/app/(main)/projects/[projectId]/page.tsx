'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProject, useProjectMembers, useProjectPlaceholders, useProjectContracts, useActivity, usePresence, usePermission } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProjectDocumentsUploader } from './components/ProjectDocumentsUploader';

// Active users indicator
function ActiveUsersIndicator({ projectId }: { projectId: string }) {
  const { activeUsers, updatePresence } = usePresence(projectId);

  useEffect(() => {
    // Mark user as present when viewing project
    updatePresence({ currentView: 'dashboard' });
  }, [updatePresence]);

  if (!activeUsers || activeUsers.length <= 1) return null;

  // Filter out current user
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

// Placeholders tab content
function PlaceholdersTab({ projectId }: { projectId: string }) {
  const { placeholders, isLoading } = useProjectPlaceholders(projectId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!placeholders || placeholders.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <h3 className="text-lg font-semibold mb-2">Nenhuma variável encontrada</h3>
          <p className="text-muted-foreground">
            Adicione documentos para que a IA extraia variáveis automaticamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  const filledCount = placeholders.filter((p) => p.value && p.value.trim() !== '').length;
  const confirmedCount = placeholders.filter((p) => p.status === 'confirmed').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filledCount} de {placeholders.length} preenchidas • {confirmedCount} confirmadas
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/projects/${projectId}/placeholders`}>
            Gerenciar todas
          </Link>
        </Button>
      </div>

      <div className="grid gap-3">
        {placeholders.slice(0, 5).map((placeholder) => (
          <Card key={placeholder.id}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{placeholder.key}</p>
                  {placeholder.value ? (
                    <p className="text-sm text-muted-foreground truncate max-w-md">
                      {placeholder.value}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Não preenchido</p>
                  )}
                </div>
                <Badge
                  variant={
                    placeholder.status === 'confirmed'
                      ? 'default'
                      : placeholder.value
                      ? 'secondary'
                      : 'outline'
                  }
                >
                  {placeholder.status === 'confirmed'
                    ? 'Confirmado'
                    : placeholder.value
                    ? 'Revisado'
                    : 'Pendente'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {placeholders.length > 5 && (
        <Button variant="ghost" className="w-full" asChild>
          <Link href={`/projects/${projectId}/placeholders`}>
            Ver todas {placeholders.length} variáveis
          </Link>
        </Button>
      )}
    </div>
  );
}

// Contracts tab content
function ContractsTab({ projectId }: { projectId: string }) {
  const { contracts, isLoading } = useProjectContracts(projectId);
  const { canEdit } = usePermission(projectId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum contrato gerado</h3>
          <p className="text-muted-foreground mb-4">
            Gere contratos preenchidos usando as variáveis extraídas.
          </p>
          {canEdit && (
            <Button asChild>
              <Link href={`/projects/${projectId}/contracts/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Gerar contrato
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <Card key={contract.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{contract.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(contract.generatedAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/projects/${projectId}/contracts/${contract.id}`}>
                  Visualizar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
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
              {formatDistanceToNow(new Date(activity.timestamp), {
                addSuffix: true,
                locale: ptBR,
              })}
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
  const { members, isLoading: membersLoading } = useProjectMembers(projectId);
  const { canEdit } = usePermission(projectId);

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
              <div className="text-2xl font-bold">{project.documentCount || 0}</div>
              <FolderOpen className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Variáveis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{project.placeholderCount || 0}</div>
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contratos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">{project.contractCount || 0}</div>
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
          <TabsTrigger value="placeholders">Variáveis</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Documentos</h2>
            {canEdit && (
              <Button asChild>
                <Link href={`/projects/${projectId}/documents`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Link>
              </Button>
            )}
          </div>
          <DocumentsTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="placeholders">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Variáveis Extraídas</h2>
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/placeholders`}>
                Gerenciar
              </Link>
            </Button>
          </div>
          <PlaceholdersTab projectId={projectId} />
        </TabsContent>

        <TabsContent value="contracts">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Contratos Gerados</h2>
            {canEdit && (
              <Button asChild>
                <Link href={`/projects/${projectId}/contracts/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Gerar
                </Link>
              </Button>
            )}
          </div>
          <ContractsTab projectId={projectId} />
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
