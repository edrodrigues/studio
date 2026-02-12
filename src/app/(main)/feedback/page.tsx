"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    TrendingUp,
    Filter,
    FileText,
    Scale,
    Sparkles,
    BarChart3,
    LayoutGrid,
    List
} from "lucide-react";
import { handleSaveDeveloperFeedback } from "@/lib/actions";
import { db } from "@/lib/firebase-server";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where } from "firebase/firestore";
import { useAuthContext } from "@/context/auth-context";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Tipos de feedback expandidos para múltiplas origens
type FeedbackType = 'positive' | 'neutral' | 'negative';
type FeedbackSource = 'playbook_chat' | 'document_analysis' | 'consistency_analysis';
type FeedbackStatus = 'Em análise' | 'Em implementação' | 'Implementado' | 'Negado';

interface BaseFeedback {
    id: string;
    feedback: FeedbackType;
    status: FeedbackStatus;
    userName?: string;
    userEmail?: string;
    userId?: string;
    timestamp: string;
    source: FeedbackSource;
    context?: string;
}

interface PlaybookFeedback extends BaseFeedback {
    source: 'playbook_chat';
    query: string;
    answer: string;
}

interface DocumentAnalysisFeedback extends BaseFeedback {
    source: 'document_analysis';
    documentName?: string;
    analysisType?: string;
    feedback: FeedbackType;
}

interface ConsistencyAnalysisFeedback extends BaseFeedback {
    source: 'consistency_analysis';
    documentNames?: string[];
    consistencyPercentage?: number;
}

interface DeveloperFeedback {
    id: string;
    message: string;
    userName: string;
    userId: string;
    status: FeedbackStatus;
    timestamp: string;
    category?: 'bug' | 'feature' | 'improvement' | 'other';
}

type FeedbackItem = PlaybookFeedback | DocumentAnalysisFeedback | ConsistencyAnalysisFeedback;

const SOURCE_LABELS: Record<FeedbackSource, { label: string; icon: React.ReactNode; color: string }> = {
    playbook_chat: { 
        label: 'Chat do Alex', 
        icon: <Bot className="h-4 w-4" />, 
        color: 'bg-blue-500/10 text-blue-600' 
    },
    document_analysis: { 
        label: 'Análise de Documentos', 
        icon: <FileText className="h-4 w-4" />, 
        color: 'bg-purple-500/10 text-purple-600' 
    },
    consistency_analysis: { 
        label: 'Análise de Consistência', 
        icon: <Scale className="h-4 w-4" />, 
        color: 'bg-amber-500/10 text-amber-600' 
    },
};

const STATUS_OPTIONS: FeedbackStatus[] = ['Em análise', 'Em implementação', 'Implementado', 'Negado'];

export default function FeedbackPage() {
    const { user } = useAuthContext();
    const { toast } = useToast();
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [devFeedbacks, setDevFeedbacks] = useState<DeveloperFeedback[]>([]);
    const [devMessage, setDevMessage] = useState("");
    const [devCategory, setDevCategory] = useState<DeveloperFeedback['category']>('improvement');
    const [isPending, startTransition] = useTransition();
    const [isLoading, setIsLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    
    // Filtros
    const [selectedSource, setSelectedSource] = useState<FeedbackSource | 'all'>('all');
    const [selectedType, setSelectedType] = useState<FeedbackType | 'all'>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
    const [activeTab, setActiveTab] = useState('interactions');

    // Estatísticas calculadas
    const stats = useMemo(() => {
        const filtered = selectedSource === 'all' 
            ? feedbacks 
            : feedbacks.filter(f => f.source === selectedSource);
        
        const bySource = {
            playbook_chat: feedbacks.filter(f => f.source === 'playbook_chat'),
            document_analysis: feedbacks.filter(f => f.source === 'document_analysis'),
            consistency_analysis: feedbacks.filter(f => f.source === 'consistency_analysis'),
        };

        const total = filtered.length;
        const positive = filtered.filter(f => f.feedback === 'positive').length;
        const neutral = filtered.filter(f => f.feedback === 'neutral').length;
        const negative = filtered.filter(f => f.feedback === 'negative').length;
        const satisfactionRate = total > 0 ? Math.round((positive / total) * 100) : 0;

        return {
            total,
            positive,
            neutral,
            negative,
            satisfactionRate,
            bySource,
        };
    }, [feedbacks, selectedSource]);

    // Feedbacks filtrados
    const filteredFeedbacks = useMemo(() => {
        return feedbacks.filter(f => {
            const sourceMatch = selectedSource === 'all' || f.source === selectedSource;
            const typeMatch = selectedType === 'all' || f.feedback === selectedType;
            return sourceMatch && typeMatch;
        });
    }, [feedbacks, selectedSource, selectedType]);

    useEffect(() => {
        // Query para feedbacks de interações com a IA (múltiplas fontes)
        const qFeedback = query(
            collection(db, "playbook_feedback"),
            orderBy("timestamp", "desc")
        );

        const unsubscribeFeedback = onSnapshot(qFeedback, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    source: data.source || 'playbook_chat',
                    status: data.status || 'Em análise',
                    timestamp: data.timestamp?.toDate()?.toISOString() || new Date().toISOString(),
                } as FeedbackItem;
            });
            setFeedbacks(items);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching feedbacks:", error);
            setIsLoading(false);
        });

        // Query para feedbacks de desenvolvedores
        const qDev = query(
            collection(db, "developer_feedback"),
            orderBy("timestamp", "desc")
        );
        const unsubscribeDev = onSnapshot(qDev, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate()?.toISOString() || new Date().toISOString(),
            })) as DeveloperFeedback[];
            setDevFeedbacks(items);
        }, (error) => {
            console.error("Error fetching dev feedbacks:", error);
        });

        return () => {
            unsubscribeFeedback();
            unsubscribeDev();
        };
    }, [user]);

    const handleUpdateStatus = async (feedbackId: string, newStatus: FeedbackStatus, collectionName: string) => {
        try {
            const feedbackRef = doc(db, collectionName, feedbackId);
            await updateDoc(feedbackRef, { status: newStatus });
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
                userName: user.displayName || user.email?.split('@')[0] || 'Usuário',
                userEmail: user.email || undefined,
            });

            if (!result.success) throw new Error(result.error);

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

    const getFeedbackIcon = (type: FeedbackType) => {
        switch (type) {
            case 'positive': return <Smile className="text-emerald-500 h-4 w-4" />;
            case 'neutral': return <Meh className="text-amber-500 h-4 w-4" />;
            case 'negative': return <Frown className="text-red-500 h-4 w-4" />;
        }
    };

    const getFeedbackLabel = (type: FeedbackType) => {
        switch (type) {
            case 'positive': return 'Útil';
            case 'neutral': return 'Neutro';
            case 'negative': return 'Não Útil';
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'Em análise': return 'bg-blue-500/10 text-blue-600 border-blue-200';
            case 'Em implementação': return 'bg-purple-500/10 text-purple-600 border-purple-200';
            case 'Implementado': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
            case 'Negado': return 'bg-slate-500/10 text-slate-600 border-slate-200';
            default: return '';
        }
    };

    const getCategoryIcon = (category?: string) => {
        switch (category) {
            case 'bug': return '🐛';
            case 'feature': return '✨';
            case 'improvement': return '🔧';
            default: return '💬';
        }
    };

    return (
        <div className="container py-8 pb-32">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-7xl flex flex-col gap-8"
            >
                {/* Header com estatísticas gerais */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-6">
                        <div>
                            <h1 className="text-4xl font-serif font-bold tracking-tight text-primary">Central de Feedback</h1>
                            <p className="text-muted-foreground mt-2 text-lg font-outfit">
                                Avaliações e sugestões de todas as interações com a IA e o sistema.
                            </p>
                        </div>
                    </div>

                    {/* Cards de estatísticas por fonte */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Bot className="h-4 w-4 text-blue-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600/70">Chat Alex</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-700">{stats.bySource.playbook_chat.length}</p>
                                <p className="text-xs text-blue-600/60 mt-1">interações avaliadas</p>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileText className="h-4 w-4 text-purple-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-purple-600/70">Análise Docs</span>
                                </div>
                                <p className="text-2xl font-bold text-purple-700">{stats.bySource.document_analysis.length}</p>
                                <p className="text-xs text-purple-600/60 mt-1">análises avaliadas</p>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Scale className="h-4 w-4 text-amber-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600/70">Consistência</span>
                                </div>
                                <p className="text-2xl font-bold text-amber-700">{stats.bySource.consistency_analysis.length}</p>
                                <p className="text-xs text-amber-600/60 mt-1">comparações feitas</p>
                            </CardContent>
                        </Card>
                        
                        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/50">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600/70">Satisfação</span>
                                </div>
                                <p className="text-2xl font-bold text-emerald-700">{stats.satisfactionRate}%</p>
                                <p className="text-xs text-emerald-600/60 mt-1">taxa de aprovação</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Tabs para navegação */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-md">
                        <TabsTrigger value="interactions" className="gap-2">
                            <Sparkles className="h-4 w-4" />
                            Interações com IA
                        </TabsTrigger>
                        <TabsTrigger value="suggestions" className="gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Sugestões & Bugs
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="interactions" className="mt-6 space-y-6">
                        {/* Barra de filtros */}
                        <Card className="border-none shadow-sm bg-muted/30">
                            <CardContent className="p-4">
                                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Filter className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">Filtrar por:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        <Select value={selectedSource} onValueChange={(v) => setSelectedSource(v as FeedbackSource | 'all')}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Todas as fontes" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as fontes</SelectItem>
                                                <SelectItem value="playbook_chat">Chat do Alex</SelectItem>
                                                <SelectItem value="document_analysis">Análise de Docs</SelectItem>
                                                <SelectItem value="consistency_analysis">Consistência</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Select value={selectedType} onValueChange={(v) => setSelectedType(v as FeedbackType | 'all')}>
                                            <SelectTrigger className="w-[160px]">
                                                <SelectValue placeholder="Todos os tipos" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas as avaliações</SelectItem>
                                                <SelectItem value="positive">
                                                    <span className="flex items-center gap-2">
                                                        <Smile className="h-4 w-4 text-emerald-500" /> Útil
                                                    </span>
                                                </SelectItem>
                                                <SelectItem value="neutral">
                                                    <span className="flex items-center gap-2">
                                                        <Meh className="h-4 w-4 text-amber-500" /> Neutro
                                                    </span>
                                                </SelectItem>
                                                <SelectItem value="negative">
                                                    <span className="flex items-center gap-2">
                                                        <Frown className="h-4 w-4 text-red-500" /> Não útil
                                                    </span>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <div className="flex items-center gap-1 bg-background rounded-lg border p-1">
                                            <Button
                                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setViewMode('list')}
                                            >
                                                <List className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => setViewMode('grid')}
                                            >
                                                <LayoutGrid className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Resumo dos filtros aplicados */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground">
                                Mostrando <strong>{filteredFeedbacks.length}</strong> de <strong>{feedbacks.length}</strong> feedbacks
                                {selectedSource !== 'all' && (
                                    <span> de <Badge variant="secondary" className="ml-1">{SOURCE_LABELS[selectedSource].label}</Badge></span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                    <Smile className="h-3 w-3 mr-1" /> {stats.positive}
                                </Badge>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    <Meh className="h-3 w-3 mr-1" /> {stats.neutral}
                                </Badge>
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                    <Frown className="h-3 w-3 mr-1" /> {stats.negative}
                                </Badge>
                            </div>
                        </div>

                        {/* Lista de feedbacks */}
                        <Card className="border-none shadow-lg">
                            <CardContent className="p-0">
                                <ScrollArea className="h-[600px]">
                                    {isLoading ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                                        </div>
                                    ) : filteredFeedbacks.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                                            <p className="text-lg font-medium">Nenhum feedback encontrado</p>
                                            <p className="text-sm">Tente ajustar os filtros acima</p>
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "p-6",
                                            viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-6"
                                        )}>
                                            <AnimatePresence>
                                                {filteredFeedbacks.map((feedback, index) => (
                                                    <motion.div
                                                        key={feedback.id}
                                                        initial={{ opacity: 0, y: 20 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: -20 }}
                                                        transition={{ delay: index * 0.05 }}
                                                        className={cn(
                                                            "relative group",
                                                            viewMode === 'list' && "pl-6 border-l-2 border-primary/10 pb-2"
                                                        )}
                                                    >
                                                        {viewMode === 'list' && (
                                                            <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-primary/20 border-2 border-background" />
                                                        )}
                                                        
                                                        <div className={cn(
                                                            "bg-background rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all",
                                                            viewMode === 'grid' ? "p-5" : "p-5"
                                                        )}>
                                                            {/* Header com origem e avaliação */}
                                                            <div className="flex items-start justify-between mb-4">
                                                                <div className="flex items-center gap-2">
                                                                    <Badge className={cn(
                                                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg",
                                                                        SOURCE_LABELS[feedback.source].color
                                                                    )}>
                                                                        {SOURCE_LABELS[feedback.source].icon}
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                                                            {SOURCE_LABELS[feedback.source].label}
                                                                        </span>
                                                                    </Badge>
                                                                    <Badge variant="outline" className={cn(
                                                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border-none",
                                                                        feedback.feedback === 'positive' ? 'bg-emerald-500/10 text-emerald-600' :
                                                                        feedback.feedback === 'neutral' ? 'bg-amber-500/10 text-amber-600' :
                                                                        'bg-red-500/10 text-red-600'
                                                                    )}>
                                                                        {getFeedbackIcon(feedback.feedback)}
                                                                        <span className="text-[10px] font-bold uppercase tracking-wider">
                                                                            {getFeedbackLabel(feedback.feedback)}
                                                                        </span>
                                                                    </Badge>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-muted-foreground/60">
                                                                    {format(new Date(feedback.timestamp), "dd MMM · HH:mm", { locale: ptBR })}
                                                                </span>
                                                            </div>

                                                            {/* Conteúdo específico por tipo */}
                                                            {'query' in feedback && (
                                                                <div className="space-y-3">
                                                                    <div className="flex gap-3 items-start">
                                                                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                                                            <User className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <p className="text-sm font-medium leading-relaxed">{feedback.query}</p>
                                                                    </div>
                                                                    <div className="flex gap-3 items-start bg-muted/50 p-3 rounded-xl">
                                                                        <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                                                                            <Bot className="h-3.5 w-3.5" />
                                                                        </div>
                                                                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 italic">
                                                                            "{feedback.answer}"
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {'documentName' in feedback && (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="font-medium">{feedback.documentName || 'Documento não especificado'}</span>
                                                                    </div>
                                                                    {feedback.analysisType && (
                                                                        <p className="text-xs text-muted-foreground ml-6">
                                                                            Tipo: {feedback.analysisType}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {'documentNames' in feedback && (
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <Scale className="h-4 w-4 text-muted-foreground" />
                                                                        <span className="font-medium">Comparação de documentos</span>
                                                                    </div>
                                                                    {feedback.consistencyPercentage !== undefined && (
                                                                        <div className="flex items-center gap-2 ml-6">
                                                                            <div className={cn(
                                                                                "text-lg font-bold",
                                                                                feedback.consistencyPercentage >= 80 ? "text-emerald-600" :
                                                                                feedback.consistencyPercentage >= 60 ? "text-amber-600" : "text-red-600"
                                                                            )}>
                                                                                {feedback.consistencyPercentage}%
                                                                            </div>
                                                                            <span className="text-xs text-muted-foreground">de consistência</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Footer com usuário e status */}
                                                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/30">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-[10px] font-bold text-white">
                                                                        {(feedback.userName || 'A').substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                    <span className="text-xs font-medium text-muted-foreground">
                                                                        {feedback.userName || 'Anônimo'}
                                                                    </span>
                                                                </div>
                                                                <Select
                                                                    value={feedback.status}
                                                                    onValueChange={(v) => handleUpdateStatus(feedback.id, v as FeedbackStatus, 'playbook_feedback')}
                                                                >
                                                                    <SelectTrigger className={cn("h-7 text-[10px] w-auto border-none", getStatusClass(feedback.status))}>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {STATUS_OPTIONS.map(status => (
                                                                            <SelectItem key={status} value={status} className="text-xs">
                                                                                {status}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </AnimatePresence>
                                        </div>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="suggestions" className="mt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Lista de sugestões */}
                            <div className="lg:col-span-2">
                                <Card className="border-none shadow-lg">
                                    <CardHeader>
                                        <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full text-amber-600 w-fit mb-4">
                                            <TrendingUp className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Roadmap de Melhorias</span>
                                        </div>
                                        <CardTitle className="text-2xl">Sugestões e Relatos</CardTitle>
                                        <CardDescription>
                                            Acompanhe o status de todas as sugestões enviadas ao time de desenvolvimento.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        {isLoading ? (
                                            <div className="flex items-center justify-center py-20">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                                            </div>
                                        ) : devFeedbacks.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                                                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                                                <p>Nenhuma sugestão enviada ainda</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {devFeedbacks.map((f) => (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        key={f.id}
                                                        className="p-5 rounded-2xl border border-border/40 bg-background/30 hover:bg-background/60 transition-colors"
                                                    >
                                                        <div className="flex items-start justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-emerald-700 flex items-center justify-center text-lg shadow-lg">
                                                                    {getCategoryIcon(f.category)}
                                                                </div>
                                                                <div>
                                                                    <span className="text-sm font-bold tracking-tight block">{f.userName}</span>
                                                                    <span className="text-[10px] text-muted-foreground/60">
                                                                        {format(new Date(f.timestamp), "dd/MM/yyyy")}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <Select
                                                                value={f.status}
                                                                onValueChange={(v) => handleUpdateStatus(f.id, v as FeedbackStatus, 'developer_feedback')}
                                                            >
                                                                <SelectTrigger className={cn("h-7 text-[10px] w-auto", getStatusClass(f.status))}>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {STATUS_OPTIONS.map(status => (
                                                                        <SelectItem key={status} value={status} className="text-xs">
                                                                            {status}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground leading-relaxed italic line-clamp-4">
                                                            "{f.message}"
                                                        </p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Formulário de envio */}
                            <div>
                                <motion.div
                                    initial={{ x: 30, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <Card className="border-none shadow-xl bg-gradient-to-b from-primary to-emerald-900 text-white overflow-hidden relative sticky top-6">
                                        <div className="absolute top-0 right-0 p-8 opacity-10">
                                            <MessageSquare className="h-32 w-32 rotate-12" />
                                        </div>
                                        <CardHeader className="relative z-10">
                                            <CardTitle className="text-white text-xl">Envie sua Sugestão</CardTitle>
                                            <CardDescription className="text-emerald-100/60">
                                                Relate bugs, sugira melhorias ou novas funcionalidades.
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="relative z-10">
                                            {submitted ? (
                                                <div className="flex flex-col items-center justify-center text-center py-12">
                                                    <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
                                                        <CheckCircle2 className="h-10 w-10 text-white" />
                                                    </div>
                                                    <h3 className="font-bold text-xl mb-2">Obrigado!</h3>
                                                    <p className="text-sm text-emerald-100/70 mb-8">
                                                        Sua mensagem foi enviada com sucesso.
                                                    </p>
                                                    <Button 
                                                        variant="outline" 
                                                        className="border-white/20 text-white hover:bg-white/10" 
                                                        onClick={() => setSubmitted(false)}
                                                    >
                                                        Enviar outra
                                                    </Button>
                                                </div>
                                            ) : (
                                                <form onSubmit={handleDevSubmit} className="space-y-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-emerald-100/60">
                                                            Categoria
                                                        </Label>
                                                        <Select value={devCategory} onValueChange={(v) => setDevCategory(v as DeveloperFeedback['category'])}>
                                                            <SelectTrigger className="bg-white/5 border-white/10 text-white">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="bug">🐛 Bug</SelectItem>
                                                                <SelectItem value="feature">✨ Nova Funcionalidade</SelectItem>
                                                                <SelectItem value="improvement">🔧 Melhoria</SelectItem>
                                                                <SelectItem value="other">💬 Outro</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-xs font-bold uppercase tracking-wider text-emerald-100/60">
                                                            Sua Mensagem
                                                        </Label>
                                                        <Textarea
                                                            placeholder="Descreva sua sugestão ou problema..."
                                                            className="min-h-[140px] bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                                                            value={devMessage}
                                                            onChange={(e) => setDevMessage(e.target.value)}
                                                            required
                                                        />
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        className="w-full bg-white text-primary hover:bg-white/90 font-bold h-11 shadow-xl"
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
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </motion.div>
        </div>
    );
}
