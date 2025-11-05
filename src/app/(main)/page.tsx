"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Clock, CircleDollarSign, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileUploader } from "@/components/app/file-uploader";
import { handleGenerateContract } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import useLocalStorage from "@/hooks/use-local-storage";
import { type Contract } from "@/lib/types";

const fileToDataURI = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function ComeceAquiPage() {
  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    planOfWork: null,
    termOfExecution: null,
    budgetSpreadsheet: null,
  });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();
  const [, setContracts] = useLocalStorage<Contract[]>("contracts", []);

  const handleFileSelect = (key: string) => (file: File | null) => {
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const canGenerate = Object.values(files).every((file) => file !== null);

  const handleSubmit = async () => {
    if (!canGenerate) return;

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
          const newContract: Contract = {
            id: `contract-${Date.now()}`,
            name: `Novo Contrato Gerado - ${new Date().toLocaleDateString()}`,
            content: result.data.contractDraft,
            createdAt: new Date().toISOString(),
          };
          
          setContracts((prev) => [...prev, newContract]);
          toast({
            title: "Sucesso!",
            description: "Minuta de contrato gerada. Redirecionando para o editor...",
          });
          router.push(`/preencher/${newContract.id}`);
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
    <div className="container relative">
      <section className="mx-auto flex max-w-3xl flex-col items-center justify-center py-12 text-center md:py-20">
        <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:leading-[1.1]">
          Gere sua Minuta de Contrato com IA
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground sm:text-lg">
          Siga os 3 passos para que nossa inteligência artificial crie uma minuta de contrato de cooperação completa e estruturada para você.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
        <FileUploader
          icon={<FileText size={24} />}
          title="Passo 1: Plano de Trabalho"
          description="Documento com o escopo e atividades."
          onFileSelect={handleFileSelect("planOfWork")}
          name="planOfWork"
        />
        <FileUploader
          icon={<Clock size={24} />}
          title="Passo 2: Termo de Execução"
          description="Cronograma e prazos do projeto."
          onFileSelect={handleFileSelect("termOfExecution")}
          name="termOfExecution"
        />
        <FileUploader
          icon={<CircleDollarSign size={24} />}
          title="Passo 3: Planilha de Orçamento"
          description="Valores e distribuição de recursos."
          onFileSelect={handleFileSelect("budgetSpreadsheet")}
          name="budgetSpreadsheet"
        />
      </section>

      <section className="mt-12 flex justify-center py-8">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canGenerate || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Gerando...
            </>
          ) : (
            "Gerar Contrato"
          )}
        </Button>
      </section>
    </div>
  );
}
