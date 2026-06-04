import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ShieldCheck, Search, Filter, AlertTriangle, CheckCircle2, 
  Clock, XCircle, MoreHorizontal, Eye, ExternalLink, Settings,
  AlertCircle, ShieldAlert, FileSearch, Smartphone, RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

export default function AdminSegurancaPagamento() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [config, setConfig] = useState<any>({
    ocr_enabled: true,
    duplicate_check: true,
    whatsapp_notifications: false,
    ai_provider: 'lovable',
    ai_model: 'google/gemini-2.5-flash',
    openai_api_key: '',
    groq_api_key: '',
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_payments')
        .select('*, cliente:clientes(nome, email, numero, cobranca_ativa)')
        .or('status.eq.pending_approval,status.eq.rejected,payment_type.eq.pix_manual,payment_type.eq.link_pagamento,payment_type.eq.outros_manual,pix_transaction_id.not.is.null')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Erro ao buscar pagamentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };


  // Approval dialog state — used when OCR sinaliza duplicado/divergente
  const [approvalDialog, setApprovalDialog] = useState<{
    open: boolean;
    payment: any | null;
    action: 'approve' | 'reject';
    reason: string;
  }>({ open: false, payment: null, action: 'approve', reason: '' });

  // Dialog para visualizar motivo da rejeição/aprovação manual
  const [reasonDialog, setReasonDialog] = useState<{ open: boolean; payment: any | null }>({
    open: false,
    payment: null,
  });

  const SUSPICIOUS = new Set(['duplicate', 'mismatch', 'divergent', 'invalid']);

  const performApproval = async (
    paymentId: string,
    action: 'approve' | 'reject',
    reason?: string
  ) => {
    setApprovingId(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke('approve-pixpague-payment', {
        body: {
          paymentId,
          action,
          approvalReason: action === 'approve' ? reason : undefined,
          rejectionReason: action === 'reject' ? reason : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);

      const receiptInfo = (data as any)?.receipt;
      const receiptMsg =
        action === 'approve'
          ? receiptInfo?.sent
            ? 'Cliente renovado e recibo enviado.'
            : `Cliente renovado, mas o envio do recibo falhou${receiptInfo?.error ? `: ${receiptInfo.error}` : '.'}`
          : 'Pagamento marcado como rejeitado. Cliente NÃO foi renovado.';

      toast({
        title: action === 'approve' ? '✅ Pagamento aprovado' : '🚫 Pagamento rejeitado',
        description: receiptMsg,
        variant: action === 'approve' && !receiptInfo?.sent ? 'destructive' : 'default',
      });
      setApprovalDialog({ open: false, payment: null, action: 'approve', reason: '' });
      await fetchPayments();
    } catch (e: any) {
      toast({
        title: 'Erro ao processar aprovação',
        description: e?.message || 'Falha desconhecida',
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleApproval = async (payment: any, action: 'approve' | 'reject') => {
    const isSuspicious = SUSPICIOUS.has(payment.ocr_status);
    // Para casos suspeitos (aprovação) OU rejeição → sempre pedir motivo via Dialog
    if (isSuspicious || action === 'reject') {
      setApprovalDialog({ open: true, payment, action, reason: '' });
      return;
    }
    await performApproval(payment.id, action);
  };

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('billing_config')
        .select('config_value')
        .eq('config_key', 'pixpague_config')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) {
        setConfig(typeof data.config_value === 'string' ? JSON.parse(data.config_value) : data.config_value);
      }
    } catch (error: any) {
      console.error('Error fetching config:', error);
    }
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const { error } = await supabase
        .from('billing_config')
        .upsert({
          config_key: 'pixpague_config',
          config_value: JSON.stringify(config),
          updated_at: new Date().toISOString()
        }, { onConflict: 'config_key' });

      if (error) throw error;
      toast({
        title: 'Configuração salva',
        description: 'As regras de segurança do PixPague foram atualizadas.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingConfig(false);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchConfig();
  }, []);

  const stats = {
    total: payments.length,
    duplicates: payments.filter(p => p.ocr_status === 'duplicate').length,
    divergent: payments.filter(p => p.ocr_status === 'divergent').length,
    verified: payments.filter(p => p.ocr_status === 'success').length,
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.cliente?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.pix_transaction_id?.toLowerCase().includes(searchTerm.toLowerCase());
    let matchesStatus = true;
    if (statusFilter === 'pending_approval') matchesStatus = p.status === 'pending_approval';
    else if (statusFilter === 'paid') matchesStatus = p.status === 'paid';
    else if (statusFilter === 'rejected') matchesStatus = p.status === 'rejected';
    else if (statusFilter !== 'all') matchesStatus = p.ocr_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingApprovalCount = payments.filter(p => p.status === 'pending_approval').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-semibold">Validado</Badge>;
      case 'duplicate':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 animate-pulse font-bold">Duplicado</Badge>;
      case 'divergent':
      case 'mismatch':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold">Valor Divergente</Badge>;
      case 'invalid':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/30 animate-pulse font-bold">Não é Comprovante</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-muted-foreground italic border-dashed">Em processamento</Badge>;
      case 'rejected_manual':
        return <Badge variant="destructive" className="font-semibold">Rejeitado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro na IA</Badge>;
      default:
        return <Badge variant="outline">{status || '—'}</Badge>;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_approval':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse font-semibold">⏳ Aguardando Aprovação</Badge>;
      case 'paid':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="font-semibold">Rejeitado</Badge>;
      default:
        return null;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-gradient flex items-center gap-2">
              <ShieldCheck className="h-8 w-8 text-primary" />
              Segurança de Pagamento
            </h1>
            <p className="text-muted-foreground">
              Análise de comprovantes, detecção de duplicidade e prevenção de fraudes (PixPague)
            </p>
          </div>
          <div className="flex gap-2">
             <Button variant="outline" onClick={fetchPayments} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Sincronizar
             </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Analisado</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.verified}</p>
                <p className="text-xs text-muted-foreground">Validados</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/5 to-transparent border-destructive/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.duplicates}</p>
                <p className="text-xs text-muted-foreground">Duplicados (Fraudes)</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/5 to-transparent border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.divergent}</p>
                <p className="text-xs text-muted-foreground">Valores Divergentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="transactions">Transações PIX</TabsTrigger>
            <TabsTrigger value="config">Configurações PixPague</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Histórico de Verificação</CardTitle>
                    <CardDescription>Acompanhe todos os comprovantes processados pela IA</CardDescription>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="Buscar cliente ou ID..." 
                        className="pl-9 w-full sm:w-[250px]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <select 
                      className="h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Todos</option>
                      <option value="pending_approval">⏳ Aguardando Aprovação{pendingApprovalCount > 0 ? ` (${pendingApprovalCount})` : ''}</option>
                      <option value="paid">Aprovados</option>
                      <option value="rejected">Rejeitados</option>
                      <option value="success">IA: Validado</option>
                      <option value="duplicate">IA: Duplicado</option>
                      <option value="mismatch">IA: Divergente</option>
                      <option value="invalid">IA: Não é Comprovante</option>
                      <option value="error">IA: Erro</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Desktop / wide screens: tabela tradicional */}
                <div className="hidden lg:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>ID Transação</TableHead>
                        <TableHead>Status IA</TableHead>
                        <TableHead>Status Pagamento</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                              <Clock className="h-4 w-4 animate-spin" />
                              Carregando transações...
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                            Nenhuma transação encontrada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => {
                          const isPending = payment.status === 'pending_approval';
                          const isProcessing = approvingId === payment.id;
                          return (
                          <TableRow 
                            key={payment.id} 
                            className={
                              payment.ocr_status === 'duplicate' ? 'bg-destructive/5' :
                              isPending ? 'bg-amber-500/5' : ''
                            }
                          >
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell className="max-w-[260px]">
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium text-sm truncate">
                                  {payment.cliente?.nome || 'N/A'}
                                </span>
                                {payment.cliente?.cobranca_ativa !== undefined && (
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[10px] h-4 px-1.5 w-fit font-medium mb-1 ${
                                      payment.cliente.cobranca_ativa === false 
                                        ? "bg-slate-50 text-slate-500 border-slate-200" 
                                        : "bg-blue-50 text-blue-600 border-blue-200"
                                    }`}
                                  >
                                    {payment.cliente.cobranca_ativa === false ? "Apenas Registro" : "Mensal"}
                                  </Badge>
                                )}
                                {payment.cliente?.email && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    {payment.cliente.email}
                                  </span>
                                )}
                                {payment.cliente?.numero && (
                                  <span className="text-[11px] text-muted-foreground truncate">
                                    📱 {payment.cliente.numero}
                                  </span>
                                )}
                                {(payment.submitted_by_name || payment.submitted_by_email) && (
                                  <div className="mt-1 pt-1 border-t border-border/50">
                                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Enviado por</span>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-medium text-primary truncate">
                                        👤 {payment.submitted_by_name || payment.submitted_by_email}
                                      </span>
                                      {payment.submitted_by_name && payment.submitted_by_email && (
                                        <span className="text-[10px] text-muted-foreground truncate">
                                          {payment.submitted_by_email}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                                </span>
                                {payment.ocr_amount && payment.ocr_amount !== payment.amount && (
                                  <span className="text-[10px] text-amber-500 font-medium">
                                    IA leu: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.ocr_amount)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono text-[10px] max-w-[150px] truncate">
                              {payment.pix_transaction_id || '—'}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(payment.ocr_status)}
                            </TableCell>
                            <TableCell>
                              {getPaymentStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Em telas xl mostramos botões Aprovar/Rejeitar; abaixo disso, vão para o menu "..." */}
                                {isPending && (
                                  <div className="hidden xl:flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                      onClick={() => handleApproval(payment, 'approve')}
                                      disabled={isProcessing}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      Aprovar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                                      onClick={() => handleApproval(payment, 'reject')}
                                      disabled={isProcessing}
                                    >
                                      <XCircle className="h-3.5 w-3.5 mr-1" />
                                      Rejeitar
                                    </Button>
                                  </div>
                                )}
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isProcessing}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {isPending && (
                                      <div className="xl:hidden">
                                        <DropdownMenuItem
                                          onClick={() => handleApproval(payment, 'approve')}
                                          className="text-emerald-500 focus:text-emerald-600 focus:bg-emerald-500/10"
                                        >
                                          <CheckCircle2 className="h-4 w-4 mr-2" />
                                          Aprovar
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onClick={() => handleApproval(payment, 'reject')}
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Rejeitar
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </div>
                                    )}
                                    {/* Olhinho para ver detalhes da análise (IA/Duplicidade) ou motivo da rejeição */}
                                    {(payment.status === 'rejected' || isPending) && (
                                      <DropdownMenuItem
                                        onClick={() => setReasonDialog({ open: true, payment })}
                                        className="text-amber-500 focus:text-amber-600 focus:bg-amber-500/10"
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        Ver detalhes da análise
                                      </DropdownMenuItem>
                                    )}
                                    {payment.comprovante_url && (
                                      <DropdownMenuItem onClick={() => window.open(payment.comprovante_url, '_blank')}>
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Ver Comprovante
                                      </DropdownMenuItem>
                                    )}
                                    {/* Notificar Cliente: somente em renovações de clientes mensais. */}
                                    {payment.cliente?.cobranca_ativa === true &&
                                      payments.filter(p => p.cliente_id === payment.cliente_id && p.status === 'paid' && p.id !== payment.id).length > 0 && (
                                      <DropdownMenuItem>
                                        <Smartphone className="h-4 w-4 mr-2" />
                                        Notificar Cliente
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile / tablet: cards empilhados */}
                <div className="lg:hidden space-y-3">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-10">
                      <Clock className="h-4 w-4 animate-spin" />
                      Carregando transações...
                    </div>
                  ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground">
                      Nenhuma transação encontrada.
                    </div>
                  ) : (
                    filteredPayments.map((payment) => {
                      const isPending = payment.status === 'pending_approval';
                      const isProcessing = approvingId === payment.id;
                      return (
                        <div
                          key={payment.id}
                          className={`rounded-lg border p-4 space-y-3 ${
                            payment.ocr_status === 'duplicate' ? 'bg-destructive/5 border-destructive/20' :
                            isPending ? 'bg-amber-500/5 border-amber-500/20' : 'bg-card'
                          }`}
                        >
                          {/* Header: cliente + data */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-sm truncate">
                                {payment.cliente?.nome || 'N/A'}
                              </p>
                              {payment.cliente?.cobranca_ativa !== undefined && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-[9px] h-3.5 px-1 w-fit font-medium mb-1 ${
                                    payment.cliente.cobranca_ativa === false 
                                      ? "bg-slate-50 text-slate-500 border-slate-200" 
                                      : "bg-blue-50 text-blue-600 border-blue-200"
                                  }`}
                                >
                                  {payment.cliente.cobranca_ativa === false ? "Apenas Registro" : "Mensal"}
                                </Badge>
                              )}
                              {payment.cliente?.email && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  ✉️ {payment.cliente.email}
                                </p>
                              )}
                              {payment.cliente?.numero && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  📱 {payment.cliente.numero}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                              </p>
                            </div>
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-bold text-base">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.amount)}
                              </span>
                              {payment.ocr_amount && payment.ocr_amount !== payment.amount && (
                                <span className="text-[10px] text-amber-500 font-medium">
                                  IA leu: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payment.ocr_amount)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex flex-wrap gap-2">
                            {getStatusBadge(payment.ocr_status)}
                            {getPaymentStatusBadge(payment.status)}
                          </div>

                          {/* ID Transação */}
                          {payment.pix_transaction_id && (
                            <div className="text-[10px] text-muted-foreground">
                              <span className="font-medium">ID:</span>{' '}
                              <span className="font-mono break-all">{payment.pix_transaction_id}</span>
                            </div>
                          )}

                          {/* Usuário do sistema que enviou */}
                          {(payment.submitted_by_name || payment.submitted_by_email) && (
                            <div className="rounded-md bg-primary/5 border border-primary/10 p-2">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                                Enviado por
                              </p>
                              <p className="text-xs font-medium text-primary truncate">
                                👤 {payment.submitted_by_name || payment.submitted_by_email}
                              </p>
                              {payment.submitted_by_name && payment.submitted_by_email && (
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {payment.submitted_by_email}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Ações */}
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {isPending && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-8 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                                  onClick={() => handleApproval(payment, 'approve')}
                                  disabled={isProcessing}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                  Aprovar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                                  onClick={() => handleApproval(payment, 'reject')}
                                  disabled={isProcessing}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" />
                                  Rejeitar
                                </Button>
                              </>
                            )}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={isProcessing}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                {(payment.status === 'rejected' || isPending) && (
                                  <DropdownMenuItem
                                    onClick={() => setReasonDialog({ open: true, payment })}
                                    className="text-amber-500 focus:text-amber-600 focus:bg-amber-500/10"
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Ver detalhes da análise
                                  </DropdownMenuItem>
                                )}
                                {payment.comprovante_url && (
                                  <DropdownMenuItem onClick={() => window.open(payment.comprovante_url, '_blank')}>
                                    <ExternalLink className="h-4 w-4 mr-2" />
                                    Ver Comprovante
                                  </DropdownMenuItem>
                                )}
                                {payment.cliente?.cobranca_ativa === true &&
                                  payments.filter(p => p.cliente_id === payment.cliente_id && p.status === 'paid' && p.id !== payment.id).length > 0 && (
                                  <DropdownMenuItem>
                                    <Smartphone className="h-4 w-4 mr-2" />
                                    Notificar Cliente
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle>Configurações PixPague</CardTitle>
                <CardDescription>Defina como o sistema deve analisar os comprovantes e o que fazer em caso de suspeita</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-base">Análise Automática (OCR)</Label>
                      <p className="text-sm text-muted-foreground">
                        Utiliza Inteligência Artificial para ler o conteúdo do comprovante enviado pelo cliente.
                      </p>
                    </div>
                    <Switch 
                      checked={config.ocr_enabled}
                      onCheckedChange={(checked) => setConfig({...config, ocr_enabled: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-base">Bloqueio de Duplicidade</Label>
                      <p className="text-sm text-muted-foreground">
                        Alerta e sinaliza transações que utilizam um ID de transação já processado anteriormente.
                      </p>
                    </div>
                    <Switch 
                      checked={config.duplicate_check}
                      onCheckedChange={(checked) => setConfig({...config, duplicate_check: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div className="space-y-0.5">
                      <Label className="text-base">Notificações WhatsApp para Aprovadores</Label>
                      <p className="text-sm text-muted-foreground">
                        Envia um alerta para os números configurados quando um comprovante for suspeito ou validado.
                      </p>
                    </div>
                    <Switch 
                      checked={config.whatsapp_notifications}
                      onCheckedChange={(checked) => setConfig({...config, whatsapp_notifications: checked})}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 rounded-lg border bg-card">
                  <div>
                    <Label className="text-base">Provedor de IA</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Escolha qual IA será usada para analisar os comprovantes. Lovable AI é grátis (sem API key).
                    </p>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={config.ai_provider || 'lovable'}
                      onChange={(e) => setConfig({...config, ai_provider: e.target.value})}
                    >
                      <option value="lovable">Lovable AI (Padrão - Sem API Key)</option>
                      <option value="openai">OpenAI (GPT-4o / GPT-5)</option>
                      <option value="groq">Groq (Llama Vision)</option>
                    </select>
                  </div>

                  {config.ai_provider === 'lovable' && (
                    <div>
                      <Label>Modelo Lovable AI</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={config.ai_model || 'google/gemini-2.5-flash'}
                        onChange={(e) => setConfig({...config, ai_model: e.target.value})}
                      >
                        <option value="google/gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</option>
                        <option value="google/gemini-2.5-pro">Gemini 2.5 Pro (Mais preciso)</option>
                        <option value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Mais rápido)</option>
                        <option value="openai/gpt-5-mini">GPT-5 Mini</option>
                        <option value="openai/gpt-5">GPT-5 (Premium)</option>
                      </select>
                    </div>
                  )}

                  {config.ai_provider === 'openai' && (
                    <div>
                      <Label>OpenAI API Key</Label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={config.openai_api_key || ''}
                        onChange={(e) => setConfig({...config, openai_api_key: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Obtenha em platform.openai.com/api-keys. Será usado o modelo gpt-4o.
                      </p>
                    </div>
                  )}

                  {config.ai_provider === 'groq' && (
                    <div>
                      <Label>Groq API Key</Label>
                      <Input
                        type="password"
                        placeholder="gsk_..."
                        value={config.groq_api_key || ''}
                        onChange={(e) => setConfig({...config, groq_api_key: e.target.value})}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Obtenha em console.groq.com. Será usado llama-3.2-90b-vision-preview.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Números para Notificação WhatsApp (separados por vírgula)</Label>
                  <Input 
                    placeholder="Ex: 5511999999999, 5511888888888"
                    value={config.approver_phones || ''}
                    onChange={(e) => setConfig({...config, approver_phones: e.target.value})}
                  />
                </div>

                <div className="pt-4 border-t flex justify-end">
                  <Button onClick={saveConfig} disabled={isSavingConfig}>
                    {isSavingConfig ? <Clock className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                    Salvar Configurações
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-semibold text-blue-500 mb-1">Dica de Segurança</p>
                O PixPague é uma camada de proteção adicional. Sempre confira o extrato bancário (Cora/Inter/etc) para confirmação definitiva do recebimento dos fundos, especialmente em casos sinalizados como duplicados pela IA.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Approval Dialog — exige justificativa para aprovações de pagamentos suspeitos
          (duplicado/divergente) e também para qualquer rejeição. */}
      <Dialog
        open={approvalDialog.open}
        onOpenChange={(open) => {
          if (!open) setApprovalDialog({ open: false, payment: null, action: 'approve', reason: '' });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {approvalDialog.action === 'approve' ? (
                <>
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  Confirmar aprovação com alerta
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-destructive" />
                  Rejeitar pagamento
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {approvalDialog.action === 'approve' && approvalDialog.payment?.ocr_status === 'duplicate' && (
                <>
                  A IA detectou que o <strong>ID da transação PIX já foi usado anteriormente</strong>.
                  Aprovar mesmo assim pode encobrir uma fraude. Explique abaixo o motivo da decisão.
                </>
              )}
              {approvalDialog.action === 'approve' &&
                (approvalDialog.payment?.ocr_status === 'mismatch' || approvalDialog.payment?.ocr_status === 'divergent') && (
                <>
                  O <strong>valor do comprovante não bate</strong> com o valor declarado pelo cliente.
                  Por que está aprovando mesmo assim?
                </>
              )}
              {approvalDialog.action === 'approve' && approvalDialog.payment?.ocr_status === 'invalid' && (
                <>
                  A IA detectou que <strong>a imagem enviada não é um comprovante de PIX válido</strong>
                  (pode ser uma foto aleatória, screenshot, imagem em branco, etc).
                  Aprovar mesmo assim é <strong>altamente arriscado</strong>. Explique o motivo.
                </>
              )}
              {approvalDialog.action === 'reject' && (
                <>Descreva brevemente o motivo da rejeição (será registrado no histórico).</>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Resumo do pagamento */}
          {approvalDialog.payment && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-medium">{approvalDialog.payment.cliente?.nome || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor declarado:</span>
                <span className="font-semibold">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(approvalDialog.payment.amount)}
                </span>
              </div>
              {approvalDialog.payment.ocr_amount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IA leu no comprovante:</span>
                  <span className="font-semibold text-amber-500">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(approvalDialog.payment.ocr_amount)}
                  </span>
                </div>
              )}
              {approvalDialog.payment.pix_transaction_id && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">ID Transação:</span>
                  <span className="font-mono text-[11px] truncate">{approvalDialog.payment.pix_transaction_id}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="approval-reason">
              {approvalDialog.action === 'approve' ? 'Motivo da aprovação' : 'Motivo da rejeição'}
              {approvalDialog.action === 'approve' && (
                <span className="text-destructive ml-1">*</span>
              )}
            </Label>
            <Textarea
              id="approval-reason"
              placeholder={
                approvalDialog.action === 'approve'
                  ? 'Ex: Cliente enviou comprovante errado por engano, confirmei o pagamento via extrato bancário...'
                  : 'Ex: Comprovante adulterado, ID já utilizado em outro pedido...'
              }
              value={approvalDialog.reason}
              onChange={(e) => setApprovalDialog((prev) => ({ ...prev, reason: e.target.value }))}
              rows={4}
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {approvalDialog.reason.length}/500
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setApprovalDialog({ open: false, payment: null, action: 'approve', reason: '' })}
              disabled={approvingId === approvalDialog.payment?.id}
            >
              Cancelar
            </Button>
            <Button
              variant={approvalDialog.action === 'approve' ? 'default' : 'destructive'}
              onClick={() => approvalDialog.payment && performApproval(approvalDialog.payment.id, approvalDialog.action, approvalDialog.reason)}
              disabled={
                approvingId === approvalDialog.payment?.id ||
                (approvalDialog.action === 'approve' && approvalDialog.reason.trim().length < 5)
              }
            >
              {approvingId === approvalDialog.payment?.id ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : approvalDialog.action === 'approve' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirmar aprovação
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirmar rejeição
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Ver motivo da rejeição */}
      <Dialog
        open={reasonDialog.open}
        onOpenChange={(open) => setReasonDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 text-left">
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Análise de Segurança
            </DialogTitle>
            <DialogDescription>
              Informações detectadas pela IA e status de duplicidade.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-4">
            {reasonDialog.payment && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Cliente</p>
                    <p className="font-medium truncate">{reasonDialog.payment.cliente?.nome || '—'}</p>
                  </div>
                  <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
                    <p className="text-[10px] uppercase text-muted-foreground font-semibold">Valor Digitado</p>
                    <p className="font-bold">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        reasonDialog.payment.amount || 0,
                      )}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                    <FileSearch className="h-3.5 w-3.5" />
                    Resultado do OCR (IA)
                  </h4>
                  
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex justify-between items-center border-b border-amber-500/10 pb-1">
                      <span className="text-muted-foreground">Valor lido no papel:</span>
                      <span className={`font-bold ${reasonDialog.payment.ocr_amount !== reasonDialog.payment.amount ? 'text-destructive' : 'text-emerald-600'}`}>
                        {reasonDialog.payment.ocr_amount 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reasonDialog.payment.ocr_amount)
                          : 'Não detectado'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-amber-500/10 pb-1">
                      <span className="text-muted-foreground">ID da Transação:</span>
                      <span className="font-mono text-[10px] bg-white/50 px-1 rounded truncate ml-2">
                        {reasonDialog.payment.pix_transaction_id || 'Não detectado'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status da IA:</span>
                      {getStatusBadge(reasonDialog.payment.ocr_status)}
                    </div>
                  </div>

                  {reasonDialog.payment.ocr_status === 'duplicate' && (
                    <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-[11px] text-destructive font-medium flex gap-2">
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                      Atenção: Este ID de transação já foi utilizado em outro pagamento. Possível tentativa de fraude!
                    </div>
                  )}
                  
                  {reasonDialog.payment.ocr_status === 'mismatch' && (
                    <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[11px] text-amber-700 font-medium flex gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Atenção: O valor que o cliente digitou não bate com o valor que a IA leu no comprovante.
                    </div>
                  )}
                </div>

                {reasonDialog.payment.approval_reason && (
                  <div className={`rounded-md border p-3 ${reasonDialog.payment.status === 'rejected' ? 'border-destructive/30 bg-destructive/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                    <p className={`text-[10px] uppercase tracking-wide font-bold mb-1 ${reasonDialog.payment.status === 'rejected' ? 'text-destructive' : 'text-emerald-600'}`}>
                      {reasonDialog.payment.status === 'rejected' ? 'Justificativa da Rejeição' : 'Observação da Aprovação'}
                    </p>
                    <p className="text-sm whitespace-pre-wrap">
                      {reasonDialog.payment.approval_reason}
                    </p>
                    {reasonDialog.payment.approved_by_email && (
                      <p className="text-[10px] text-muted-foreground mt-2 italic text-right">
                        — {reasonDialog.payment.approved_by_email}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end p-4 border-t bg-muted/20">
            <Button variant="outline" onClick={() => setReasonDialog({ open: false, payment: null })}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}