'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Settings,
  Trash2,
  Archive,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useProject, usePermission } from '@/hooks/use-projects';
import { ProjectStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { doc, deleteDoc, getFirestore } from 'firebase/firestore';
import { useFirebase, useUser } from '@/firebase';

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { firestore } = useFirebase();
  const { user } = useUser();

  const { project, isLoading, error, updateProject } = useProject(projectId);
  const { canEdit, isOwner } = usePermission(projectId);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleArchive = async () => {
    if (!project || !canEdit) return;
    setIsArchiving(true);
    try {
      await updateProject({
        status: ProjectStatus.ARCHIVED,
        updatedAt: new Date().toISOString(),
      });
      router.push('/projects');
    } catch (error) {
      console.error('Failed to archive project:', error);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !isOwner || deleteConfirmText !== project.name) return;
    
    setIsDeleting(true);
    try {
      if (firestore && projectId) {
        await deleteDoc(doc(firestore, 'projects', projectId));
      }
      router.push('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível carregar o projeto. {error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full max-w-md" />
          <div className="mt-8 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-8">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Projeto não encontrado</AlertTitle>
          <AlertDescription>
            O projeto que você está procurando não existe ou você não tem acesso.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Voltar ao Projeto
          </Link>
          <span>/</span>
          <span>Configurações</span>
        </div>

        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configurações do Projeto</h1>
            <p className="text-muted-foreground">{project.name}</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Archive Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" />
              Arquivar Projeto
            </CardTitle>
            <CardDescription>
              Arquive o projeto para removê-lo da lista ativa. O projeto poderá ser reativado posteriormente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertDescription>
                Ao arquivar um projeto, ele permanecerá acessível mas será marcado como inativo.
                Todos os dados serão preservados.
              </AlertDescription>
            </Alert>
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={isArchiving || !canEdit}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Arquivando...
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Arquivar Projeto
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Delete Section - Only for Owners */}
        {isOwner && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription>
                Ações irreversíveis que afetam permanentemente o projeto.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  A exclusão do projeto é permanente e não pode ser desfeita. 
                  Todos os dados, documentos, contratos e histórico serão removidos.
                </AlertDescription>
              </Alert>

              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Projeto Permanentemente
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Confirmar Exclusão
                    </DialogTitle>
                    <DialogDescription>
                      Esta ação não pode ser desfeita. Isso excluirá permanentemente o projeto
                      <strong> &quot;{project.name}&quot; </strong> e todos os seus dados.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="confirm-delete">
                        Digite <strong>&quot;{project.name}&quot;</strong> para confirmar:
                      </Label>
                      <Input
                        id="confirm-delete"
                        value={deleteConfirmText}
                        onChange={(e) => setDeleteConfirmText(e.target.value)}
                        placeholder={project.name}
                        className="w-full"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDeleteDialog(false);
                        setDeleteConfirmText('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={deleteConfirmText !== project.name || isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Excluindo...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sim, Excluir Permanentemente
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
