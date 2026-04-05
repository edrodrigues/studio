'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

import { useFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { ProjectStatus, type Project } from '@/lib/types';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function NewProjectPage() {
  const router = useRouter();
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    clientName: '',
  });

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Você precisa estar autenticado para criar um projeto.',
      });
      return;
    }

    if (!formData.name.trim() || !formData.clientName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o nome do projeto e o nome do cliente.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const projectData: Omit<Project, 'id'> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        clientName: formData.clientName.trim(),
        createdBy: user.uid,
        createdAt: now,
        updatedAt: now,
        status: ProjectStatus.ACTIVE,
        memberCount: 1,
        documentCount: 0,
        placeholderCount: 0,
        contractCount: 0,
      };

      const projectRef = await addDoc(collection(firestore, 'projects'), projectData);
      await setDoc(doc(firestore, 'projectMembers', `${projectRef.id}_${user.uid}`), {
        projectId: projectRef.id,
        userId: user.uid,
        role: 'owner' as const,
        invitedBy: user.uid,
        invitedAt: now,
        joinedAt: now,
        email: user.email || '',
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      });

      toast({
        title: 'Projeto criado',
        description: 'Seu novo projeto foi criado com sucesso.',
      });
      router.push(`/projects/${projectRef.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao criar projeto',
        description: 'Ocorreu um erro ao criar o projeto. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page-shell">
      <div className="page-width page-stack max-w-3xl">
        <PageHeader
          title="Criar Novo Projeto"
          description="Configure o contexto básico do projeto para começar a organizar documentos, membros e contratos com uma estrutura pronta para revisão."
          backHref="/projects"
          backLabel="Voltar para projetos"
        />

        <Card>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-6 p-5 sm:p-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome do projeto</Label>
                  <Input
                    id="name"
                    placeholder="Ex.: Contrato de prestação de serviços - Empresa XYZ"
                    value={formData.name}
                    onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                    disabled={isSubmitting}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">Escolha um nome fácil de reconhecer na lista de projetos.</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="clientName">Nome do cliente</Label>
                  <Input
                    id="clientName"
                    placeholder="Ex.: Empresa XYZ Ltda."
                    value={formData.clientName}
                    onChange={(event) => setFormData({ ...formData, clientName: event.target.value })}
                    disabled={isSubmitting}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">Esse nome será usado para orientar o contexto e facilitar a identificação do projeto.</p>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva objetivos, escopo ou observações importantes…"
                    value={formData.description}
                    onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                    disabled={isSubmitting}
                    rows={5}
                  />
                  <p className="text-sm leading-6 text-muted-foreground">Opcional, mas útil para dar contexto à equipe e à revisão futura.</p>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/projects')} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando…
                  </>
                ) : (
                  'Criar Projeto'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
