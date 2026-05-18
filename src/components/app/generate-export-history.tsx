"use client";

import { useState } from "react";
import { useCollection, useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, where, deleteDoc, doc, getDoc, updateDoc, increment } from "firebase/firestore";
import { format } from "date-fns";
import { ExternalLink, Eye, MoreHorizontal, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn, isValidDate, safeNewDate } from "@/lib/utils";
import type { Contract } from "@/lib/types";

type ContractRecord = Contract & { id: string };

interface GenerateExportHistoryProps {
  projectId: string | null;
  onPreview?: (contract: ContractRecord) => void;
}

export function GenerateExportHistory({ projectId, onPreview }: GenerateExportHistoryProps) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const contractsQuery = useMemoFirebase(() => {
    if (!user || !firestore || !projectId) return null;
    return query(
      collection(firestore, "users", user.uid, "filledContracts"),
      where("projectId", "==", projectId)
    );
  }, [firestore, user, projectId]);

  const { data: contracts, isLoading } = useCollection<Contract>(contractsQuery);

  const sortedContracts = (contracts || [])
    .map((c) => ({ ...c, id: (c as any).id }))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const handleDelete = async (contract: ContractRecord) => {
    if (!user || !firestore || !window.confirm("Deseja excluir este contrato?")) return;
    setDeletingId(contract.id);
    try {
      const contractRef = doc(firestore, "users", user.uid, "filledContracts", contract.id);
      const contractDoc = await getDoc(contractRef);
      const contractData = contractDoc.exists() ? contractDoc.data() as Contract : null;
      await deleteDoc(contractRef);
      if (contractData?.projectContractId) {
        await deleteDoc(doc(firestore, "projectContracts", contractData.projectContractId));
      }
      if (contractData?.projectId) {
        await updateDoc(doc(firestore, "projects", contractData.projectId), {
          contractCount: increment(-1),
          updatedAt: new Date().toISOString(),
        });
      }
      toast({ title: "Documento excluído." });
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir." });
    } finally {
      setDeletingId(null);
    }
  };

  if (!projectId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documentos Gerados</CardTitle>
          <CardDescription>Selecione um projeto para ver o histórico.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos Gerados</CardTitle>
        <CardDescription>Histórico de documentos gerados para este projeto.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedContracts.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum documento gerado ainda para este projeto.
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {sortedContracts.map((contract) => (
                <Card key={contract.id} className="border border-border/70 shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-medium">{contract.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {contract.generationMethod === "google-docs" && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                      )}
                      {contract.generationMethod === "ai-enriched" && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {contract.googleDocLink && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={contract.googleDocLink} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-2 h-4 w-4" /> Google Docs
                          </a>
                        </Button>
                      )}
                      {onPreview && (
                        <Button variant="outline" size="sm" onClick={() => onPreview(contract)}>
                          <Eye className="mr-2 h-4 w-4" /> Visualizar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(contract)}
                        disabled={deletingId === contract.id}
                      >
                        {deletingId === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Excluir
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Entidades</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">
                        {contract.name}
                        {contract.googleDocLink && (
                          <a href={contract.googleDocLink} target="_blank" rel="noreferrer" className="block text-[10px] text-blue-500 hover:underline flex items-center gap-1 mt-1">
                            <ExternalLink className="h-2 w-2" /> Google Docs
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-wrap gap-1">
                          {contract.generationMethod === "google-docs" && (
                            <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-700 border-blue-200">Google Docs</Badge>
                          )}
                          {contract.generationMethod === "ai-enriched" && (
                            <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">AI Enriquecido</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {contract.entityCount !== undefined ? (
                          <span className={cn(contract.entityCount > 0 ? "text-green-600 font-medium" : "text-muted-foreground")}>
                            {contract.entityCount > 0 ? `${contract.entityCount} preench.` : "Sem dados"}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isValidDate(contract.createdAt) ? format(safeNewDate(contract.createdAt)!, "dd/MM/yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {contract.googleDocLink && (
                              <DropdownMenuItem asChild>
                                <a href={contract.googleDocLink} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-2 h-4 w-4" /> Abrir no Google Docs
                                </a>
                              </DropdownMenuItem>
                            )}
                            {onPreview && (
                              <DropdownMenuItem onClick={() => onPreview(contract)}>
                                <Eye className="mr-2 h-4 w-4" /> Visualizar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(contract)}
                              disabled={deletingId === contract.id}
                            >
                              {deletingId === contract.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
