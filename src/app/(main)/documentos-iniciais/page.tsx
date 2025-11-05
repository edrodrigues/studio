
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Clock, CircleDollarSign, Loader2 } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/app/file-uploader";
import { handleGenerateContract } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { type Contract } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FeedbackModal } from "@/components/app/feedback-modal";
import { type UploadedFile } from "@/lib/types";
import { useFirebase, useUser } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";

export const fileToDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function DocumentosIniciaisPage() {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [contractType, setContractType] = useState<string>('');
  const [processType, setProcessType] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<UploadedFile[]>([]);
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const { user } = useUser();


  const handleFileSelect = (key: string) => (file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };
  
  const handleFeedbackClick = (file: File | null) => {
    if (file) {
      setFeedbackFiles([{ id: file.name, file }]);
      setIsFeedbackModalOpen(true);
    }
  };


  const canGenerate = Object.values(files).every((file) => file !== null) && contractType && processType;


  const handleSubmit = async () => {
    if (!canGenerate || !user || !firestore) return;

    startTransition(async () => {
      try {
        const formData = new FormData();
        const planOfWorkURI = await fileToDataURI(files.planOfWork!);
        const termOfExecutionURI = await fileToDataURI(files.termOfExecution!);
        const budgetSpreadsheetURI = await fileToDataURI(files.budgetSpreadsheet!);

        formData.append("planOfWork", planOfWorkURI);
        formData.append("termOfExecution", termOfExecutionURI);
        formData.append("budgetSpreadsheet", budgetSpreadsheetURI);

        const result = await handleGenerateContract(formData);

        if (result.success && result.data?.contractDraft) {
          
          const newContract: Omit<Contract, 'id'> = {
            name: `Novo Contrato Gerado - ${new Date().toLocaleDateString()}`,
            content: result.data.contractDraft,
            createdAt: new Date().toISOString(),
          };

          const contractsCollection = collection(firestore, 'users', user.uid, 'filledContracts');
          const docRef = await addDocumentNonBlocking(contractsCollection, newContract);

          toast({
            title: "Sucesso!",
            description: "Minuta de contrato gerada. Redirecionando para o editor...",
          });
          router.push(`/preencher/${docRef.id}`);
        } else {
          throw new Error(result.error || "Falha ao obter o rascunho do contrato.");
        }
      } catch (error) {
        console.error(error);
        toast({
          variant: "destructive",
          title: "Erro na Geração",
          description: error instanceof Error ? error.message : "Ocorreu um erro desconhecido.",
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
            Analise os documentos iniciais com a IA e depois clique em "Indexar Documentos" para que eles sejam usados de contexto para os demais documentos.
          </p>
        </section>

        <section className="mx-auto max-w-5xl mb-8">
          <Card>
              <CardHeader>
                  <CardTitle>Definições Iniciais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                      <Label>Tipo de Contrato</Label>
                      <RadioGroup value={contractType} onValueChange={setContractType} className="flex space-x-4">
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="TED" id="ted" />
                              <Label htmlFor="ted">TED</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                              <RadioGroupItem value="ACT" id="act" />
                              <Label htmlFor="act">ACT</Label>
                          </div>
                           <div className="flex items-center space-x-2">
                              <RadioGroupItem value="outro" id="outro-contrato" />
                              <Label htmlFor="outro-contrato">Outro</Label>
                          </div>
                      </RadioGroup>
                  </div>
                   <div className="space-y-3">
                      <Label>Tipo de Processo</Label>
                      <RadioGroup value={processType} onValueChange={setProcessType} className="flex space-x-4">
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
              </CardContent>
          </Card>
        </section>

        <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
          <FileUploader
            icon={<FileText size={24} />}
            title="Plano de Trabalho"
            description="Documento com o escopo e atividades."
            onFileSelect={handleFileSelect("planOfWork")}
            onFeedbackClick={() => handleFeedbackClick(files.planOfWork)}
            name="planOfWork"
          />
          <FileUploader
            icon={<Clock size={24} />}
            title="Termo de Execução"
            description="Cronograma e prazos do projeto."
            onFileSelect={handleFileSelect("termOfExecution")}
            onFeedbackClick={() => handleFeedbackClick(files.termOfExecution)}
            name="termOfExecution"
          />
          <FileUploader
            icon={<CircleDollarSign size={24} />}
            title="Planilha de Orçamento"
            description="Valores e distribuição de recursos."
            onFileSelect={handleFileSelect("budgetSpreadsheet")}
            onFeedbackClick={() => handleFeedbackClick(files.budgetSpreadsheet)}
            name="budgetSpreadsheet"
          />
        </section>

        <section className="mt-12 flex justify-center gap-4 py-8">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!canGenerate || isPending || !user}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Indexando...
              </>
            ) : (
              "Indexar Documentos"
            )}
          </Button>
        </section>
      </div>
      <FeedbackModal
        isOpen={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
        files={feedbackFiles}
      />
    </>
  );
}
