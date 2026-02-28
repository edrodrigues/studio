'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { useProject } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function NewProjectContractPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project, isLoading } = useProject(projectId);

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {isLoading ? <Skeleton className="h-4 w-24" /> : project?.name || 'Projeto'}
          </Link>
          <span>/</span>
          <span>Novo Contrato</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Gerar Novo Contrato</h1>
        <p className="text-muted-foreground mt-2">
          Gere um novo documento usando as variáveis extraídas deste projeto.
        </p>
      </div>

      <Alert className="bg-muted/50">
        <FileText className="h-4 w-4" />
        <AlertTitle>Funcionalidade em migração</AlertTitle>
        <AlertDescription>
          A geração de contratos específicos por projeto está sendo integrada ao novo fluxo do Google Docs. 
          Por enquanto, você pode usar a aba global "Gerar Novo" para utilizar seus modelos salvos com as entidades deste projeto.
        </AlertDescription>
      </Alert>
    </div>
  );
}
