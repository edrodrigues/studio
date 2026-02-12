'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { useFirebase, useUser } from '@/firebase';
import { useLegacyContracts, useUserProjects } from '@/hooks/use-projects';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  FolderOpen,
  Plus,
  AlertCircle,
  Check,
  FileText,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Contract, Project } from '@/lib/types';

// Contract item component
function ContractItem({
  contract,
  isSelected,
  onSelect,
}: {
  contract: Contract & { id: string };
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onSelect(contract.id)}
        className="mt-1"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <p className="font-medium truncate">{contract.name}</p>
        </div>
        <p className="text-sm text-muted-foreground">{contract.clientName}</p>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            {formatDistanceToNow(new Date(contract.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </Badge>
          {contract.googleDocLink && (
            <Badge variant="secondary" className="text-xs">
              Google Doc
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Project selector component
function ProjectSelector({
  projects,
  selectedProject,
  onSelect,
  isLoading,
}: {
  projects: (Project & { id: string; myRole: string })[] | null;
  selectedProject: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (!projects || projects.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Você não tem projetos. Crie um projeto primeiro para migrar seus contratos.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Select value={selectedProject || ''} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione um projeto" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            <div className="flex flex-col items-start">
              <span>{project.name}</span>
              <span className="text-xs text-muted-foreground">
                {project.clientName}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Main migration page
export default function MigrateContractsPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const { data: legacyContracts, isLoading: contractsLoading } = useLegacyContracts();
  const { projects, isLoading: projectsLoading } = useUserProjects();

  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState({
    current: 0,
    total: 0,
  });

  const selectableContracts = useMemo(() => {
    if (!legacyContracts) return [];
    return legacyContracts.filter((c): c is Contract & { id: string } => !!c.id);
  }, [legacyContracts]);

  const toggleContract = (id: string) => {
    setSelectedContracts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedContracts.length === selectableContracts.length) {
      setSelectedContracts([]);
    } else {
      setSelectedContracts(selectableContracts.map((c) => c.id));
    }
  };

  const migrateContracts = async () => {
    if (!firestore || !user || !selectedProject || selectedContracts.length === 0) return;

    setIsMigrating(true);
    setMigrationProgress({ current: 0, total: selectedContracts.length });

    try {
      const selectedProjectData = projects?.find((p) => p.id === selectedProject);
      if (!selectedProjectData) throw new Error('Projeto não encontrado');

      let migrated = 0;

      for (const contractId of selectedContracts) {
        const contract = selectableContracts.find((c) => c.id === contractId);
        if (!contract) continue;

        // Create project contract
        const projectContract = {
          projectId: selectedProject,
          templateId: contract.contractModelId || '',
          name: contract.name,
          markdownContent: contract.markdownContent,
          filledData: contract.filledData,
          generatedBy: user.uid,
          generatedAt: contract.createdAt,
          googleDocLink: contract.googleDocLink,
          googleDocId: contract.googleDocLink
            ? extractDocId(contract.googleDocLink)
            : undefined,
          version: 1,
        };

        await addDoc(collection(firestore, 'projectContracts'), projectContract);

        // Delete legacy contract
        const legacyRef = doc(firestore, 'users', user.uid, 'filledContracts', contractId);
        await deleteDoc(legacyRef);

        migrated++;
        setMigrationProgress({ current: migrated, total: selectedContracts.length });
      }

      toast({
        title: 'Migração concluída!',
        description: `${migrated} contrato(s) migrado(s) para o projeto "${selectedProjectData.name}"`,
      });

      // Clear selection
      setSelectedContracts([]);

      // Redirect to project
      router.push(`/projects/${selectedProject}`);
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro na migração',
        description: 'Ocorreu um erro ao migrar os contratos. Tente novamente.',
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const extractDocId = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : '';
  };

  if (contractsLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!legacyContracts || legacyContracts.length === 0) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="mb-6">
          <Link
            href="/projects"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para projetos
          </Link>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <Check className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Tudo em ordem!</h2>
            <p className="text-muted-foreground mb-6">
              Você não tem contratos legados para migrar. Todos seus contratos já estão no novo sistema.
            </p>
            <Button asChild>
              <Link href="/projects">Ver meus projetos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para projetos
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Migrar Contratos Legados</h1>
        <p className="text-muted-foreground mt-2">
          Selecione os contratos antigos que deseja migrar para o novo sistema baseado em projetos.
        </p>
      </div>

      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          A migração move os contratos do sistema antigo para o novo. Os contratos serão excluídos da
          área legada após a migração. Esta ação não pode ser desfeita.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contracts List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Contratos disponíveis ({selectableContracts.length})
            </h2>
            <Button variant="outline" size="sm" onClick={toggleAll}>
              {selectedContracts.length === selectableContracts.length
                ? 'Desmarcar todos'
                : 'Selecionar todos'}
            </Button>
          </div>

          <div className="space-y-3">
            {selectableContracts.map((contract) => (
              <ContractItem
                key={contract.id}
                contract={contract}
                isSelected={selectedContracts.includes(contract.id)}
                onSelect={toggleContract}
              />
            ))}
          </div>
        </div>

        {/* Migration Panel */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <CardHeader>
              <CardTitle>Migrar para</CardTitle>
              <CardDescription>
                Selecione o projeto de destino
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProjectSelector
                projects={projects}
                selectedProject={selectedProject}
                onSelect={setSelectedProject}
                isLoading={projectsLoading}
              />

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowNewProjectDialog(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar novo projeto
              </Button>

              {selectedContracts.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedContracts.length} contrato(s) selecionado(s)
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                disabled={
                  !selectedProject ||
                  selectedContracts.length === 0 ||
                  isMigrating
                }
                onClick={migrateContracts}
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrando {migrationProgress.current}/{migrationProgress.total}
                  </>
                ) : (
                  <>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Migrar contratos
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo projeto</DialogTitle>
            <DialogDescription>
              Crie um novo projeto para receber os contratos migrados.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Button asChild className="w-full" onClick={() => setShowNewProjectDialog(false)}>
              <Link href="/projects/new">Ir para criação de projeto</Link>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewProjectDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
