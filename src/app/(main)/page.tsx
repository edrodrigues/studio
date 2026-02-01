
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FileText, DraftingCompass, UploadCloud, GitCompareArrows, Sparkles, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useLocalStorage from "@/hooks/use-local-storage";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function ComeceAquiPage() {
    const [clientName, setClientName] = useLocalStorage("clientName", "");
    const [yourName, setYourName] = useLocalStorage("yourName", "");

    const areFieldsFilled = clientName.trim() !== "" && yourName.trim() !== "";

    return (
        <div className="container relative overflow-hidden pb-20">
            {/* Background Decoration */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-gradient-to-b from-primary/5 to-transparent -z-10" />

            <section className="mx-auto flex max-w-5xl flex-col items-center justify-center py-20 text-center md:py-32">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary mb-8"
                >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-[11px] font-medium tracking-wide">Conheça o ALEX no canto direito inferior da tela.</span>
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
                    className="mt-12 w-full max-w-md p-8 rounded-[2.5rem] glass dark:glass-dark shadow-2xl relative"
                >
                    <div className="space-y-6">
                        <div className="grid w-full items-center gap-2.5 text-left">
                            <Label htmlFor="client-name" className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-2">Cliente</Label>
                            <Input
                                type="text"
                                id="client-name"
                                placeholder="Nome do cliente"
                                className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-border/50 focus:ring-primary/20 font-outfit text-base px-5"
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid w-full items-center gap-2.5 text-left">
                            <Label htmlFor="your-name" className="text-[10px] font-bold uppercase tracking-widest text-primary/60 ml-2">Seu nome</Label>
                            <Input
                                type="text"
                                id="your-name"
                                placeholder="Pessoa preenchendo o projeto"
                                className="h-14 rounded-2xl bg-white/50 dark:bg-black/20 border-border/50 focus:ring-primary/20 font-outfit text-base px-5"
                                value={yourName}
                                onChange={(e) => setYourName(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="mt-10 flex flex-col gap-4">
                        <Button
                            size="lg"
                            className="h-16 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 bg-primary hover:bg-primary/90 transition-all active:scale-95"
                            asChild={areFieldsFilled}
                            disabled={!areFieldsFilled}
                        >
                            <Link href="/documentos-iniciais">
                                Começar a Gerar um Contrato <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                        <Button variant="ghost" className="h-12 text-muted-foreground hover:text-primary rounded-xl font-bold" asChild>
                            <Link href="/modelos">Gerenciar Meus Modelos</Link>
                        </Button>
                    </div>
                </motion.div>
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
                                    <UploadCloud size={40} />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-primary mb-4">1. Analise e Indexe</h3>
                                <p className="text-muted-foreground font-outfit leading-relaxed">
                                    Na aba "Documentos Iniciais", carregue seus arquivos, receba feedback da IA e indexe o conteúdo para extrair as entidades importantes dos documentos principais.
                                </p>
                            </CardContent>
                        </Card>

                        <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                            <CardContent className="p-10 flex flex-col items-center text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                    <FileText size={40} />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-primary mb-4">2. Gerar Documentos</h3>
                                <p className="text-muted-foreground font-outfit leading-relaxed">
                                    Selecione modelos e use as entidades extraídas para gerar novos documentos preenchidos com IA na aba "Gerar Documentos".
                                </p>
                            </CardContent>
                        </Card>

                        <Card glass className="relative group overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all hover:-translate-y-2 rounded-[2rem]">
                            <CardContent className="p-10 flex flex-col items-center text-center">
                                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-accent mb-8 group-hover:scale-110 transition-transform shadow-inner">
                                    <GitCompareArrows size={40} />
                                </div>
                                <h3 className="text-2xl font-serif font-bold text-primary mb-4">3. Analisar Contratos</h3>
                                <p className="text-muted-foreground font-outfit leading-relaxed">
                                    Compare as minutas geradas com a ajuda da IA, revise, edite e exporte os documentos finais em Markdown ou .DOCX na aba "Revisar Documentos".
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </section>
        </div>
    );
}
