"use client";

import { useState, useMemo } from "react";
import { File, Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Contract } from "@/lib/types";
import { ContractPreviewModal } from "@/components/app/contract-preview-modal";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";


function ContractCard({ contract, onOpenModal }: { contract: Contract, onOpenModal: (contract: Contract) => void }) {
  const createdAtDate = useMemo(() => new Date(contract.createdAt).toLocaleDateString(), [contract.createdAt]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <File className="h-8 w-8 text-muted-foreground" />
        </div>
        <CardTitle className="pt-4">{contract.name}</CardTitle>
        <CardDescription>
          Criado em: {createdAtDate}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-3">
          {contract.content.substring(0, 100)}...
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={() => onOpenModal(contract)}>
          <Eye className="mr-2 h-4 w-4" />
          Visualizar e Exportar
        </Button>
      </CardFooter>
    </Card>
  );
}

function LoadingSkeleton() {
    return (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
                 <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-6 w-3/4 mt-4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full mt-2" />
                        <Skeleton className="h-4 w-2/3 mt-2" />
                    </CardContent>
                    <CardFooter>
                        <Skeleton className="h-10 w-full" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}


export default function GerarExportarPage() {
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const contractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore]);

  const { data: contracts, isLoading } = useCollection<Omit<Contract, 'id'>>(contractsQuery);
  
  const handleOpenModal = (contract: Contract) => {
    setSelectedContract(contract);
  };

  const handleCloseModal = () => {
    setSelectedContract(null);
  };

  const isLoadingData = isUserLoading || isLoading;

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-5xl lg:leading-[1.1]">
          Contratos Gerados
        </h1>
        <p className="mt-4 max-w-xl mx-auto text-muted-foreground sm:text-lg">
          Visualize, continue a preencher ou exporte os contratos que você salvou.
        </p>
      </div>

      {isLoadingData ? (
        <LoadingSkeleton />
      ) : contracts && contracts.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <ContractCard key={contract.id} contract={contract} onOpenModal={handleOpenModal} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground">Nenhum contrato salvo encontrado.</p>
          <p className="text-sm text-muted-foreground">Gere um novo contrato na aba "Documentos Iniciais".</p>
        </div>
      )}

      <ContractPreviewModal
        isOpen={!!selectedContract}
        contract={selectedContract}
        onClose={handleCloseModal}
      />
    </div>
  );
}
