import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  History, CreditCard, Mail, FileText, CheckSquare, ShoppingBag, 
  File, RefreshCw, ChevronDown, AlertTriangle, Send, MessageSquare,
  Clock, ArrowUpDown, Image, Key, Columns3, Zap, Users, Award, ExternalLink, User,
  Sparkles, ShoppingCart, PhoneCall, CalendarClock, TrendingUp, Lightbulb, Instagram
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimelineEvent {
  id: string;
  type: 'history' | 'billing' | 'payment' | 'followup' | 'proposal' | 'task' | 'purchase' | 'file' | 'recovery' | 'whatsapp_group' | 'logo' | 'credential' | 'pipeline' | 'automation' | 'license' | 'share_link' | 'client' | 'ai_log' | 'ticket' | 'appointment' | 'sale' | 'sms_validation' | 'ia_call' | 'scheduled_call' | 'score_change' | 'upsell' | 'social_profile';
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
      const [
        historyRes,
        billingRes,
        paymentsRes,
        followupsRes,
        tasksRes,
        purchasesRes,
        filesRes,
        recoveryRes,
        whatsappGroupsRes,
        logosRes,
        credentialsRes,
        pipelineRes,
        automationRes,
        licensesRes,
        shareLinksRes,
        proposalsRes,
        clientDataRes,
        aiLogsRes,
        ticketsRes,
        appointmentsRes,
        salesRes,
        smsLogsRes,
        iaCallsRes,
        scheduledCallsRes,
        scoreHistoryRes,
        upsellRes,
        socialProfilesRes,
      ] = await Promise.all([
        supabase.from('client_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('billing_logs').select('*').eq('cliente_id', clienteId).order('sent_at', { ascending: false }).limit(50),
        supabase.from('client_payments').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_followups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_tasks').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_purchases').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_files').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_recovery_attempts').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_whatsapp_groups').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_logos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_social_credentials').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_pipeline').select('*, stage:pipeline_stages(name)').eq('cliente_id', clienteId).limit(10),
        supabase.from('automation_logs').select('*, rule:automation_rules(name)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('licencas_entregues').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('social_credential_share_links').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('proposals').select('*').eq('client_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('clientes').select('*').eq('id', clienteId).single(),
        canViewClientAI() ? supabase.from('client_ai_logs').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        supabase.from('chamados').select('*').or(`email.eq.${clienteId},contato.eq.${clienteId}`).order('created_at', { ascending: false }).limit(50),
        supabase.from('calendar_events').select('*').or(`client_email.eq.${clienteId},client_phone.eq.${clienteId}`).order('created_at', { ascending: false }).limit(50),
        supabase.from('gateway_orders').select('*').eq('customer_email', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('sms_validation_logs').select('*').eq('numero', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('ligacoes_ia_historico').select('*, roteiro:ligacoes_ia_roteiros(nome)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('ligacoes_agendadas').select('*, roteiro:ligacoes_ia_roteiros(nome)').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_score_history').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(50),
        supabase.from('client_ai_upsell_suggestions').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
        supabase.from('social_media_client_profiles').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }).limit(20),
      ]);

      const clientInfo = clientDataRes.data;
      const clientEmail = clientInfo?.email;
      const clientPhone = clientInfo?.numero;

      // Re-fetch some by email/phone if we have them
      if (clientEmail || clientPhone) {
        const [extraTickets, extraAppointments, extraSales, extraSms] = await Promise.all([
          clientEmail ? supabase.from('chamados').select('*').eq('email', clientEmail).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
          clientEmail ? supabase.from('calendar_events').select('*').eq('client_email', clientEmail).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
          clientEmail ? supabase.from('gateway_orders').select('*').eq('customer_email', clientEmail).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
          clientPhone ? supabase.from('sms_validation_logs').select('*').eq('numero', clientPhone).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        ]);
        
        // Merge or replace results
        if (extraTickets.data) ticketsRes.data = extraTickets.data;
        if (extraAppointments.data) appointmentsRes.data = extraAppointments.data;
        if (extraSales.data) salesRes.data = extraSales.data;
        if (extraSms.data) smsLogsRes.data = extraSms.data;
      }

      const allEvents: TimelineEvent[] = [];

      // Client history
      (historyRes.data || []).forEach((h: any) => {
        const actionLabels: Record<string, string> = { created: 'Cliente cadastrado', updated: 'Cliente atualizado', deleted: 'Cliente excluído' };
        allEvents.push({
          id: `history-${h.id}`,
          type: 'history',
          date: h.created_at,
          title: actionLabels[h.action] || h.action,
          description: h.changed_fields?.length ? `Campos: ${h.changed_fields.join(', ')}` : (h.changed_by_email ? `Por: ${h.changed_by_email}` : ''),
          status: h.action,
        });
      });

      // Billing logs
      (billingRes.data || []).forEach((b: any) => {
        const statusLabels: Record<string, string> = { sent: 'Enviado', error: 'Erro', pending: 'Pendente' };
        allEvents.push({
          id: `billing-${b.id}`,
          type: 'billing',
          date: b.sent_at,
          title: `Cobrança ${b.message_type || ''}`.trim(),
          description: `Canal: ${b.channel}${b.error_message ? ` — ${b.error_message}` : ''}`,
          status: b.status,
        });
      });

      // Payments
      (paymentsRes.data || []).forEach((p: any) => {
        const statusLabels: Record<string, string> = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado', cancelled: 'Cancelado' };
        allEvents.push({
          id: `payment-${p.id}`,
          type: 'payment',
          date: p.created_at,
          title: `Pagamento ${statusLabels[p.status] || p.status}`,
          description: `R$ ${Number(p.amount).toFixed(2)} — ${p.payment_type}`,
          status: p.status,
        });
      });

      // Follow-ups
      (followupsRes.data || []).forEach((f: any) => {
        const statusLabels: Record<string, string> = { pending: 'Pendente', sent: 'Enviado', completed: 'Concluído', cancelled: 'Cancelado', failed: 'Falhou', resolved: 'Resolvido' };
        allEvents.push({
          id: `followup-${f.id}`,
          type: 'followup',
          date: f.created_at,
          title: `Follow-up: ${f.produto}`,
          description: `Canal: ${f.channel} — ${statusLabels[f.status] || f.status}`,
          status: f.status,
        });
      });

      // Tasks
      (tasksRes.data || []).forEach((t: any) => {
        const statusLabels: Record<string, string> = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada' };
        allEvents.push({
          id: `task-${t.id}`,
          type: 'task',
          date: t.created_at,
          title: `Tarefa: ${t.title}`,
          description: `${t.codigo || ''} — ${statusLabels[t.status] || t.status}${t.priority ? ` (${t.priority})` : ''}`,
          status: t.status,
        });
      });

      // Purchases
      (purchasesRes.data || []).forEach((p: any) => {
        allEvents.push({
          id: `purchase-${p.id}`,
          type: 'purchase',
          date: p.created_at,
          title: `Compra: ${p.produto}`,
          description: `${p.moeda === 'USD' ? '$' : 'R$'} ${Number(p.valor).toFixed(2)}${p.descricao ? ` — ${p.descricao}` : ''}`,
        });
      });

      // Files
      (filesRes.data || []).forEach((f: any) => {
        allEvents.push({
          id: `file-${f.id}`,
          type: 'file',
          date: f.created_at,
          title: `Arquivo: ${f.file_name}`,
          description: f.file_type || '',
        });
      });

      // Recovery attempts
      (recoveryRes.data || []).forEach((r: any) => {
        allEvents.push({
          id: `recovery-${r.id}`,
          type: 'recovery',
          date: r.created_at,
          title: `Recuperação — ${r.canal}`,
          description: `${r.status}${r.converteu ? ' ✓ Converteu' : ''}${r.error_message ? ` — ${r.error_message}` : ''}`,
          status: r.status,
        });
      });

      // WhatsApp Groups
      (whatsappGroupsRes.data || []).forEach((g: any) => {
        allEvents.push({
          id: `whatsapp-${g.id}`,
          type: 'whatsapp_group',
          date: g.created_at,
          title: `Grupo: ${g.group_name}`,
          description: `${g.participants?.length || 0} participantes${g.motivo ? ` — ${g.motivo}` : ''}`,
          status: g.status,
        });
      });

      // Logos
      (logosRes.data || []).forEach((l: any) => {
        allEvents.push({
          id: `logo-${l.id}`,
          type: 'logo',
          date: l.created_at,
          title: `Logo: ${l.file_name}`,
          description: l.description || l.file_type || '',
        });
      });

      // Social Credentials
      (credentialsRes.data || []).forEach((c: any) => {
        allEvents.push({
          id: `credential-${c.id}`,
          type: 'credential',
          date: c.created_at,
          title: `Credencial: ${c.platform}`,
          description: `Login: ${c.login}`,
        });
      });

      // Pipeline
      (pipelineRes.data || []).forEach((p: any) => {
        const stageName = (p.stage as any)?.name || 'Sem etapa';
        allEvents.push({
          id: `pipeline-${p.id}`,
          type: 'pipeline',
          date: p.moved_at,
          title: `Pipeline: ${stageName}`,
          description: p.notes || (p.is_lead ? 'Lead' : 'Cliente'),
          status: p.is_lead ? 'lead' : 'cliente',
        });
      });

      // Automation logs
      (automationRes.data || []).forEach((a: any) => {
        const ruleName = (a.rule as any)?.name || 'Regra';
        allEvents.push({
          id: `automation-${a.id}`,
          type: 'automation',
          date: a.created_at,
          title: `Automação: ${ruleName}`,
          description: `${a.action_taken}${a.result ? ` — ${a.result}` : ''}`,
        });
      });

      // Licenças entregues
      (licensesRes.data || []).forEach((l: any) => {
        allEvents.push({
          id: `license-${l.id}`,
          type: 'license',
          date: l.data_entrega || l.created_at,
          title: `Licença: ${l.ferramenta}`,
          description: `${l.origem ? `Origem: ${l.origem}` : ''}${l.observacao ? ` — ${l.observacao}` : ''}`.trim() || 'Licença entregue',
        });
      });

      // Links de compartilhamento de credenciais
      (shareLinksRes.data || []).forEach((s: any) => {
        const expiresAt = new Date(s.expires_at).toLocaleDateString('pt-BR');
        allEvents.push({
          id: `share-link-${s.id}`,
          type: 'share_link',
          date: s.created_at,
          title: 'Link de credenciais compartilhado',
          description: `Expira em: ${expiresAt}`,
        });
      });
      
      // Propostas
      (proposalsRes.data || []).forEach((p: any) => {
        allEvents.push({
          id: `proposal-${p.id}`,
          type: 'proposal',
          date: p.created_at,
          title: `Proposta: ${p.title || 'Sem título'}`,
          description: `Status: ${p.status || 'Pendente'}`,
          status: p.status,
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
          description: `${c.produto ? `Produto: ${c.produto}` : ''}${c.email ? ` — Email: ${c.email}` : ''}${c.numero ? ` — Tel: ${c.numero}` : ''}${c.tags?.length ? ` — Tags: ${c.tags.join(', ')}` : ''}`,
          status: 'Ativo',
        });
      }

      // AI Logs
      (aiLogsRes.data || []).forEach((a: any) => {
        const modeLabels: Record<string, string> = { 
          summary: 'Briefing', 
          churn: 'Análise de Churn',
          'recovery-message': 'Mensagem de Recuperação'
        };
        allEvents.push({
          id: `ai-log-${a.id}`,
          type: 'ai_log',
          date: a.created_at,
          title: `Insight de IA gerado (${modeLabels[a.mode] || a.mode})`,
          description: `Modelo: ${a.model}`,
        });
      });

      // Chamados
      (ticketsRes.data || []).forEach((t: any) => {
        allEvents.push({
          id: `ticket-${t.id}`,
          type: 'ticket',
          date: t.created_at,
          title: `Chamado: ${t.codigo}`,
          description: `${t.motivo} — ${t.status}`,
          status: t.status,
        });
      });

      // Agendamentos
      (appointmentsRes.data || []).forEach((a: any) => {
        allEvents.push({
          id: `appointment-${a.id}`,
          type: 'appointment',
          date: a.start_time,
          title: `Agenda: ${a.title}`,
          description: `${new Date(a.start_time).toLocaleTimeString('pt-BR')} — ${a.status}`,
          status: a.status,
        });
      });

      // Sales
      (salesRes.data || []).forEach((s: any) => {
        allEvents.push({
          id: `sale-${s.id}`,
          type: 'sale',
          date: s.created_at,
          title: `Venda: Pedido #${s.id.slice(0, 8)}`,
          description: `${s.currency === 'BRL' ? 'R$' : '$'} ${Number(s.total).toFixed(2)} — ${s.status}`,
          status: s.status,
        });
      });

      // SMS Logs
      (smsLogsRes.data || []).forEach((sms: any) => {
        allEvents.push({
          id: `sms-${sms.id}`,
          type: 'sms_validation',
          date: sms.created_at,
          title: 'Validação SMS',
          description: `${sms.resultado} — ${sms.motivo || ''}`,
          status: sms.resultado === 'sucesso' ? 'default' : 'destructive',
        });
      });

      // Ligações IA (histórico de chamadas feitas)
      (iaCallsRes.data || []).forEach((c: any) => {
        const roteiroNome = (c.roteiro as any)?.nome || 'Sem roteiro';
        const dur = c.duration_seconds ? ` — ${c.duration_seconds}s` : '';
        const statusLabel = IA_CALL_STATUS_LABEL[c.status] || c.status;
        allEvents.push({
          id: `ia-call-${c.id}`,
          type: 'ia_call',
          date: c.created_at,
          title: `Ligação IA: ${roteiroNome}`,
          description: `${c.numero_destino || ''} — ${statusLabel}${dur}${c.source ? ` (${c.source})` : ''}${c.error_message ? ` — ${c.error_message}` : ''}`,
          status: statusLabel,
        });
      });

      // Ligações Agendadas (fila de cobrança IA)
      (scheduledCallsRes.data || []).forEach((s: any) => {
        const roteiroNome = (s.roteiro as any)?.nome || 'Sem roteiro';
        const statusLabel = SCHEDULED_CALL_STATUS_LABEL[s.status] || s.status;
        allEvents.push({
          id: `sched-call-${s.id}`,
          type: 'scheduled_call',
          date: s.created_at,
          title: `Ligação agendada: ${roteiroNome}`,
          description: `${s.tipo_d || ''} — alvo: ${s.dia_alvo} — ${statusLabel}${s.tentativas ? ` (tent. ${s.tentativas})` : ''}${s.erro ? ` — ${s.erro}` : ''}`,
          status: statusLabel,
        });
      });

      // Histórico de Score IA
      (scoreHistoryRes.data || []).forEach((s: any) => {
        const delta = (s.score_novo ?? 0) - (s.score_anterior ?? 0);
        const sign = delta > 0 ? '+' : '';
        allEvents.push({
          id: `score-${s.id}`,
          type: 'score_change',
          date: s.created_at,
          title: `Score: ${s.score_anterior ?? 0} → ${s.score_novo ?? 0} (${sign}${delta})`,
          description: `${s.faixa_anterior || '—'} → ${s.faixa_nova || '—'}${s.motivo ? ` — ${s.motivo}` : ''}`,
          status: s.faixa_nova,
        });
      });

      // Sugestões de Upsell IA
      (upsellRes.data || []).forEach((u: any) => {
        const count = Array.isArray(u.suggestions) ? u.suggestions.length : 0;
        allEvents.push({
          id: `upsell-${u.id}`,
          type: 'upsell',
          date: u.last_analysis_at || u.created_at,
          title: `Sugestões de upsell geradas`,
          description: `${count} sugestão(ões) — status: ${u.status || 'pendente'}`,
          status: u.status,
        });
      });

      // Perfis de Redes Sociais vinculados
      (socialProfilesRes.data || []).forEach((p: any) => {
        allEvents.push({
          id: `social-profile-${p.id}`,
          type: 'social_profile',
          date: p.created_at,
          title: `Perfil Instagram vinculado: @${p.username || 'sem usuário'}`,
          description: `${p.display_name || ''}${p.followers_count ? ` — ${p.followers_count} seguidores` : ''}${p.oauth_connected ? ' — OAuth conectado' : ''}`,
          status: p.is_active ? 'Ativo' : 'Inativo',
        });
      });

      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading timeline:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events
    .filter(e => filter === 'all' || e.type === filter)
    .sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  const getStatusBadgeVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!status) return 'secondary';
    if (['paid', 'sent', 'completed', 'converted', 'resolved', 'created', 'Ativo', 'registrado'].includes(status)) return 'default';
    if (['error', 'failed', 'overdue', 'deleted', 'cancelled'].includes(status)) return 'destructive';
    return 'outline';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelative = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return formatDateTime(dateString);
  };

  // Group events by date
  const groupedEvents: Record<string, TimelineEvent[]> = {};
  visibleEvents.forEach(event => {
    const dateKey = new Date(event.date).toLocaleDateString('pt-BR');
    if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
    groupedEvents[dateKey].push(event);
  });

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-secondary border-border text-sm focus:ring-offset-0">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos ({events.length})</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([key, config]) => {
              const count = events.filter(e => e.type === key).length;
              if (count === 0) return null;
              return (
                <SelectItem key={key} value={key}>
                  {config.label} ({count})
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          className="h-9 border-border"
          onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
          {sortOrder === 'desc' ? 'Recentes' : 'Antigos'}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-9 ml-auto"
          onClick={loadAllEvents}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>

        <span className="text-xs text-muted-foreground">
          {filteredEvents.length} eventos
        </span>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum evento encontrado</p>
          <p className="text-sm">Este cliente ainda não possui registros na timeline.</p>
        </div>
      ) : (
        <div>
          <div className="space-y-6 pr-4">
            {Object.entries(groupedEvents).map(([dateKey, dayEvents]) => (
              <div key={dateKey}>
                {/* Date header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground bg-card px-2">
                    {dateKey}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {/* Events for this date */}
                <div className="space-y-2 relative ml-4">
                  {/* Vertical line */}
                  <div className="absolute left-3 top-4 bottom-4 w-px bg-border" />

                  {dayEvents.map((event) => {
                    const config = TYPE_CONFIG[event.type];
                    const Icon = config.icon;

                    return (
                      <div key={event.id} className="relative flex gap-3 group">
                        {/* Icon dot */}
                        <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-card border border-border shrink-0 ${config.color} group-hover:border-current transition-colors`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {event.title}
                              </p>
                              {event.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {event.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {event.status && (
                                <Badge variant={getStatusBadgeVariant(event.status)} className="text-[10px] px-1.5 py-0">
                                  {event.status}
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                {formatRelative(event.date)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {visibleCount < filteredEvents.length && (
            <div className="text-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleCount(c => c + 20)}
                className="text-muted-foreground"
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                Carregar mais ({filteredEvents.length - visibleCount} restantes)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
