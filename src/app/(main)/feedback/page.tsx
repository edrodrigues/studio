
"use client";

import { useState, useEffect, useTransition } from "react";
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
    Loader
} from "lucide-react";
import { db } from "@/lib/firebase-server"; // Ensure this exports the client SDK instance if possible, or init it here.
// Actually, firebase-server exports `db` from getFirestore(app). That's fine for client if 'firebase-server' is client safe? 
// Wait, `firebase-server.ts` uses `getApps`, `getApp`, `initializeApp` from `firebase/app`. That IS the client SDK.
// The file name is misleading but the code is client SDK.
// But to be safe and use client-side auth correctly, we should use standard client side patterns.
import { collection, addDoc, serverTimestamp, query, where, orderBy, getDocs, onSnapshot, limit } from "firebase/firestore";
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

    useEffect(() => {
        // Alex Feedback Listener
        const qAlex = query(
            collection(db, "playbook_feedback"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        const unsubscribeAlex = onSnapshot(qAlex, (snapshot) => {
            const feedbacks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()?.toISOString() || new Date().toISOString(),
            })) as AlexFeedback[];
            setAlexFeedbacks(feedbacks);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching alex feedbacks:", error);
            setIsLoading(false);
        });

        // Developer Feedback Listener
        if (user) {
            const qDev = query(
                collection(db, "developer_feedback"),
                where("userId", "==", user.uid),
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
        }

        return () => unsubscribeAlex();
    }, [user]);

    const handleDevSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!devMessage.trim() || !user) return;

        try {
            await addDoc(collection(db, "developer_feedback"), {
                message: devMessage,
                userId: user.uid,
                userName: user.email?.split('@')[0] || 'Usuário',
                userEmail: user.email,
                status: 'Em análise',
                timestamp: serverTimestamp(),
            });

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
                description: "Falha ao enviar feedback. Tente novamente.",
                variant: "destructive",
            });
        }
    };

    const getFeedbackIcon = (type: string) => {
        switch (type) {
            case 'positive': return <Smile className="text-green-500 h-5 w-5" />;
            case 'neutral': return <Meh className="text-yellow-500 h-5 w-5" />;
            case 'negative': return <Frown className="text-red-500 h-5 w-5" />;
            default: return null;
        }
    };
    const getFeedbackLabel = (type: string) => {
        switch (type) {
            case 'positive': return "Útil";
            case 'neutral': return "Neutro";
            case 'negative': return "Não Útil";
            default: return "";
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'Em análise': return 'secondary';
            case 'Em implementação': return 'default';
            case 'Implementado': return 'outline';
            case 'Negado': return 'destructive';
            default: return 'outline';
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Em análise': return 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100';
            case 'Em implementação': return 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100';
            case 'Implementado': return 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100';
            case 'Negado': return 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100';
            default: return '';
        }
    };

    return (
        <div className="container py-12 pb-24">
            <div className="mx-auto max-w-6xl flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Feedback</h1>
                    <p className="text-muted-foreground mt-1">
                        Veja as avaliações do Alex e envie sugestões diretamente para os desenvolvedores.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* ALEX Feedback List */}
                    <div className="lg:col-span-2 space-y-4">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Bot className="h-5 w-5 text-primary" />
                                    Avaliações do ALEX
                                </CardTitle>
                                <CardDescription>
                                    Resumo das interações avaliadas no chat do Playbook.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                <ScrollArea className="h-[500px] px-6">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : alexFeedbacks.length === 0 ? (
                                        <div className="text-center py-20 text-muted-foreground">
                                            Nenhuma interação foi avaliada ainda.
                                        </div>
                                    ) : (
                                        <div className="space-y-6 pb-6">
                                            {alexFeedbacks.map((f) => (
                                                <div key={f.id} className="border-b last:border-0 pb-6 last:pb-0">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <Badge variant="outline" className="flex items-center gap-1.5 py-1 px-3">
                                                            {getFeedbackIcon(f.feedback)}
                                                            {getFeedbackLabel(f.feedback)}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(f.timestamp), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <div className="flex gap-3">
                                                            <div className="mt-1 h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                                                <User className="h-3 w-3 text-muted-foreground" />
                                                            </div>
                                                            <p className="text-sm font-medium">{f.query}</p>
                                                        </div>
                                                        <div className="flex gap-3 bg-muted/30 p-3 rounded-lg border border-border/50">
                                                            <div className="mt-1 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                                                                <Bot className="h-3 w-3" />
                                                            </div>
                                                            <p className="text-sm text-muted-foreground line-clamp-3 italic">
                                                                "{f.answer}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>

                        {/* Sent Feedbacks List */}
                        <Card className="flex flex-col">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    Feedbacks enviados
                                </CardTitle>
                                <CardDescription>
                                    Acompanhe o status das suas sugestões enviadas ao time de desenvolvimento.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                <ScrollArea className="h-[400px] px-6">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : devFeedbacks.length === 0 ? (
                                        <div className="text-center py-20 text-muted-foreground text-sm italic">
                                            Você ainda não enviou feedbacks ao desenvolvedor.
                                        </div>
                                    ) : (
                                        <div className="space-y-4 pb-6">
                                            {devFeedbacks.map((f) => (
                                                <div key={f.id} className="p-4 rounded-lg border bg-card/50 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                                {f.userName.substring(0, 2).toUpperCase()}
                                                            </div>
                                                            <span className="text-sm font-semibold">{f.userName}</span>
                                                        </div>
                                                        <Badge className={cn("text-[10px] py-0 px-2 font-medium uppercase", getStatusClass(f.status))}>
                                                            {f.status}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                                                        "{f.message}"
                                                    </p>
                                                    <div className="text-[10px] text-muted-foreground/60 text-right">
                                                        {format(new Date(f.timestamp), "dd/MM/yyyy 'às' HH:mm")}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Dev Feedback Form */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    Feedback ao Desenvolvedor
                                </CardTitle>
                                <CardDescription>
                                    Sugestões, melhorias ou relatos de bugs no sistema.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {submitted ? (
                                    <div className="flex flex-col items-center justify-center text-center py-10 animate-in zoom-in duration-300">
                                        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                                        <h3 className="font-bold text-lg">Obrigado!</h3>
                                        <p className="text-sm text-muted-foreground mb-6">
                                            Sua mensagem foi enviada com sucesso.
                                        </p>
                                        <Button variant="outline" onClick={() => setSubmitted(false)}>
                                            Enviar outro
                                        </Button>
                                    </div>
                                ) : (
                                    <form onSubmit={handleDevSubmit} className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="message">Sua Mensagem</Label>
                                            <Textarea
                                                id="message"
                                                placeholder="Como podemos melhorar sua experiência?"
                                                className="min-h-[150px] resize-none"
                                                value={devMessage}
                                                onChange={(e) => setDevMessage(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <Button
                                            type="submit"
                                            className="w-full"
                                            disabled={isPending || !devMessage.trim()}
                                        >
                                            {isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    Enviar Feedback
                                                </>
                                            )}
                                        </Button>
                                    </form>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-primary/5 border-primary/20">
                            <CardContent className="pt-6">
                                <div className="flex items-start gap-4">
                                    <div className="rounded-full bg-primary/10 p-2 text-primary">
                                        <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold">Dica</h4>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Você pode interagir com o Alex no chat lateral a qualquer momento para tirar dúvidas sobre o Playbook.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
