'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { CircleDollarSign, Clock, Download, File, FileText, Loader2, Minus, MoreVertical, Plus, Trash2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase/provider';
import { useProject } from '@/hooks/use-projects';
import { useFileUpload, useDocumentsByType } from '@/hooks/use-file-upload';
import { useToast } from '@/hooks/use-toast';
import { handleSyncToFileSearch } from '@/lib/actions';
import { getDownloadUrl } from '@/lib/actions/storage-actions';
import { FileUploader } from '@/components/app/file-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatFileSize } from '@/lib/storage';
import { DocumentStatus, ProjectDocument, UploadedFile } from '@/lib/types';

const FeedbackModal = dynamic(() => import('@/components/app/feedback-modal').then((mod) => mod.FeedbackModal), { ssr: false });
const ConsistencyAnalysisModal = dynamic(() => import('@/components/app/consistency-analysis-modal').then((mod) => mod.ConsistencyAnalysisModal), { ssr: false });

interface ProjectDocumentsUploaderProps {
  projectId: string;
}

type DocumentCardConfig = {
  key: string;
  icon: React.ReactNode;
  getTitle: (contractType: string) => string;
  getDescription: (contractType: string) => string;
};

const MAX_EXTRA_DOCUMENTS = 6;
const BASE_DOCUMENT_TYPES: DocumentCardConfig[] = [
  {
    key: 'planOfWork',
    icon: <FileText size={24} />,
    getTitle: (contractType) => {
      switch (contractType) {
        case 'ted': return 'Plano de Trabalho';
        case 'acordo-parceria-inovacao':
        case 'acordo-parceria-embrapii': return 'Plano de Trabalho da Parceria';
        case 'contrato-extensao': return 'Plano de Trabalho de Extensão';
        default: return 'Plano de Trabalho';
      }
    },
    getDescription: () => 'Documento com o escopo e atividades.',
  },
  {
    key: 'termOfExecution',
    icon: <Clock size={24} />,
    getTitle: (contractType) => {
      switch (contractType) {
        case 'ted': return 'Termo de Execução Decentralizada (TED)';
        case 'acordo-parceria-inovacao':
        case 'acordo-parceria-embrapii': return 'Acordo de Parceria';
        case 'contrato-extensao': return 'Contrato de Extensão Tecnológica';
        default: return 'Termo de Execução Decentralizada (TED)';
      }
    },
    getDescription: (contractType) => contractType === 'contrato-extensao'
      ? 'Termo de Prestação de Serviços Técnicos.'
      : 'Cronograma e prazos do projeto.',
  },
  {
    key: 'budgetSpreadsheet',
    icon: <CircleDollarSign size={24} />,
    getTitle: (contractType) => contractType === 'contrato-extensao' ? 'Proposta de Honorários' : 'Planilha Orçamentária',
    getDescription: () => 'Valores e distribuição de recursos.',
  },
];

const getExtraDocumentType = (index: number) => `extraDocument${index}`;
const getExtraDocumentConfig = (index: number): DocumentCardConfig => ({
  key: getExtraDocumentType(index),
  icon: <Plus size={24} />,
  getTitle: () => `Documento Extra ${index}`,
  getDescription: () => 'Documento adicional para análise e comparação.',
});
const getEffectiveExtraDocumentCount = (project?: { extraDocumentCount?: number; extraDocumentEnabled?: boolean } | null) => {
  if (typeof project?.extraDocumentCount === 'number') {
    return Math.min(MAX_EXTRA_DOCUMENTS, Math.max(0, project.extraDocumentCount));
  }
  return project?.extraDocumentEnabled ? 1 : 0;
};

export function ProjectDocumentsUploader({ projectId }: ProjectDocumentsUploaderProps) {
  const router = useRouter();
  const { user } = useUser();
  const { project, updateProject } = useProject(projectId);
  const { uploadFile, uploadState, resetUpload } = useFileUpload(projectId);
  const { documentsByType } = useDocumentsByType(projectId);
  const { toast } = useToast();

  const [contractType, setContractType] = useState('');
  const [processType, setProcessType] = useState('');
  const [extraDocumentCount, setExtraDocumentCount] = useState(0);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [isSyncing, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const [feedbackDocumentId, setFeedbackDocumentId] = useState<string | null>(null);
  const [isConsistencyModalOpen, setIsConsistencyModalOpen] = useState(false);

  useEffect(() => {
    if (!project) return;
    if (project.contractType) setContractType(project.contractType);
    if (project.processType) setProcessType(project.processType);
    setExtraDocumentCount(getEffectiveExtraDocumentCount(project));
  }, [project]);

  const visibleExtraConfigs = useMemo(
    () => Array.from({ length: extraDocumentCount }, (_, index) => getExtraDocumentConfig(index + 1)),
    [extraDocumentCount]
  );
  const visibleDocumentConfigs = useMemo(() => [...BASE_DOCUMENT_TYPES, ...visibleExtraConfigs], [visibleExtraConfigs]);
  const visibleDocumentTypes = useMemo(() => visibleDocumentConfigs.map((config) => config.key), [visibleDocumentConfigs]);

  useEffect(() => {
    setSelectedDocuments((prev) => prev.filter((docType) => visibleDocumentTypes.includes(docType)));
  }, [visibleDocumentTypes]);

  const persistExtraDocumentCount = async (nextCount: number) => {
    setExtraDocumentCount(nextCount);
    try {
      await updateProject({
        extraDocumentCount: nextCount,
        extraDocumentEnabled: nextCount > 0,
      });
    } catch (error) {
      console.error('Failed to save extra document count:', error);
    }
  };

  const handleContractTypeChange = async (value: string) => {
    setContractType(value);
    try {
      await updateProject({ contractType: value });
    } catch (error) {
      console.error('Failed to save contract type:', error);
    }
  };

  const handleProcessTypeChange = async (value: string) => {
    setProcessType(value);
    try {
      await updateProject({ processType: value });
    } catch (error) {
      console.error('Failed to save process type:', error);
    }
  };

  const handleFileSelect = (documentType: string, documentName: string) => async (file: File | null) => {
    if (!file || !contractType) return;
    setFiles((prev) => ({ ...prev, [documentType]: file }));
    setUploadingType(documentType);

    try {
      const documentId = await uploadFile(file, projectId, documentType, documentName);
      if (documentId) {
        toast({
          title: 'Upload concluído!',
          description: `${documentName} - ${file.name} (${new Date().toLocaleString('pt-BR')})`,
        });
        setFiles((prev) => ({ ...prev, [documentType]: null }));
      } else if (uploadState.error) {
        toast({ variant: 'destructive', title: 'Erro no upload', description: uploadState.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Erro no upload', description: 'Não foi possível fazer o upload do arquivo.' });
    } finally {
      setUploadingType(null);
      resetUpload();
    }
  };

  const handleDownload = async (projectDocument: ProjectDocument) => {
    if (!user) return;
    try {
      let downloadUrl = projectDocument.fileUrl;
      if (projectDocument.storageProvider === 'r2') {
        const result = await getDownloadUrl(projectId, user.uid, projectDocument.storagePath);
        if (!result.success || !result.url) throw new Error(result.error || 'Falha ao gerar URL de download');
        downloadUrl = result.url;
      }
      if (!downloadUrl) throw new Error('URL de download não disponível');
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = projectDocument.originalFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast({ variant: 'destructive', title: 'Erro no download', description: 'Não foi possível baixar o arquivo.' });
    }
  };

  const getSelectedDocumentIds = () => {
    const docTypesToUse = selectedDocuments.length > 0 ? selectedDocuments : visibleDocumentTypes;
    return docTypesToUse.map((type) => documentsByType?.[type]?.[0]?.id).filter((id): id is string => Boolean(id));
  };

  const handleSubmit = async () => {
    const documentsToSync = (selectedDocuments.length > 0 ? selectedDocuments : visibleDocumentTypes)
      .map((type) => documentsByType?.[type]?.[0])
      .filter((doc): doc is ProjectDocument & { id: string } => Boolean(doc));

    if (documentsToSync.length < 1) {
      toast({ variant: 'destructive', title: 'Documentos insuficientes', description: 'Selecione ao menos 1 documento para sincronizar.' });
      return;
    }

    startTransition(async () => {
      try {
        toast({ title: 'Iniciando sincronização...', description: 'Seus documentos estão sendo preparados para o File Search.' });
        const result = await handleSyncToFileSearch({ projectId, userId: user?.uid || '', documentIds: documentsToSync.map((doc) => doc.id) });
        if (!result.success) throw new Error(result.error || 'Falha na sincronização.');
        toast({ title: 'Sincronização Concluída!', description: 'Os documentos agora estão disponíveis como contexto para o ALEX.' });
        router.push(`/gerar-exportar?projectId=${projectId}`);
      } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Erro na Sincronização', description: error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.' });
      }
    });
  };

  const renderDocumentCard = (config: DocumentCardConfig) => {
    const documents = documentsByType?.[config.key] || [];
    const latestDoc = documents[0];
    const isUploading = uploadingType === config.key;
    const title = config.getTitle(contractType);

    return (
      <Card key={config.key} className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">{config.icon}</div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{config.getDescription(contractType)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-4">
          <FileUploader
            handleFileSelect={handleFileSelect(config.key, title)}
            handleFeedback={() => {
              if (!latestDoc) return;
              setFeedbackFiles([]);
              setFeedbackDocumentId(latestDoc.id);
              setIsFeedbackModalOpen(true);
            }}
            name={config.key}
            disabled={!contractType || isUploading}
            feedbackDisabled={!latestDoc}
          />
          {isUploading && <div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Enviando...</span><span className="font-medium">{Math.round(uploadState.progress)}%</span></div><Progress value={uploadState.progress} className="h-2" /></div>}
          {latestDoc ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <File className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{latestDoc.originalFileName}</span>
                    <span className="text-xs text-muted-foreground">{new Date(latestDoc.uploadedAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={selectedDocuments.includes(config.key) ? 'default' : 'outline'} size="sm" onClick={() => setSelectedDocuments((prev) => prev.includes(config.key) ? prev.filter((item) => item !== config.key) : [...prev, config.key])} disabled={!latestDoc}>
                    {selectedDocuments.includes(config.key) ? 'Selecionado' : 'Selecionar'}
                  </Button>
                  <Badge variant="outline" className="text-xs">v{latestDoc.version}</Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleDownload(latestDoc)}><Download className="mr-2 h-4 w-4" />Baixar arquivo</DropdownMenuItem>
                      {documents.length > 1 && <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Histórico de uploads</div>
                        {documents.slice(1).map((doc) => (
                          <DropdownMenuItem key={doc.id} onClick={() => handleDownload(doc)} className="flex flex-col items-start gap-1 py-2">
                            <div className="flex items-center gap-2">
                              <File className="h-3 w-3 shrink-0" />
                              <span className="truncate text-xs">{doc.originalFileName}</span>
                              <Badge variant="outline" className="text-[10px] ml-auto">v{doc.version}</Badge>
                            </div>
                            <span className="text-[10px] text-muted-foreground ml-5">{new Date(doc.uploadedAt).toLocaleString('pt-BR')}</span>
                          </DropdownMenuItem>
                        ))}
                      </>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatFileSize(latestDoc.fileSize)}</span>
                {latestDoc.status === DocumentStatus.INDEXED && <Badge variant="outline" className="text-[10px]">Indexado</Badge>}
              </div>
            </div>
          ) : !isUploading ? <div className="text-center py-4 text-sm text-muted-foreground">Nenhum documento enviado ainda</div> : null}
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Analise os documentos iniciais</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">Utilize os botões "Carregar Documento" nos cards abaixo para enviar os arquivos iniciais. Eles serão salvos no projeto e poderão ser baixados a qualquer momento. Depois clique em "Sincronizar Arquivos" para que o conteúdo seja indexado pela IA.</p>
          <Button variant="outline" size="sm" onClick={() => { setFiles({}); setContractType(''); setProcessType(''); setExtraDocumentCount(0); setSelectedDocuments([]); toast({ title: 'Dados limpos', description: 'Os estados locais da tela foram limpos.' }); }} className="gap-2"><Trash2 className="h-4 w-4" />Limpar Dados Antigos</Button>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Definições Iniciais</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-medium">Tipo de Contrato</Label>
              <RadioGroup value={contractType} onValueChange={handleContractTypeChange} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="ted" id="ted" /><Label htmlFor="ted">TED</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="acordo-parceria-inovacao" id="acordo-parceria-inovacao" /><Label htmlFor="acordo-parceria-inovacao">Acordo de Parceria (Lei de Inovação)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="acordo-parceria-embrapii" id="acordo-parceria-embrapii" /><Label htmlFor="acordo-parceria-embrapii">Acordo de Parceria (Embrapii)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="contrato-extensao" id="contrato-extensao" /><Label htmlFor="contrato-extensao">Contrato de Extensão Tecnológica (Prestação de Serviços Técnicos)</Label></div>
              </RadioGroup>
            </div>

            {contractType === 'ted' && <div className="space-y-3 pt-4 border-t">
              <Label className="text-base font-medium">Tipo de Processo</Label>
              <RadioGroup value={processType} onValueChange={handleProcessTypeChange} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="ufpe-parceiro" id="ufpe-parceiro" /><Label htmlFor="ufpe-parceiro">UFPE - Parceiro</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="fade-ufpe" id="fade-ufpe" /><Label htmlFor="fade-ufpe">Fade - UFPE</Label></div>
              </RadioGroup>
            </div>}

            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label className="text-base font-medium">Documentos Extras</Label>
                <p className="text-sm text-muted-foreground">Defina quantos documentos extras deseja usar neste projeto.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => persistExtraDocumentCount(Math.max(0, extraDocumentCount - 1))} disabled={extraDocumentCount === 0}><Minus className="h-4 w-4" /></Button>
                <div className="min-w-12 text-center"><div className="text-lg font-semibold">{extraDocumentCount}</div><div className="text-xs text-muted-foreground">de {MAX_EXTRA_DOCUMENTS}</div></div>
                <Button variant="outline" size="icon" onClick={() => persistExtraDocumentCount(Math.min(MAX_EXTRA_DOCUMENTS, extraDocumentCount + 1))} disabled={extraDocumentCount === MAX_EXTRA_DOCUMENTS}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visibleDocumentConfigs.map(renderDocumentCard)}
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Button onClick={() => setIsConsistencyModalOpen(true)} disabled={getSelectedDocumentIds().length < 2} variant="outline" size="lg">Análise da consistência de documentos com IA</Button>
          <Button onClick={handleSubmit} disabled={getSelectedDocumentIds().length < 1 || isSyncing} size="lg">
            {isSyncing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sincronizando...</> : 'Sincronizar Arquivos'}
          </Button>
        </div>
      </div>

      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onOpenChange={(open) => { setIsFeedbackModalOpen(open); if (!open) setFeedbackDocumentId(null); }}
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
        files={[]}
      />
    </>
  );
}
