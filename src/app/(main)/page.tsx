"use client";

import Link from "next/link";
import { ArrowRight, FileText, GitCompareArrows, LayoutTemplate, Sparkles, UploadCloud } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserPreferences } from "@/hooks/use-user-preferences";

const steps = [
  {
    icon: UploadCloud,
    title: "1. Organize os documentos",
    description: "Carregue os arquivos-base, acompanhe o status e extraia as entidades importantes do projeto.",
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: LayoutTemplate,
    title: "2. Escolha os modelos",
    description: "Selecione os modelos de contrato adequados e prepare o contexto para geração com menos retrabalho.",
    accent: "bg-primary/10 text-primary",
  },
  {
    icon: GitCompareArrows,
    title: "3. Revise com clareza",
    description: "Compare versões, ajuste o conteúdo e exporte o documento final quando tudo estiver validado.",
    accent: "bg-amber-500/10 text-amber-600",
  },
];

export default function ComeceAquiPage() {
  const { clientName, setClientName, yourName, setYourName, isLoading } = useUserPreferences();

  if (isLoading) {
    return (
      <main id="main" className="page-shell flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </main>
    );
  }

  return (
    <main id="main" className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[32rem] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <section className="page-shell relative">
        <div className="page-width-wide page-stack">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,24rem)] lg:items-end">
            <div className="max-w-3xl space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Alex disponível no canto inferior direito
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="max-w-3xl text-4xl font-serif font-bold leading-tight tracking-tight text-primary sm:text-5xl lg:text-6xl"
              >
                Comece com um fluxo mais claro para montar e revisar contratos.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
              >
                Defina o contexto do projeto, deixe os dados importantes à mão e avance para geração e revisão sem perder a visão geral do processo.
              </motion.p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="surface-panel p-5 sm:p-6"
            >
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="client-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Nome do projeto
                  </Label>
                  <Input
                    type="text"
                    id="client-name"
                    placeholder="Ex.: Contrato de prestação de serviços"
                    className="h-12 rounded-2xl"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="your-name" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Nome do cliente
                  </Label>
                  <Input
                    type="text"
                    id="your-name"
                    placeholder="Empresa ou contraparte principal"
                    className="h-12 rounded-2xl"
                    value={yourName}
                    onChange={(event) => setYourName(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <Button size="lg" className="h-12 rounded-2xl text-base font-semibold" asChild>
                    <Link href="/projects/new">
                      Criar novo projeto
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" size="lg" className="h-12 rounded-2xl text-base font-semibold" asChild>
                    <Link href="/projects">Ver projetos existentes</Link>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          <section className="page-stack">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">Como funciona</h2>
              <p className="page-description">As próximas etapas mantêm o trabalho orientado por contexto, com menos dependência de painéis apertados e interfaces rígidas.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {steps.map((step) => (
                <Card key={step.title} className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${step.accent}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="surface-panel flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary">Pronto para continuar?</h2>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                Você pode criar um projeto agora ou retomar um fluxo existente a partir da área de projetos.
              </p>
            </div>
            <Button variant="outline" size="lg" className="h-12 rounded-2xl text-base font-semibold" asChild>
              <Link href="/gerar-exportar">
                <FileText className="h-4 w-4" />
                Ir para gerar e revisar
              </Link>
            </Button>
          </section>
        </div>
      </section>
    </main>
  );
}
