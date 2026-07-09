import { Button } from "@/components/ui/button";
import { Search, CreditCard, PlusCircle, History, Info, Loader2, MessageCircle, Mail, CheckCircle2, XCircle, ExternalLink, User, Receipt, CircleDot, Clock, AlertTriangle, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { MessagePreviewDialog } from "@/components/dashboard/MessagePreviewDialog";

type BillingLogRow = {
  id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_numero: string | null;
  cliente_produto: string | null;
  cliente_observacoes: string | null;
  message_type: string;
  channel: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  message_body?: string | null;
  clientes?: { valor: number | null; produto: string | null; cobranca_ativa: boolean | null; data_renovacao: string | null } | null;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
};

const getMessageTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'd_menos_3': 'Vence em 3 dias',
    'd_zero': 'Vence hoje',
    'd_mais_1': 'Vencido 1 dia',
    'd_mais_2': 'Vencido 2 dias',
    'd_mais_15': 'Vencido 15 dias',
    'd_mais_30': 'Vencido 30 dias',
    'recibo': 'Recibo',
  };
  return labels[type] || type;
};

const getMessageTypeStyle = (type: string) => {
  if (type === 'recibo') return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5';
  if (type.startsWith('d_menos') || type === 'd_zero') return 'text-amber-500 border-amber-500/30 bg-amber-500/5';
  if (type.startsWith('d_mais')) return 'text-rose-500 border-rose-500/30 bg-rose-500/5';
  return '';
};

// Compact payment status derived from client data_renovacao/cobranca_ativa
function PaymentStatusPill({ cliente }: { cliente?: BillingLogRow['clientes'] }) {
  if (!cliente) return <span className="text-xs text-muted-foreground">-</span>;
  if (cliente.cobranca_ativa === false) {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 text-muted-foreground border-muted-foreground/30 whitespace-nowrap">
        <CircleDot className="h-3 w-3" /> Inativo
      </Badge>
    );
  }
  if (!cliente.data_renovacao) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dr = new Date(cliente.data_renovacao);
  dr.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dr.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 text-rose-500 border-rose-500/30 bg-rose-500/5 whitespace-nowrap" title={`Vencido há ${Math.abs(diffDays)} dia(s)`}>
        <AlertTriangle className="h-3 w-3" /> Atrasado {Math.abs(diffDays)}d
      </Badge>
    );
  }
  if (diffDays <= 3) {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 text-amber-500 border-amber-500/30 bg-amber-500/5 whitespace-nowrap" title={`Vence em ${diffDays} dia(s)`}>
        <Clock className="h-3 w-3" /> Vence {diffDays}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] h-5 gap-1 text-emerald-500 border-emerald-500/30 bg-emerald-500/5 whitespace-nowrap" title={`Em dia — próxima em ${diffDays} dia(s)`}>
      <CheckCircle2 className="h-3 w-3" /> Em dia
    </Badge>
  );
}

// Inline dialog with cobrança history for a single client (no navigation needed)
function ClientBillingInlineDialog({ clienteId, clienteNome, open, onOpenChange }: {
  clienteId: string | null;
  clienteNome: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [rows, setRows] = useState<BillingLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchHistory = async () => {
    if (!clienteId && !clienteNome) return;
    setLoading(true);
    try {
      let q = supabase
        .from('billing_logs')
        .select('*, clientes(valor, produto, cobranca_ativa, data_renovacao)')
        .order('sent_at', { ascending: false })
        .limit(100);
      q = clienteId ? q.eq('cliente_id', clienteId) : q.ilike('cliente_nome', `%${clienteNome}%`);
      const { data, error } = await q;
      if (error) throw error;
      setRows((data as BillingLogRow[]) || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetch whenever dialog opens for a new client (Radix não emite onOpenChange
  // quando o open é controlado externamente, então precisamos deste effect).
  useEffect(() => {
    if (open) {
      setRows([]);
      fetchHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId, clienteNome]);

  const summary = useMemo(() => {
    const total = rows.length;
    const enviados = rows.filter(r => ['sent', 'success', 'delivered'].includes(r.status)).length;
    const falhas = rows.filter(r => ['failed', 'error'].includes(r.status)).length;
    const recibos = rows.filter(r => r.message_type === 'recibo').length;
    const cliente = rows[0]?.clientes;
    return { total, enviados, falhas, recibos, cliente };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-update" />
            Histórico de cobrança — {clienteNome}
          </DialogTitle>
          <DialogDescription>
            Visão rápida sem sair do dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* Sticky summary top bar */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/80 backdrop-blur p-2 text-xs">
          <PaymentStatusPill cliente={summary.cliente} />
          <span className="text-muted-foreground">•</span>
          <span><span className="font-semibold">{summary.total}</span> registros</span>
          <span className="text-emerald-500">✓ {summary.enviados} enviados</span>
          {summary.falhas > 0 && <span className="text-rose-500">✗ {summary.falhas} falhas</span>}
          <span className="text-emerald-400">🧾 {summary.recibos} recibos</span>
          {summary.cliente?.valor != null && (
            <span className="ml-auto font-semibold">{formatCurrency(summary.cliente.valor)}</span>
          )}
        </div>

        <div className="flex-1 overflow-auto rounded-lg border mt-2">
          {loading ? (
            <div className="p-10 text-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Carregando...</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhum histórico encontrado.</div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const isEmail = r.channel === 'email';
                  const isSuccess = ['sent', 'success', 'delivered'].includes(r.status);
                  const isFailed = ['failed', 'error'].includes(r.status);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(r.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] h-5 whitespace-nowrap ${getMessageTypeStyle(r.message_type)}`}>
                          {getMessageTypeLabel(r.message_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] h-5 gap-1 whitespace-nowrap ${isEmail ? 'text-blue-500 border-blue-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
                          {isEmail ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                          {isEmail ? 'Email' : 'WhatsApp'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isSuccess ? (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 text-emerald-500 border-emerald-500/30 whitespace-nowrap"><CheckCircle2 className="h-3 w-3" /> Enviado</Badge>
                        ) : isFailed ? (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 text-destructive border-destructive/30 whitespace-nowrap" title={r.error_message || ''}><XCircle className="h-3 w-3" /> Falhou</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 whitespace-nowrap">{r.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientSearchHistory, setClientSearchHistory] = useState<BillingLogRow[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [inlineDialog, setInlineDialog] = useState<{ open: boolean; clienteId: string | null; clienteNome: string }>({ open: false, clienteId: null, clienteNome: "" });
  const [previewLog, setPreviewLog] = useState<BillingLogRow | null>(null);

  const canViewHistory = hasPermission('view_billing_history_quick');
  const canOpenCobrancaModule = hasPermission('view_admin_cobranca');

  const handleSearchClientHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSearchTerm.trim()) return;

    setIsSearchingClient(true);
    try {
      const { data, error } = await supabase
        .from('billing_logs')
        .select('*, clientes(valor, produto, cobranca_ativa, data_renovacao)')
        .or(`cliente_nome.ilike.%${clientSearchTerm}%,cliente_email.ilike.%${clientSearchTerm}%,cliente_numero.ilike.%${clientSearchTerm}%`)
        .order('sent_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setClientSearchHistory((data as BillingLogRow[]) || []);
    } catch (err: any) {
      toast({
        title: "Erro na busca",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSearchingClient(false);
    }
  };

  const summary = useMemo(() => {
    const total = clientSearchHistory.length;
    const enviados = clientSearchHistory.filter(r => ['sent', 'success', 'delivered'].includes(r.status)).length;
    const falhas = clientSearchHistory.filter(r => ['failed', 'error'].includes(r.status)).length;
    return { total, enviados, falhas };
  }, [clientSearchHistory]);

  const actions = [
    { label: "Criar Proposta Rápida", icon: PlusCircle, path: "/propostas", color: "bg-primary/10 text-primary hover:bg-primary/20" },
    { label: "Consultar Número", icon: Search, path: "/admin/consulta-numeros", color: "bg-info/10 text-info hover:bg-info/20" },
    { label: "Recuperação de Boleto", icon: CreditCard, path: "/admin/cobranca?tab=recovery", color: "bg-update/10 text-update hover:bg-update/20" },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="ghost"
          className={`flex items-center gap-2 border border-transparent transition-all duration-200 ${action.color}`}
          onClick={() => navigate(action.path)}
        >
          <action.icon className="h-4 w-4" />
          <span className="font-medium">{action.label}</span>
        </Button>
      ))}

      {canViewHistory && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 border border-transparent transition-all duration-200 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
              <History className="h-4 w-4" />
              <span className="font-medium">Consultar Histórico</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                Consulta Rápida de Histórico
              </DialogTitle>
              <DialogDescription>
                Busque por nome, e-mail ou telefone para ver o que foi enviado (WhatsApp/Email), valores e status.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSearchClientHistory} className="flex gap-2 mb-2">
              <Input
                placeholder="Nome, e-mail ou telefone do cliente..."
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearchingClient}>
                {isSearchingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar"}
              </Button>
            </form>

            {/* Sticky summary bar */}
            {clientSearchHistory.length > 0 && (
              <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/80 backdrop-blur px-3 py-2 text-xs mb-2">
                <span><span className="font-semibold">{summary.total}</span> registros</span>
                <span className="text-emerald-500">✓ {summary.enviados} enviados</span>
                {summary.falhas > 0 && <span className="text-rose-500">✗ {summary.falhas} falhas</span>}
                <span className="ml-auto text-muted-foreground italic">→ role horizontalmente para ver todos os campos</span>
              </div>
            )}

            <div className="flex-1 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead className="whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="whitespace-nowrap">Produto</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Valor</TableHead>
                    <TableHead className="whitespace-nowrap">Situação</TableHead>
                    <TableHead className="whitespace-nowrap">Canal</TableHead>
                    <TableHead className="whitespace-nowrap">Tipo</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="w-[140px] text-right whitespace-nowrap">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientSearchHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        {clientSearchTerm ? "Nenhum histórico encontrado para este termo." : "Digite um termo e clique em buscar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientSearchHistory.map((log) => {
                      const isEmail = log.channel === 'email';
                      const isSuccess = ['sent', 'success', 'delivered'].includes(log.status);
                      const isFailed = ['failed', 'error'].includes(log.status);
                      const valor = log.clientes?.valor;
                      const produto = log.cliente_produto || log.clientes?.produto || '-';
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(log.sent_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-sm font-medium max-w-[180px] truncate" title={log.cliente_nome}>
                            {log.cliente_nome}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate" title={produto}>
                            {produto}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                            {formatCurrency(valor)}
                          </TableCell>
                          <TableCell><PaymentStatusPill cliente={log.clientes} /></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] h-5 gap-1 whitespace-nowrap ${isEmail ? 'text-blue-500 border-blue-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
                              {isEmail ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                              {isEmail ? 'Email' : 'WhatsApp'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] h-5 whitespace-nowrap ${getMessageTypeStyle(log.message_type)}`}>
                              {getMessageTypeLabel(log.message_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isSuccess ? (
                              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-emerald-500 border-emerald-500/30 whitespace-nowrap">
                                <CheckCircle2 className="h-3 w-3" /> Enviado
                              </Badge>
                            ) : isFailed ? (
                              <Badge variant="outline" className="text-[10px] h-5 gap-1 text-destructive border-destructive/30 whitespace-nowrap" title={log.error_message || ''}>
                                <XCircle className="h-3 w-3" /> Falhou
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] h-5 whitespace-nowrap">{log.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {log.cliente_observacoes && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary" title="Ver observações">
                                      <Info className="h-4 w-4" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="bg-card border-border">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        <Info className="h-5 w-5 text-primary" />
                                        Observações do Cliente
                                      </DialogTitle>
                                      <DialogDescription>{log.cliente_nome}</DialogDescription>
                                    </DialogHeader>
                                    <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{log.cliente_observacoes}</p>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-primary"
                                title="Ver prévia da mensagem enviada"
                                onClick={() => setPreviewLog(log)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-amber-500"
                                title="Abrir cliente em Consultar"
                                onClick={() => navigate(`/consultar?q=${encodeURIComponent(log.cliente_nome)}`)}
                              >
                                <User className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-update"
                                title="Ver histórico de cobrança (rápido)"
                                onClick={() => setInlineDialog({ open: true, clienteId: log.cliente_id, clienteNome: log.cliente_nome })}
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                              {canOpenCobrancaModule && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-muted-foreground"
                                  title="Abrir no módulo de Cobrança"
                                  onClick={() => navigate(`/admin/cobranca?tab=logs&q=${encodeURIComponent(log.cliente_nome)}`)}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ClientBillingInlineDialog
        open={inlineDialog.open}
        onOpenChange={(o) => setInlineDialog(s => ({ ...s, open: o }))}
        clienteId={inlineDialog.clienteId}
        clienteNome={inlineDialog.clienteNome}
      />
    </div>
  );
}
