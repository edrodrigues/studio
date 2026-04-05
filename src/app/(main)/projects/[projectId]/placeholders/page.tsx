'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, Edit2, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react';

import { PageHeader } from '@/components/app/page-header';
import { useProject, useProjectPlaceholders } from '@/hooks/use-projects';
import { useToast } from '@/hooks/use-toast';
import type { ProjectPlaceholder } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

type ConfidenceLevel = 'high' | 'medium' | 'low';
type FilterOption = 'all' | 'low' | 'medium' | 'confirmed' | 'pending';

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getConfidenceConfig(level: ConfidenceLevel) {
  switch (level) {
    case 'high':
      return { label: 'Alta', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: TrendingUp };
    case 'medium':
      return { label: 'Média', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Minus };
    case 'low':
      return { label: 'Baixa', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', icon: TrendingDown };
  }
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = getConfidenceLevel(confidence);
  const config = getConfidenceConfig(level);
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      <span className="opacity-75">({Math.round(confidence * 100)}%)</span>
    </div>
  );
}

export default function ProjectPlaceholdersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project, isLoading: projectLoading } = useProject(projectId);
  const { placeholders, isLoading: placeholdersLoading, updatePlaceholder, confirmPlaceholder } = useProjectPlaceholders(projectId);
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortByConfidence, setSortByConfidence] = useState(true);
  const [editingPlaceholder, setEditingPlaceholder] = useState<ProjectPlaceholder | null>(null);
  const [editValue, setEditValue] = useState('');

  const stats = useMemo(() => {
    if (!placeholders) return { total: 0, confirmed: 0, lowConfidence: 0, pending: 0 };
    return {
      total: placeholders.length,
      confirmed: placeholders.filter((placeholder) => placeholder.status === 'confirmed').length,
      lowConfidence: placeholders.filter((placeholder) => placeholder.confidence < 0.5 && placeholder.status !== 'confirmed').length,
      pending: placeholders.filter((placeholder) => placeholder.status !== 'confirmed').length,
    };
  }, [placeholders]);

  const filteredAndSortedPlaceholders = useMemo(() => {
    if (!placeholders) return [];
    let filtered = placeholders;

    switch (filterOption) {
      case 'low':
        filtered = filtered.filter((placeholder) => placeholder.confidence < 0.5 && placeholder.status !== 'confirmed');
        break;
      case 'medium':
        filtered = filtered.filter((placeholder) => placeholder.confidence >= 0.5 && placeholder.confidence < 0.8 && placeholder.status !== 'confirmed');
        break;
      case 'confirmed':
        filtered = filtered.filter((placeholder) => placeholder.status === 'confirmed');
        break;
      case 'pending':
        filtered = filtered.filter((placeholder) => placeholder.status !== 'confirmed');
        break;
    }

    if (searchTerm) {
      filtered = filtered.filter((placeholder) =>
        placeholder.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        placeholder.value?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (sortByConfidence) {
      return [...filtered].sort((a, b) => {
        if (a.status === 'confirmed' && b.status !== 'confirmed') return 1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return -1;
        return a.confidence - b.confidence;
      });
    }

    return [...filtered].sort((a, b) => a.key.localeCompare(b.key));
  }, [filterOption, placeholders, searchTerm, sortByConfidence]);

  const handleEdit = (placeholder: ProjectPlaceholder) => {
    setEditingPlaceholder(placeholder);
    setEditValue(placeholder.value || '');
  };

  const handleSave = async () => {
    if (!editingPlaceholder) return;
    try {
      await updatePlaceholder(editingPlaceholder.id, editValue);
      setEditingPlaceholder(null);
      toast({ title: 'Variável atualizada' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: (error as Error).message });
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmPlaceholder(id);
      toast({ title: 'Variável confirmada' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro ao confirmar', description: (error as Error).message });
    }
  };

  return (
    <div className="page-shell">
      <div className="page-width page-stack">
        <PageHeader
          title="Variáveis Extraídas"
          description="Revise, confirme e ajuste as informações extraídas dos documentos do projeto."
          backHref={`/projects/${projectId}`}
          backLabel={projectLoading ? 'Carregando projeto…' : project?.name || 'Projeto'}
        />

        {!placeholdersLoading && placeholders && placeholders.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-primary/10 p-2"><span className="text-lg font-bold">{stats.total}</span></div><div className="text-sm"><p className="font-medium">Total</p><p className="text-xs text-muted-foreground">variáveis</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/30"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div><div className="text-sm"><p className="font-medium">{stats.confirmed}</p><p className="text-xs text-muted-foreground">confirmadas</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30"><AlertTriangle className="h-5 w-5 text-red-600" /></div><div className="text-sm"><p className="font-medium">{stats.lowConfidence}</p><p className="text-xs text-muted-foreground">baixa confiança</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30"><Clock className="h-5 w-5 text-amber-600" /></div><div className="text-sm"><p className="font-medium">{stats.pending}</p><p className="text-xs text-muted-foreground">pendentes</p></div></CardContent></Card>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou valor…" className="pl-10" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-sm text-muted-foreground">Filtrar:</span>
            <div className="flex flex-wrap gap-1">
              {(['all', 'low', 'medium', 'confirmed', 'pending'] as FilterOption[]).map((option) => (
                <Button key={option} variant={filterOption === option ? 'default' : 'outline'} size="sm" onClick={() => setFilterOption(option)} className="h-8 text-xs">
                  {option === 'all' ? 'Todas' : option === 'low' ? 'Baixa' : option === 'medium' ? 'Média' : option === 'confirmed' ? 'Confirmadas' : 'Pendentes'}
                </Button>
              ))}
            </div>
          </div>
          <Button variant={sortByConfidence ? 'default' : 'outline'} size="sm" onClick={() => setSortByConfidence(!sortByConfidence)} className="gap-2">
            <TrendingDown className="h-4 w-4" />
            Prioridade
          </Button>
        </div>

        <div className="grid gap-4">
          {placeholdersLoading ? (
            [...Array(5)].map((_, index) => <Skeleton key={index} className="h-24 w-full" />)
          ) : filteredAndSortedPlaceholders.length > 0 ? (
            filteredAndSortedPlaceholders.map((placeholder) => {
              const confidenceLevel = getConfidenceLevel(placeholder.confidence);

              return (
                <Card
                  key={placeholder.id}
                  className={
                    placeholder.status === 'confirmed'
                      ? 'border-green-500/20 bg-green-500/5'
                      : confidenceLevel === 'low'
                        ? 'border-red-200 dark:border-red-800'
                        : confidenceLevel === 'medium'
                          ? 'border-amber-200 dark:border-amber-800'
                          : ''
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-semibold text-primary">{placeholder.key}</code>
                          <ConfidenceBadge confidence={placeholder.confidence} />
                          <Badge variant={placeholder.status === 'confirmed' ? 'default' : placeholder.value ? 'secondary' : 'outline'}>
                            {placeholder.status === 'confirmed' ? 'Confirmado' : placeholder.value ? 'Revisado' : 'Pendente'}
                          </Badge>
                          {placeholder.source ? <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Fonte: {placeholder.source}</span> : null}
                        </div>
                        <p className={`mt-2 text-sm font-medium ${!placeholder.value && placeholder.status !== 'confirmed' ? 'italic text-muted-foreground' : ''}`}>
                          {placeholder.value || 'Valor não preenchido'}
                        </p>
                        {placeholder.modifiedByName ? (
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Editado por {placeholder.modifiedByName}
                          </p>
                        ) : null}
                        {placeholder.aiSuggestions?.length && placeholder.status !== 'confirmed' ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            <span className="font-medium">Sugestão IA:</span> {placeholder.aiSuggestions[0]}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {placeholder.status !== 'confirmed' ? (
                          <Button variant="outline" size="sm" onClick={() => handleConfirm(placeholder.id)}>
                            Confirmar
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(placeholder)} aria-label={`Editar variável ${placeholder.key}`}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="rounded-2xl border-2 border-dashed py-12 text-center">
              <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold">Nenhuma variável encontrada</h3>
              <p className="text-sm text-muted-foreground">Ajuste sua busca ou adicione documentos para extração.</p>
            </div>
          )}
        </div>

        <Dialog open={!!editingPlaceholder} onOpenChange={(open) => !open && setEditingPlaceholder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Variável</DialogTitle>
              <DialogDescription>
                Ajuste o valor para a variável <code className="text-primary">{editingPlaceholder?.key}</code>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor</Label>
                <Input id="value" value={editValue} onChange={(event) => setEditValue(event.target.value)} placeholder="Digite o valor…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPlaceholder(null)}>Cancelar</Button>
              <Button onClick={handleSave}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
