'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  FolderOpen,
  Users,
  Clock,
  MoreVertical,
  Archive,
  Trash2,
  ExternalLink,
  Bell,
  UserPlus,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserProjects, useInvites } from '@/hooks/use-projects';
import { useUser, useFirebase } from '@/firebase';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { doc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, isValidDate, safeNewDate } from "@/lib/utils";
import type { Project, ProjectRole } from '@/lib/types';

// Role badge component
function RoleBadge({ role }: { role: ProjectRole }) {
  const config = {
    owner: { label: 'Proprietário', variant: 'default' as const },
    editor: { label: 'Editor', variant: 'secondary' as const },
    viewer: { label: 'Visualizador', variant: 'outline' as const },
  };

  const { label, variant } = config[role];

  return <Badge variant={variant}>{label}</Badge>;
}

// Project card component
interface ProjectWithRole extends Project {
  id: string;
  myRole: ProjectRole;
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
    <Card className="group relative hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
              <Link href={`/projects/${project.id}`} className="hover:underline">
                {project.name}
              </Link>
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {project.description || 'Sem descrição'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {canInvite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary hover:text-primary/80"
                onClick={() => router.push(`/projects/${project.id}/members`)}
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Convidar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                {project.myRole === 'owner' && (
                  <DropdownMenuItem
                    onClick={() => onDelete(project.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Cliente:</span>
            <span className="font-medium">{project.clientName}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <RoleBadge role={project.myRole} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {isValidDate(project.updatedAt)
                ? formatDistanceToNow(safeNewDate(project.updatedAt)!, {
                    addSuffix: true,
                    locale: ptBR,
                  })
                : 'Nunca'}
            </span>
          </div>

        </div>
      </CardFooter>
    </Card>
  );
}

// Loading skeleton
function ProjectCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full mt-2" />
      </CardHeader>
      <CardContent className="pb-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}

// Invite notification component
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
    <div className="mb-8 space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Bell className="h-5 w-5 text-primary" />
        Convites pendentes ({invites.length})
      </h3>
      <div className="grid gap-4">
        {invites.map((invite) => (
          <Card key={invite.id} className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    Você foi convidado para colaborar em{' '}
                    <span className="text-primary">{invite.projectName}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Por {invite.invitedByName} •{' '}
                    {isValidDate(invite.invitedAt)
                      ? formatDistanceToNow(safeNewDate(invite.invitedAt)!, {
                          addSuffix: true,
                          locale: ptBR,
                        })
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

// Main page component
export default function ProjectsDashboardPage() {
  const router = useRouter();
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { projects, isLoading, error } = useUserProjects();
  const { pendingInvites, acceptInvite, declineInvite } = useInvites();
  const { toast } = useToast();

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter and sort projects
  const sortedProjects = useMemo(() => {
    if (!projects) return null;
    return [...projects].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
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
      toast({
        title: 'Projeto arquivado',
        description: 'O projeto foi arquivado com sucesso.',
      });
    } catch (err) {
      console.error('Error archiving project:', err);
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
      toast({
        title: 'Projeto excluído',
        description: 'O projeto foi excluído com sucesso.',
      });
    } catch (err) {
      console.error('Error deleting project:', err);
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
      <div className="container py-12">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-destructive">Erro ao carregar projetos</h2>
          <p className="text-muted-foreground mt-2">{error.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Projetos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seus contratos e colabore com sua equipe
          </p>
        </div>
        <Button size="lg" onClick={() => router.push('/projects/new')}>
          <Plus className="mr-2 h-5 w-5" />
          Novo Projeto
        </Button>
      </div>

      {/* Pending Invites */}
      <InviteNotification
        invites={pendingInvites}
        onAccept={acceptInvite}
        onDecline={declineInvite}
      />

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : sortedProjects && sortedProjects.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
            <FolderOpen className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Nenhum projeto ainda</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            Crie seu primeiro projeto para começar a gerenciar contratos e colaborar com sua equipe.
          </p>
          <Button size="lg" onClick={() => router.push('/projects/new')}>
            <Plus className="mr-2 h-5 w-5" />
            Criar Projeto
          </Button>
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja arquivar este projeto? Você poderá restaurar ele mais tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive} disabled={isProcessing}>
              {isProcessing ? 'Arquivando...' : 'Arquivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
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
            <AlertDialogAction onClick={confirmDelete} disabled={isProcessing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isProcessing ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

