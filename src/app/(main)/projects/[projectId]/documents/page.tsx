'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ProjectDocumentsUploader } from '../components/ProjectDocumentsUploader';
import { useProject } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectDocumentsPage() {
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
          <span>Documentos</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Gerenciar Documentos</h1>
        <p className="text-muted-foreground mt-2">
          Adicione ou remova documentos iniciais para extração de variáveis.
        </p>
      </div>

      <ProjectDocumentsUploader projectId={projectId} />
    </div>
  );
}
