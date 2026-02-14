'use client';

import { useState, useTransition } from 'react';
import { FileText, Clock, CircleDollarSign, Loader2, Trash2 } from 'lucide-react';
import { fileToDataURI } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/app/file-uploader';
import { handleExtractEntitiesAction } from '@/lib/actions';
import { UploadedFile } from '@/lib/types';
import dynamic from 'next/dynamic';
import useLocalStorage from '@/hooks/use-local-storage';

const FeedbackModal = dynamic(() => import('@/components/app/feedback-modal').then(mod => mod.FeedbackModal), { ssr: false });
const ConsistencyAnalysisModal = dynamic(() => import('@/components/app/consistency-analysis-modal').then(mod => mod.ConsistencyAnalysisModal), { ssr: false });
const EntitiesPreviewModal = dynamic(() => import('@/components/app/entities-preview-modal').then(mod => mod.EntitiesPreviewModal), { ssr: false });

interface ProjectDocumentsUploaderProps {
  projectId: string;
}

export function ProjectDocumentsUploader({ projectId }: ProjectDocumentsUploaderProps) {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [contractType, setContractType] = useState<string>('');
  const [processType, setProcessType] = useState<string>('');
  const [isExtracting, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [isEntitiesModalOpen, setIsEntitiesModalOpen] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<string>('');
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

  const handleClearAll = () => {
    setFiles({
      planOfWork: null,
      termOfExecution: null,
      budgetSpreadsheet: null,
    });
    setContractType('');
    setProcessType('');
    toast({
      title: 'Dados limpos',
      description: 'Todos os arquivos e seleções foram removidos.',
    });
  };

  const hasAtLeastOneFile = Object.values(files).some(file => file !== null);
  const hasAtLeastTwoFiles = Object.values(files).filter(file => file !== null).length >= 2;

  const handleConsistencyClick = () => {
    setIsConsistencyModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!hasAtLeastOneFile) return;

    startTransition(async () => {
      try {
        const uploadedFiles = await Promise.all(
          Object.entries(files)
            .filter(([, file]) => file)
            .map(async ([key, file]) => ({
              name: file!.name,
              dataUri: await fileToDataURI(file!),
            }))
        );

        if (uploadedFiles.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Nenhum arquivo',
            description: 'Carregue ao menos um documento para extrair as entidades.',
          });
          return;
        }

        const result = await handleExtractEntitiesAction({ documents: uploadedFiles });

        if (result.success && result.data?.extractedJson) {
          const entitiesJson = result.data.extractedJson;

          setExtractedEntities(JSON.stringify(entitiesJson, null, 2));
          setStoredEntities(entitiesJson);

          setIsEntitiesModalOpen(true);
          toast({
            title: 'Sucesso!',
            description: 'As entidades foram extraídas e salvas para a próxima etapa.',
          });
        } else {
          throw new Error(result.error || 'Falha ao extrair entidades.');
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Erro na Extração',
          description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.',
        });
      }
    });
  };

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">
            Analise os documentos iniciais
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Analise os documentos iniciais com a IA e depois clique em &quot;Extrair Entidades&quot; 
            para que as variáveis sejam identificadas e usadas de contexto para os demais documentos.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleClearAll}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Limpar Dados Antigos
          </Button>
        </div>

        {/* Contract Type Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Definições Iniciais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Tipo de Contrato</Label>
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
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-medium">Tipo de Processo</Label>
                <RadioGroup
                  value={processType}
                  onValueChange={setProcessType}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="ufpe-parceiro" id="ufpe-parceiro" />
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

        {/* File Uploaders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Button
            onClick={handleConsistencyClick}
            disabled={!hasAtLeastTwoFiles}
            variant="outline"
            size="lg"
          >
            Análise da consistência de documentos com IA
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasAtLeastOneFile || isExtracting}
            size="lg"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              'Extrair Entidades'
            )}
          </Button>
        </div>
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
      <EntitiesPreviewModal
        isOpen={isEntitiesModalOpen}
        onOpenChange={setIsEntitiesModalOpen}
        jsonContent={extractedEntities}
      />
    </>
  );
}
