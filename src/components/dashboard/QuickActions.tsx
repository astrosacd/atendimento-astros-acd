import { Button } from "@/components/ui/button";
import { Search, CreditCard, PlusCircle, History, Info, Loader2, MessageCircle, Mail, CheckCircle2, XCircle, ExternalLink, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";

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
  clientes?: { valor: number | null; produto: string | null; cobranca_ativa: boolean | null; data_renovacao: string | null } | null;
};

const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
};

export function QuickActions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clientSearchHistory, setClientSearchHistory] = useState<any[]>([]);
  const [isSearchingClient, setIsSearchingClient] = useState(false);

  const canViewHistory = hasPermission('view_billing_history_quick');

  const handleSearchClientHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSearchTerm.trim()) return;

    setIsSearchingClient(true);
    try {
      const { data, error } = await supabase
        .from('billing_logs')
        .select('*')
        .or(`cliente_nome.ilike.%${clientSearchTerm}%,cliente_email.ilike.%${clientSearchTerm}%,cliente_numero.ilike.%${clientSearchTerm}%`)
        .order('sent_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setClientSearchHistory(data || []);
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

  const getMessageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'd_menos_3': 'Vencimento em 3 dias',
      'd_zero': 'Vencimento hoje',
      'd_mais_1': 'Vencido há 1 dia',
      'd_mais_2': 'Vencido há 2 dias',
      'd_mais_15': 'Vencido há 15 dias',
      'd_mais_30': 'Vencido há 30 dias',
      'recibo': 'Recibo',
    };
    return labels[type] || type;
  };

  const actions = [
    {
      label: "Criar Proposta Rápida",
      icon: PlusCircle,
      path: "/propostas",
      color: "bg-primary/10 text-primary hover:bg-primary/20",
    },
    {
      label: "Consultar Número",
      icon: Search,
      path: "/admin/consulta-numeros",
      color: "bg-info/10 text-info hover:bg-info/20",
    },
    {
      label: "Recuperação de Boleto",
      icon: CreditCard,
      path: "/admin/cobranca?tab=recovery",
      color: "bg-update/10 text-update hover:bg-update/20",
    },
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
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-500" />
                Consulta Rápida de Histórico
              </DialogTitle>
              <DialogDescription>
                Busque por nome, e-mail ou telefone para ver o que foi enviado para o cliente.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSearchClientHistory} className="flex gap-2 mb-4">
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

            <div className="flex-1 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="w-[40px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientSearchHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                        {clientSearchTerm ? "Nenhum histórico encontrado para este termo." : "Digite um termo e clique em buscar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientSearchHistory.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs">
                          {new Date(log.sent_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {log.cliente_produto || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {getMessageTypeLabel(log.message_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.cliente_observacoes && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-primary">
                                  <Search className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-card border-border">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5 text-primary" />
                                    Observações do Cliente
                                  </DialogTitle>
                                  <DialogDescription>
                                    {log.cliente_nome}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {log.cliente_observacoes}
                                  </p>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
