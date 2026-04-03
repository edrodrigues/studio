'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  Clock, 
  User,
  Search,
  Filter,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser } from '@/firebase/provider';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Feedback {
  id: string;
  query: string;
  answer: string;
  feedback?: 'positive' | 'negative';
  userName?: string;
  userEmail?: string;
  userId?: string;
  timestamp: string;
  createdAt?: string;
}

export default function AdminFeedbackPage() {
  const { user, isUserLoading: userLoading } = useUser();
  const router = useRouter();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'positive' | 'negative' | 'none'>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/auth');
    }
  }, [user, userLoading, router]);

  const fetchFeedbacks = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/feedback');
      if (response.ok) {
        const data = await response.json();
        setFeedbacks(data.feedbacks || []);
      } else {
        // Fallback to direct server action call
        const { handleGetAlexFeedback } = await import('@/lib/actions');
        const result = await handleGetAlexFeedback();
        if (result.success && result.data) {
          setFeedbacks(result.data as Feedback[]);
        }
      }
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchFeedbacks();
    }
  }, [user]);

  const filteredFeedbacks = feedbacks.filter(fb => {
    const matchesSearch = searchTerm === '' || 
      fb.query?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fb.answer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fb.userName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = filterType === 'all' ||
      (filterType === 'positive' && fb.feedback === 'positive') ||
      (filterType === 'negative' && fb.feedback === 'negative') ||
      (filterType === 'none' && !fb.feedback);
    
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: feedbacks.length,
    positive: feedbacks.filter(f => f.feedback === 'positive').length,
    negative: feedbacks.filter(f => f.feedback === 'negative').length,
    none: feedbacks.filter(f => !f.feedback).length,
  };

  if (userLoading || isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-64 mb-8" />
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Feedbacks do ALEX</h1>
        <p className="text-muted-foreground mt-2">
          Analise os feedbacks dos usuários sobre as respostas do assistente ALEX.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <ThumbsUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.positive}</p>
              <p className="text-xs text-muted-foreground">Positivos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <ThumbsDown className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.negative}</p>
              <p className="text-xs text-muted-foreground">Negativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 bg-muted rounded-lg">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.none}</p>
              <p className="text-xs text-muted-foreground">Sem feedback</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por pergunta, resposta ou usuário..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'positive', 'negative', 'none'] as const).map((type) => (
            <Button
              key={type}
              variant={filterType === type ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
            >
              {type === 'all' ? 'Todos' : 
               type === 'positive' ? 'Positivos' : 
               type === 'negative' ? 'Negativos' : 'Sem Feedback'}
            </Button>
          ))}
        </div>
        <Button 
          variant="outline" 
          size="icon"
          onClick={fetchFeedbacks}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Nenhum feedback encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm || filterType !== 'all' 
                  ? 'Tente ajustar seus filtros de busca.'
                  : 'Os feedbacks dos usuários aparecerão aqui.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredFeedbacks.map((fb) => (
            <Card key={fb.id} className={
              fb.feedback === 'positive' ? 'border-emerald-200 dark:border-emerald-800' :
              fb.feedback === 'negative' ? 'border-red-200 dark:border-red-800' : ''
            }>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">
                        {fb.userName?.charAt(0)?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {fb.userName || 'Usuário anônimo'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fb.userEmail || fb.userId || ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fb.feedback === 'positive' && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300">
                        <ThumbsUp className="h-3 w-3 mr-1" /> Positivo
                      </Badge>
                    )}
                    {fb.feedback === 'negative' && (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border-red-300">
                        <ThumbsDown className="h-3 w-3 mr-1" /> Negativo
                      </Badge>
                    )}
                    {!fb.feedback && (
                      <Badge variant="outline">
                        Sem feedback
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fb.timestamp ? formatDistanceToNow(new Date(fb.timestamp), { addSuffix: true, locale: ptBR }) : 'Recente'}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Pergunta:</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    {fb.query || 'Não disponível'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <MessageSquare className="h-4 w-4" />
                    <span>Resposta do ALEX:</span>
                  </div>
                  <div className="bg-primary/5 dark:bg-primary/10 rounded-lg p-3 text-sm border border-primary/10">
                    {fb.answer || 'Não disponível'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
