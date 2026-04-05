"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, FileText, Shield, Sparkles, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthContext } from "@/context/auth-context";

const valueProps = [
  {
    icon: Zap,
    title: "Inteligência aplicada",
    description: "Analise documentos, identifique entidades relevantes e acelere o preparo das minutas sem perder contexto.",
    accent: "text-emerald-600 bg-emerald-500/10",
  },
  {
    icon: Shield,
    title: "Mais segurança jurídica",
    description: "Trabalhe a partir de modelos confiáveis e processos consistentes para revisar contratos com mais clareza.",
    accent: "text-primary bg-primary/10",
  },
  {
    icon: Users,
    title: "Colaboração orientada",
    description: "Centralize projeto, equipe, documentos e versões em uma rotina mais legível para todos os envolvidos.",
    accent: "text-amber-600 bg-amber-500/10",
  },
];

const workflow = [
  {
    icon: FileText,
    title: "1. Organize os documentos",
    description: "Envie os arquivos-base, acompanhe o status e deixe o material pronto para leitura e extração.",
    accent: "text-emerald-600 bg-emerald-500/10",
  },
  {
    icon: Sparkles,
    title: "2. Gere com contexto",
    description: "Use modelos e dados extraídos para montar novos documentos com menos retrabalho manual.",
    accent: "text-primary bg-primary/10",
  },
  {
    icon: CheckCircle2,
    title: "3. Revise e exporte",
    description: "Compare versões, ajuste o conteúdo e exporte o resultado final para seguir com a operação.",
    accent: "text-amber-600 bg-amber-500/10",
  },
];

export default function HomePage() {
  const { user, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/projects");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <main id="main" className="page-shell flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-pulse rounded-full bg-primary/20" />
          <p className="text-muted-foreground">Carregando…</p>
        </div>
      </main>
    );
  }

  if (user) return null;

  return (
    <main id="main" className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[38rem] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />

      <section className="page-shell relative pt-10 sm:pt-14 lg:pt-20">
        <div className="page-width-wide page-stack">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,24rem)] lg:items-end">
            <div className="max-w-3xl space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Inteligência para contratos
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="max-w-3xl text-4xl font-serif font-bold leading-tight tracking-tight text-primary sm:text-5xl lg:text-6xl"
              >
                Contratos mais legíveis, organizados e fáceis de revisar em qualquer tela.
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg"
              >
                O Assistente de Contratos V-Lab reúne documentos, modelos, geração assistida e revisão em um fluxo pensado para operação diária, não apenas para desktop.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex flex-col gap-3 sm:flex-row"
              >
                <Button size="lg" className="h-12 rounded-2xl px-6 text-base font-semibold" asChild>
                  <Link href="/auth">
                    Começar agora
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="h-12 rounded-2xl px-6 text-base font-semibold" asChild>
                  <Link href="/auth">Já tenho conta</Link>
                </Button>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="surface-panel p-5 sm:p-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">O que você ganha</p>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-sm font-semibold text-foreground">Fluxo unificado</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">Projetos, modelos, revisão e histórico ficam no mesmo contexto.</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-foreground">Menos retrabalho</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">As entidades extraídas alimentam a geração e reduzem cópias manuais.</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-foreground">Experiência móvel melhor</dt>
                  <dd className="mt-1 text-sm leading-6 text-muted-foreground">Acompanhe status, navegue e revise sem depender de uma tela larga.</dd>
                </div>
              </dl>
            </motion.div>
          </div>

          <section className="page-stack pt-4">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">Por que usar o V-Lab?</h2>
              <p className="page-description">A plataforma continua familiar, mas com uma hierarquia mais clara para leitura, revisão e tomada de decisão.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {valueProps.map((item) => (
                <Card key={item.title} className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="page-stack">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary sm:text-3xl">Como funciona</h2>
              <p className="page-description">Do envio inicial à exportação, o fluxo foi desenhado para mostrar contexto e ação com menos ruído visual.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workflow.map((item) => (
                <Card key={item.title} className="h-full">
                  <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.accent}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="surface-panel flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl font-serif font-bold text-primary">Pronto para começar?</h2>
              <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                Crie sua conta e entre em um fluxo de trabalho mais limpo para organizar documentos, gerar contratos e revisar com mais confiança.
              </p>
            </div>
            <Button size="lg" className="h-12 rounded-2xl px-6 text-base font-semibold" asChild>
              <Link href="/auth">
                Criar conta grátis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </section>

          <footer className="flex flex-col gap-4 border-t pt-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-xl font-bold tracking-tight text-primary">V-Lab</span>
              <span className="rounded-sm bg-[#86EFAC] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">UFPE</span>
            </div>
            <p className="text-sm text-muted-foreground">© 2026 V-Lab UFPE. Todos os direitos reservados.</p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:justify-end">
              <Link href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-primary">Termos de Serviço</Link>
              <Link href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-primary">Política de Privacidade</Link>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
