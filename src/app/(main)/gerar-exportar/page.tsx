"use client";

import { useState } from "react";
import { File, Eye } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import useLocalStorage from "@/hooks/use-local-storage";
import { type Contract } from "@/lib/types";
import { ContractPreviewModal } from "@/components/app/contract-preview-modal";

export default function GerarExportarPage() {
  const [contracts] = useLocalStorage<Contract[]>("contracts", []);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const handleOpenModal = (contract: Contract) => {
    setSelectedContract(contract);
  };

  const handleCloseModal = () => {
    setSelectedContract(null);
  };

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

      {contracts.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {contracts.map((contract) => (
            <Card key={contract.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <File className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardTitle className="pt-4">{contract.name}</CardTitle>
                <CardDescription>
                  Criado em: {new Date(contract.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {contract.content.substring(0, 100)}...
                </p>
              </CardContent>
              <CardFooter>
                <Button className="w-full" onClick={() => handleOpenModal(contract)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Visualizar e Exportar
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-lg text-muted-foreground">Nenhum contrato salvo encontrado.</p>
          <p className="text-sm text-muted-foreground">Gere um novo contrato na aba "Comece Aqui".</p>
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
