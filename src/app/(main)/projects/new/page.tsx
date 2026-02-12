'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useFirebase, useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ProjectStatus, type Project } from '@/lib/types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
        description: 'Por favor, preencha o nome do projeto e do cliente.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      
      // Create project
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
      const projectId = projectRef.id;

      // Create owner membership
      const memberData = {
        projectId,
        userId: user.uid,
        role: 'owner' as const,
        invitedBy: user.uid,
        invitedAt: now,
        joinedAt: now,
        email: user.email || '',
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
      };

      await addDoc(
        collection(firestore, 'projectMembers'),
        memberData
      );

      toast({
        title: 'Projeto criado!',
        description: 'Seu novo projeto foi criado com sucesso.',
      });

      // Redirect to project page
      router.push(`/projects/${projectId}`);
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
    <div className="container py-8 max-w-2xl">
      <div className="mb-6">
        <Link
          href="/projects"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para projetos
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Criar Novo Projeto</CardTitle>
          <CardDescription>
            Configure um novo projeto de contrato para começar a colaborar com sua equipe.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                Nome do projeto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Ex: Contrato de Prestação de Serviços - Empresa XYZ"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                Escolha um nome descritivo para identificar facilmente este projeto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientName">
                Nome do cliente <span className="text-destructive">*</span>
              </Label>
              <Input
                id="clientName"
                placeholder="Ex: Empresa XYZ Ltda"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                O nome do cliente ou contraparte principal deste contrato.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva os objetivos e escopo deste projeto..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Uma breve descrição ajuda sua equipe a entender o contexto do projeto.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/projects')}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Projeto'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
