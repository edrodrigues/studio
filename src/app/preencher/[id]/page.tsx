"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ContractAssistant } from "@/components/app/contract-assistant";
import { ContractEditor } from "@/components/app/contract-editor";
import useLocalStorage from "@/hooks/use-local-storage";
import { type Contract } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function EditorLoadingSkeleton() {
    return (
        <div className="container grid h-full max-w-7xl grid-cols-1 gap-8 p-4 md:grid-cols-2">
            <div className="flex flex-col space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-64 w-full flex-1" />
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>
            <div className="flex flex-col space-y-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-full flex-1" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    )
}

export default function PreencherContratoPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [contracts, setContracts] = useLocalStorage<Contract[]>("contracts", []);
  const [contract, setContract] = useState<Contract | undefined>(undefined);
  const [clauseContent, setClauseContent] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const foundContract = contracts.find((c) => c.id === id);
    if (foundContract) {
      setContract(foundContract);
    } else if(isClient) {
      // router.replace('/gerar-exportar'); // avoid redirecting on initial server render
    }
  }, [id, contracts, router, isClient]);

  const handleContentChange = useCallback((newContent: string) => {
    if (contract) {
      const updatedContract = { ...contract, content: newContent };
      setContract(updatedContract);
      setContracts((prevContracts) =>
        prevContracts.map((c) => (c.id === id ? updatedContract : c))
      );
    }
  }, [contract, id, setContracts]);

  if (!isClient || !contract) {
    return (
        <div className="flex flex-col h-screen">
            <header className="p-4 border-b">
                 <Button variant="outline" asChild>
                    <Link href="/gerar-exportar"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
                </Button>
            </header>
            <div className="flex-1">
                <EditorLoadingSkeleton />
            </div>
        </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-muted/40">
        <header className="flex-shrink-0 bg-background p-4 border-b">
            <div className="container flex items-center justify-between max-w-7xl">
                <Button variant="outline" asChild>
                    <Link href="/gerar-exportar"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para lista</Link>
                </Button>
                <h1 className="text-lg font-semibold truncate px-4">
                    Preenchendo: <span className="text-muted-foreground">{contract.name}</span>
                </h1>
                <div></div>
            </div>
        </header>
        <main className="flex-1 overflow-hidden p-4">
            <div className="container grid h-full max-w-7xl grid-cols-1 gap-8 md:grid-cols-2">
                <ContractEditor
                    initialContent={contract.content}
                    onContentChange={handleContentChange}
                    onClauseChange={setClauseContent}
                />
                <ContractAssistant
                    contractContent={contract.content}
                    clauseContent={clauseContent}
                />
            </div>
        </main>
    </div>
  );
}
