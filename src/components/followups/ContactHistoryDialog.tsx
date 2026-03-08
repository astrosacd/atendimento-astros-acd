import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Clock, CheckCircle, Send, XCircle, AlertCircle, ThumbsUp, ThumbsDown,
  Mail, MessageSquare, ShieldCheck, History,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactPhone: string;
  contactEmail: string;
  contactName: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Agendado', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
  resolved: { label: 'Resolvido', color: 'bg-slate-100 text-slate-700', icon: <ShieldCheck className="h-3 w-3" /> },
};

const conversionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  converted: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700', icon: <ThumbsUp className="h-3 w-3" /> },
  not_converted: { label: 'Não convertido', color: 'bg-rose-100 text-rose-700', icon: <ThumbsDown className="h-3 w-3" /> },
};

export function ContactHistoryDialog({ open, onOpenChange, contactPhone, contactEmail, contactName }: ContactHistoryDialogProps) {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['contact-history', contactPhone, contactEmail],
    enabled: open && !!(contactPhone || contactEmail),
    queryFn: async () => {
      // Build OR filter for phone and email across manual and client fields
      const conditions: string[] = [];
      if (contactPhone) {
        conditions.push(`manual_phone.eq.${contactPhone}`);
      }
      if (contactEmail) {
        conditions.push(`manual_email.eq.${contactEmail}`);
      }

      const { data, error } = await supabase
        .from('client_followups')
        .select('*, clientes(nome, email, numero)')
        .or(conditions.join(','))
        .order('scheduled_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Also filter by linked client phone/email
      let results = data || [];
      if (contactPhone || contactEmail) {
        const { data: linkedData } = await supabase
          .from('client_followups')
          .select('*, clientes!inner(nome, email, numero)')
          .or(
            [
              contactPhone ? `numero.eq.${contactPhone}` : '',
              contactEmail ? `email.eq.${contactEmail}` : '',
            ].filter(Boolean).join(','),
            { referencedTable: 'clientes' }
          )
          .order('scheduled_at', { ascending: false })
          .limit(50);

        if (linkedData) {
          const existingIds = new Set(results.map((r: any) => r.id));
          for (const item of linkedData) {
            if (!existingIds.has(item.id)) {
              results.push(item);
            }
          }
          results.sort((a: any, b: any) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());
        }
      }

      return results as any[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Envios — {contactName}
          </DialogTitle>
        </DialogHeader>

        {contactPhone && (
          <p className="text-xs text-muted-foreground">📱 {contactPhone}</p>
        )}
        {contactEmail && (
          <p className="text-xs text-muted-foreground">📧 {contactEmail}</p>
        )}

        <ScrollArea className="max-h-[55vh] pr-2">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhum registro encontrado para este contato</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item: any, idx: number) => {
                const status = statusConfig[item.status] || statusConfig.pending;
                const conversion = item.conversion_status ? conversionConfig[item.conversion_status] : null;
                const isLatest = idx === 0;

                return (
                  <div
                    key={item.id}
                    className={`relative border rounded-lg p-3 space-y-2 ${isLatest ? 'border-primary/40 bg-primary/5' : ''}`}
                  >
                    {isLatest && (
                      <div className="flex justify-end mb-1">
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground">
                          Último envio
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm break-words">{item.produto}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(item.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.channel === 'email' ? <Mail className="h-3.5 w-3.5 text-muted-foreground" /> :
                         item.channel === 'whatsapp' ? <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> :
                         <><Mail className="h-3.5 w-3.5 text-muted-foreground" /><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /></>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="secondary" className={`${status.color} gap-1 text-[10px] px-1.5 py-0`}>
                        {status.icon} {status.label}
                      </Badge>
                      {conversion && (
                        <Badge variant="secondary" className={`${conversion.color} gap-1 text-[10px] px-1.5 py-0`}>
                          {conversion.icon} {conversion.label}
                        </Badge>
                      )}
                      {item.is_recurring && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          🔁 {item.current_attempt}/{item.max_attempts}
                        </Badge>
                      )}
                    </div>

                    {item.conversion_note && (
                      <p className="text-xs text-muted-foreground italic border-t pt-1.5 mt-1">
                        💬 {item.conversion_note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <p className="text-xs text-muted-foreground text-center">
          {history.length} registro(s) encontrado(s)
        </p>
      </DialogContent>
    </Dialog>
  );
}
