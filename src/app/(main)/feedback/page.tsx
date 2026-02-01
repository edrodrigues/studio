
"use client";

import { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Smile,
    Meh,
    Frown,
    Send,
    MessageSquare,
    Bot,
    User,
    Loader2,
    CheckCircle2,
    Sparkles,
    TrendingUp
} from "lucide-react";
import { handleSaveDeveloperFeedback } from "@/lib/actions";
import { db } from "@/lib/firebase-server";
import { collection, query, orderBy, onSnapshot, limit, doc, updateDoc } from "firebase/firestore";
import { useAuthContext } from "@/context/auth-context";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AlexFeedback {
    id: string;
    query: string;
    answer: string;
    feedback: 'positive' | 'neutral' | 'negative';
    status: DeveloperFeedback['status'];
    userName?: string;
    userEmail?: string;
    timestamp: string;
}

interface DeveloperFeedback {
    id: string;
    message: string;
    userName: string;
    userId: string;
    status: 'Em análise' | 'Em implementação' | 'Implementado' | 'Negado';
    timestamp: string;
}

export default function FeedbackPage() {
    const { user } = useAuthContext();
    const { toast } = useToast();
    const [alexFeedbacks, setAlexFeedbacks] = useState<AlexFeedback[]>([]);
    const [devFeedbacks, setDevFeedbacks] = useState<DeveloperFeedback[]>([]);
    const [devMessage, setDevMessage] = useState("");
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    const alexStats = {
        positive: alexFeedbacks.filter(f => f.feedback === 'positive').length,
        neutral: alexFeedbacks.filter(f => f.feedback === 'neutral').length,
        negative: alexFeedbacks.filter(f => f.feedback === 'negative').length,
    };

    useEffect(() => {
        const qAlex = query(
            collection(db, "playbook_feedback"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribeAlex = onSnapshot(qAlex, (snapshot) => {
            const feedbacks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                status: doc.data().status || 'Em análise',
                timestamp: doc.data().timestamp?.toDate()?.toISOString() || new Date().toISOString(),
            })) as AlexFeedback[];
            setAlexFeedbacks(feedbacks);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching alex feedbacks:", error);
            setIsLoading(false);
        });

        const qDev = query(
            collection(db, "developer_feedback"),
            orderBy("timestamp", "desc")
        );
        const unsubscribeDev = onSnapshot(qDev, (snapshot) => {
            const feedbacks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()?.toISOString() || new Date().toISOString(),
            })) as DeveloperFeedback[];
            setDevFeedbacks(feedbacks);
        }, (error) => {
            console.error("Error fetching dev feedbacks:", error);
        });

        return () => {
            unsubscribeAlex();
            unsubscribeDev();
        };
    }, [user]);

    const handleUpdateStatus = async (feedbackId: string, newStatus: DeveloperFeedback['status'], type: 'alex' | 'dev') => {
        try {
            const collectionName = type === 'alex' ? 'playbook_feedback' : 'developer_feedback';
            const feedbackRef = doc(db, collectionName, feedbackId);
            await updateDoc(feedbackRef, {
                status: newStatus
            });

            toast({
                title: "Status atualizado",
                description: `O status foi alterado para "${newStatus}".`,
            });
        } catch (error) {
            console.error("Error updating status:", error);
            toast({
                title: "Erro ao atualizar",
                description: "Não foi possível alterar o status.",
                variant: "destructive",
            });
        }
    };

    const handleDevSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!devMessage.trim() || !user) return;

        try {
            const result = await handleSaveDeveloperFeedback({
                message: devMessage,
                userId: user.uid,
                userName: user.email?.split('@')[0] || 'Usuário',
                userEmail: user.email || undefined,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            setSubmitted(true);
            setDevMessage("");
            toast({
                title: "Feedback enviado!",
                description: "Obrigado por nos ajudar a melhorar o sistema.",
            });
        } catch (error) {
            console.error("Error submitting feedback:", error);
            toast({
                title: "Erro ao enviar",
                description: "Falha ao enviar feedback.",
                variant: "destructive",
            });
        }
    };

    const getFeedbackIcon = (type: string) => {
        switch (type) {
            case 'positive': return <Smile className="text-emerald-500 h-4 w-4" />;
            case 'neutral': return <Meh className="text-amber-500 h-4 w-4" />;
            case 'negative': return <Frown className="text-red-500 h-4 w-4" />;
            default: return null;
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Em análise': return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-500/30';
            case 'Em implementação': return 'bg-purple-500/10 text-purple-600 border-purple-200 dark:border-purple-500/30';
            case 'Implementado': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-500/30';
            case 'Negado': return 'bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-500/30';
            default: return '';
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1
        }
    };

    return (
        <div className="container py-16 pb-32">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-6xl flex flex-col gap-12"
            >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
                    <div>
                        <h1 className="text-5xl font-serif font-bold tracking-tight text-primary">Feedback</h1>
                        <p className="text-muted-foreground mt-3 text-lg font-outfit">
                            Veja as avaliações do Alex e sugestões de todos os usuários para o time de desenvolvimento.
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center px-4 py-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 opacity-60">Satisfação</span>
                            <span className="text-xl font-serif font-bold text-emerald-700">{Math.round((alexStats.positive / (alexFeedbacks.length || 1)) * 100)}%</span>
                        </div>
                        <div className="flex flex-col items-center px-4 py-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-500/20">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-600 opacity-60">Interações</span>
                            <span className="text-xl font-serif font-bold text-amber-700">{alexFeedbacks.length}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-10">
                        {/* ALEX Feedback List */}
                        <Card glass className="border-none shadow-2xl">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary">
                                        <Bot className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Avaliações do ALEX</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                                            <Smile className="h-4 w-4" />
                                            <span>{alexStats.positive}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                                            <Meh className="h-4 w-4" />
                                            <span>{alexStats.neutral}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                                            <Frown className="h-4 w-4" />
                                            <span>{alexStats.negative}</span>
                                        </div>
                                    </div>
                                </div>
                                <CardTitle className="text-3xl">Avaliações do ALEX</CardTitle>
                                <CardDescription className="text-base font-outfit">
                                    Resumo global das interações avaliadas no chat do Playbook.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0 mt-6">
                                <ScrollArea className="h-[500px] px-8">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                                        </div>
                                    ) : (
                                        <motion.div
                                            variants={containerVariants}
                                            initial="hidden"
                                            animate="visible"
                                            className="space-y-8 pb-10"
                                        >
                                            {alexFeedbacks.map((f) => (
                                                <motion.div key={f.id} variants={itemVariants} className="relative pl-6 border-l-2 border-primary/10 pb-2">
                                                    <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary/20 border-2 border-background" />
                                                    <div className="flex items-center justify-between mb-4">
                                                        <Badge variant="outline" className={cn("flex items-center gap-2 py-1 px-4 rounded-full border-none font-bold text-[10px] uppercase tracking-widest", f.feedback === 'positive' ? 'bg-emerald-500/10 text-emerald-600' : f.feedback === 'neutral' ? 'bg-amber-500/10 text-amber-600' : 'bg-red-500/10 text-red-600')}>
                                                            {getFeedbackIcon(f.feedback)}
                                                            {f.feedback === 'positive' ? 'Útil' : f.feedback === 'neutral' ? 'Neutro' : 'Não Útil'}
                                                        </Badge>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter block">
                                                                {f.userName || 'Anônimo'} • {format(new Date(f.timestamp), "HH:mm, dd MMM", { locale: ptBR })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-background/40 rounded-2xl p-5 border border-border/10 shadow-sm hover:shadow-md transition-shadow">
                                                        <div className="flex gap-4 items-start mb-4">
                                                            <div className="h-8 w-8 rounded-xl bg-primary/5 flex items-center justify-center text-primary flex-shrink-0">
                                                                <User className="h-4 w-4" />
                                                            </div>
                                                            <p className="text-sm font-semibold leading-relaxed mt-1">{f.query}</p>
                                                        </div>
                                                        <div className="flex gap-4 items-start bg-primary/5 p-4 rounded-xl border border-primary/10">
                                                            <div className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0">
                                                                <Sparkles className="h-4 w-4" />
                                                            </div>
                                                            <p className="text-sm text-muted-foreground leading-relaxed italic font-outfit">
                                                                "{f.answer}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Sent Feedbacks List */}
                        <Card glass className="border-none shadow-2xl">
                            <CardHeader>
                                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full text-amber-600 w-fit mb-4">
                                    <MessageSquare className="h-4 w-4" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Roadmap de Correções</span>
                                </div>
                                <CardTitle className="text-3xl">Feedbacks enviados</CardTitle>
                                <CardDescription className="text-base font-outfit">
                                    Acompanhe o status de todas as sugestões enviadas ao time de desenvolvimento.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-8 pb-10">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-20 text-primary/20">
                                        <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {devFeedbacks.map((f) => (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                key={f.id}
                                                className="p-6 rounded-3xl border border-border/40 bg-background/30 hover:bg-background/60 transition-colors group"
                                            >
                                                <div className="flex items-center justify-between mb-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-sm font-bold text-white shadow-lg">
                                                            {f.userName.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span className="text-sm font-bold tracking-tight">{f.userName}</span>
                                                    </div>
                                                    <Badge className={cn("text-[9px] py-1 px-3 font-bold uppercase tracking-widest border-none rounded-full", getStatusClass(f.status))}>
                                                        {f.status}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed font-outfit line-clamp-3 italic mb-4">
                                                    "{f.message}"
                                                </p>
                                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/20">
                                                    <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                                        {format(new Date(f.timestamp), "dd/MM/yyyy")}
                                                    </span>
                                                    <TrendingUp className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Dev Feedback Form */}
                    <div className="space-y-8">
                        <motion.div
                            initial={{ x: 30, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Card className="border-none shadow-2xl bg-gradient-to-b from-primary to-emerald-900 text-white overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <MessageSquare className="h-32 w-32 rotate-12" />
                                </div>
                                <CardHeader className="relative z-10">
                                    <CardTitle className="text-white text-2xl">Feedback ao Desenvolvedor</CardTitle>
                                    <CardDescription className="text-emerald-100/60 font-outfit">
                                        Sugestões, melhorias ou relatos de bugs no sistema.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="relative z-10">
                                    {submitted ? (
                                        <div className="flex flex-col items-center justify-center text-center py-12">
                                            <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                                                <CheckCircle2 className="h-10 w-10 text-white" />
                                            </div>
                                            <h3 className="font-bold text-xl mb-2">Obrigado!</h3>
                                            <p className="text-sm text-emerald-100/70 mb-8 font-outfit">
                                                Sua mensagem foi enviada com sucesso.
                                            </p>
                                            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10 rounded-xl" onClick={() => setSubmitted(false)}>
                                                Enviar outro
                                            </Button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleDevSubmit} className="space-y-6">
                                            <div className="space-y-3">
                                                <Label htmlFor="message" className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100/60">Sua Mensagem</Label>
                                                <Textarea
                                                    id="message"
                                                    placeholder="Como podemos melhorar sua experiência?"
                                                    className="min-h-[180px] bg-white/5 border-white/10 text-white placeholder:text-white/20 resize-none rounded-2xl focus:ring-accent/50 p-4 font-outfit"
                                                    value={devMessage}
                                                    onChange={(e) => setDevMessage(e.target.value)}
                                                    required
                                                />
                                            </div>
                                            <Button
                                                type="submit"
                                                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-12 rounded-2xl shadow-xl transition-all active:scale-95"
                                                disabled={isPending || !devMessage.trim()}
                                            >
                                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                                Enviar Feedback
                                            </Button>
                                        </form>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>

                        <motion.div
                            initial={{ x: 30, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="p-8 rounded-3xl bg-primary/5 border border-primary/10 flex flex-col gap-4 relative overflow-hidden group"
                        >
                            <div className="absolute -right-4 -bottom-4 h-24 w-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2 shadow-inner">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <h4 className="font-serif font-bold text-lg text-primary">Próximos Passos</h4>
                            <p className="text-sm text-muted-foreground font-outfit leading-relaxed">
                                Estamos processando feedbacks para otimizar os prompts de exportação jurídica no próximo sprint.
                            </p>
                        </motion.div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
