"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Sparkles, 
  FolderOpen, 
  FileText, 
  UploadCloud, 
  GitCompareArrows, 
  PenTool,
  Settings,
  Users,
  Activity,
  LayoutTemplate,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pages = [
  {
    href: "/",
    title: "Comece Aqui",
    description: "Página inicial com visão geral do aplicativo e opções para criar novos projetos.",
    icon: HelpCircle,
    color: "bg-primary/10 text-primary",
  },
  {
    href: "/projects",
    title: "Meus Projetos",
    description: "Lista de todos os seus projetos. Aqui você visualiza, gerencia e cria novos projetos de contratos.",
    icon: FolderOpen,
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    href: "/documentos-iniciais",
    title: "Documentos Iniciais",
    description: "Carregue os documentos base do projeto (Plano de Trabalho, Termo de Execução, Planilha Orçamentária). Receba feedback da IA e indexe o conteúdo.",
    icon: UploadCloud,
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    href: "/modelos",
    title: "Gerenciar Modelos",
    description: "Gerencie os modelos de contratos. Crie, edite e organize templates para usar na geração de documentos.",
    icon: LayoutTemplate,
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    href: "/gerar-exportar",
    title: "Gerar e Revisar",
    description: "Gere novas minutas de contratos usando IA. Compare, analise e revise os documentos gerados.",
    icon: GitCompareArrows,
    color: "bg-amber-500/10 text-amber-600",
  },
  {
    href: "/preencher/[id]",
    title: "Preencher",
    description: "Preencha os placeholders (campos variáveis) dos contratos com os dados extraídos dos documentos.",
    icon: PenTool,
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    href: "/projects/[projectId]/settings",
    title: "Configurações",
    description: "Configure as opções do projeto, como nome, descrição e preferências.",
    icon: Settings,
    color: "bg-zinc-500/10 text-zinc-600",
  },
  {
    href: "/projects/[projectId]/members",
    title: "Membros",
    description: "Gerencie os membros da equipe do projeto e suas permissões de acesso.",
    icon: Users,
    color: "bg-pink-500/10 text-pink-600",
  },
  {
    href: "/projects/[projectId]/activity",
    title: "Atividade",
    description: "Veja o histórico de atividades do projeto, incluindo ações realizadas por cada membro.",
    icon: Activity,
    color: "bg-orange-500/10 text-orange-600",
  },
];

const workflowSteps = [
  {
    number: 1,
    title: "Crie um Projeto",
    description: "Comece criando um novo projeto na página inicial.",
    icon: FolderOpen,
  },
  {
    number: 2,
    title: "Carregue Documentos Iniciais",
    description: "Envie o Plano de Trabalho, Termo de Execução e Planilha Orçamentária.",
    icon: UploadCloud,
  },
  {
    number: 3,
    title: "Analise e Indexe",
    description: "A IA analisará os documentos e extrairá as entidades importantes.",
    icon: FileText,
  },
  {
    number: 4,
    title: "Selecione um Modelo",
    description: "Escolha um modelo de contrato em 'Gerenciar Modelos'.",
    icon: LayoutTemplate,
  },
  {
    number: 5,
    title: "Gere a Minuta",
    description: "Use a IA para gerar uma minuta baseada nos documentos e modelo.",
    icon: Sparkles,
  },
  {
    number: 6,
    title: "Revise e Preencha",
    description: "Revise o documento, preencha os campos variáveis e exporte.",
    icon: PenTool,
  },
];

export default function ComoUsarPage() {
  return (
    <main id="main" className="relative w-full overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1000px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent -z-10" />

      <div className="container relative pb-20">
        <section className="mx-auto flex max-w-4xl flex-col items-center justify-center py-16 text-center md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8"
          >
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-medium">Guia Completo</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-serif font-bold leading-[1.1] tracking-tight text-primary"
          >
            Como Usar o V-Lab Studio
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 max-w-2xl text-muted-foreground text-lg md:text-xl font-outfit leading-relaxed"
          >
            Um guia completo para aproveitar ao máximo o Assistente de Contratos V-Lab.
          </motion.p>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-serif font-bold text-primary mb-8 flex items-center gap-2">
              <Lightbulb className="h-6 w-6 text-amber-500" />
              O que é o V-Lab Studio?
            </h2>
            <Card glass className="shadow-xl">
              <CardContent className="p-8">
                <p className="text-muted-foreground font-outfit leading-relaxed text-lg">
                  O <strong>V-Lab Studio</strong> é uma ferramenta inteligente para criar, gerenciar e preencher 
                  minutas de contratos de cooperação de forma rápida e eficiente. Utilize inteligência artificial 
                  para analisar documentos, extrair entidades, gerar minutas e revisar contratos.
                </p>
                <div className="mt-6 flex flex-wrap gap-4">
                  <Link href="/projects/new">
                    <Button className="gap-2">
                      Criar Primeiro Projeto <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/projects">
                    <Button variant="outline" className="gap-2">
                      Ver Meus Projetos <FolderOpen className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-serif font-bold text-primary mb-8 flex items-center gap-2">
              <ChevronRight className="h-6 w-6" />
              Páginas do Aplicativo
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {pages.map((page, index) => (
                <motion.div
                  key={page.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Card glass className="shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 group">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shrink-0", page.color)}>
                          <page.icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
                            {page.title}
                            <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </h3>
                          <p className="text-muted-foreground font-outfit mt-1 text-sm">
                            {page.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-serif font-bold text-primary mb-8 flex items-center gap-2">
              <GitCompareArrows className="h-6 w-6 text-primary" />
              Fluxo de Trabalho
            </h2>

            <div className="relative">
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-primary/20 md:left-1/2" />
              
              <div className="space-y-8">
                {workflowSteps.map((step, index) => (
                  <motion.div
                    key={step.number}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    className={cn(
                      "flex flex-col md:flex-row gap-4",
                      index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                    )}
                  >
                    <div className="flex-1 md:text-right">
                      <Card glass className="inline-block shadow-lg">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 md:justify-end mb-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                              {step.number}
                            </span>
                            <h3 className="font-bold text-primary">{step.title}</h3>
                          </div>
                          <p className="text-muted-foreground text-sm font-outfit">
                            {step.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex justify-center md:justify-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shrink-0 z-10">
                        <step.icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="flex-1 hidden md:block" />
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-serif font-bold text-primary mb-8 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent" />
              Dicas do ALEX
            </h2>

            <Card glass className="shadow-xl border-accent/20">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-primary mb-1">O que é o ALEX?</h3>
                      <p className="text-muted-foreground font-outfit text-sm">
                        O ALEX é seu assistente virtual de contratos. Ele aparece no canto inferior direito da tela e pode responder perguntas sobre o Playbook e seus documentos.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-primary mb-1">Como usar?</h3>
                      <p className="text-muted-foreground font-outfit text-sm">
                        Clique no ícone do ALEX e faça perguntas como "Qual o prazo deste contrato?" ou "Que cláusulas preciso revisar?".
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-primary mb-1">Documentos Indexados</h3>
                      <p className="text-muted-foreground font-outfit text-sm">
                        Após sincronizar seus documentos na aba "Documentos Iniciais", o ALEX poderá responder perguntas específicas sobre o conteúdo deles.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-primary mb-1">Feedback</h3>
                      <p className="text-muted-foreground font-outfit text-sm">
                        Avalie as respostas do ALEX com o emojis de feedback. Isso ajuda a melhorar o assistente.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="py-16 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground font-outfit mb-8">
              Crie seu primeiro projeto e comece a gerar contratos com IA.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/projects/new">
                <Button size="lg" className="gap-2">
                  Criar Projeto <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="lg">
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
