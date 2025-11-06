
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { FilePlus2, MoreHorizontal, Trash2, Pencil, Eye } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { type Contract } from "@/lib/types";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContractPreviewModal } from "@/components/app/contract-preview-modal";

function ContractsTable({ 
    contracts, 
    isLoading, 
    onEdit, 
    onDelete, 
    onPreview 
}: { 
    contracts: (Contract & {id: string})[] | null, 
    isLoading: boolean,
    onEdit: (id: string) => void,
    onDelete: (id: string) => void,
    onPreview: (contract: Contract) => void
}) {

    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
        )
    }

    if (!contracts || contracts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                <FilePlus2 className="h-8 w-8 mb-4" />
                <p className="font-semibold">Nenhum contrato gerado ainda</p>
                <p className="text-sm">Vá para a aba "Gerar Novo Contrato" para começar.</p>
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Nome do Contrato</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                        <TableCell className="font-medium">{contract.name}</TableCell>
                        <TableCell>
                            {contract.createdAt ? format(new Date(contract.createdAt), "dd 'de' MMMM 'de' yyyy, 'às' HH:mm", { locale: ptBR }) : 'Data indisponível'}
                        </TableCell>
                        <TableCell>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => onPreview(contract)}>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Visualizar e Exportar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onEdit(contract.id)}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => onDelete(contract.id)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Deletar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export default function GerarExportarPage() {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore]);

  const { data: contracts, isLoading } = useCollection<Omit<Contract, 'id'>>(filledContractsQuery);

  const handleEdit = (id: string) => {
    router.push(`/preencher/${id}`);
  };

  const handleDelete = async (id: string) => {
    if (!user || !firestore) return;

    if (window.confirm("Tem certeza de que deseja excluir este contrato?")) {
      const contractRef = doc(firestore, 'users', user.uid, 'filledContracts', id);
      try {
        await deleteDoc(contractRef);
        toast({
          title: "Contrato excluído",
          description: "O contrato foi removido com sucesso.",
        });
      } catch (error) {
        console.error("Erro ao excluir o contrato:", error);
        toast({
          variant: "destructive",
          title: "Erro ao excluir",
          description: "Não foi possível remover o contrato. Tente novamente.",
        });
      }
    }
  };
  
  const handlePreview = (contract: Contract) => {
    setSelectedContract(contract);
    setIsPreviewOpen(true);
  }

  const handleGoToGenerator = () => {
    router.push('/gerar-novo');
  }

  return (
    <>
      <div className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
              Contratos Gerados
            </h1>
            <p className="mt-2 text-muted-foreground">
              Visualize, edite ou exporte os contratos que você já preencheu.
            </p>
          </div>
          <Button size="lg" onClick={handleGoToGenerator}>
            <FilePlus2 className="mr-2 h-5 w-5"/>
            Gerar Novo Contrato
          </Button>
        </div>
        
        <div className="border rounded-lg">
            <ContractsTable 
                contracts={contracts}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPreview={handlePreview}
            />
        </div>
      </div>
      {selectedContract && (
        <ContractPreviewModal
            contract={selectedContract}
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </>
  );
}
