'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Activity, Clock, User, Target } from 'lucide-react';
import { useProject, useActivity } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

export default function ProjectActivityPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project, isLoading: projectLoading } = useProject(projectId);
  const { activities, isLoading: activityLoading, hasMore, loadMore } = useActivity(projectId, 50);

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

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return 'text-blue-500';
      case 'deleted': return 'text-red-500';
      case 'generated': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Link
            href={`/projects/${projectId}`}
            className="inline-flex items-center hover:text-primary transition-colors"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {projectLoading ? <Skeleton className="h-4 w-24" /> : project?.name || 'Projeto'}
          </Link>
          <span>/</span>
          <span>Atividade</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Registro de Atividades</h1>
        <p className="text-muted-foreground mt-2">
          Histórico completo de ações realizadas neste projeto.
        </p>
      </div>

      <div className="space-y-6">
        {activityLoading && !activities ? (
          [...Array(10)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : activities && activities.length > 0 ? (
          <>
            <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
              {activities.map((activity) => (
                <div key={activity.id} className="relative flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                      <Avatar className="h-10 w-10 border-2 border-background">
                        <AvatarImage src={activity.userPhotoURL} />
                        <AvatarFallback>{activity.userName?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-1 -right-1 p-1 rounded-full bg-background border shadow-sm ${getActionColor(activity.action)}`}>
                        <Activity className="h-3 w-3" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-semibold">{activity.userName}</span>{' '}
                        <span className="text-muted-foreground">{getActionLabel(activity.action)}</span>{' '}
                        <span className="font-medium">{activity.targetName}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{activity.targetType}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button variant="outline" onClick={loadMore}>
                  Carregar mais atividades
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12 border-dashed border-2 rounded-lg">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold">Nenhuma atividade registrada</h3>
            <p className="text-sm text-muted-foreground">As ações realizadas no projeto aparecerão aqui.</p>
          </div>
        )}
      </div>
    </div>
  );
}
