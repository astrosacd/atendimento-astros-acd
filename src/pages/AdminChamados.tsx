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
  Bell
} from "lucide-react";
import { format } from "date-fns";
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
  aberto: { label: 'Aberto', color: 'bg-blue-500/10 text-blue-500 border-blue-500/30', icon: AlertCircle },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30', icon: Clock },
  aguardando_cliente: { label: 'Aguardando Cliente', color: 'bg-purple-500/10 text-purple-500 border-purple-500/30', icon: User },
  resolvido: { label: 'Resolvido', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30', icon: CheckCircle },
  fechado: { label: 'Fechado', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

const prioridadeConfig: Record<ChamadoPrioridade, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'bg-slate-500/10 text-slate-500' },
  media: { label: 'Média', color: 'bg-blue-500/10 text-blue-500' },
  alta: { label: 'Alta', color: 'bg-orange-500/10 text-orange-500' },
  urgente: { label: 'Urgente', color: 'bg-red-500/10 text-red-500' },
};

const AdminChamados = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chamados'] });
      setNewComment("");
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
                <h1 className="text-xl font-bold text-foreground">Sistema de Chamados</h1>
                <p className="text-sm text-muted-foreground">Gerencie os chamados dos clientes</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/config')}>
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/webhooks')}>
              <Webhook className="h-4 w-4 mr-2" />
              Webhooks
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/api')}>
              <Key className="h-4 w-4 mr-2" />
              API Keys
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin/chamados/guia')}>
              <BookOpen className="h-4 w-4 mr-2" />
              Guia
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Ticket className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Abertos</p>
                  <p className="text-2xl font-bold">{stats.abertos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                  <p className="text-2xl font-bold">{stats.emAndamento}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/40 bg-card/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Resolvidos</p>
                  <p className="text-2xl font-bold">{stats.resolvidos}</p>
                </div>
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
                  <CardTitle>Chamados</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código, nome, email..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="aberto">Aberto</SelectItem>
                      <SelectItem value="em_andamento">Em Andamento</SelectItem>
                      <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                      <SelectItem value="resolvido">Resolvido</SelectItem>
                      <SelectItem value="fechado">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredChamados?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum chamado encontrado
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
                          className={`p-4 rounded-lg border cursor-pointer transition-all relative ${
                            selectedChamado?.id === chamado.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border/40 hover:border-primary/50 hover:bg-muted/30'
                          } ${clientResponded ? 'ring-2 ring-orange-500/50' : ''}`}
                        >
                          {/* Alerta de resposta do cliente */}
                          {clientResponded && (
                            <div className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full p-1 animate-pulse">
                              <Bell className="h-3 w-3" />
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-semibold text-primary">
                                  {chamado.codigo}
                                </span>
                                <Badge variant="outline" className={prioridadeInfo.color}>
                                  {prioridadeInfo.label}
                                </Badge>
                                {clientResponded && (
                                  <Badge className="bg-orange-500 text-white text-xs">
                                    Cliente respondeu
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium truncate">{chamado.nome}</p>
                              <p className="text-sm text-muted-foreground truncate">{chamado.motivo}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {chamado.email}
                                </span>
                                <span>
                                  {format(new Date(chamado.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className={statusInfo.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
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
              <Card className="border-border/40 bg-card/50 sticky top-24">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Detalhes</CardTitle>
                    <span className="font-mono text-sm text-primary">{selectedChamado.codigo}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Cliente</label>
                    <p className="font-medium">{selectedChamado.nome}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Mail className="h-3 w-3" /> Email
                    </label>
                    <p className="text-sm break-all">{selectedChamado.email}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Contato
                    </label>
                    <p className="text-sm">{selectedChamado.contato}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Motivo</label>
                    <p className="text-sm mt-1 p-3 bg-muted/50 rounded-lg">{selectedChamado.motivo}</p>
                  </div>
                  
                  {/* Status Update */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider">Atualizar Status</label>
                    <Select 
                      value={selectedChamado.status} 
                      onValueChange={(value) => updateStatusMutation.mutate({ 
                        id: selectedChamado.id, 
                        status: value as ChamadoStatus 
                      })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="aguardando_cliente">Aguardando Cliente</SelectItem>
                        <SelectItem value="resolvido">Resolvido</SelectItem>
                        <SelectItem value="fechado">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Comentários
                    </label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                      {selectedChamado.chamados_comentarios?.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">Nenhum comentário</p>
                      ) : (
                        selectedChamado.chamados_comentarios?.map((comment) => (
                          <div 
                            key={comment.id} 
                            className={`p-2 rounded text-sm ${
                              comment.tipo === 'interno' 
                                ? 'bg-amber-500/10 border border-amber-500/30' 
                                : 'bg-muted/50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span className="font-medium">{comment.autor_nome}</span>
                              <span>{format(new Date(comment.created_at), "dd/MM HH:mm")}</span>
                            </div>
                            <p>{comment.conteudo}</p>
                            {comment.tipo === 'interno' && (
                              <Badge variant="outline" className="mt-1 text-xs bg-amber-500/10 text-amber-500">
                                Interno
                              </Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Comment */}
                  {selectedChamado.status !== 'fechado' && selectedChamado.status !== 'resolvido' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Select value={commentType} onValueChange={(v) => setCommentType(v as "publico" | "interno")}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="publico">Público</SelectItem>
                            <SelectItem value="interno">Interno</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Adicionar comentário..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
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
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full"
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
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Enviar Comentário
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/50 rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        {selectedChamado.status === 'resolvido' 
                          ? 'Chamado resolvido - comentários bloqueados' 
                          : 'Chamado fechado - comentários bloqueados'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border/40 bg-card/50">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione um chamado para ver os detalhes</p>
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
