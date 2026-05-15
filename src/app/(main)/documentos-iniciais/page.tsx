'use client';

import { useState, useTransition } from 'react';
import { FileText, Clock, CircleDollarSign, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { type UploadedFile } from '@/lib/types';
import { FileUploader } from '@/components/app/file-uploader';
import { handleSyncToFileSearch } from '@/lib/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/context/auth-context';
import { useFirebase } from '@/firebase/provider';

const FeedbackModal = dynamic(() => import('@/components/app/feedback-modal').then(mod => mod.FeedbackModal), { ssr: false });
const ConsistencyAnalysisModal = dynamic(() => import('@/components/app/consistency-analysis-modal').then(mod => mod.ConsistencyAnalysisModal), { ssr: false });
import useLocalStorage from '@/hooks/use-local-storage';
import { ClearEntitiesButton } from '@/components/app/clear-entities-button';


export default function DocumentosIniciaisPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  const { firestore } = useFirebase();
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [contractType, setContractType] = useState<string>('');
  const [processType, setProcessType] = useState<string>('');
  const [isSyncing, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [, setStoredEntities] = useLocalStorage<any>('extractedEntities', null);

  const { toast } = useToast();

  const handleFileSelect = (key: string) => (file: File | null) => {
    setFiles(prev => ({ ...prev, [key]: file }));
  };

  const handleFeedbackClick = (file: File | null) => {
    if (file) {
      setFeedbackFiles([{ id: file.name, file }]);
      setIsFeedbackModalOpen(true);
    }
  };

  const hasAtLeastOneFile = Object.values(files).some(file => file !== null);
  const hasAtLeastTwoFiles = Object.values(files).filter(file => file !== null).length >= 2;

  const handleConsistencyClick = () => {
    setIsConsistencyModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!hasAtLeastOneFile) return;
    if (!user) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Usuário não autenticado.' });
      return;
    }

    startTransition(async () => {
      try {
        toast({
          title: 'Funcionalidade indisponível',
          description: 'O upload de documentos iniciais será implementado em breve. Use a página Documentos do projeto para enviar arquivos.',
        });
        return;
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Erro na Sincronização',
          description:
            error instanceof Error
              ? error.message
              : 'Ocorreu um erro desconhecido.',
        });
      }
    });
  };

  return (
    <>
      <div className="container relative">
        <section className="mx-auto flex max-w-3xl flex-col items-center justify-center py-12 text-center md:py-20">
          <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:leading-[1.1]">
            Analise os documentos iniciais
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">
            Habilite o conteúdo dos documentos iniciais como contexto para o ALEX e para geração de novos documentos sincronizando-os ao File Search.
          </p>
          <div className="mt-4">
            <ClearEntitiesButton />
          </div>
        </section>

        <section className="mx-auto max-w-5xl mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Definições Iniciais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <Label>Tipo de Contrato</Label>
                <RadioGroup
                  value={contractType}
                  onValueChange={setContractType}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ted" id="ted" />
                    <Label htmlFor="ted">TED</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="acordo-parceria-inovacao" id="acordo-parceria-inovacao" />
                    <Label htmlFor="acordo-parceria-inovacao">Acordo de Parceria (Lei de Inovação)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="acordo-parceria-embrapii" id="acordo-parceria-embrapii" />
                    <Label htmlFor="acordo-parceria-embrapii">Acordo de Parceria (Embrapii)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="contrato-extensao" id="contrato-extensao" />
                    <Label htmlFor="contrato-extensao">Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)</Label>
                  </div>
                </RadioGroup>
              </div>
              {contractType === 'ted' && (
                <div className="space-y-3">
                  <Label>Tipo de Processo</Label>
                  <RadioGroup
                    value={processType}
                    onValueChange={setProcessType}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="ufpe-parceiro"
                        id="ufpe-parceiro"
                      />
                      <Label htmlFor="ufpe-parceiro">UFPE - Parceiro</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fade-ufpe" id="fade-ufpe" />
                      <Label htmlFor="fade-ufpe">Fade - UFPE</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          <FileUploader
            icon={<FileText size={24} />}
            title="Plano de Trabalho"
            description="Documento com o escopo e atividades."
            handleFileSelect={handleFileSelect('planOfWork')}
            handleFeedback={() => handleFeedbackClick(files.planOfWork)}
            name="planOfWork"
            disabled={!contractType}
          />
          <FileUploader
            icon={<Clock size={24} />}
            title="Termo de Execução Decentralizada (TED)"
            description="Cronograma e prazos do projeto."
            handleFileSelect={handleFileSelect('termOfExecution')}
            handleFeedback={() => handleFeedbackClick(files.termOfExecution)}
            name="termOfExecution"
            disabled={!contractType}
          />
          <FileUploader
            icon={<CircleDollarSign size={24} />}
            title="Planilha Orçamentária"
            description="Valores e distribuição de recursos."
            handleFileSelect={handleFileSelect('budgetSpreadsheet')}
            handleFeedback={() => handleFeedbackClick(files.budgetSpreadsheet)}
            name="budgetSpreadsheet"
            disabled={!contractType}
          />
        </section>

        <section className="mt-12 flex justify-center gap-4 py-8">
          <Button
            size="lg"
            onClick={handleConsistencyClick}
            disabled={!hasAtLeastTwoFiles}
            variant="outline"
          >
            Análise da consistência de documentos com IA
          </Button>
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!hasAtLeastTwoFiles || isSyncing}
          >
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              'Sincronizar Arquivos'
            )}
          </Button>
        </section>
      </div>
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={setIsFeedbackModalOpen}
        files={feedbackFiles}
      />
      <ConsistencyAnalysisModal
        isOpen={isConsistencyModalOpen}
        onOpenChange={setIsConsistencyModalOpen}
        files={Object.entries(files)
          .filter(([, file]) => file !== null)
          .map(([key, file]) => ({ id: key, file: file! }))}
      />
    </>
  );
}
