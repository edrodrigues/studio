"use client";

import { useAuthContext } from "@/context/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Shield, Sparkles, ArrowRight, CheckCircle2, Zap, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

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
            <main id="main" className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/20" />
                    <p className="text-muted-foreground">Carregando...</p>
                </div>
            </main>
        );
    }

    if (user) {
        return null;
    }

    return (
        <main id="main" className="relative w-full overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1000px] bg-gradient-to-b from-primary/10 via-primary/5 to-transparent -z-10" />

            <div className="container relative pb-20">
                <section className="mx-auto flex max-w-5xl flex-col items-center justify-center py-20 text-center md:py-32">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8"
                    >
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[11px] font-medium tracking-wide">Inteligência Artificial para Contratos</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl font-serif font-bold leading-[1.1] tracking-tight md:text-7xl text-primary"
                    >
                        Assistente de Contratos V-Lab
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="mt-8 max-w-2xl text-muted-foreground text-lg md:text-xl font-outfit leading-relaxed"
                    >
                        Sua ferramenta inteligente para criar, gerenciar e preencher minutas de contratos de cooperação de forma rápida e eficiente.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="mt-12 flex flex-col gap-4 w-full max-w-sm"
                    >
                        <Button
                            size="lg"
                            className="h-14 text-base font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                            asChild
                        >
                            <Link href="/auth">
                                Começar Agora <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                            </Link>
                        </Button>
                        <Button variant="outline" size="lg" className="h-12 text-base font-bold rounded-2xl border-2 hover:bg-primary/5 transition-all" asChild>
                            <Link href="/auth">
                                Já tenho conta - Entrar
                            </Link>
                        </Button>
                    </motion.div>
                </section>

                <section className="py-20">
                    <div className="mx-auto max-w-6xl">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-serif font-bold text-primary">Por que usar o V-Lab?</h2>
                            <p className="text-muted-foreground mt-4 text-lg font-outfit italic opacity-80">Simplifique a criação de contratos com tecnologia de ponta.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <Zap size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">Inteligência Artificial</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Nossa IA analiza seus documentos, extrai entidades importantes e gera minutas automaticamente.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <Shield size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">Segurança Jurídica</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Contratos revisados e gerados com base em modelos seguros e práticas jurídicas estabelecidas.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-accent mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <Users size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">Colaboração em Equipe</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Convide membros para seus projetos, acompanhe versões e trabalhem juntos em tempo real.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>

                <section className="py-20">
                    <div className="mx-auto max-w-6xl">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl font-serif font-bold text-primary">Como Funciona</h2>
                            <p className="text-muted-foreground mt-4 text-lg font-outfit italic opacity-80">Siga estes simples passos para otimizar seu fluxo de trabalho.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/10 text-emerald-600 mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <FileText size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">1. Carregue Documentos</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Na aba "Documentos Iniciais", carregue seus arquivos e receba feedback da IA sobre o conteúdo.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <Sparkles size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">2. Gere com IA</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Selecione modelos e use o contexto sincronizado para gerar novos documentos automaticamente.
                                    </p>
                                </CardContent>
                            </Card>

                            <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                                <CardContent className="p-10 flex flex-col items-center text-center">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-accent mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                        <CheckCircle2 size={40} aria-hidden="true" />
                                    </div>
                                    <h3 className="text-2xl font-serif font-bold text-primary mb-4">3. Revise e Exporte</h3>
                                    <p className="text-muted-foreground font-outfit leading-relaxed">
                                        Compare as minutas geradas, revise com ajuda da IA e exporte em Markdown ou .DOCX.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </section>

                <section className="py-20 text-center">
                    <div className="mx-auto max-w-2xl">
                        <h2 className="text-3xl font-serif font-bold text-primary mb-6">Pronto para começar?</h2>
                        <p className="text-muted-foreground mb-8 font-outfit">
                            Crie sua conta gratuita e tenha acesso a todas as funcionalidades do Assistente de Contratos V-Lab.
                        </p>
                        <Button
                            size="lg"
                            className="h-14 text-base font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                            asChild
                        >
                            <Link href="/auth">
                                Criar Conta Grátis <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                            </Link>
                        </Button>
                    </div>
                </section>

                <footer className="py-10 border-t mt-20">
                    <div className="mx-auto max-w-6xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold tracking-tighter text-primary">V-Lab</span>
                            <span className="rounded-sm bg-[#86EFAC] px-2 py-0.5">
                                <span className="text-xs font-bold uppercase tracking-widest text-[#1A1A1A]">UFPE</span>
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            © 2026 V-Lab UFPE. Todos os direitos reservados.
                        </p>
                        <div className="flex gap-6">
                            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                Termos de Serviço
                            </Link>
                            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                Política de Privacidade
                            </Link>
                        </div>
                    </div>
                </footer>
            </div>
        </main>
    );
}
