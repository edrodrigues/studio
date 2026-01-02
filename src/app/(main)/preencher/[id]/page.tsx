
"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { ContractEditor } from "@/components/app/contract-editor";
import { type Contract } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useFirebase, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { updateDocumentNonBlocking } from "@/firebase/non-blocking-updates";

function EditorLoadingSkeleton() {
    return (
        <div className="container h-full max-w-4xl p-4">
            <div className="flex flex-col space-y-4 h-full">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-64 w-full flex-1" />
                <div className="flex justify-between">
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-28" />
                </div>
            </div>
        </div>
    )
}

export default function PreencherContratoPage() {
    const params = useParams();
    const id = params.id as string;
    const { user } = useUser();
    const { firestore } = useFirebase();

    const contractRef = useMemoFirebase(() => {
        if (!user || !firestore || !id) return null;
        return doc(firestore, 'users', user.uid, 'filledContracts', id);
    }, [user, firestore, id]);

    const { data: contract, isLoading } = useDoc<Omit<Contract, 'id'>>(contractRef);



    if (isLoading || !contract) {
        return <EditorLoadingSkeleton />;
    }

    return (
        <div className="flex h-[calc(100vh-12rem)] flex-col bg-muted/40">
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
                <div className="container h-full max-w-4xl">
                    <ContractEditor
                        initialContent={contract.markdownContent}
                        onContentChange={(newContent: string) => {
                            if (!contractRef) return;
                            updateDocumentNonBlocking(contractRef, { markdownContent: newContent });
                        }}
                    />
                </div>
            </main>
        </div>
    );
}
