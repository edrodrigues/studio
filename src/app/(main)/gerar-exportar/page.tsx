
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, deleteDoc } from "firebase/firestore";
import { FilePlus2, MoreHorizontal, Trash2, Pencil, Eye, GitCompareArrows } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { type Contract } from "@/lib/types";
import { useCollection, useFirebase, useUser, useMemoFirebase } from "@/firebase";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ContractPreviewModal } from "@/components/app/contract-preview-modal";
import { ComparisonModal } from "@/components/app/comparison-modal";
import { saveAs } from "file-saver";
import { exportToDocx } from "@/lib/export";

function ContractsTable({ 
    contracts, 
    isLoading, 
    onEdit, 
    onDelete, 
    onPreview,
    selectedContracts,
    onSelectionChange
}: { 
    contracts: (Contract & {id: string})[] | null, 
    isLoading: boolean,
    onEdit: (id: string) => void,
    onDelete: (id: string) => void,
    onPreview: (contract: Contract) => void,
    selectedContracts: string[],
    onSelectionChange: (id: string) => void,
}) {
    if (isLoading) {
        return (
            <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
        )
    }

    if (!contracts || contracts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-8 border border-dashed rounded-lg">
                <FilePlus2 className="h-8 w-8 mb-4" />
                <p className="font-semibold">Nenhum contrato gerado ainda</p>
                <p className="text-sm">Vá para a aba "Gerar Contratos" para começar.</p>
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[40px]">
                       <Checkbox
                            checked={selectedContracts.length === contracts.length && contracts.length > 0}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    const allIds = contracts.map(c => c.id);
                                    allIds.forEach(id => {
                                        if (!selectedContracts.includes(id)) onSelectionChange(id);
                                    });
                                } else {
                                    selectedContracts.forEach(id => onSelectionChange(id));
                                }
                            }}
                        />
                    </TableHead>
                    <TableHead>Nome do Contrato</TableHead>
                    <TableHead>Data de Criação</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {contracts.map((contract) => (
                    <TableRow key={contract.id} data-state={selectedContracts.includes(contract.id) ? 'selected' : ''}>
                        <TableCell>
                            <Checkbox 
                                checked={selectedContracts.includes(contract.id)}
                                onCheckedChange={() => onSelectionChange(contract.id)}
                            />
                        </TableCell>
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
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);


  const filledContractsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'filledContracts');
  }, [user, firestore]);

  const { data: contracts, isLoading } = useCollection<Omit<Contract, 'id'>>(filledContractsQuery);

  const sortedContracts = useMemo(() => {
    if (!contracts) return null;
    return [...contracts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [contracts]);
  
  const comparisonContracts = useMemo(() => {
    if (!sortedContracts) return [];
    return sortedContracts.filter(c => selectedForComparison.includes(c.id));
  }, [sortedContracts, selectedForComparison]);

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
        setSelectedForComparison(prev => prev.filter(cid => cid !== id));
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

  const handleExportSelected = () => {
    if (selectedForComparison.length === 0 || !sortedContracts) {
        toast({
            variant: "destructive",
            title: "Nenhum contrato selecionado",
            description: "Por favor, selecione pelo menos um contrato para exportar."
        });
        return;
    }

    const selectedContractsData = sortedContracts.filter(c => selectedForComparison.includes(c.id));

    selectedContractsData.forEach(contract => {
        if (!contract.markdownContent) {
            console.warn(`Contrato '${contract.name}' (ID: ${contract.id}) ignorado por não ter conteúdo.`);
            return;
        }
        
        const cleanedContent = contract.markdownContent.replace(/<[^>]*>?/gm, '');
        const mdBlob = new Blob([cleanedContent], { type: "text/markdown;charset=utf-8" });
        saveAs(mdBlob, `${contract.name.replace(/\s/g, '_')}.md`);

        exportToDocx(contract.markdownContent, contract.name.replace(/\s/g, '_'));
    });

    toast({
        title: "Exportação iniciada!",
        description: `${selectedContractsData.length} contrato(s) estão sendo baixados.`
    });
  };

  const handleSelectionChange = (id: string) => {
    setSelectedForComparison(prev => 
        prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  return (
    <>
      <div className="container py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tighter md:text-4xl">
              Revisar Contratos
            </h1>
            <p className="mt-2 text-muted-foreground">
              Visualize, edite, exporte ou compare os contratos que você já gerou.
            </p>
          </div>
           <div className="flex items-center gap-2">
                <Button 
                    variant="outline"
                    onClick={() => setIsComparisonOpen(true)}
                    disabled={selectedForComparison.length < 2}
                >
                    <GitCompareArrows className="mr-2 h-5 w-5"/>
                    Analisar Documentos com IA ({selectedForComparison.length})
                </Button>
                <Button size="lg" onClick={handleExportSelected} disabled={selectedForComparison.length === 0}>
                    <FilePlus2 className="mr-2 h-5 w-5"/>
                    Exportar Contratos ({selectedForComparison.length})
                </Button>
           </div>
        </div>
        
        <div className="border rounded-lg">
            <ContractsTable 
                contracts={sortedContracts as (Contract & { id: string; })[] | null}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onPreview={handlePreview}
                selectedContracts={selectedForComparison}
                onSelectionChange={handleSelectionChange}
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
      <ComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        contracts={comparisonContracts as (Contract & { id: string; })[]}
      />
    </>
  );
}

    

    