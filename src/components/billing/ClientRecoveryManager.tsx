import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { RecoveryWebhooksManager } from '@/components/billing/RecoveryWebhooksManager';
import { 
  Sparkles, 
  Send, 
  History, 
  Phone, 
  Mail, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  Search,
  UserPlus,
  TrendingUp,
  Clock,
  MessageSquare,
  ShoppingBag,
  Users,
  Webhook
} from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  email: string;
  numero: string;
  produto: string;
  plano: string | null;
  valor: number;
  moeda: string;
  data_renovacao: string;
  cobranca_ativa: boolean;
}

interface RecoveryAttempt {
  id: string;
  cliente_id: string;
  data_vencimento: string;
  data_envio: string;
  mensagem_enviada: string;
  canal: string;
  status: string;
  converteu: boolean | null;
  error_message?: string | null;
  clientes?: {
    nome: string;
    produto: string;
    numero: string;
    email: string;
  };
}

export const ClientRecoveryManager = () => {
  const { toast } = useToast();
  const [overdueClients, setOverdueClients] = useState<Cliente[]>([]);
  const [registroClients, setRegistroClients] = useState<Cliente[]>([]);
  const [recoveryHistory, setRecoveryHistory] = useState<RecoveryAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRegistro, setIsLoadingRegistro] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Cliente | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchQueryRegistro, setSearchQueryRegistro] = useState('');
  const [searchQueryHistory, setSearchQueryHistory] = useState('');
  const [activeTab, setActiveTab] = useState('clients');
  const [isNewSaleMode, setIsNewSaleMode] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ attemptId: string; converted: boolean } | null>(null);
  const [confirmReason, setConfirmReason] = useState('');

  useEffect(() => {
    loadOverdueClients();
    loadRegistroClients();
    loadRecoveryHistory();
  }, []);

  const loadOverdueClients = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, numero, produto, plano, valor, moeda, data_renovacao, cobranca_ativa')
        .eq('cobranca_ativa', true)
        .lt('data_renovacao', thirtyDaysAgo.toISOString().split('T')[0])
        .order('data_renovacao', { ascending: true });

      if (error) throw error;
      setOverdueClients(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar clientes',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRegistroClients = async () => {
    setIsLoadingRegistro(true);
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, email, numero, produto, plano, valor, moeda, data_renovacao, cobranca_ativa')
        .eq('cobranca_ativa', false)
        .order('data_renovacao', { ascending: false });

      if (error) throw error;
      setRegistroClients(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar clientes registro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRegistro(false);
    }
  };

  const loadRecoveryHistory = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('client-recovery', {
        body: { action: 'get-history' },
      });

      if (error) throw error;
      setRecoveryHistory(data.history || []);
    } catch (error: any) {
      console.error('Error loading history:', error);
    }
  };

  const generateMessage = async (cliente: Cliente, forNewSale: boolean = false) => {
    setSelectedClient(cliente);
    setIsGenerating(true);
    setIsDialogOpen(true);
    setGeneratedMessage('');
    setIsNewSaleMode(forNewSale);

    try {
      const { data, error } = await supabase.functions.invoke('client-recovery', {
        body: { 
          action: forNewSale ? 'generate-new-sale-message' : 'generate-message',
          clienteId: cliente.id 
        },
      });

      if (error) throw error;
      setGeneratedMessage(data.message);
      
      if (data.usedAI) {
        toast({
          title: 'Mensagem gerada com IA',
          description: 'A mensagem foi personalizada automaticamente.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar mensagem',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendRecoveryMessage = async () => {
    if (!selectedClient || !generatedMessage) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-recovery', {
        body: { 
          action: 'send-recovery',
          clienteId: selectedClient.id,
          message: generatedMessage,
          channel: selectedChannel,
          isNewSale: isNewSaleMode,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Mensagem enviada!',
          description: `Recuperação enviada via ${selectedChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}`,
        });
        setIsDialogOpen(false);
        loadRecoveryHistory();
      } else {
        toast({
          title: 'Erro ao enviar',
          description: data.error || 'Falha no envio',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    try {
      const { error } = await supabase.functions.invoke('client-recovery', {
        body: { 
          action: 'mark-converted',
          attemptId: confirmAction.attemptId,
          converted: confirmAction.converted,
        },
      });

      if (error) throw error;
      
      toast({
        title: confirmAction.converted ? 'Marcado como convertido!' : 'Marcado como não convertido',
        description: confirmReason || undefined,
      });
      setConfirmAction(null);
      setConfirmReason('');
      loadRecoveryHistory();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getDaysOverdue = (dataRenovacao: string) => {
    const today = new Date();
    const renovacao = new Date(dataRenovacao);
    return Math.floor((today.getTime() - renovacao.getTime()) / (1000 * 60 * 60 * 24));
  };

  const filteredClients = overdueClients.filter(c =>
    c.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.numero.includes(searchQuery) ||
    c.produto.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRegistroClients = registroClients.filter(c =>
    c.nome.toLowerCase().includes(searchQueryRegistro.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQueryRegistro.toLowerCase()) ||
    c.numero.includes(searchQueryRegistro) ||
    c.produto.toLowerCase().includes(searchQueryRegistro.toLowerCase())
  );

  // Per-client recovery stats from history
  const getClientRecoveryStats = (clienteId: string) => {
    const clientAttempts = recoveryHistory.filter(r => r.cliente_id === clienteId && r.status === 'sent');
    const count = clientAttempts.length;
    const lastDate = clientAttempts.length > 0
      ? clientAttempts.reduce((latest, r) => {
          const d = new Date(r.data_envio);
          return d > latest ? d : latest;
        }, new Date(0))
      : null;
    return { count, lastDate };
  };

  const hasPendingRecovery = (clienteId: string) => {
    return recoveryHistory.some(r => 
      r.cliente_id === clienteId && 
      r.status === 'sent' && 
      r.converteu === null
    );
  };

  const sentMessages = recoveryHistory.filter(r => r.status === 'sent');
  const lastSentDate = sentMessages.length > 0
    ? sentMessages.reduce((latest, r) => {
        const d = new Date(r.data_envio);
        return d > latest ? d : latest;
      }, new Date(0))
    : null;

  const stats = {
    total: overdueClients.length,
    registro: registroClients.length,
    attempts: recoveryHistory.length,
    converted: recoveryHistory.filter(r => r.converteu === true).length,
    pending: recoveryHistory.filter(r => r.converteu === null && r.status === 'sent').length,
    totalSent: sentMessages.length,
    lastSentDate,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Mensais +30d</p>
                <p className="text-2xl font-bold text-red-400">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <ShoppingBag className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes Registro</p>
                <p className="text-2xl font-bold text-purple-400">{stats.registro}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Send className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tentativas</p>
                <p className="text-2xl font-bold text-blue-400">{stats.attempts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Convertidos</p>
                <p className="text-2xl font-bold text-emerald-400">{stats.converted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aguardando</p>
                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/20">
                <MessageSquare className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Msgs Enviadas</p>
                <p className="text-2xl font-bold text-indigo-400">{stats.totalSent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <History className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Último Envio</p>
                <p className="text-sm font-bold text-cyan-400">
                  {stats.lastSentDate
                    ? stats.lastSentDate.toLocaleDateString('pt-BR')
                    : 'Nenhum'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="clients">
            <Users className="w-4 h-4 mr-2" />
            Mensais Inadimplentes
          </TabsTrigger>
          <TabsTrigger value="registro">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Clientes Registro
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    Recuperação com IA
                  </CardTitle>
                  <CardDescription>
                    Clientes inadimplentes há mais de 30 dias. Clique para gerar mensagem personalizada.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Button variant="outline" onClick={loadOverdueClients} disabled={isLoading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Dias Atraso</TableHead>
                      <TableHead>Envios</TableHead>
                      <TableHead>Último Contato</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                          <p className="text-muted-foreground">Nenhum cliente inadimplente há mais de 30 dias!</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClients.map((cliente) => {
                        const daysOverdue = getDaysOverdue(cliente.data_renovacao);
                        const recoveryStats = getClientRecoveryStats(cliente.id);
                        return (
                          <TableRow key={cliente.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                <p className="text-xs text-muted-foreground">{cliente.numero}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{cliente.produto}</p>
                                {cliente.plano && (
                                  <p className="text-xs text-muted-foreground">{cliente.plano}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">
                                {cliente.moeda === 'USD' ? '$' : 'R$'} {cliente.valor.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">
                                {daysOverdue} dias
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{recoveryStats.count}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {recoveryStats.lastDate
                                  ? recoveryStats.lastDate.toLocaleDateString('pt-BR')
                                  : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {hasPendingRecovery(cliente.id) ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button 
                                          size="sm" 
                                          disabled
                                          className="opacity-50 cursor-not-allowed"
                                        >
                                          <Clock className="w-4 h-4 mr-1" />
                                          Pendente
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Já existe uma recuperação pendente para este cliente</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => generateMessage(cliente, false)}
                                  className="bg-gradient-to-r from-purple-500 to-violet-600"
                                >
                                  <Sparkles className="w-4 h-4 mr-1" />
                                  Recuperar
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="registro" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-purple-400" />
                    Clientes Registro - Nova Venda
                  </CardTitle>
                  <CardDescription>
                    Clientes que fizeram compras únicas. Entre em contato para oferecer novos produtos/serviços.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchQueryRegistro}
                      onChange={(e) => setSearchQueryRegistro(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Button variant="outline" onClick={loadRegistroClients} disabled={isLoadingRegistro}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingRegistro ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto Comprado</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Última Compra</TableHead>
                      <TableHead>Dias Desde Compra</TableHead>
                      <TableHead>Envios</TableHead>
                      <TableHead>Último Contato</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRegistro ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredRegistroClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-10">
                          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">Nenhum cliente registro encontrado</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegistroClients.map((cliente) => {
                        const daysSincePurchase = getDaysOverdue(cliente.data_renovacao);
                        const recoveryStats = getClientRecoveryStats(cliente.id);
                        return (
                          <TableRow key={cliente.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-medium">{cliente.nome}</p>
                                <p className="text-xs text-muted-foreground">{cliente.numero}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p>{cliente.produto}</p>
                                {cliente.plano && (
                                  <p className="text-xs text-muted-foreground">{cliente.plano}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono">
                                {cliente.moeda === 'USD' ? '$' : 'R$'} {cliente.valor.toFixed(2)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(cliente.data_renovacao).toLocaleDateString('pt-BR')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                                {daysSincePurchase} dias
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium">{recoveryStats.count}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {recoveryStats.lastDate
                                  ? recoveryStats.lastDate.toLocaleDateString('pt-BR')
                                  : '—'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {hasPendingRecovery(cliente.id) ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>
                                        <Button 
                                          size="sm" 
                                          disabled
                                          className="opacity-50 cursor-not-allowed"
                                        >
                                          <Clock className="w-4 h-4 mr-1" />
                                          Pendente
                                        </Button>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Já existe uma recuperação pendente para este cliente</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <Button 
                                  size="sm" 
                                  onClick={() => generateMessage(cliente, true)}
                                  className="bg-gradient-to-r from-emerald-500 to-teal-600"
                                >
                                  <ShoppingBag className="w-4 h-4 mr-1" />
                                  Nova Venda
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-blue-400" />
                    Histórico de Recuperações
                  </CardTitle>
                  <CardDescription>
                    Registro de todas as tentativas de recuperação de clientes
                  </CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou produto..."
                    value={searchQueryHistory}
                    onChange={(e) => setSearchQueryHistory(e.target.value)}
                    className="pl-10 w-[250px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="whitespace-nowrap">Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="whitespace-nowrap hidden md:table-cell">Venc.</TableHead>
                      <TableHead className="whitespace-nowrap">Canal</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Result.</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recoveryHistory.filter(r => 
                      r.clientes?.nome?.toLowerCase().includes(searchQueryHistory.toLowerCase()) ||
                      r.clientes?.produto?.toLowerCase().includes(searchQueryHistory.toLowerCase())
                    ).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">
                            {searchQueryHistory ? 'Nenhum resultado encontrado' : 'Nenhuma tentativa de recuperação registrada'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recoveryHistory.filter(r => 
                        r.clientes?.nome?.toLowerCase().includes(searchQueryHistory.toLowerCase()) ||
                        r.clientes?.produto?.toLowerCase().includes(searchQueryHistory.toLowerCase())
                      ).map((attempt) => (
                        <TableRow key={attempt.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {new Date(attempt.data_envio).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[150px]">
                              <p className="font-medium text-sm truncate">{attempt.clientes?.nome || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground truncate">{attempt.clientes?.produto}</p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-xs">
                            {new Date(attempt.data_vencimento).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {attempt.canal === 'whatsapp' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Phone className="w-4 h-4 text-green-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>WhatsApp</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Mail className="w-4 h-4 text-blue-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>Email</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                          <TableCell>
                            {attempt.status === 'sent' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                                  </TooltipTrigger>
                                  <TooltipContent>Enviado</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <XCircle className="w-4 h-4 text-amber-400" />
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-sm">{attempt.error_message || 'Falha no envio'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                          <TableCell>
                            {attempt.status !== 'sent' ? (
                              <span className="text-muted-foreground">—</span>
                            ) : attempt.converteu === true ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : attempt.converteu === false ? (
                              <XCircle className="w-4 h-4 text-red-400" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-400" />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {attempt.status === 'sent' && attempt.converteu === null && (
                              <div className="flex gap-1 justify-end">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className="h-7 w-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                        onClick={() => setConfirmAction({ attemptId: attempt.id, converted: true })}
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar como convertido (cliente retornou)</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button 
                                        size="icon" 
                                        variant="ghost"
                                        className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                        onClick={() => setConfirmAction({ attemptId: attempt.id, converted: false })}
                                      >
                                        <XCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Marcar como não convertido (cliente não retornou)</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="webhooks" className="space-y-4">
          <RecoveryWebhooksManager />
        </TabsContent>
      </Tabs>

      {/* Confirm Convert Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) { setConfirmAction(null); setConfirmReason(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction?.converted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Confirmar Conversão
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-400" />
                  Confirmar Não Conversão
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.converted
                ? 'Informe o motivo pelo qual o cliente foi convertido.'
                : 'Informe o motivo pelo qual o cliente não foi convertido.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Textarea
                value={confirmReason}
                onChange={(e) => setConfirmReason(e.target.value)}
                rows={3}
                placeholder={confirmAction?.converted 
                  ? 'Ex: Cliente renovou o plano após contato...' 
                  : 'Ex: Cliente informou que não tem interesse...'}
                className="resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setConfirmAction(null); setConfirmReason(''); }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmAction}
                className={confirmAction?.converted 
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                  : "bg-red-600 hover:bg-red-700 text-white"}
              >
                {confirmAction?.converted ? 'Confirmar Conversão' : 'Confirmar Não Conversão'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate & Send Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isNewSaleMode ? (
                <>
                  <ShoppingBag className="w-5 h-5 text-emerald-400" />
                  Nova Venda - Cliente Registro
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Recuperar Cliente
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedClient && (
                <span>
                  Enviando mensagem para <strong>{selectedClient.nome}</strong> - {selectedClient.produto}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto flex-1 pr-1">
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-10">
                <Sparkles className="w-8 h-8 text-purple-400 animate-pulse mb-3" />
                <p className="text-muted-foreground">Gerando mensagem personalizada com IA...</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mensagem</label>
                  <Textarea
                    value={generatedMessage}
                    onChange={(e) => setGeneratedMessage(e.target.value)}
                    rows={8}
                    placeholder="A mensagem será gerada automaticamente..."
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Você pode editar a mensagem antes de enviar
                  </p>
                  
                  {/* Variáveis disponíveis */}
                  {selectedClient && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs font-medium text-muted-foreground mb-2">📋 Dados do cliente disponíveis:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Nome:</span>
                          <span className="font-medium text-foreground">{selectedClient.nome}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Produto:</span>
                          <span className="font-medium text-foreground">{selectedClient.produto}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Valor:</span>
                          <span className="font-medium text-foreground">
                            {selectedClient.moeda === 'USD' ? '$' : 'R$'} {selectedClient.valor}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Plano:</span>
                          <span className="font-medium text-foreground">{selectedClient.plano || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Email:</span>
                          <span className="font-medium text-foreground truncate max-w-[120px]" title={selectedClient.email}>
                            {selectedClient.email}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Vencimento:</span>
                          <span className="font-medium text-foreground">
                            {new Date(selectedClient.data_renovacao).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-medium mb-2 block">Canal de envio</label>
                    <Select value={selectedChannel} onValueChange={(v: 'whatsapp' | 'email') => setSelectedChannel(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-green-400" />
                            WhatsApp
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-blue-400" />
                            Email
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => selectedClient && generateMessage(selectedClient, isNewSaleMode)}
                    variant="outline"
                    className={isNewSaleMode ? "border-emerald-500/30 text-emerald-400" : "border-purple-500/30 text-purple-400"}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerar
                  </Button>
                  <Button 
                    onClick={sendRecoveryMessage}
                    disabled={isSending || !generatedMessage}
                    className={isNewSaleMode 
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600" 
                      : "bg-gradient-to-r from-purple-500 to-violet-600"
                    }
                  >
                    {isSending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Enviar Mensagem
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
