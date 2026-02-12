'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  ArrowLeft,
  Plus,
  MoreVertical,
  Crown,
  Pencil,
  Eye,
  UserMinus,
  Mail,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useProject, useProjectMembers, usePermission } from '@/hooks/use-projects';
import { useUser } from '@/firebase';
import { ProjectRole, type ProjectMember } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Role config for display
const roleConfig: Record<
  ProjectRole,
  { label: string; description: string; icon: React.ReactNode }
> = {
  owner: {
    label: 'Proprietário',
    description: 'Controle total, pode excluir projeto',
    icon: <Crown className="h-4 w-4" />,
  },
  editor: {
    label: 'Editor',
    description: 'Pode editar variáveis e convidar',
    icon: <Pencil className="h-4 w-4" />,
  },
  viewer: {
    label: 'Visualizador',
    description: 'Acesso somente leitura',
    icon: <Eye className="h-4 w-4" />,
  },
};

// Role badge component
function RoleBadge({ role }: { role: ProjectRole }) {
  const config = roleConfig[role];
  return (
    <Badge variant={role === 'owner' ? 'default' : role === 'editor' ? 'secondary' : 'outline'}>
      <span className="flex items-center gap-1">
        {config.icon}
        {config.label}
      </span>
    </Badge>
  );
}

// Member list item
function MemberListItem({
  member,
  currentUserId,
  canManage,
  onUpdateRole,
  onRemove,
}: {
  member: ProjectMember & { id: string };
  currentUserId: string;
  canManage: boolean;
  onUpdateRole: (memberId: string, role: ProjectRole) => void;
  onRemove: (memberId: string) => void;
}) {
  const isCurrentUser = member.userId === currentUserId;
  const canChangeThisMember = canManage && !isCurrentUser && member.role !== 'owner';

  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={member.photoURL} />
          <AvatarFallback>
            {member.displayName?.charAt(0) || member.email?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {member.displayName || member.email?.split('@')[0] || 'Usuário'}
            </p>
            {isCurrentUser && (
              <Badge variant="outline" className="text-xs">
                Você
              </Badge>
            )}
            {!member.joinedAt && (
              <Badge variant="secondary" className="text-xs">
                Pendente
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{member.email}</p>
          {member.joinedAt && (
            <p className="text-xs text-muted-foreground">
              Entrou{' '}
              {formatDistanceToNow(new Date(member.joinedAt), {
                addSuffix: true,
                locale: ptBR,
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <RoleBadge role={member.role} />

        {canChangeThisMember && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onUpdateRole(member.id, ProjectRole.EDITOR)}
                disabled={member.role === ProjectRole.EDITOR}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Tornar Editor
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onUpdateRole(member.id, ProjectRole.VIEWER)}
                disabled={member.role === ProjectRole.VIEWER}
              >
                <Eye className="mr-2 h-4 w-4" />
                Tornar Visualizador
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onRemove(member.id)}
                className="text-destructive"
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Remover do projeto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// Invite dialog component
function InviteDialog({
  projectId,
  projectName,
  onInvite,
}: {
  projectId: string;
  projectName: string;
  onInvite: (email: string, role: ProjectRole) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>(ProjectRole.VIEWER);
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !email.includes('@')) {
      setError('Por favor, insira um email válido');
      return;
    }

    setIsInviting(true);
    try {
      await onInvite(email.trim(), role);
      toast({
        title: 'Convite enviado!',
        description: `Um convite foi enviado para ${email}`,
      });
      setEmail('');
      setRole(ProjectRole.VIEWER);
      setOpen(false);
    } catch (err) {
      setError('Erro ao enviar convite. Tente novamente.');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Convidar membro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convidar para {projectName}</DialogTitle>
            <DialogDescription>
              Envie um convite por email para colaborar neste projeto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="colaborador@empresa.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isInviting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Permissão</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as ProjectRole)}
                disabled={isInviting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['editor', 'viewer'] as ProjectRole[]).map((r) => (
                    <SelectItem key={r} value={r}>
                <div className="flex flex-col items-start">
                  <span>{roleConfig[r].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {roleConfig[r].description}
                  </span>
                </div>
              </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isInviting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isInviting}>
              {isInviting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar convite
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Main page component
export default function MembersPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { user } = useUser();
  const { toast } = useToast();

  const { project, isLoading: projectLoading } = useProject(projectId);
  const { members, isLoading: membersLoading, inviteMember, updateMemberRole, removeMember } =
    useProjectMembers(projectId);
  const { canManageMembers } = usePermission(projectId);

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
    try {
      await updateMemberRole(memberId, newRole);
      toast({
        title: 'Permissão atualizada',
        description: 'A permissão do membro foi atualizada com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível atualizar a permissão.',
      });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Tem certeza que deseja remover este membro do projeto?')) {
      return;
    }

    try {
      await removeMember(memberId);
      toast({
        title: 'Membro removido',
        description: 'O membro foi removido do projeto.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível remover o membro.',
      });
    }
  };

  if (projectLoading || membersLoading) {
    return (
      <div className="container py-8 max-w-4xl">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="container py-8">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Projeto não encontrado.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o projeto
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8" />
              Membros do Projeto
            </h1>
            <p className="text-muted-foreground mt-2">
              Gerencie quem tem acesso a <strong>{project.name}</strong>
            </p>
          </div>

          {canManageMembers && (
            <InviteDialog
              projectId={projectId}
              projectName={project.name}
              onInvite={inviteMember}
            />
          )}
        </div>
      </div>

      {/* Role descriptions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Níveis de Permissão</CardTitle>
          <CardDescription>Entenda o que cada permissão permite fazer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(['owner', 'editor', 'viewer'] as ProjectRole[]).map((role) => (
              <div key={role} className="flex items-start gap-3">
                <div className="mt-0.5">{roleConfig[role].icon}</div>
                <div>
                  <p className="font-medium">{roleConfig[role].label}</p>
                  <p className="text-sm text-muted-foreground">
                    {roleConfig[role].description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Members list */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Membros ({members?.length || 0})
        </h2>

        {members && members.length > 0 ? (
          members.map((member) => (
            <MemberListItem
              key={member.id}
              member={member}
              currentUserId={user?.uid || ''}
              canManage={canManageMembers}
              onUpdateRole={handleUpdateRole}
              onRemove={handleRemoveMember}
            />
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum membro</h3>
              <p className="text-muted-foreground mb-4">
                Você é o único membro deste projeto. Convide outras pessoas para colaborar.
              </p>
              {canManageMembers && (
                <InviteDialog
                  projectId={projectId}
                  projectName={project.name}
                  onInvite={inviteMember}
                />
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
