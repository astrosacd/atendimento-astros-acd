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
import { usePermissions } from '@/hooks/usePermissions';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  ExternalLink,
  Plus,
  Building2,
  ShieldAlert
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
  is_internal: boolean;
  setor: string | null;
  cliente_id: string | null;
  criado_por: string | null;
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
  baixa: { label: 'Baixa', color: 'bg-slate-500/10 text-slate-400', indicator: 'bg-slate-400' },
  media: { label: 'Média', color: 'bg-blue-500/10 text-blue-400', indicator: 'bg-blue-500' },
  alta: { label: 'Alta', color: 'bg-orange-500/10 text-orange-400', indicator: 'bg-orange-500' },
  urgente: { label: 'Urgente', color: 'bg-red-500/10 text-red-400', indicator: 'bg-red-500' },
};

const setoresInternal = ['TI', 'Financeiro', 'Suporte', 'Vendas', 'Outros'];

const AdminChamados = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { logActivity } = useSystemActivities();
  const { canCreateChamados, canManageChamadosConfig, canManageChamadosWebhooks, canManageChamadosApi } = usePermissions();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedChamado, setSelectedChamado] = useState<Chamado | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<"publico" | "interno">("publico");
  const [typeFilter, setTypeFilter] = useState<string>("all"); // all, internal, public
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newChamado, setNewChamado] = useState({
    nome: "",
    email: "",
    contato: "",
    motivo: "",
    prioridade: "media" as ChamadoPrioridade,
    setor: "TI",
    cliente_id: "none"
  });

  const { data: clients } = useQuery({
    queryKey: ['clients-for-tickets'],
    queryFn: async () => {
      const pageSize = 1000;
      const allClients: Array<{ id: string; nome: string; email: string | null; numero: string; tipo: string | null; cobranca_ativa: boolean; ciclo_cobranca: string }> = [];

      for (let page = 0; page < 20; page++) {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nome, email, numero, tipo, cobranca_ativa, ciclo_cobranca')
          .order('nome')
          .range(page * pageSize, page * pageSize + pageSize - 1);

        if (error) throw error;
        allClients.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }

      return allClients;
    }
  });

  const [openClientSearch, setOpenClientSearch] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  const getClientBillingLabel = (client?: { cobranca_ativa?: boolean | null }) => {
    if (!client) return "";
    return client.cobranca_ativa === false ? "Registro" : "Mensal";
  };

  const getClientBillingClasses = (client?: { cobranca_ativa?: boolean | null }) =>
    client?.cobranca_ativa === false
      ? "bg-amber-500/15 text-amber-500"
      : "bg-emerald-500/15 text-emerald-500";

  const handleClientSelect = (clientId: string) => {
    if (clientId === 'none') {
      setNewChamado({
        ...newChamado,
        cliente_id: 'none',
        nome: "",
        email: "",
        contato: ""
      });
      setOpenClientSearch(false);
      setClientSearch("");
      return;
    }

    const client = clients?.find(c => c.id === clientId);
    if (client) {
      setNewChamado({
        ...newChamado,
        cliente_id: clientId,
        nome: client.nome,
        email: client.email || "",
        contato: client.numero || ""
      });
      setOpenClientSearch(false);
      setClientSearch("");
    }
  };

  const { data: chamados, isLoading, refetch } = useQuery({
    queryKey: ['chamados', statusFilter, typeFilter],
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

      if (typeFilter === 'internal') {
        query = query.eq('is_internal', true);
      } else if (typeFilter === 'public') {
        query = query.eq('is_internal', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Chamado[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ChamadoStatus }) => {
      const updateData: Record<string, unknown> = { status };
      // Encerramento = resolvido OU fechado. Reabertura limpa a data.
      if (status === 'fechado' || status === 'resolvido') {
        updateData.closed_at = new Date().toISOString();
      } else {
        updateData.closed_at = null;
      }
      const { error } = await supabase.from('chamados').update(updateData as never).eq('id', id);
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

  const createInternalTicketMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('api-chamados', {
        method: 'POST',
        body: {
          ...newChamado,
          cliente_id: newChamado.cliente_id === 'none' ? null : newChamado.cliente_id,
          is_internal: true,
          criado_por: user?.id
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      setIsDialogOpen(false);
      setNewChamado({
        nome: "",
        email: "",
        contato: "",
        motivo: "",
        prioridade: "media",
        setor: "TI",
        cliente_id: "none"
      });
      toast.success('Chamado interno criado com sucesso');
      logActivity(`Criou um novo chamado interno para ${newChamado.nome}`, 'duvida');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar chamado: ' + error.message);
    }
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    createInternalTicketMutation.mutate();
  };
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

  const filteredChamados = chamados?.filter(c => {
    const term = search.toLowerCase();
    return (
      c.codigo.toLowerCase().includes(term) ||
      c.nome.toLowerCase().includes(term) ||
      c.email.toLowerCase().includes(term) ||
      (c.setor && c.setor.toLowerCase().includes(term))
    );
  });

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
          {canCreateChamados() && (
            <Button onClick={() => setIsDialogOpen(true)} className="shadow-lg shadow-primary/20 gap-2">
              <Plus className="h-4 w-4" /> Novo Chamado
            </Button>
          )}
          {canManageChamadosConfig() && (
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/config')} className="border-border/40 hover:bg-primary/5">
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/guia')} className="border-border/40 hover:bg-primary/5">
            <BookOpen className="h-4 w-4 mr-2" /> Guia
          </Button>
        </div>
      </header>

        <div className="w-full max-w-none 2xl:max-w-[1800px] mx-auto">
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


        <div className="grid grid-cols-1 lg:grid-cols-[minmax(500px,0.9fr)_minmax(0,1.35fr)] gap-8 items-start">
          <div className="space-y-4 min-w-0">
            <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Pesquisar chamados..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 border-border/40 bg-background/50" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-10 border-border/40 bg-background/50"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Status</SelectItem>
                      <SelectItem value="aberto">Abertos</SelectItem>
                      <SelectItem value="em_andamento">Em Atendimento</SelectItem>
                      <SelectItem value="resolvido">Resolvidos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[140px] h-10 border-border/40 bg-background/50"><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos Tipos</SelectItem>
                      <SelectItem value="internal">Internos</SelectItem>
                      <SelectItem value="public">Públicos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[680px] pr-2">
                  {isLoading ? <div className="space-y-4"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div> : (
                    <div className="space-y-3">
                      <AnimatePresence>
                        {filteredChamados?.map(c => {
                          const conf = statusConfig[c.status];
                          const selected = selectedChamado?.id === c.id;
                          return (
                            <motion.div key={c.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setSelectedChamado(c)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all w-full overflow-hidden ${selected ? 'border-primary bg-primary/10' : 'border-border/40 bg-background/30 hover:border-primary/30'}`}>
                              <div className="flex justify-between items-start gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                                    <span className="text-[10px] font-bold text-muted-foreground font-mono whitespace-nowrap">#{c.codigo}</span>
                                    {c.is_internal && (
                                      <Badge className="bg-amber-500/20 text-amber-500 border-none font-bold text-[9px] uppercase px-1.5 py-0 h-4 flex items-center gap-1 whitespace-nowrap">
                                        <Lock className="h-2 w-2" /> Interno
                                      </Badge>
                                    )}
                                    {c.setor && <Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 text-primary px-1.5 py-0 h-4 whitespace-nowrap">{c.setor}</Badge>}
                                    <Badge className={`${conf.bg} ${conf.color} border-none font-bold text-[9px] uppercase px-1.5 py-0 h-4 whitespace-nowrap`}>{conf.label}</Badge>
                                    {hasClientResponse(c) && <Badge className="bg-orange-500 text-white animate-pulse text-[9px] px-1.5 py-0 h-4 whitespace-nowrap">NOVA</Badge>}
                                  </div>
                                  <h4 className="font-bold text-foreground truncate">{c.nome}</h4>
                                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{c.motivo}</p>
                                </div>
                                <Badge variant="outline" className="text-[9px] uppercase font-bold whitespace-nowrap shrink-0">{prioridadeConfig[c.prioridade].label}</Badge>
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

          <div className="h-fit lg:sticky lg:top-24 min-w-0">
            {selectedChamado ? (
              <Card className="border-border/40 bg-card/60 backdrop-blur-md shadow-2xl overflow-hidden border-2 flex flex-col min-h-[760px] lg:h-[calc(100vh-140px)]">
                <div className="h-1.5 w-full bg-border/20 shrink-0"><motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: '100%' }} /></div>
                <CardHeader className="pb-4 shrink-0">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-[10px] font-bold text-primary">{selectedChamado.codigo}</Badge>
                    {selectedChamado.status !== 'resolvido' && selectedChamado.status !== 'fechado' && (
                      <Button size="sm" variant="outline" className="h-7 text-[10px] font-bold border-emerald-200 text-emerald-600 hover:bg-emerald-50" onClick={() => updateStatusMutation.mutate({ id: selectedChamado.id, status: 'resolvido' })}>RESOLVER</Button>
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold">{selectedChamado.nome}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1"><Mail className="h-3 w-3" />{selectedChamado.email}</p>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
                  <div className="p-4 rounded-xl bg-background/50 border border-border/40 shrink-0"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Motivo</p><p className="text-sm text-foreground font-medium whitespace-pre-wrap line-clamp-3">{selectedChamado.motivo}</p></div>
                  <div className="flex-1 min-h-0 flex flex-col gap-3">
                    <div className="flex justify-between items-center shrink-0"><h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conversa</h3><Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">{selectedChamado.chamados_comentarios?.length || 0} interações</Badge></div>
                    <ScrollArea className="flex-1 min-h-0 pr-4">
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
                  {(selectedChamado.status === 'resolvido' || selectedChamado.status === 'fechado') ? (
                    <div className="shrink-0 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-3 flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Lock className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Chamado Encerrado</p>
                        <p className="text-[11px] text-muted-foreground">Status <span className="font-bold">{statusConfig[selectedChamado.status].label}</span> — não pode ser alterado.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="shrink-0 space-y-3 pt-3 border-t border-border/40">
                      <div className="flex gap-2">
                        <Button size="sm" variant={commentType === 'publico' ? 'default' : 'ghost'} className="h-7 text-[10px] font-bold" onClick={() => setCommentType('publico')}><Eye className="h-3 w-3 mr-1" /> PÚBLICO</Button>
                        <Button size="sm" variant={commentType === 'interno' ? 'secondary' : 'ghost'} className="h-7 text-[10px] font-bold" onClick={() => setCommentType('interno')}><Lock className="h-3 w-3 mr-1" /> INTERNO</Button>
                      </div>
                      <div className="relative">
                        <Input 
                          placeholder="Escreva aqui..." 
                          value={newComment} 
                          onChange={(e) => setNewComment(e.target.value)} 
                          className="pr-10 h-11 rounded-xl bg-background/50 border-border/40" 
                          onKeyDown={e => e.key === 'Enter' && newComment.trim() && addCommentMutation.mutate({ chamadoId: selectedChamado.id, conteudo: newComment, tipo: commentType })} 
                        />
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="absolute right-1 top-1 h-9 w-9 text-primary" 
                          disabled={!newComment.trim()}
                          onClick={() => newComment.trim() && addCommentMutation.mutate({ chamadoId: selectedChamado.id, conteudo: newComment, tipo: commentType })}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <Select 
                        value={selectedChamado.status} 
                        onValueChange={v => updateStatusMutation.mutate({ id: selectedChamado.id, status: v as any })}
                      >
                        <SelectTrigger className="h-10 text-xs font-bold bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/40">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Abrir Chamado Interno
            </DialogTitle>
            <DialogDescription>
              Crie um chamado para ser acompanhado por outra equipe internamente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Cliente / Assunto</Label>
                <Input 
                  placeholder="Ex: Suporte TI - João" 
                  value={newChamado.nome} 
                  onChange={e => setNewChamado({...newChamado, nome: e.target.value})}
                  required
                  disabled={newChamado.cliente_id !== 'none'}
                />
              </div>
              <div className="space-y-2">
                <Label>Email para Referência</Label>
                <Input 
                  type="email" 
                  placeholder="cliente@email.com" 
                  value={newChamado.email} 
                  onChange={e => setNewChamado({...newChamado, email: e.target.value})}
                  required
                  disabled={newChamado.cliente_id !== 'none'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contato (WhatsApp)</Label>
                <Input 
                  placeholder="(11) 99999-9999" 
                  value={newChamado.contato} 
                  onChange={e => setNewChamado({...newChamado, contato: e.target.value})}
                  required
                  disabled={newChamado.cliente_id !== 'none'}
                />
              </div>
              <div className="space-y-2">
                <Label>Setor Responsável</Label>
                <Select value={newChamado.setor} onValueChange={v => setNewChamado({...newChamado, setor: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {setoresInternal.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vincular Cliente (Opcional)</Label>
                {newChamado.cliente_id !== "none" && (() => {
                  const selectedClient = clients?.find((c) => c.id === newChamado.cliente_id);
                  return selectedClient ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/40 px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Tipo no banco:</span>
                      <Badge className={cn("text-[9px] font-bold uppercase border-none", getClientBillingClasses(selectedClient))}>
                        {getClientBillingLabel(selectedClient)}
                      </Badge>
                    </div>
                  ) : null;
                })()}
                <Popover open={openClientSearch} onOpenChange={setOpenClientSearch}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      type="button"
                      role="combobox"
                      aria-expanded={openClientSearch}
                      className="w-full h-auto min-h-11 justify-between font-normal bg-background/50 border-border/40 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {newChamado.cliente_id !== "none"
                          ? clients?.find((c) => c.id === newChamado.cliente_id)?.nome
                          : "Pesquisar/selecionar cliente..."}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="bottom"
                    align="start"
                    sideOffset={8}
                    collisionPadding={24}
                    className="w-[min(92vw,560px)] p-0 bg-popover border-border"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Pesquisar cliente por nome..." 
                        value={clientSearch}
                        onValueChange={setClientSearch}
                        className="h-12"
                      />
                      <CommandList className="max-h-[220px] overflow-y-auto overscroll-contain">
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => handleClientSelect("none")}
                            className="data-[selected=true]:bg-muted/50"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                newChamado.cliente_id === "none" ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="text-muted-foreground italic">Nenhum cliente vinculado</span>
                          </CommandItem>
                          {clients?.filter(client => 
                            client.nome.toLowerCase().includes(clientSearch.toLowerCase()) || 
                            client.email?.toLowerCase().includes(clientSearch.toLowerCase()) ||
                            client.numero?.toLowerCase().includes(clientSearch.toLowerCase())
                          ).map((client) => (
                              <CommandItem
                                key={client.id}
                                value={client.id}
                                onSelect={() => handleClientSelect(client.id)}
                                className="flex items-center gap-3 py-3"
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4 shrink-0",
                                    newChamado.cliente_id === client.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium truncate">{client.nome}</p>
                                  {client.email && (
                                    <p className="text-[10px] text-muted-foreground truncate">{client.email}</p>
                                  )}
                                </div>
                                <Badge
                                  className={cn(
                                    "text-[9px] font-bold uppercase shrink-0 border-none",
                                    getClientBillingClasses(client)
                                  )}
                                >
                                  {getClientBillingLabel(client)}
                                </Badge>
                              </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={newChamado.prioridade} onValueChange={v => setNewChamado({...newChamado, prioridade: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(prioridadeConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descrição / Motivo</Label>
              <Textarea 
                placeholder="Detalhes do problema ou observação..." 
                className="min-h-[100px]"
                value={newChamado.motivo}
                onChange={e => setNewChamado({...newChamado, motivo: e.target.value})}
                required
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createInternalTicketMutation.isPending}>
                {createInternalTicketMutation.isPending ? "Criando..." : "Criar Chamado Interno"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
};

export default AdminChamados;
