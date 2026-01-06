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
  Users
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
  const [activeTab, setActiveTab] = useState('clients');
  const [isNewSaleMode, setIsNewSaleMode] = useState(false);

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

  const markAsConverted = async (attemptId: string, converted: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('client-recovery', {
        body: { 
          action: 'mark-converted',
          attemptId,
          converted,
        },
      });

      if (error) throw error;
      
      toast({
        title: converted ? 'Marcado como convertido!' : 'Marcado como não convertido',
      });
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

  const stats = {
    total: overdueClients.length,
    registro: registroClients.length,
    attempts: recoveryHistory.length,
    converted: recoveryHistory.filter(r => r.converteu === true).length,
    pending: recoveryHistory.filter(r => r.converteu === null).length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                          <p className="text-muted-foreground">Nenhum cliente inadimplente há mais de 30 dias!</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredClients.map((cliente) => {
                        const daysOverdue = getDaysOverdue(cliente.data_renovacao);
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
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                onClick={() => generateMessage(cliente, false)}
                                className="bg-gradient-to-r from-purple-500 to-violet-600"
                              >
                                <Sparkles className="w-4 h-4 mr-1" />
                                Recuperar
                              </Button>
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
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingRegistro ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-muted-foreground" />
                          Carregando...
                        </TableCell>
                      </TableRow>
                    ) : filteredRegistroClients.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10">
                          <ShoppingBag className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">Nenhum cliente registro encontrado</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegistroClients.map((cliente) => {
                        const daysSincePurchase = getDaysOverdue(cliente.data_renovacao);
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
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                onClick={() => generateMessage(cliente, true)}
                                className="bg-gradient-to-r from-emerald-500 to-teal-600"
                              >
                                <ShoppingBag className="w-4 h-4 mr-1" />
                                Nova Venda
                              </Button>
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
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                Histórico de Recuperações
              </CardTitle>
              <CardDescription>
                Registro de todas as tentativas de recuperação de clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Data Envio</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Canal</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Converteu?</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recoveryHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10">
                          <History className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                          <p className="text-muted-foreground">Nenhuma tentativa de recuperação registrada</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      recoveryHistory.map((attempt) => (
                        <TableRow key={attempt.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-sm">
                            {new Date(attempt.data_envio).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{attempt.clientes?.nome || 'N/A'}</p>
                              <p className="text-xs text-muted-foreground">{attempt.clientes?.produto}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(attempt.data_vencimento).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {attempt.canal === 'whatsapp' ? (
                              <Badge variant="outline" className="border-green-500/30 text-green-400">
                                <Phone className="w-3 h-3 mr-1" />
                                WhatsApp
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                                <Mail className="w-3 h-3 mr-1" />
                                Email
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {attempt.status === 'sent' ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Enviado
                              </Badge>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 cursor-help">
                                      <XCircle className="w-3 h-3 mr-1" />
                                      Não enviado
                                    </Badge>
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
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge className="bg-amber-500/20 text-amber-400 cursor-help">
                                      Não enviado
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p className="text-sm">
                                      {attempt.error_message || 'Falha no envio'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : attempt.converteu === true ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400">Sim</Badge>
                            ) : attempt.converteu === false ? (
                              <Badge className="bg-red-500/20 text-red-400">Não</Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-400">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {attempt.status === 'sent' && attempt.converteu === null && (
                              <div className="flex gap-1 justify-end">
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                  onClick={() => markAsConverted(attempt.id, true)}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => markAsConverted(attempt.id, false)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
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
      </Tabs>

      {/* Generate & Send Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
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

          <div className="space-y-4">
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
