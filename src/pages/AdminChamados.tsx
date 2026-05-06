import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Ticket, 
  Settings, 
  Webhook, 
  Key, 
  BookOpen,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  MessageSquare,
  User,
  Mail,
  Phone,
  RefreshCw,
  Bell,
  MoreVertical,
  History,
  Send,
  Lock,
  Eye,
  Calendar
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type ChamadoStatus = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'resolvido' | 'fechado';
type ChamadoPrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

interface Chamado {
  id: string;
  codigo: string;
  nome: string;
  email: string;
  contato: string;
  motivo: string;
  status: ChamadoStatus;
  prioridade: ChamadoPrioridade;
  tecnico_id: string | null;
  hash_acesso: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  chamados_comentarios?: Array<{
    id: string;
    autor_nome: string;
    tipo: string;
    conteudo: string;
    created_at: string;
  }>;
}

const statusConfig: Record<ChamadoStatus, { label: string; color: string; icon: React.ElementType }> = {
  aberto: { label: 'Aberto', color: 'bg-blue-500/10 text-blue-600 border-blue-200', icon: AlertCircle },
  em_andamento: { label: 'Em Atendimento', color: 'bg-amber-500/10 text-amber-600 border-amber-200', icon: Clock },
  aguardando_cliente: { label: 'Aguardando Cliente', color: 'bg-purple-500/10 text-purple-600 border-purple-200', icon: User },
  resolvido: { label: 'Resolvido', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', icon: CheckCircle },
  fechado: { label: 'Fechado', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: XCircle },
};

const prioridadeConfig: Record<ChamadoPrioridade, { label: string; color: string; indicator: string }> = {
  baixa: { label: 'Baixa', color: 'bg-slate-100 text-slate-600', indicator: 'bg-slate-400' },
  media: { label: 'Média', color: 'bg-blue-100 text-blue-600', indicator: 'bg-blue-500' },
  alta: { label: 'Alta', color: 'bg-orange-100 text-orange-600', indicator: 'bg-orange-500' },
  urgente: { label: 'Urgente', color: 'bg-red-100 text-red-600', indicator: 'bg-red-500' },
};

const AdminChamados = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { logActivity } = useSystemActivities();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedChamado, setSelectedChamado] = useState<Chamado | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<"publico" | "interno">("publico");

  const { data: chamados, isLoading, refetch } = useQuery({
    queryKey: ['chamados', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('chamados')
        .select(`
          *,
          chamados_comentarios(id, autor_nome, autor_email, tipo, conteudo, created_at)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as ChamadoStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Chamado[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChamadoStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === 'fechado') {
        updateData.closed_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('chamados')
        .update(updateData)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      logActivity(`Atualizou status do chamado ${variables.id} para ${variables.status}`, 'duvida');
      toast.success('Status atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ chamadoId, conteudo, tipo }: { chamadoId: string; conteudo: string; tipo: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user?.id)
        .single();

      const { error } = await supabase
        .from('chamados_comentarios')
        .insert({
          chamado_id: chamadoId,
          autor_nome: profile?.name || user?.email || 'Técnico',
          autor_id: user?.id,
          tipo,
          conteudo,
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      setNewComment("");
      logActivity(`Comentou no chamado ${variables.chamadoId}`, 'duvida');
      toast.success('Comentário adicionado');
    },
    onError: (error) => {
      console.error('Error adding comment:', error);
      toast.error('Erro ao adicionar comentário');
    },
  });

  // Realtime subscription para comentários
  useEffect(() => {
    const channel = supabase
      .channel('chamados-comentarios-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chamados_comentarios'
        },
        (payload) => {
          console.log('Novo comentário recebido:', payload);
          // Atualizar os dados
          queryClient.invalidateQueries({ queryKey: ['chamados'] });
          
          // Se o comentário é de um cliente (não tem autor_id = técnico), mostrar alerta
          const newComment = payload.new as any;
          if (!newComment.autor_id) {
            toast.info(`💬 Novo comentário do cliente no chamado`, {
              description: newComment.conteudo?.substring(0, 50) + (newComment.conteudo?.length > 50 ? '...' : ''),
              duration: 5000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Verificar se um chamado tem resposta do cliente não lida
  const hasClientResponse = (chamado: Chamado) => {
    const comments = chamado.chamados_comentarios || [];
    if (comments.length === 0) return false;
    
    // Ordenar por data decrescente
    const sortedComments = [...comments].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Verificar se o último comentário é do cliente (não tem autor_id no tipo técnico)
    const lastComment = sortedComments[0];
    return lastComment && lastComment.tipo === 'publico' && !lastComment.autor_nome?.includes('Astros');
  };

  const filteredChamados = chamados?.filter(c => 
    c.codigo.toLowerCase().includes(search.toLowerCase()) ||
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.motivo.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: chamados?.length || 0,
    abertos: chamados?.filter(c => c.status === 'aberto').length || 0,
    emAndamento: chamados?.filter(c => c.status === 'em_andamento').length || 0,
    resolvidos: chamados?.filter(c => c.status === 'resolvido' || c.status === 'fechado').length || 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/admin')}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t('tickets.system')}</h1>
                <p className="text-sm text-muted-foreground">{t('tickets.systemDesc')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/config')}>
              <Settings className="h-4 w-4 mr-2" />
              {t('tickets.config')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/webhooks')}>
              <Webhook className="h-4 w-4 mr-2" />
              {t('tickets.webhooks')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/api')}>
              <Key className="h-4 w-4 mr-2" />
              {t('tickets.apiKeys')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/guia')}>
              <BookOpen className="h-4 w-4 mr-2" />
              {t('tickets.guide')}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-border/40 bg-card/50 hover:bg-card/80 transition-all hover:shadow-lg hover:shadow-blue-500/5 group">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{t('tickets.total')}</p>
                  <p className="text-3xl font-bold tracking-tight">{stats.total}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Ticket className="h-6 w-6 text-blue-500" />
                </div>
              </div>
              <div className="mt-4 h-1 w-full bg-blue-500/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 hover:bg-card/80 transition-all hover:shadow-lg hover:shadow-amber-500/5 group">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{t('tickets.open')}</p>
                  <p className="text-3xl font-bold tracking-tight text-amber-500">{stats.abertos}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
              <div className="mt-4 h-1 w-full bg-amber-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.total > 0 ? (stats.abertos / stats.total) * 100 : 0}%` }} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 hover:bg-card/80 transition-all hover:shadow-lg hover:shadow-purple-500/5 group">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{t('tickets.inProgress')}</p>
                  <p className="text-3xl font-bold tracking-tight text-purple-500">{stats.emAndamento}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock className="h-6 w-6 text-purple-500" />
                </div>
              </div>
              <div className="mt-4 h-1 w-full bg-purple-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.total > 0 ? (stats.emAndamento / stats.total) * 100 : 0}%` }} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 bg-card/50 hover:bg-card/80 transition-all hover:shadow-lg hover:shadow-emerald-500/5 group">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{t('tickets.resolved')}</p>
                  <p className="text-3xl font-bold tracking-tight text-emerald-500">{stats.resolvidos}</p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
              <div className="mt-4 h-1 w-full bg-emerald-500/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${stats.total > 0 ? (stats.resolvidos / stats.total) * 100 : 0}%` }} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Chamados */}
          <div className="lg:col-span-2">
            <Card className="border-border/40 bg-card/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{t('tickets.title')}</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      refetch();
                      toast.success("Lista de chamados atualizada");
                    }}
                    className="hover:bg-primary/10 transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
                  </Button>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('tickets.searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t('tickets.filterStatus')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('tickets.all')}</SelectItem>
                      <SelectItem value="aberto">{t('tickets.statusOpen')}</SelectItem>
                      <SelectItem value="em_andamento">{t('tickets.statusInProgress')}</SelectItem>
                      <SelectItem value="aguardando_cliente">{t('tickets.statusWaitingClient')}</SelectItem>
                      <SelectItem value="resolvido">{t('tickets.statusResolved')}</SelectItem>
                      <SelectItem value="fechado">{t('tickets.statusClosed')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center space-x-4 p-4 rounded-xl border border-border/40">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-[250px]" />
                          <Skeleton className="h-4 w-[200px]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredChamados?.length === 0 ? (
                  <div className="text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border/60">
                    <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Ticket className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{t('tickets.noTicketsFound')}</h3>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-1">
                      Não encontramos nenhum chamado com os filtros aplicados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredChamados?.map((chamado) => {
                      const statusInfo = statusConfig[chamado.status];
                      const StatusIcon = statusInfo.icon;
                      const prioridadeInfo = prioridadeConfig[chamado.prioridade];
                      const clientResponded = hasClientResponse(chamado);
                      
                      return (
                        <div
                          key={chamado.id}
                          onClick={() => setSelectedChamado(chamado)}
                          className={`group p-4 rounded-xl border transition-all relative overflow-hidden ${
                            selectedChamado?.id === chamado.id 
                              ? 'border-primary bg-primary/[0.03] shadow-sm' 
                              : 'border-border/40 hover:border-primary/30 hover:bg-muted/30'
                          }`}
                        >
                          {/* Priority Indicator Line */}
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${prioridadeInfo.indicator}`} />
                          
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2 mb-2">
                                <span className="text-[11px] font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  #{chamado.codigo}
                                </span>
                                <Badge variant="secondary" className={`${statusInfo.color} border font-semibold text-[10px] uppercase py-0 px-2 h-5`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo.label}
                                </Badge>
                                {clientResponded && (
                                  <span className="flex h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                                )}
                              </div>
                              
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                                {chamado.nome}
                                {clientResponded && (
                                  <Badge className="bg-orange-500 hover:bg-orange-600 text-[9px] h-4 px-1.5">NOVA RESPOSTA</Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground line-clamp-1 mt-1 font-medium italic">
                                "{chamado.motivo}"
                              </p>
                              
                              <div className="flex items-center gap-4 mt-3">
                                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {formatDistanceToNow(new Date(chamado.created_at), { addSuffix: true, locale: ptBR })}
                                </span>
                                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  {chamado.chamados_comentarios?.length || 0}
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-2">
                              <Badge variant="outline" className={`${prioridadeInfo.color} border-none font-bold text-[10px] px-2 py-0.5 rounded-full`}>
                                {prioridadeInfo.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Detalhes do Chamado */}
          <div>
            {selectedChamado ? (
              <Card className="border-border/40 bg-card/50 shadow-sm sticky top-24 overflow-hidden">
                <div className="h-1.5 w-full bg-primary/20">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${selectedChamado.status === 'resolvido' || selectedChamado.status === 'fechado' ? '100%' : '30%'}` }} 
                  />
                </div>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="font-mono text-[10px] text-primary bg-primary/5">
                      {selectedChamado.codigo}
                    </Badge>
                    <div className="flex gap-1">
                      {selectedChamado.status !== 'resolvido' && selectedChamado.status !== 'fechado' && (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-[10px] border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => updateStatusMutation.mutate({ id: selectedChamado.id, status: 'resolvido' })}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          RESOLVER
                        </Button>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold tracking-tight">{selectedChamado.nome}</CardTitle>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                      {selectedChamado.email}
                    </div>
                    <Separator orientation="vertical" className="h-3" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {selectedChamado.contato}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6 pt-0">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/40">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-primary/60" />
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assunto / Motivo</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedChamado.motivo}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-primary/60" />
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Linha do Tempo</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {selectedChamado.chamados_comentarios?.length || 0} interações
                      </Badge>
                    </div>

                    <ScrollArea className="h-[280px] pr-4 -mr-4">
                      <div className="space-y-4 pt-1">
                        {selectedChamado.chamados_comentarios?.length === 0 ? (
                          <div className="text-center py-8">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs text-muted-foreground italic">Nenhuma interação registrada ainda.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {selectedChamado.chamados_comentarios?.map((comment) => {
                              const isInternal = comment.tipo === 'interno';
                              const isTechnician = comment.autor_nome?.includes('Astros') || comment.tipo === 'interno';
                              
                              return (
                                <div key={comment.id} className={`flex flex-col ${isTechnician ? 'items-end' : 'items-start'}`}>
                                  <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                      {comment.autor_nome}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/60">
                                      {format(new Date(comment.created_at), "HH:mm")}
                                    </span>
                                  </div>
                                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm relative group ${
                                    isInternal 
                                      ? 'bg-amber-50 border border-amber-100 text-amber-900 rounded-tr-none' 
                                      : isTechnician 
                                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                        : 'bg-muted border border-border/40 text-foreground rounded-tl-none'
                                  }`}>
                                    {isInternal && (
                                      <div className="absolute -left-16 top-2 flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                        <Lock className="h-2.5 w-2.5" /> INTERNO
                                      </div>
                                    )}
                                    <p className="leading-relaxed">{comment.conteudo}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-4">
                    <Separator className="bg-border/40" />
                    
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">Status Atual</label>
                        <Select 
                          value={selectedChamado.status} 
                          onValueChange={(value) => updateStatusMutation.mutate({ 
                            id: selectedChamado.id, 
                            status: value as ChamadoStatus 
                          })}
                        >
                          <SelectTrigger className="h-9 text-sm bg-background border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="aberto">Aberto</SelectItem>
                            <SelectItem value="em_andamento">Em Atendimento</SelectItem>
                            <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                            <SelectItem value="resolvido">Resolvido</SelectItem>
                            <SelectItem value="fechado">Fechado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedChamado.status !== 'fechado' && selectedChamado.status !== 'resolvido' ? (
                      <div className="space-y-3 p-3 bg-muted/40 rounded-xl border border-border/40">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant={commentType === 'publico' ? 'default' : 'ghost'}
                              className={`h-7 text-[10px] px-3 ${commentType === 'publico' ? '' : 'text-muted-foreground'}`}
                              onClick={() => setCommentType('publico')}
                            >
                              <Eye className="h-3 w-3 mr-1.5" /> PÚBLICO
                            </Button>
                            <Button 
                              size="sm" 
                              variant={commentType === 'interno' ? 'secondary' : 'ghost'}
                              className={`h-7 text-[10px] px-3 ${commentType === 'interno' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'text-muted-foreground'}`}
                              onClick={() => setCommentType('interno')}
                            >
                              <Lock className="h-3 w-3 mr-1.5" /> INTERNO
                            </Button>
                          </div>
                        </div>
                        
                        <div className="relative">
                          <Input
                            placeholder={commentType === 'interno' ? "Adicionar nota interna..." : "Responder ao cliente..."}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="pr-10 bg-background border-border/60 focus-visible:ring-primary/20"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newComment.trim()) {
                                addCommentMutation.mutate({
                                  chamadoId: selectedChamado.id,
                                  conteudo: newComment.trim(),
                                  tipo: commentType,
                                });
                              }
                            }}
                          />
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-primary hover:bg-primary/10"
                            disabled={!newComment.trim() || addCommentMutation.isPending}
                            onClick={() => {
                              if (newComment.trim()) {
                                addCommentMutation.mutate({
                                  chamadoId: selectedChamado.id,
                                  conteudo: newComment.trim(),
                                  tipo: commentType,
                                });
                              }
                            }}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground text-center">
                          {commentType === 'interno' 
                            ? "Notas internas são visíveis apenas para a equipe." 
                            : "A resposta pública será enviada por e-mail ao cliente."}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-muted/50 rounded-xl text-center border border-dashed border-border/60">
                        <Lock className="h-5 w-5 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium text-muted-foreground">
                          {selectedChamado.status === 'resolvido' 
                            ? 'Chamado resolvido. Reabra para comentar.' 
                            : 'Chamado fechado para novas interações.'}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/40 bg-card/50 border-dashed py-32 text-center group hover:bg-card/80 transition-all">
                <CardContent>
                  <div className="relative mx-auto w-20 h-20 mb-6">
                    <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping" />
                    <div className="relative h-full w-full bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                      <Ticket className="h-10 w-10 text-primary opacity-60 group-hover:scale-110 transition-transform" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Aguardando Seleção</h3>
                  <p className="text-sm text-muted-foreground max-w-[220px] mx-auto mt-2">
                    Selecione um chamado da lista ao lado para gerenciar o atendimento e responder ao cliente.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminChamados;
