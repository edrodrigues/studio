'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Bell,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  MoreVertical,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useFirebase, useUser } from '@/firebase';
import { useInvites, useUserProjects } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import { isValidDate, safeNewDate } from '@/lib/utils';
import type { Project, ProjectRole } from '@/lib/types';
import { PageHeader } from '@/components/app/page-header';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';

interface ProjectWithRole extends Project {
  id: string;
  myRole: ProjectRole;
}

function RoleBadge({ role }: { role: ProjectRole }) {
  const config = {
    owner: { label: 'Proprietário', variant: 'default' as const },
    editor: { label: 'Editor', variant: 'secondary' as const },
    viewer: { label: 'Visualizador', variant: 'outline' as const },
  };

  return <Badge variant={config[role].variant}>{config[role].label}</Badge>;
}

function ProjectCard({
  project,
  onArchive,
  onDelete,
}: {
  project: ProjectWithRole;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const router = useRouter();
  const canInvite = project.myRole === 'owner' || project.myRole === 'editor';

  return (
    <Card className="group h-full transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-lg text-foreground transition-colors group-hover:text-primary">
              <Link href={`/projects/${project.id}`} className="hover:underline">
                {project.name}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {project.description || 'Sem descrição'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 self-end sm:self-start">
            {canInvite ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary hover:text-primary/80"
                onClick={() => router.push(`/projects/${project.id}/members`)}
              >
                <UserPlus className="mr-1 h-3 w-3" />
                <span className="hidden sm:inline">Convidar</span>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Abrir ações do projeto ${project.name}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}`)}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Abrir projeto
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onArchive(project.id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar
                </DropdownMenuItem>
                {project.myRole === 'owner' ? (
                  <DropdownMenuItem onClick={() => onDelete(project.id)} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">Cliente:</span>
            <span className="min-w-0 truncate text-right font-medium">{project.clientName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1" title="Documentos Iniciais">
              <FolderOpen className="h-4 w-4" />
              <span>{project.documentCount || 0} docs</span>
            </div>
            <div className="flex items-center gap-1" title="Contratos Gerados">
              <FileText className="h-4 w-4" />
              <span>{project.contractCount || 0} contratos</span>
            </div>
            <div className="flex items-center gap-1" title="Membros">
              <Users className="h-4 w-4" />
              <span>{project.memberCount || 1} membros</span>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="border-t pt-3">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <RoleBadge role={project.myRole} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {isValidDate(project.updatedAt)
                ? formatDistanceToNow(safeNewDate(project.updatedAt)!, { addSuffix: true, locale: ptBR })
                : 'Nunca'}
            </span>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}

function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="mt-2 h-4 w-full" />
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <div className="flex w-full items-center justify-between">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}

function InviteNotification({
  invites,
  onAccept,
  onDecline,
}: {
  invites: (import('@/lib/types').ProjectInvite & { id: string })[] | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  if (!invites || invites.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="h-5 w-5 text-primary" />
        Convites pendentes ({invites.length})
      </h2>
      <div className="grid gap-4">
        {invites.map((invite) => (
          <Card key={invite.id} className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-medium">
                    Você foi convidado para colaborar em <span className="text-primary">{invite.projectName}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Por {invite.invitedByName} •{' '}
                    {isValidDate(invite.invitedAt)
                      ? formatDistanceToNow(safeNewDate(invite.invitedAt)!, { addSuffix: true, locale: ptBR })
                      : 'Agora'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => onDecline(invite.id)}>
                    Recusar
                  </Button>
                  <Button size="sm" onClick={() => onAccept(invite.id)}>
                    Aceitar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function ProjectsDashboardPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { projects, isLoading, error } = useUserProjects();
  const { pendingInvites, acceptInvite, declineInvite } = useInvites();
  const { toast } = useToast();
  useUser();

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const sortedProjects = useMemo(() => {
    if (!projects) return null;
    return [...projects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects]);

  const handleArchive = (projectId: string) => {
    setSelectedProjectId(projectId);
    setArchiveDialogOpen(true);
  };

  const handleDelete = (projectId: string) => {
    setSelectedProjectId(projectId);
    setDeleteDialogOpen(true);
  };

  const confirmArchive = async () => {
    if (!firestore || !selectedProjectId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'projects', selectedProjectId), {
        status: 'archived',
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Projeto arquivado', description: 'O projeto foi arquivado com sucesso.' });
    } catch (error) {
      console.error('Error archiving project:', error);
      toast({
        title: 'Erro ao arquivar',
        description: 'Não foi possível arquivar o projeto. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setArchiveDialogOpen(false);
      setSelectedProjectId(null);
    }
  };

  const confirmDelete = async () => {
    if (!firestore || !selectedProjectId) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(firestore, 'projects', selectedProjectId), {
        status: 'deleted',
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Projeto excluído', description: 'O projeto foi excluído com sucesso.' });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o projeto. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setDeleteDialogOpen(false);
      setSelectedProjectId(null);
    }
  };

  if (error) {
    return (
      <div className="page-shell">
        <div className="page-width text-center">
          <h2 className="text-xl font-semibold text-destructive">Erro ao carregar projetos</h2>
          <p className="mt-2 text-muted-foreground">{error.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="page-width page-stack">
        <PageHeader
          title="Meus Projetos"
          description="Gerencie contratos, convites e colaboração com uma visão mais legível em desktop e mobile."
          actions={
            <Button size="lg" className="h-11 rounded-2xl px-5 text-base font-semibold" onClick={() => router.push('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>
          }
        />

        <InviteNotification invites={pendingInvites} onAccept={acceptInvite} onDecline={declineInvite} />

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : sortedProjects && sortedProjects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedProjects.map((project) => (
              <ProjectCard key={project.id} project={project} onArchive={handleArchive} onDelete={handleDelete} />
            ))}
          </div>
        ) : (
          <div className="surface-panel py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-xl font-semibold">Nenhum projeto ainda</h3>
            <p className="mx-auto mb-6 max-w-md text-muted-foreground">
              Crie seu primeiro projeto para começar a gerenciar contratos e colaborar com sua equipe.
            </p>
            <Button size="lg" className="h-11 rounded-2xl px-5 text-base font-semibold" onClick={() => router.push('/projects/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Projeto
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar este projeto? Você poderá restaurá-lo mais tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={isProcessing}>
              {isProcessing ? 'Arquivando…' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este projeto? Esta ação não pode ser desfeita e todos os documentos serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
