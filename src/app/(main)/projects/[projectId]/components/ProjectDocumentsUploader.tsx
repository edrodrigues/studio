'use client';

import { useState, useTransition, useEffect } from 'react';
import { FileText, Clock, CircleDollarSign, Loader2, Trash2, Upload, Download, File, MoreVertical, Trash, Eye } from 'lucide-react';
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
import { useProject } from '@/hooks/use-projects';
import { useUser } from '@/firebase/provider';
import { getDownloadUrl } from '@/lib/actions/storage-actions';
import { formatFileSize } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  // State for contract and process types - initialize from project
  const [contractType, setContractType] = useState<string>('');
  const [processType, setProcessType] = useState<string>('');

  // State for file handling
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  // Hooks
  const { user } = useUser();
  const { project, updateProject } = useProject(projectId);
  const { uploadFile, uploadState, resetUpload } = useFileUpload(projectId);
  const { documentsByType, isLoading: isLoadingDocs } = useDocumentsByType(projectId);
  const { updateDocument } = useProjectDocuments(projectId);

  // Load contract types from project on mount
  useEffect(() => {
    if (project) {
      if (project.contractType) {
        setContractType(project.contractType);
      }
      if (project.processType) {
        setProcessType(project.processType);
      }
    }
  }, [project]);

  // Save contract type when changed
  const handleContractTypeChange = async (value: string) => {
    setContractType(value);
    try {
      await updateProject({ contractType: value });
    } catch (error) {
      console.error('Failed to save contract type:', error);
    }
  };

  // Save process type when changed
  const handleProcessTypeChange = async (value: string) => {
    setProcessType(value);
    try {
      await updateProject({ processType: value });
    } catch (error) {
      console.error('Failed to save process type:', error);
    }
  };

  // Other state
  const [isExtracting, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const [feedbackDocumentId, setFeedbackDocumentId] = useState<string | null>(null);
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
        const uploadDate = new Date().toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        toast({
          title: 'Upload concluído!',
          description: `${documentName} - ${file.name} (${uploadDate})`,
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

  const handleDownload = async (doc: ProjectDocument) => {
    if (!user) return;

    try {
      let downloadUrl = doc.fileUrl;

      if (doc.storageProvider === 'r2') {
        const result = await getDownloadUrl(projectId, user.uid, doc.storagePath);
        if (result.success && result.url) {
          downloadUrl = result.url;
        } else {
          throw new Error(result.error || 'Falha ao gerar URL de download');
        }
      }

      if (!downloadUrl) {
        throw new Error('URL de download não disponível');
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        variant: 'destructive',
        title: 'Erro no download',
        description: 'Não foi possível baixar o arquivo.',
      });
    }
  };

  const handleFeedbackClick = (doc: import('@/lib/types').ProjectDocument & { id: string }) => {
    setFeedbackFiles([]);
    // Pass the stored document ID so the modal fetches it from the server
    setFeedbackDocumentId(doc.id);
    setIsFeedbackModalOpen(true);
  };

  const toggleDocumentSelection = (docType: string) => {
    setSelectedDocuments(prev =>
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
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

  // Get document IDs based on selection or fallback to all uploaded documents
  const getSelectedDocumentIds = (): string[] => {
    const docTypesToUse = selectedDocuments.length > 0
      ? selectedDocuments
      : Object.keys(DOCUMENT_TYPES);
    return docTypesToUse
      .map(type => documentsByType?.[type]?.[0]?.id)
      .filter((id): id is string => !!id);
  };

  const handleConsistencyClick = () => {
    setIsConsistencyModalOpen(true);
  };

  const handleSubmit = async () => {
    // Use selected documents or fallback to all uploaded documents
    const docTypesToUse = selectedDocuments.length > 0
      ? selectedDocuments
      : Object.keys(DOCUMENT_TYPES);

    const documentsToExtract = docTypesToUse
      .map(type => documentsByType?.[type]?.[0]) // Get latest version of each type
      .filter(doc => doc !== undefined) as (ProjectDocument & { id: string })[];

    if (documentsToExtract.length < 2) {
      toast({
        variant: 'destructive',
        title: 'Documentos insuficientes',
        description: 'Selecione ao menos 2 documentos para extrair as entidades.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await handleExtractEntitiesAction({
          projectId,
          userId: user?.uid || '',
          documentIds: documentsToExtract.map(doc => doc.id)
        });

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
    const title = config.getTitle(contractType);
    const description = config.getDescription(contractType);

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

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
          {/* Upload + Feedback Buttons */}
          <FileUploader
            handleFileSelect={handleFileSelect(docType)}
            handleFeedback={() => latestDoc && handleFeedbackClick(latestDoc as import('@/lib/types').ProjectDocument & { id: string })}
            name={docType}
            disabled={!contractType || isUploading}
            feedbackDisabled={!latestDoc}
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
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {latestDoc.originalFileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(latestDoc.uploadedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant={selectedDocuments.includes(docType) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDocumentSelection(docType)}
                      disabled={!latestDoc}
                    >
                      {selectedDocuments.includes(docType) ? "Selecionado" : "Selecionar"}
                    </Button>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    v{latestDoc.version}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleDownload(latestDoc)}>
                        <Download className="mr-2 h-4 w-4" />
                        Baixar arquivo
                      </DropdownMenuItem>
                      {hasHistory && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                            Histórico de uploads
                          </div>
                          {documents.slice(1).map((doc) => (
                            <DropdownMenuItem
                              key={doc.id}
                              onClick={() => handleDownload(doc)}
                              className="flex flex-col items-start gap-1 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <File className="h-3 w-3 shrink-0" />
                                <span className="truncate text-xs">{doc.originalFileName}</span>
                                <Badge variant="outline" className="text-[10px] ml-auto">
                                  v{doc.version}
                                </Badge>
                              </div>
                              <span className="text-[10px] text-muted-foreground ml-5">
                                {formatDate(doc.uploadedAt)}
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(latestDoc.fileSize)}
              </div>
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
            Utilize os botões &quot;Carregar Documento&quot; nos cards abaixo para enviar os arquivos iniciais. Eles serão salvos no projeto e poderão ser baixados a qualquer momento.
            Depois clique em &quot;Sincronizar Arquivos&quot; para que o conteúdo seja indexado pela IA.
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
                onValueChange={handleContractTypeChange}
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
                  onValueChange={handleProcessTypeChange}
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
            disabled={selectedDocuments.length < 2 && !hasAtLeastTwoFiles}
            variant="outline"
            size="lg"
          >
            Análise da consistência de documentos com IA
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={(selectedDocuments.length < 2 && !hasAtLeastTwoFiles) || isExtracting}
            size="lg"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extraindo...
              </>
            ) : (
              'Sincronizar Arquivos'
            )}
          </Button>
        </div>
      </div>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={(open) => {
          setIsFeedbackModalOpen(open);
          if (!open) setFeedbackDocumentId(null);
        }}
        projectId={projectId}
        userId={user?.uid || ''}
        documentIds={feedbackDocumentId ? [feedbackDocumentId] : getSelectedDocumentIds()}
        files={feedbackFiles}
      />
      <ConsistencyAnalysisModal
        isOpen={isConsistencyModalOpen}
        onOpenChange={setIsConsistencyModalOpen}
        projectId={projectId}
        userId={user?.uid || ''}
        documentIds={getSelectedDocumentIds()}
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
