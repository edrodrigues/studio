'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, CheckCircle2, AlertTriangle, Clock, Edit2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useProject, useProjectPlaceholders } from '@/hooks/use-projects';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ProjectPlaceholder } from '@/lib/types';

type ConfidenceLevel = 'high' | 'medium' | 'low';

function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.5) return 'medium';
  return 'low';
}

function getConfidenceConfig(level: ConfidenceLevel) {
  switch (level) {
    case 'high':
      return {
        label: 'Alta',
        color: 'text-emerald-600',
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        border: 'border-emerald-200 dark:border-emerald-800',
        icon: TrendingUp,
      };
    case 'medium':
      return {
        label: 'Média',
        color: 'text-amber-600',
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        border: 'border-amber-200 dark:border-amber-800',
        icon: Minus,
      };
    case 'low':
      return {
        label: 'Baixa',
        color: 'text-red-600',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-red-200 dark:border-red-800',
        icon: TrendingDown,
      };
  }
}

function ConfidenceBadge({ confidence, showPercentage = false }: { confidence: number; showPercentage?: boolean }) {
  const level = getConfidenceLevel(confidence);
  const config = getConfidenceConfig(level);
  const Icon = config.icon;
  
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      {showPercentage && (
        <span className="opacity-75">({Math.round(confidence * 100)}%)</span>
      )}
    </div>
  );
}

type FilterOption = 'all' | 'low' | 'medium' | 'confirmed' | 'pending';

export default function ProjectPlaceholdersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project, isLoading: projectLoading } = useProject(projectId);
  const { placeholders, isLoading: placeholdersLoading, updatePlaceholder, confirmPlaceholder } = useProjectPlaceholders(projectId);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [sortByConfidence, setSortByConfidence] = useState(true);
  const [editingPlaceholder, setEditingPlaceholder] = useState<ProjectPlaceholder | null>(null);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();

  const stats = useMemo(() => {
    if (!placeholders) return { total: 0, confirmed: 0, lowConfidence: 0, pending: 0 };
    return {
      total: placeholders.length,
      confirmed: placeholders.filter(p => p.status === 'confirmed').length,
      lowConfidence: placeholders.filter(p => p.confidence < 0.5 && p.status !== 'confirmed').length,
      pending: placeholders.filter(p => p.status !== 'confirmed').length,
    };
  }, [placeholders]);

  const filteredAndSortedPlaceholders = useMemo(() => {
    if (!placeholders) return [];
    
    let filtered = placeholders;
    
    // Apply filter
    switch (filterOption) {
      case 'low':
        filtered = filtered.filter(p => p.confidence < 0.5 && p.status !== 'confirmed');
        break;
      case 'medium':
        filtered = filtered.filter(p => p.confidence >= 0.5 && p.confidence < 0.8 && p.status !== 'confirmed');
        break;
      case 'confirmed':
        filtered = filtered.filter(p => p.status === 'confirmed');
        break;
      case 'pending':
        filtered = filtered.filter(p => p.status !== 'confirmed');
        break;
    }
    
    // Apply search
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.value?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Sort by confidence (low first) or alphabetically
    if (sortByConfidence) {
      filtered = [...filtered].sort((a, b) => {
        // Confirmed items go to the bottom
        if (a.status === 'confirmed' && b.status !== 'confirmed') return 1;
        if (a.status !== 'confirmed' && b.status === 'confirmed') return -1;
        // Sort by confidence ascending
        return a.confidence - b.confidence;
      });
    } else {
      filtered = [...filtered].sort((a, b) => a.key.localeCompare(b.key));
    }
    
    return filtered;
  }, [placeholders, filterOption, searchTerm, sortByConfidence]);

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
          <span>Variáveis</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Variáveis Extraídas</h1>
            <p className="text-muted-foreground mt-2">
              Revise e confirme as informações extraídas dos documentos.
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {!placeholdersLoading && placeholders && placeholders.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <span className="text-lg font-bold">{stats.total}</span>
              </div>
              <div className="text-sm">
                <p className="font-medium">Total</p>
                <p className="text-xs text-muted-foreground">variáveis</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.confirmed === stats.total ? 'border-green-500/50' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{stats.confirmed}</p>
                <p className="text-xs text-muted-foreground">confirmadas</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.lowConfidence > 0 ? 'border-red-500/50' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{stats.lowConfidence}</p>
                <p className="text-xs text-muted-foreground">baixa confiança</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="text-sm">
                <p className="font-medium">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou valor..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filtrar:</span>
          <div className="flex gap-1">
            {(['all', 'low', 'medium', 'confirmed', 'pending'] as FilterOption[]).map((option) => (
              <Button
                key={option}
                variant={filterOption === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterOption(option)}
                className="text-xs h-8"
              >
                {option === 'all' ? 'Todas' : 
                 option === 'low' ? 'Baixa' : 
                 option === 'medium' ? 'Média' : 
                 option === 'confirmed' ? 'Confirmadas' : 'Pendentes'}
              </Button>
            ))}
          </div>
        </div>
        <Button
          variant={sortByConfidence ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSortByConfidence(!sortByConfidence)}
          className="gap-2"
        >
          <TrendingDown className="h-4 w-4" />
          Prioridade
        </Button>
      </div>

      {/* Placeholders List */}
      <div className="grid gap-4">
        {placeholdersLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filteredAndSortedPlaceholders && filteredAndSortedPlaceholders.length > 0 ? (
          filteredAndSortedPlaceholders.map((placeholder) => {
            const confidenceLevel = getConfidenceLevel(placeholder.confidence);
            const confidenceConfig = getConfidenceConfig(confidenceLevel);
            return (
              <Card 
                key={placeholder.id} 
                className={`
                  ${placeholder.status === 'confirmed' ? 'border-green-500/20 bg-green-500/5' : ''}
                  ${confidenceLevel === 'low' && placeholder.status !== 'confirmed' ? 'border-red-200 dark:border-red-800' : ''}
                  ${confidenceLevel === 'medium' && placeholder.status !== 'confirmed' ? 'border-amber-200 dark:border-amber-800' : ''}
                  transition-colors
                `}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-semibold text-primary">
                          {placeholder.key}
                        </code>
                        <ConfidenceBadge confidence={placeholder.confidence} />
                        <Badge variant={
                          placeholder.status === 'confirmed' ? 'default' :
                          placeholder.value ? 'secondary' : 'outline'
                        }>
                          {placeholder.status === 'confirmed' ? 'Confirmado' :
                           placeholder.value ? 'Revisado' : 'Pendente'}
                        </Badge>
                        {placeholder.source && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            Fonte: {placeholder.source}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm font-medium mt-2 ${!placeholder.value && placeholder.status !== 'confirmed' ? 'text-muted-foreground italic' : ''}`}>
                        {placeholder.value || 'Valor não preenchido'}
                      </p>
                      {placeholder.modifiedByName && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Editado por {placeholder.modifiedByName}
                        </p>
                      )}
                      {placeholder.aiSuggestions && placeholder.aiSuggestions.length > 0 && placeholder.status !== 'confirmed' && (
                        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                          <span className="font-medium">Sugestão IA:</span> {placeholder.aiSuggestions[0]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {placeholder.status !== 'confirmed' && (
                        <Button variant="outline" size="sm" onClick={() => handleConfirm(placeholder.id)}>
                          Confirmar
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(placeholder)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-12 border-dashed border-2 rounded-lg">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
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
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor</Label>
              <Input
                id="value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Digite o valor..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPlaceholder(null)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
