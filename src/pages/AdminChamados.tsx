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
import { DashboardLayout } from '@/components/DashboardLayout';
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
  Calendar,
  Filter,
  ArrowUpRight,
  ExternalLink
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

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

const statusConfig: Record<ChamadoStatus, { label: string; color: string; icon: any; bg: string }> = {
  aberto: { label: 'Aberto', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: AlertCircle },
  em_andamento: { label: 'Em Atendimento', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: Clock },
  aguardando_cliente: { label: 'Aguardando Cliente', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: User },
  resolvido: { label: 'Resolvido', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
  fechado: { label: 'Fechado', color: 'text-slate-400', bg: 'bg-slate-500/10', icon: XCircle },
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
      if (status === 'fechado') updateData.closed_at = new Date().toISOString();
      const { error } = await supabase.from('chamados').update(updateData).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      logActivity(`Atualizou status do chamado ${variables.id} para ${variables.status}`, 'duvida');
      toast.success('Status atualizado');
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ chamadoId, conteudo, tipo }: { chamadoId: string; conteudo: string; tipo: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('profiles').select('name').eq('user_id', user?.id).single();
      const { error } = await supabase.from('chamados_comentarios').insert({
        chamado_id: chamadoId,
        autor_nome: profile?.name || user?.email || 'Técnico',
        autor_id: user?.id,
        tipo,
        conteudo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      setNewComment("");
      toast.success('Comentário enviado');
    },
  });

  useEffect(() => {
    const channel = supabase.channel('chamados-realtime').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chamados_comentarios' }, (payload) => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      const newC = payload.new as any;
      if (!newC.autor_id) {
        toast.info(`Novo comentário no chamado`, { description: newC.conteudo?.substring(0, 40) + '...' });
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const hasClientResponse = (chamado: Chamado) => {
    const comments = chamado.chamados_comentarios || [];
    if (comments.length === 0) return false;
    const last = [...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return last && last.tipo === 'publico' && !last.autor_nome?.includes('Astros');
  };

  const filteredChamados = chamados?.filter(c => 
    c.codigo.toLowerCase().includes(search.toLowerCase()) ||
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: chamados?.length || 0,
    abertos: chamados?.filter(c => c.status === 'aberto').length || 0,
    emAndamento: chamados?.filter(c => c.status === 'em_andamento').length || 0,
    resolvidos: chamados?.filter(c => c.status === 'resolvido' || c.status === 'fechado').length || 0,
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="rounded-full hover:bg-primary/10 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Ticket className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Central de Atendimento</h1>
              <p className="text-sm text-muted-foreground">Gerencie seus chamados e suporte</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/config')} className="border-border/40 hover:bg-primary/5">
            <Settings className="h-4 w-4 mr-2" /> Configurações
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/guia')} className="border-border/40 hover:bg-primary/5">
            <BookOpen className="h-4 w-4 mr-2" /> Guia
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {[
            { label: 'Total', value: stats.total, icon: Ticket, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', textColor: 'text-blue-500' },
            { label: 'Abertos', value: stats.abertos, icon: AlertCircle, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', textColor: 'text-amber-500' },
            { label: 'Em Andamento', value: stats.emAndamento, icon: Clock, iconBg: 'bg-purple-500/10', iconColor: 'text-purple-500', textColor: 'text-purple-500' },
            { label: 'Resolvidos', value: stats.resolvidos, icon: CheckCircle, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', textColor: 'text-emerald-500' }
          ].map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-border/40 bg-card/50 backdrop-blur-sm hover:border-primary/20 transition-all">
                <CardContent className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                      <p className={`text-3xl font-extrabold mt-1 ${s.textColor}`}>{s.value}</p>
                    </div>
                    <div className={`h-12 w-12 rounded-2xl ${s.iconBg} flex items-center justify-center`}>
                      <s.icon className={`h-6 w-6 ${s.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>


        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-4">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar chamados..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 border-border/40 bg-background/50" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px] h-10 border-border/40 bg-background/50"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Status</SelectItem>
                      <SelectItem value="aberto">Abertos</SelectItem>
                      <SelectItem value="em_andamento">Em Atendimento</SelectItem>
                      <SelectItem value="resolvido">Resolvidos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {isLoading ? <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {filteredChamados?.map(c => {
                          const conf = statusConfig[c.status];
                          const selected = selectedChamado?.id === c.id;
                          return (
                            <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setSelectedChamado(c)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-primary bg-primary/10' : 'border-border/40 bg-background/30 hover:border-primary/30'}`}>
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="text-[10px] font-bold text-muted-foreground font-mono">#{c.codigo}</span>
                                    <Badge className={`${conf.bg} ${conf.color} border-none font-bold text-[9px] uppercase px-2`}>{conf.label}</Badge>
                                    {hasClientResponse(c) && <Badge className="bg-orange-500 text-white animate-pulse text-[9px]">NOVA RESPOSTA</Badge>}
                                  </div>
                                  <h4 className="font-bold text-foreground">{c.nome}</h4>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{c.motivo}</p>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase font-bold">{prioridadeConfig[c.prioridade].label}</Badge>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-7 h-fit lg:sticky lg:top-24">
            {selectedChamado ? (
              <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden border-2">
                <div className="h-1.5 w-full bg-border/20"><motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: '100%' }} /></div>
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-[10px] font-bold text-primary">{selectedChamado.codigo}</Badge>
                    {selectedChamado.status !== 'resolvido' && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => updateStatusMutation.mutate({ id: selectedChamado.id, status: 'resolvido' })}>RESOLVER</Button>
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold">{selectedChamado.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1"><Mail className="h-3 w-3" />{selectedChamado.email}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 rounded-xl bg-background/50 border border-border/40"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Motivo</p><p className="text-sm text-foreground font-medium whitespace-pre-wrap">{selectedChamado.motivo}</p></div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center"><h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conversa</h3><Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">{selectedChamado.chamados_comentarios?.length || 0} interações</Badge></div>
                    <ScrollArea className="h-[300px] pr-4">
                      <div className="space-y-4">
                        {selectedChamado.chamados_comentarios?.map(comm => {
                          const isTech = comm.tipo === 'interno' || comm.autor_nome?.includes('Astros');
                          return (
                            <div key={comm.id} className={`flex flex-col ${isTech ? 'items-end' : 'items-start'}`}>
                              <span className="text-[9px] font-bold text-muted-foreground uppercase mb-1 px-1">{comm.autor_nome}</span>
                              <div className={`p-3 rounded-2xl text-sm max-w-[90%] ${isTech ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-muted/50 text-foreground rounded-tl-none'} ${comm.tipo === 'interno' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : ''}`}>
                                {comm.tipo === 'interno' && <Lock className="h-3 w-3 inline mr-2" />}
                                {comm.conteudo}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-border/40">
                    <div className="flex gap-2">
                      <Button size="sm" variant={commentType === 'publico' ? 'default' : 'ghost'} className="h-7 text-[10px] font-bold" onClick={() => setCommentType('publico')}><Eye className="h-3 w-3 mr-1" /> PÚBLICO</Button>
                      <Button size="sm" variant={commentType === 'interno' ? 'secondary' : 'ghost'} className="h-7 text-[10px] font-bold" onClick={() => setCommentType('interno')}><Lock className="h-3 w-3 mr-1" /> INTERNO</Button>
                    </div>
                    <div className="relative">
                      <Input 
                        placeholder={selectedChamado.status === 'resolvido' ? "Chamado resolvido - Chat desativado" : "Escreva aqui..."} 
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)} 
                        className="pr-10 h-11 rounded-xl bg-background/50 border-border/40" 
                        disabled={selectedChamado.status === 'resolvido'}
                        onKeyDown={e => e.key === 'Enter' && newComment.trim() && addCommentMutation.mutate({ chamadoId: selectedChamado.id, conteudo: newComment, tipo: commentType })} 
                      />
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="absolute right-1 top-1 h-9 w-9 text-primary" 
                        disabled={selectedChamado.status === 'resolvido' || !newComment.trim()}
                        onClick={() => newComment.trim() && addCommentMutation.mutate({ chamadoId: selectedChamado.id, conteudo: newComment, tipo: commentType })}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Select 
                        value={selectedChamado.status} 
                        onValueChange={v => updateStatusMutation.mutate({ id: selectedChamado.id, status: v as any })}
                        disabled={selectedChamado.status === 'resolvido'}
                      >
                        <SelectTrigger className="h-10 text-xs font-bold bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k} disabled={selectedChamado.status === 'resolvido' && k !== 'resolvido'}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/40 bg-card/40 backdrop-blur-md border-2 border-dashed">
                <CardContent className="h-[600px] flex flex-col items-center justify-center p-12 text-center">
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center shadow-lg mb-6">
                    <Ticket className="h-8 w-8 text-primary/40" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Nenhum Chamado Selecionado</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-[200px]">Selecione um chamado da lista para ver os detalhes e responder.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
};

export default AdminChamados;
