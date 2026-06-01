import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  History, CreditCard, Mail, FileText, CheckSquare, ShoppingBag, 
  File, RefreshCw, ChevronDown, AlertTriangle, Send, MessageSquare,
  Clock, ArrowUpDown, Image, Key, Columns3, Zap, Users, Award, ExternalLink, User,
  Sparkles, ShoppingCart, PhoneCall, CalendarClock, TrendingUp, Lightbulb, Instagram,
  ShieldCheck, ShieldAlert, ShieldOff, Search, Smartphone
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimelineEvent {
  id: string;
  type: 'history' | 'billing' | 'payment' | 'followup' | 'proposal' | 'task' | 'purchase' | 'file' | 'recovery' | 'whatsapp_group' | 'logo' | 'credential' | 'pipeline' | 'automation' | 'license' | 'share_link' | 'client' | 'ai_log' | 'ticket' | 'appointment' | 'sale' | 'sms_validation' | 'ia_call' | 'scheduled_call' | 'score_change' | 'upsell' | 'social_profile' | 'insurance' | 'scan' | 'sms' | 'rcs';
  date: string;
  title: string;
  description: string;
  status?: string;
  metadata?: Record<string, any>;
}

interface ClientUnifiedTimelineProps {
  clienteId: string;
  clienteName: string;
}

const TYPE_CONFIG: Record<TimelineEvent['type'], { icon: React.ElementType; color: string; label: string }> = {
  history: { icon: History, color: 'text-info', label: 'Alteração' },
  billing: { icon: Mail, color: 'text-amber-500', label: 'Cobrança' },
  payment: { icon: CreditCard, color: 'text-primary', label: 'Pagamento' },
  followup: { icon: Send, color: 'text-violet-500', label: 'Follow-up' },
  proposal: { icon: FileText, color: 'text-blue-500', label: 'Proposta' },
  task: { icon: CheckSquare, color: 'text-emerald-500', label: 'Tarefa' },
  purchase: { icon: ShoppingBag, color: 'text-orange-500', label: 'Compra' },
  file: { icon: File, color: 'text-cyan-500', label: 'Arquivo' },
  recovery: { icon: AlertTriangle, color: 'text-red-500', label: 'Recuperação' },
  whatsapp_group: { icon: Users, color: 'text-green-500', label: 'Grupo WhatsApp' },
  logo: { icon: Image, color: 'text-pink-500', label: 'Logo' },
  credential: { icon: Key, color: 'text-yellow-500', label: 'Credencial' },
  pipeline: { icon: Columns3, color: 'text-indigo-500', label: 'Pipeline' },
  automation: { icon: Zap, color: 'text-teal-500', label: 'Automação' },
  license: { icon: Award, color: 'text-lime-500', label: 'Licença' },
  share_link: { icon: ExternalLink, color: 'text-sky-500', label: 'Link Compartilhado' },
  client: { icon: User, color: 'text-blue-500', label: 'Cadastro' },
  ai_log: { icon: Sparkles, color: 'text-primary', label: 'Insight IA' },
  ticket: { icon: MessageSquare, color: 'text-orange-500', label: 'Chamado' },
  appointment: { icon: Clock, color: 'text-blue-400', label: 'Agendamento' },
  sale: { icon: ShoppingCart, color: 'text-emerald-500', label: 'Venda' },
  sms_validation: { icon: Zap, color: 'text-amber-400', label: 'Validação SMS' },
  ia_call: { icon: PhoneCall, color: 'text-fuchsia-500', label: 'Ligação IA' },
  scheduled_call: { icon: CalendarClock, color: 'text-fuchsia-400', label: 'Ligação Agendada' },
  score_change: { icon: TrendingUp, color: 'text-emerald-400', label: 'Score IA' },
  upsell: { icon: Lightbulb, color: 'text-yellow-400', label: 'Sugestão Upsell' },
  social_profile: { icon: Instagram, color: 'text-pink-400', label: 'Perfil Social' },
  insurance: { icon: ShieldCheck, color: 'text-emerald-500', label: 'Seguro' },
  scan: { icon: Search, color: 'text-blue-500', label: 'Scan de QR' },
  sms: { icon: MessageSquare, color: 'text-blue-400', label: 'SMS Enviado' },
  rcs: { icon: Smartphone, color: 'text-indigo-400', label: 'RCS Enviado' },
};

export function ClientUnifiedTimeline({ clienteId, clienteName }: ClientUnifiedTimelineProps) {
  const { canViewClientAI } = usePermissions();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    if (clienteId) {
      loadAllEvents();
    }
  }, [clienteId]);

  const loadAllEvents = async () => {
    setLoading(true);
    try {
      // Execute queries individually to avoid TypeScript "Type instantiation is excessively deep" error
      // that occurs when combining many complex Supabase query types in a single Promise.all array.
      const historyRes = await supabase.from('client_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const billingRes = await supabase.from('billing_logs').select('*').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(50);
      const paymentsRes = await supabase.from('client_payments').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const followupsRes = await supabase.from('client_followups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const tasksRes = await supabase.from('client_tasks').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const purchasesRes = await supabase.from('client_purchases').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const filesRes = await supabase.from('client_files').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const recoveryRes = await supabase.from('client_recovery_attempts').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const whatsappGroupsRes = await supabase.from('client_whatsapp_groups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const logosRes = await supabase.from('client_logos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const credentialsRes = await supabase.from('client_social_credentials').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const pipelineRes = await supabase.from('client_pipeline').select('*, stage:pipeline_stages(name)').eq('cliente_id', clienteId).limit(10);
      const automationRes = await supabase.from('automation_logs').select('*, rule:automation_rules(name)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const licensesRes = await supabase.from('licencas_entregues').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const shareLinksRes = await supabase.from('social_credential_share_links').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const proposalsRes = await supabase.from('proposals').select('*').eq('client_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const clientDataRes = await supabase.from('clientes').select('*').eq('id', clienteId).single();
      const aiLogsRes = canViewClientAI() ? await supabase.from('client_ai_logs').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50) : { data: [] };
      const ticketsRes = await supabase.from('chamados').select('*').or(`email.eq.${clienteId},contato.eq.${clienteId}`).order('created_at', { ascending: false }).limit(50);
      const appointmentsRes = await supabase.from('calendar_events').select('*').or(`client_email.eq.${clienteId},client_phone.eq.${clienteId}`).order('created_at', { ascending: false }).limit(50);
      const salesRes = await supabase.from('gateway_orders').select('*').eq('customer_email', clienteId).order('created_at', { ascending: false }).limit(50);
      const smsLogsRes = await supabase.from('sms_validation_logs').select('*').eq('numero', clienteId).order('created_at', { ascending: false }).limit(50);
      const iaCallsRes = await supabase.from('ligacoes_ia_historico').select('*, roteiro:ligacoes_ia_roteiros(nome)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const scheduledCallsRes = await supabase.from('ligacoes_agendadas').select('*, roteiro:ligacoes_ia_roteiros(nome)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const scoreHistoryRes = await supabase.from('client_score_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const upsellRes = await supabase.from('client_ai_upsell_suggestions').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20);
      const socialProfilesRes = await supabase.from('social_media_client_profiles').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20);
      const insuranceUsageRes = await supabase.from('qr_scan_insurance_usage').select('*').or(`cliente_nome.ilike.%${clienteName}%`).order('created_at', { ascending: false }).limit(50);
      const scanHistoryRes = await supabase.from('qr_scan_history').select('*').or(`cliente_nome.ilike.%${clienteName}%`).order('created_at', { ascending: false }).limit(50);
      const smsHistoryRes = await supabase.from('sms_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);
      const rcsHistoryRes = await supabase.from('rcs_messages').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50);

      const allEvents: TimelineEvent[] = [];

      // Mapping RCS History
      (rcsHistoryRes.data || []).forEach((r: any) => {
        allEvents.push({
          id: `rcs-${r.id}`,
          type: 'rcs',
          date: r.created_at,
          title: `RCS: ${r.status === 'sent' ? 'Enviado' : (r.status === 'failed' ? 'Erro' : 'Pendente')}`,
          description: r.message_text,
          status: r.status,
          metadata: { error: r.error_message }
        });
      });

      // Mapping SMS History
      (smsHistoryRes.data || []).forEach((s: any) => {
        allEvents.push({
          id: `sms-${s.id}`,
          type: 'sms',
          date: s.created_at,
          title: `SMS: ${s.status === 'enviado' ? 'Enviado' : 'Erro'}`,
          description: s.conteudo,
          status: s.status,
          metadata: { error: s.error_message }
        });
      });

      // Client Base Info
      if (clientDataRes.data) {
        const c = clientDataRes.data;
        allEvents.push({
          id: `client-base-${c.id}`,
          type: 'client',
          date: c.created_at,
          title: `Cliente Cadastrado: ${c.nome}`,
          description: `${c.produto ? `Produto: ${c.produto}` : ''}${c.email ? ` — Email: ${c.email}` : ''}${c.numero ? ` — Tel: ${c.numero}` : ''}`,
          status: 'Ativo',
        });
      }

      setEvents(allEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Timeline Unificada
        </h2>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm">Este cliente ainda não possui registros na timeline.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
           {events.slice(0, visibleCount).map((event) => {
             const config = TYPE_CONFIG[event.type];
             const Icon = config.icon;
             return (
               <div key={event.id} className="flex gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                 <div className={cn("mt-1 p-2 rounded-full bg-background border shadow-sm", config.color)}>
                   <Icon className="h-4 w-4" />
                 </div>
                 <div className="flex-1 space-y-1">
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-medium leading-none">{event.title}</p>
                     <span className="text-xs text-muted-foreground">
                       {new Date(event.date).toLocaleString('pt-BR')}
                     </span>
                   </div>
                   <p className="text-xs text-muted-foreground">{event.description}</p>
                 </div>
               </div>
             );
           })}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

function Card({ children, className }: any) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}>{children}</div>;
}

function CardContent({ children, className }: any) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
