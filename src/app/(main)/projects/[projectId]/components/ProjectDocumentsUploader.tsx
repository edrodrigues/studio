'use client';

import { useState, useTransition } from 'react';
import { FileText, Clock, CircleDollarSign, Loader2, Trash2, Upload, Download, History, ChevronDown, ChevronUp, File } from 'lucide-react';
import { fileToDataURI } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { FileUploader } from '@/components/app/file-uploader';
import { handleExtractEntitiesAction } from '@/lib/actions';
import { UploadedFile, ProjectDocument, DocumentStatus } from '@/lib/types';
import { useFileUpload, useDocumentsByType } from '@/hooks/use-file-upload';
import { useProjectDocuments } from '@/hooks/use-projects';
import { formatFileSize } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import dynamic from 'next/dynamic';
import useLocalStorage from '@/hooks/use-local-storage';

const FeedbackModal = dynamic(() => import('@/components/app/feedback-modal').then(mod => mod.FeedbackModal), { ssr: false });
const ConsistencyAnalysisModal = dynamic(() => import('@/components/app/consistency-analysis-modal').then(mod => mod.ConsistencyAnalysisModal), { ssr: false });
const EntitiesPreviewModal = dynamic(() => import('@/components/app/entities-preview-modal').then(mod => mod.EntitiesPreviewModal), { ssr: false });

interface ProjectDocumentsUploaderProps {
  projectId: string;
}

// Document type definitions with dynamic naming based on contract type
const DOCUMENT_TYPES = {
  planOfWork: {
    key: 'planOfWork',
    icon: <FileText size={24} />,
    getTitle: (contractType: string) => {
      switch (contractType) {
        case 'ted':
          return 'Plano de Trabalho';
        case 'acordo-parceria-inovacao':
        case 'acordo-parceria-embrapii':
          return 'Plano de Trabalho da Parceria';
        case 'contrato-extensao':
          return 'Plano de Trabalho de Extensão';
        default:
          return 'Plano de Trabalho';
      }
    },
    getDescription: (contractType: string) => 'Documento com o escopo e atividades.',
  },
  termOfExecution: {
    key: 'termOfExecution',
    icon: <Clock size={24} />,
    getTitle: (contractType: string) => {
      switch (contractType) {
        case 'ted':
          return 'Termo de Execução Decentralizada (TED)';
        case 'acordo-parceria-inovacao':
        case 'acordo-parceria-embrapii':
          return 'Acordo de Parceria';
        case 'contrato-extensao':
          return 'Contrato de Extensão Tecnológica';
        default:
          return 'Termo de Execução Decentralizada (TED)';
      }
    },
    getDescription: (contractType: string) => {
      switch (contractType) {
        case 'contrato-extensao':
          return 'Termo de Prestação de Serviços Técnicos.';
        default:
          return 'Cronograma e prazos do projeto.';
      }
    },
  },
  budgetSpreadsheet: {
    key: 'budgetSpreadsheet',
    icon: <CircleDollarSign size={24} />,
    getTitle: (contractType: string) => {
      switch (contractType) {
        case 'contrato-extensao':
          return 'Proposta de Honorários';
        default:
          return 'Planilha Orçamentária';
      }
    },
    getDescription: (contractType: string) => 'Valores e distribuição de recursos.',
  },
};

export function ProjectDocumentsUploader({ projectId }: ProjectDocumentsUploaderProps) {
  // State for contract and process types
  const [contractType, setContractType] = useState<string>('');
  const [processType, setProcessType] = useState<string>('');
  
  // State for file handling
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  
  // State for expanded history sections
  const [expandedHistory, setExpandedHistory] = useState<{ [key: string]: boolean }>({});
  
  // Hooks
  const { uploadFile, uploadState, resetUpload } = useFileUpload(projectId);
  const { documentsByType, isLoading: isLoadingDocs } = useDocumentsByType(projectId);
  const { updateDocument } = useProjectDocuments(projectId);
  
  // Other state
  const [isExtracting, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);
  const [isEntitiesModalOpen, setIsEntitiesModalOpen] = useState(false);
  const [extractedEntities, setExtractedEntities] = useState<string>('');
  const [, setStoredEntities] = useLocalStorage<any>('extractedEntities', null);

  const { toast } = useToast();

  const handleFileSelect = (key: string) => async (file: File | null) => {
    if (!file || !contractType) return;

    setFiles(prev => ({ ...prev, [key]: file }));
    setUploadingType(key);

    const docTypeConfig = DOCUMENT_TYPES[key as keyof typeof DOCUMENT_TYPES];
    const documentName = docTypeConfig.getTitle(contractType);

    try {
      const documentId = await uploadFile(file, projectId, key, documentName);
      
      if (documentId) {
        toast({
          title: 'Upload concluído!',
          description: `${documentName} foi salvo com sucesso.`,
        });
        // Clear the file from state after successful upload
        setFiles(prev => ({ ...prev, [key]: null }));
      } else if (uploadState.error) {
        toast({
          variant: 'destructive',
          title: 'Erro no upload',
          description: uploadState.error,
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: 'Não foi possível fazer o upload do arquivo.',
      });
    } finally {
      setUploadingType(null);
      resetUpload();
    }
  };

  const handleDownload = (url: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleHistory = (docType: string) => {
    setExpandedHistory(prev => ({
      ...prev,
      [docType]: !prev[docType]
    }));
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

  const renderDocumentCard = (docType: string, config: { key: string; icon: React.ReactNode; getTitle: (contractType: string) => string; getDescription: (contractType: string) => string }) => {
    const documents = documentsByType?.[docType] || [];
    const latestDoc = documents[0];
    const isUploading = uploadingType === docType;
    const hasHistory = documents.length > 1;
    const isHistoryExpanded = expandedHistory[docType] || false;
    const title = config.getTitle(contractType);
    const description = config.getDescription(contractType);

    return (
      <Card key={docType} className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          {/* Upload Section */}
          <FileUploader
            icon={config.icon}
            title={title}
            description={description}
            handleFileSelect={handleFileSelect(docType)}
            handleFeedback={() => handleFeedbackClick(files[docType])}
            name={docType}
            disabled={!contractType || isUploading}
          />

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Enviando...</span>
                <span className="font-medium">{Math.round(uploadState.progress)}%</span>
              </div>
              <Progress value={uploadState.progress} className="h-2" />
            </div>
          )}

          {/* Latest Document */}
          {latestDoc && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <File className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[180px]">
                    {latestDoc.originalFileName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    v{latestDoc.version}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(latestDoc.fileUrl, latestDoc.originalFileName)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(latestDoc.fileSize)} • {new Date(latestDoc.uploadedAt).toLocaleDateString('pt-BR')}
              </div>

              {/* History Button */}
              {hasHistory && (
                <Collapsible open={isHistoryExpanded} onOpenChange={() => toggleHistory(docType)}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-2">
                      <History className="h-4 w-4" />
                      {isHistoryExpanded ? 'Ocultar histórico' : 'Ver histórico'}
                      {isHistoryExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-2">
                    {documents.slice(1).map((doc) => (
                      <div 
                        key={doc.id} 
                        className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <File className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{doc.originalFileName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            v{doc.version}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleDownload(doc.fileUrl, doc.originalFileName)}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          )}

          {/* No documents message */}
          {!latestDoc && !isUploading && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              Nenhum documento enviado ainda
            </div>
          )}
        </CardContent>
      </Card>
    );
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
            Faça upload dos documentos iniciais. Eles serão salvos no projeto e poderão ser baixados a qualquer momento.
            Depois clique em &quot;Extrair Entidades&quot; para que as variáveis sejam identificadas.
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

        {/* File Uploaders with Document Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {renderDocumentCard('planOfWork', DOCUMENT_TYPES.planOfWork)}
          {renderDocumentCard('termOfExecution', DOCUMENT_TYPES.termOfExecution)}
          {renderDocumentCard('budgetSpreadsheet', DOCUMENT_TYPES.budgetSpreadsheet)}
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
