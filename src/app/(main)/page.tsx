"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, DraftingCompass, UploadCloud } from "lucide-react";

export default function ComeceAquiPage() {
  return (
    <div className="container relative">
      <section className="mx-auto flex max-w-4xl flex-col items-center justify-center py-12 text-center md:py-20">
        <h1 className="text-4xl font-bold leading-tight tracking-tighter md:text-6xl lg:leading-[1.1]">
          Assitente de Contratos IA
        </h1>
        <p className="mt-6 max-w-2xl text-muted-foreground sm:text-xl">
          Sua ferramenta inteligente para criar, gerenciar e preencher minutas de contratos de cooperação de forma rápida e eficiente.
        </p>
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
                        Na aba "Documentos Iniciais", carregue seus arquivos, receba feedback da IA e indexe o conteúdo para gerar uma minuta de contrato.
                    </p>
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <DraftingCompass size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">2. Gerencie Seus Modelos</h3>
                    <p className="mt-2 text-muted-foreground">
                        Use modelos pré-existentes ou crie novos a partir de seus próprios documentos na aba "Gerenciar Modelos".
                    </p>
                </div>
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="text-xl font-semibold">3. Preencha e Exporte</h3>
                    <p className="mt-2 text-muted-foreground">
                        A IA irá gerar uma minuta. Use o editor guiado e o assistente Gemini para preencher os campos e depois exporte em Markdown ou .DOCX.
                    </p>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}
