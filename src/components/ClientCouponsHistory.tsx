import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Gift, MessageSquare, Mail, CheckCircle2, XCircle, TrendingUp, User } from 'lucide-react';

interface Props {
  clienteId: string;
}

interface CouponLog {
  id: string;
  sent_at: string;
  channel: string;
  status: string;
  error_message: string | null;
  resolution_note: string | null;
  operador_id: string | null;
  operador_email: string | null;
  desconto: string | null;
  link: string | null;
  converted: boolean;
}

function parseNote(note: string | null): { operador_id: string | null; desconto: string | null; link: string | null } {
  if (!note) return { operador_id: null, desconto: null, link: null };
  const op = note.match(/operador:([0-9a-f-]+)/i)?.[1] ?? null;
  const desc = note.match(/desconto:([^|]+)/)?.[1] ?? null;
  const link = note.match(/link:(.+)$/)?.[1] ?? null;
  return { operador_id: op, desconto: desc, link };
}

export function ClientCouponsHistory({ clienteId }: Props) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CouponLog[]>([]);

  useEffect(() => {
    if (!clienteId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = supabase as any;
        const [{ data: rows }, { data: payments }] = await Promise.all([
          s
            .from('billing_logs')
            .select('id, sent_at, channel, status, error_message, resolution_note')
            .eq('cliente_id', clienteId)
            .eq('message_type', 'cupom_desconto')
            .order('sent_at', { ascending: false })
            .limit(100),
          s
            .from('client_payments')
            .select('paid_at, created_at, status')
            .eq('cliente_id', clienteId)
            .in('status', ['confirmado', 'aprovado', 'pago', 'confirmed', 'approved', 'paid'])
            .order('paid_at', { ascending: false })
            .limit(100),
        ]);

        const operatorIds = new Set<string>();
        const enriched: CouponLog[] = (rows || []).map((r: any) => {
          const meta = parseNote(r.resolution_note);
          if (meta.operador_id) operatorIds.add(meta.operador_id);
          // Conversão: pagamento confirmado dentro de 14 dias após envio
          const sent = new Date(r.sent_at).getTime();
          const converted = (payments || []).some((p: any) => {
            const when = new Date(p.paid_at || p.created_at).getTime();
            return when >= sent && when - sent <= 14 * 86400000;
          });
          return {
            id: r.id,
            sent_at: r.sent_at,
            channel: r.channel,
            status: r.status,
            error_message: r.error_message,
            resolution_note: r.resolution_note,
            operador_id: meta.operador_id,
            operador_email: null,
            desconto: meta.desconto,
            link: meta.link,
            converted,
          };
        });

        // Resolve nomes/emails dos operadores
        if (operatorIds.size > 0) {
          const { data: profs } = await s
            .from('profiles')
            .select('user_id, name, email')
            .in('user_id', Array.from(operatorIds));
          const map = new Map<string, string>();
          (profs || []).forEach((p: any) => map.set(p.user_id, p.name || p.email || p.user_id));
          enriched.forEach((e) => {
            if (e.operador_id) e.operador_email = map.get(e.operador_id) || e.operador_id;
          });
        }
        if (alive) setLogs(enriched);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [clienteId]);

  if (loading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Gift className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nenhum cupom de desconto enviado para este cliente.</p>
      </div>
    );
  }

  const sent = logs.filter((l) => l.status === 'sent');
  const converted = sent.filter((l) => l.converted).length;
  const taxa = sent.length > 0 ? Math.round((converted / sent.length) * 100) : 0;

  // Resumo por operador
  const porOperador = sent.reduce<Record<string, { nome: string; total: number; conv: number }>>((acc, l) => {
    const key = l.operador_email || l.operador_id || 'desconhecido';
    if (!acc[key]) acc[key] = { nome: key, total: 0, conv: 0 };
    acc[key].total += 1;
    if (l.converted) acc[key].conv += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Enviados</p>
          <p className="text-xl font-bold">{sent.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Convertidos</p>
          <p className="text-xl font-bold text-emerald-500">{converted}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Taxa de conversão</p>
          <p className="text-xl font-bold flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {taxa}%
          </p>
        </div>
      </div>

      {Object.keys(porOperador).length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-[10px] uppercase text-muted-foreground mb-2 font-semibold">Por operador</p>
          <div className="space-y-1">
            {Object.values(porOperador).map((o) => (
              <div key={o.nome} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 truncate">
                  <User className="h-3 w-3" /> {o.nome}
                </span>
                <span className="text-muted-foreground shrink-0 ml-2">
                  {o.total} enviado(s) · {o.conv} convertido(s)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="space-y-2">
        {logs.map((l) => {
          const ChanIcon = l.channel === 'whatsapp' ? MessageSquare : Mail;
          return (
            <div key={l.id} className="rounded-lg border bg-card p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Gift className="h-4 w-4 text-pink-500" />
                  Cupom {l.desconto || '—'}
                  <Badge variant="outline" className="gap-1 text-[10px]">
                    <ChanIcon className="h-3 w-3" />
                    {l.channel}
                  </Badge>
                  {l.status === 'sent' ? (
                    <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Enviado
                    </Badge>
                  ) : (
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1">
                      <XCircle className="h-3 w-3" /> Erro
                    </Badge>
                  )}
                  {l.status === 'sent' && (
                    l.converted ? (
                      <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-600/30">Convertido</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Sem conversão</Badge>
                    )
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {new Date(l.sent_at).toLocaleString('pt-BR')}
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                {l.operador_email && <span>Operador: <strong className="text-foreground">{l.operador_email}</strong></span>}
                {l.link && (
                  <a href={l.link} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate max-w-[260px]">
                    {l.link}
                  </a>
                )}
                {l.error_message && <span className="text-destructive">Erro: {l.error_message}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
