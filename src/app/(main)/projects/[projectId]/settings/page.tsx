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
  RefreshCw,
  FileSearch,
  CheckCircle2,
  XCircle,
  FileSignature,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useProject, usePermission } from '@/hooks/use-projects';
import { ProjectStatus } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { doc, deleteDoc, getFirestore, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { handleSyncToFileSearch } from '@/lib/actions';
import { Progress } from '@/components/ui/progress';

const contractTypeOptions = [
  "TED",
  "Acordo de Parceria (Lei de Inovação)",
  "Acordo de Parceria (Embrapii)",
  "Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)"
];

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const { firestore } = useFirebase();

  const { project, isLoading, error, updateProject } = useProject(projectId);
  const { canEdit, isOwner } = usePermission(projectId);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

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

  const handleSync = async () => {
    if (!projectId || isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    try {
      setSyncProgress(20);
      const result = await handleSyncToFileSearch({ projectId });
      setSyncProgress(80);
      if (result.success) {
        setSyncProgress(100);
        if (firestore) {
          await updateDoc(doc(firestore, 'projects', projectId), {
            lastSyncedAt: serverTimestamp(),
            isSyncedToFileSearch: true,
            fileSearchSyncStatus: 'completed',
          });
        }
        toast({ title: 'Sincronização concluída', description: 'Os documentos foram sincronizados com sucesso.' });
      } else {
        throw new Error('Sync failed');
      }
    } catch (error) {
      console.error('Sync failed:', error);
      toast({ title: 'Erro na sincronização', description: 'Não foi possível sincronizar os documentos.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateContractType = async (contractType: string) => {
    if (!project || !canEdit) return;
    try {
      await updateProject({
        contractType,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Configuração salva', description: 'O tipo de contrato foi atualizado com sucesso.' });
    } catch (error) {
      console.error('Failed to update contract type:', error);
      toast({ title: 'Erro', description: 'Não foi possível salvar a configuração.', variant: 'destructive' });
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
        {/* Contract Type Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5" />
              Configuração do Contrato
            </CardTitle>
            <CardDescription>
              Escolha o tipo de contrato para este projeto. Os modelos disponíveis serão filtrados com base nesta escolha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contract-type">Tipo de Contrato</Label>
              <Select
                value={project.contractType || ''}
                onValueChange={handleUpdateContractType}
                disabled={!canEdit}
              >
                <SelectTrigger id="contract-type" className="w-full">
                  <SelectValue placeholder="Selecione um tipo de contrato..." />
                </SelectTrigger>
                <SelectContent>
                  {contractTypeOptions.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {project.contractType && (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Tipo selecionado: <strong>{project.contractType}</strong>. Os modelos compatíveis serão exibidos na aba Contratos.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Sync Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Configuração de Sincronização
            </CardTitle>
            <CardDescription>
              Sincronize documentos com o índice ALEX para pesquisa e análise inteligente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="font-medium">Estado da Sincronização</div>
                <div className="text-sm text-muted-foreground">
                  Última sincronização:{' '}
                  {project.lastSyncedAt
                    ? new Date(project.lastSyncedAt).toLocaleString('pt-PT')
                    : 'Nunca sincronizado'}
                </div>
              </div>
              <Badge
                variant={project.isSyncedToFileSearch ? 'default' : 'secondary'}
                className={project.isSyncedToFileSearch ? 'bg-green-500' : ''}
              >
                {project.isSyncedToFileSearch ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Sincronizado
                  </>
                ) : (
                  <>
                    <XCircle className="mr-1 h-3 w-3" /> Não Sincronizado
                  </>
                )}
              </Badge>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {isSyncing ? 'A sincronizar...' : 'Sincronização manual'}
                </span>
                {isSyncing && <span className="font-medium">{syncProgress}%</span>}
              </div>
              {isSyncing && <Progress value={syncProgress} className="h-2" />}
              <p className="text-xs text-muted-foreground">
                A sincronização indexa todos os documentos do projeto no ALEX para pesquisa semântica e análise de contratos.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || !canEdit}
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            </div>

            <Alert>
              <FileSearch className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Os documentos são sincronizados automaticamente após upload. Use esta opção para sincronização manual ou
                para recuperar de erros de sincronização.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

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
