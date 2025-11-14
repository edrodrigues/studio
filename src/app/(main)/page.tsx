
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, DraftingCompass, UploadCloud, GitCompareArrows } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ComeceAquiPage() {
    const [clientName, setClientName] = useState("");
    const [yourName, setYourName] = useState("");

  return (
    <div className="container relative">
      <section className="mx-auto flex max-w-4xl flex-col items-center justify-center py-12 text-center md:py-20">
        <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
          Assistente de Contratos V-Lab
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground sm:text-xl">
          Sua ferramenta inteligente para criar, gerenciar e preencher minutas de contratos de cooperação de forma rápida e eficiente.
        </p>

        <div className="mt-8 w-full max-w-sm space-y-4">
            <div className="grid w-full items-center gap-1.5 text-left">
                <Label htmlFor="client-name">Cliente</Label>
                <Input 
                    type="text" 
                    id="client-name" 
                    placeholder="Nome do cliente"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                />
            </div>
            <div className="grid w-full items-center gap-1.5 text-left">
                <Label htmlFor="your-name">Seu nome</Label>
                <Input 
                    type="text" 
                    id="your-name" 
                    placeholder="Pessoa preenchendo o projeto"
                    value={yourName}
                    onChange={(e) => setYourName(e.target.value)}
                />
            </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Button size="lg" asChild>
                <Link href="/documentos-iniciais">Começar a Gerar um Contrato</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
                <Link href="/modelos">Gerenciar Meus Modelos</Link>
            </Button>
        </div>
      </section>

      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-5xl">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Como Funciona</h2>
                <p className="text-muted-foreground mt-2">Siga estes simples passos para otimizar seu fluxo de trabalho.</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <UploadCloud size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">1. Analise e Indexe</h3>
                    <p className="mt-2 text-muted-foreground">
                        Na aba "Documentos Iniciais", carregue seus arquivos, receba feedback da IA e indexe o conteúdo para extrair as entidades importantes dos documentos principais.
                    </p>
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">2. Gerar Contratos</h3>
                    <p className="mt-2 text-muted-foreground">
                        Selecione modelos e use as entidades extraídas para gerar novas minutas de contrato preenchidas com IA na aba "Gerar Contratos".
                    </p>
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <GitCompareArrows size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">3. Analisar Contratos</h3>
                    <p className="mt-2 text-muted-foreground">
                        Compare as minutas geradas com a ajuda da IA, revise, edite e exporte os documentos finais em Markdown ou .DOCX na aba "Revisar Contratos".
                    </p>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}
