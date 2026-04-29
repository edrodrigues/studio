'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Save, X, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { type Template } from '@/lib/types';
import { handleUpdateTemplateLink } from '@/lib/actions';
import { useAuthContext } from '@/context/auth-context';
import { useUser } from '@/firebase/provider';

interface EditLinkModalProps {
  template: Template | null;
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}

export function EditLinkModal({ template, isOpen, onClose, projectId }: EditLinkModalProps) {
  const [link, setLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const { signInWithGoogle } = useAuthContext();
  const { user } = useUser();

  // Reset link when template changes
  useEffect(() => {
    if (template) {
      setLink(template.projectDocLink || '');
    } else {
      setLink('');
    }
  }, [template]);

  const handleSave = async () => {
    if (!template) return;
    if (!user) {
      toast({
        title: 'Conecte sua conta Google',
        description: 'Precisamos validar o Google Docs antes de salvar o fallback do projeto.',
        action: (
          <Button variant="outline" size="sm" onClick={() => signInWithGoogle()}>
            Conectar
          </Button>
        ),
      });
      return;
    }

    setIsSaving(true);
    try {
      const result = await handleUpdateTemplateLink({
        templateId: template.id,
        userId: user.uid,
        projectDocLink: link.trim() || '',
        projectId,
      });

      if (result.success) {
        if (result.warnings?.length) {
          toast({
            title: 'Link salvo com observações',
            description: result.warnings.join(' '),
          });
        }
        toast({
          title: 'Link atualizado',
          description: 'O link customizado foi salvo com sucesso.',
        });
        onClose();
      } else {
        throw new Error(result.error || 'Failed to update');
      }
    } catch (error) {
      console.error('Failed to update template link:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o link. Verifique o formato da URL.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to original value
    if (template) {
      setLink(template.projectDocLink || '');
    }
    onClose();
  };

  if (!template) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Editar Versão Customizada
          </DialogTitle>
          <DialogDescription>
            Atualize o link da versão customizada do projeto para o modelo <strong>{template.name}</strong>. Ele será usado como fallback operacional quando o link original não estiver acessível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="custom-link">URL do Google Doc</Label>
            <Input
              id="custom-link"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://docs.google.com/document/d/..."
              type="url"
            />
            <p className="text-xs text-muted-foreground">
              Cole o link do Google Doc com a versão customizada do modelo usada como fallback.
            </p>
          </div>

          {!link.trim() && (
            <Alert>
              <ExternalLink className="h-4 w-4" />
              <AlertTitle>Fallback recomendado</AlertTitle>
              <AlertDescription>
                Esse campo continua opcional, mas é o fallback operacional usado quando o link original falha.
              </AlertDescription>
            </Alert>
          )}

          {template.googleDocLink && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Link Original (referência)</Label>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">
                  {template.googleDocLink}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
