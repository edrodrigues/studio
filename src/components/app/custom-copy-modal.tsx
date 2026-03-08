'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, FileText, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { Template } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { CustomCopyService } from '@/lib/services/custom-copy.service';
import { useFirebase } from '@/firebase';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

interface CustomCopyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function CustomCopyModal({ isOpen, onClose, projectId, projectName }: CustomCopyModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [newDocName, setNewDocName] = useState<string>('');
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ docLink: string; matches: number; total: number } | null>(null);
  
  const { toast } = useToast();
  const { auth } = useFirebase();

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      setResult(null);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'contractModels'));
      const fetchedTemplates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Template[];
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: 'Erro ao carregar modelos',
        description: 'Não foi possível carregar os modelos de contrato.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    const template = templates.find(t => t.id === id);
    if (template) {
      setNewDocName(`${template.name} - ${projectName}`);
    }
  };

  const handleCreateCopy = async () => {
    if (!selectedTemplateId || !newDocName) return;
    
    setIsProcessing(true);
    try {
      const user = auth?.currentUser;
      if (!user) throw new Error('Usuário não autenticado');
      
      const token = await user.getIdToken(); // Note: This might not be the Google Access Token
      // In a real scenario, we need the Google OAuth token. 
      // For now, let's assume the service can handle it or we'll need to pass it.
      // Assuming our middleware/auth provides the necessary tokens.
      
      // For this implementation, we'll use a placeholder or handle token retrieval.
      // Since this is a server-side action usually, we might need a different approach.
      // But let's follow the service structure.
      
      const selectedTemplate = templates.find(t => t.id === selectedTemplateId);
      if (!selectedTemplate?.googleDocLink) throw new Error('Modelo sem link do Google Docs');
      
      // Extract ID from link
      const match = selectedTemplate.googleDocLink.match(/\/d\/([a-zA-Z0-9-_]+)/);
      const docId = match ? match[1] : selectedTemplate.id;

      const res = await CustomCopyService.createCustomizedCopy({
        accessToken: (window as any).googleAccessToken || '', // Temporary hack for prototype
        projectId,
        templateId: docId,
        newDocName
      });

      setResult({
        docLink: res.documentLink,
        matches: res.matchesCount,
        total: res.placeholdersCount
      });

      toast({
        title: 'Cópia criada com sucesso!',
        description: `Detectados ${res.placeholdersCount} campos, ${res.matchesCount} preenchidos automaticamente.`,
      });
    } catch (error: any) {
      console.error('Error creating custom copy:', error);
      toast({
        title: 'Erro ao criar cópia',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Criar Cópia Customizada</DialogTitle>
          <DialogDescription>
            Crie uma cópia de um modelo de contrato preenchida automaticamente com os dados do projeto.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="template">Modelo de Contrato</Label>
              <Select 
                value={selectedTemplateId} 
                onValueChange={handleTemplateChange}
                disabled={isLoadingTemplates || isProcessing}
              >
                <SelectTrigger id="template">
                  <SelectValue placeholder={isLoadingTemplates ? "Carregando..." : "Selecione um modelo"} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="name">Nome do Novo Documento</Label>
              <Input
                id="name"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                placeholder="Ex: Contrato de Prestação de Serviços - Cliente X"
                disabled={isProcessing}
              />
            </div>

            {selectedTemplateId && (
              <div className="bg-muted p-3 rounded-md text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground">
                  A IA analisará o modelo e preencherá os placeholders (ex: &lt;NOME&gt;, [VALOR], {"{{DATA}}"}) 
                  usando as informações extraídas dos documentos deste projeto.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Cópia Criada!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {result.matches} de {result.total} campos identificados foram preenchidos automaticamente.
            </p>
            
            <Button className="w-full" asChild>
              <a href={result.docLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Abrir no Google Docs
              </a>
            </Button>
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isProcessing}>
                Cancelar
              </Button>
              <Button 
                onClick={handleCreateCopy} 
                disabled={!selectedTemplateId || !newDocName || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Gerar Cópia'
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
