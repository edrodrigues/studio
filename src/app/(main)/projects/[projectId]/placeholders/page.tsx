'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Search, Filter, CheckCircle2, AlertTriangle, Clock, Edit2 } from 'lucide-react';
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

export default function ProjectPlaceholdersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { project, isLoading: projectLoading } = useProject(projectId);
  const { placeholders, isLoading: placeholdersLoading, updatePlaceholder, confirmPlaceholder } = useProjectPlaceholders(projectId);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPlaceholder, setEditingPlaceholder] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();

  const filteredPlaceholders = placeholders?.filter(p => 
    p.key.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.value?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (placeholder: any) => {
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
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filtrar
        </Button>
      </div>

      <div className="grid gap-4">
        {placeholdersLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : filteredPlaceholders && filteredPlaceholders.length > 0 ? (
          filteredPlaceholders.map((placeholder) => (
            <Card key={placeholder.id} className={placeholder.status === 'confirmed' ? 'border-green-500/20 bg-green-500/5' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-semibold text-primary">
                        {placeholder.key}
                      </code>
                      <Badge variant={
                        placeholder.status === 'confirmed' ? 'default' :
                        placeholder.value ? 'secondary' : 'outline'
                      }>
                        {placeholder.status === 'confirmed' ? 'Confirmado' :
                         placeholder.value ? 'Revisado' : 'Pendente'}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mt-2">
                      {placeholder.value || <span className="text-muted-foreground italic">Valor não preenchido</span>}
                    </p>
                    {placeholder.modifiedByName && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Editado por {placeholder.modifiedByName}
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
          ))
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
