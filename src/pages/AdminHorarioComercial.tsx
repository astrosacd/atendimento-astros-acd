import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, CalendarX, Trash2, Plus, Save, Loader2, Link2, KeyRound, CheckCircle2, AlertTriangle, RefreshCw, Pencil, ChevronDown, ChevronRight, History, PlayCircle, Timer, User as UserIcon, Bot } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getHorarioSupabase, getCachedHorarioConfig, saveHorarioConfig } from '@/integrations/horario-supabase/client';
import { supabase } from '@/integrations/supabase/client';

const wrapMotivo = (raw: string | null | undefined): string | null => {
  const t = (raw || '').trim();
  if (!t) return null;
  if (/^Motivo:\s*\(.*\)\s*$/.test(t)) return t;
  return `Motivo: (${t})`;
};
const unwrapMotivo = (stored: string | null | undefined): string => {
  if (!stored) return '';
  const m = stored.match(/^Motivo:\s*\((.*)\)\s*$/);
  return m ? m[1] : stored;
};

interface Horario {
  id: number;
  semana_inicio: string;
  semana_fim: string;
  sabado_inicio: string | null;
  sabado_fim: string | null;
}

interface Bloqueio {
  id: number;
  data: string;
  dia_todo: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
}

interface HistoricoItem {
  id: number;
  bloqueio_id: number | null;
  acao: 'criado' | 'editado' | 'excluido';
  origem: 'manual' | 'cron';
  user_nome: string | null;
  user_email: string | null;
  data_bloqueio: string | null;
  dia_todo: boolean | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
  created_at: string;
}

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export default function AdminHorarioComercial() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const { canManageHorarioComercial } = usePermissions();
  const canAccess = isAdmin || canManageHorarioComercial();
  const { toast } = useToast();

  const initial = getCachedHorarioConfig();
  const [cfgUrl, setCfgUrl] = useState(initial.url);
  const [cfgKey, setCfgKey] = useState(initial.key);
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [cfgOpen, setCfgOpen] = useState(!initial.url || !initial.key);

  const [horario, setHorario] = useState<Horario | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [semanaInicio, setSemanaInicio] = useState('');
  const [semanaFim, setSemanaFim] = useState('');
  const [sabadoInicio, setSabadoInicio] = useState('');
  const [sabadoFim, setSabadoFim] = useState('');

  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([]);
  const [novaData, setNovaData] = useState('');
  const [novoMotivo, setNovoMotivo] = useState('');
  const [diaTodo, setDiaTodo] = useState(true);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<Bloqueio | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Bloqueio | null>(null);
  const [deleting, setDeleting] = useState(false);

  // perfil do usuário (nome) para histórico
  const [userNome, setUserNome] = useState<string>('');

  // limpeza automática
  const [cleanupHour, setCleanupHour] = useState(3);
  const [cleanupMinute, setCleanupMinute] = useState(0);
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [cleanupLastRun, setCleanupLastRun] = useState<string | null>(null);
  const [cleanupLastDeleted, setCleanupLastDeleted] = useState<number | null>(null);
  const [savingCleanup, setSavingCleanup] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);

  // histórico (paginação real)
  const HIST_PAGE = 50;
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [filtroAcao, setFiltroAcao] = useState<string>('all');
  const [filtroOrigem, setFiltroOrigem] = useState<string>('all');
  const [loadingHist, setLoadingHist] = useState(false);
  const [loadingMoreHist, setLoadingMoreHist] = useState(false);
  const [histHasMore, setHistHasMore] = useState(false);
  const [histTotal, setHistTotal] = useState<number>(0);
  const [purging, setPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const notifyChange = () => window.dispatchEvent(new CustomEvent('horario-config-changed'));

  const logHist = async (
    acao: 'criado' | 'editado' | 'excluido',
    bloqueio: Partial<Bloqueio> & { id?: number },
    dadosAntes?: any,
    dadosDepois?: any
  ) => {
    try {
      await supabase.from('bloqueios_historico').insert({
        bloqueio_id: bloqueio.id ?? null,
        acao,
        origem: 'manual',
        user_id: user?.id ?? null,
        user_nome: userNome || user?.user_metadata?.name || user?.email || 'desconhecido',
        user_email: user?.email ?? null,
        data_bloqueio: bloqueio.data ?? null,
        dia_todo: bloqueio.dia_todo ?? null,
        hora_inicio: bloqueio.hora_inicio ?? null,
        hora_fim: bloqueio.hora_fim ?? null,
        motivo: bloqueio.motivo ?? null,
        dados_antes: dadosAntes ?? null,
        dados_depois: dadosDepois ?? null,
      });
      loadHistorico();
    } catch (e) {
      console.error('logHist falhou', e);
    }
  };

  const buildHistQuery = (from: number, to: number) => {
    let q = supabase
      .from('bloqueios_historico')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (filtroAcao !== 'all') q = q.eq('acao', filtroAcao);
    if (filtroOrigem !== 'all') q = q.eq('origem', filtroOrigem);
    return q;
  };

  const loadHistorico = async () => {
    setLoadingHist(true);
    const { data, error, count } = await buildHistQuery(0, HIST_PAGE - 1);
    setLoadingHist(false);
    if (error) return;
    const rows = (data as any) || [];
    setHistorico(rows);
    setHistTotal(count || 0);
    setHistHasMore((count || 0) > rows.length);
  };

  const loadMoreHistorico = async () => {
    setLoadingMoreHist(true);
    const from = historico.length;
    const to = from + HIST_PAGE - 1;
    const { data, error, count } = await buildHistQuery(from, to);
    setLoadingMoreHist(false);
    if (error) return;
    const novos = (data as any) || [];
    const merged = [...historico, ...novos];
    setHistorico(merged);
    setHistTotal(count || merged.length);
    setHistHasMore((count || merged.length) > merged.length);
  };

  const limparHistoricoAntigo = async () => {
    setPurging(true);
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabase
      .from('bloqueios_historico')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);
    setPurging(false);
    setConfirmPurge(false);
    if (error) { toast({ title: 'Erro ao limpar histórico', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Histórico limpo', description: `${count ?? 0} registro(s) com mais de 90 dias removido(s).` });
    loadHistorico();
  };

  const loadCleanupCfg = async () => {
    const { data, error } = await supabase.rpc('get_horario_cleanup_config');
    if (error || !data) return;
    const c: any = data;
    setCleanupHour(c.cleanup_hour ?? 3);
    setCleanupMinute(c.cleanup_minute ?? 0);
    setCleanupEnabled(c.enabled ?? true);
    setCleanupLastRun(c.last_run_at ?? null);
    setCleanupLastDeleted(c.last_run_deleted ?? null);
  };

  const loadAll = async (notify = false) => {
    setLoading(true);
    const client = await getHorarioSupabase();
    if (!client) {
      setConnected(false);
      setLoading(false);
      return;
    }
    setConnected(true);
    const [{ data: h, error: eh }, { data: b, error: eb }] = await Promise.all([
      client.from('horario_comercial').select('*').order('id').limit(1).maybeSingle(),
      client.from('bloqueios').select('id,data,dia_todo,hora_inicio,hora_fim,motivo').order('data', { ascending: true }),
    ]);
    if (eh || eb) {
      toast({ title: 'Erro ao ler tabelas externas', description: (eh || eb)?.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    const horarioData = h as any as Horario | null;
    setHorario(horarioData);
    if (horarioData) {
      setSemanaInicio(trim(horarioData.semana_inicio));
      setSemanaFim(trim(horarioData.semana_fim));
      setSabadoInicio(trim(horarioData.sabado_inicio));
      setSabadoFim(trim(horarioData.sabado_fim));
    }
    setBloqueios((b as any as Bloqueio[]) || []);
    setLoading(false);
    if (notify) toast({ title: 'Sincronizado' });
  };

  useEffect(() => {
    if (!canAccess) {
      navigate('/');
      return;
    }
    loadAll();
    loadCleanupCfg();
    loadHistorico();
    // carrega nome do perfil
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle();
      if (data?.name) setUserNome(data.name);
    })();
  }, [canAccess, navigate]);

  useEffect(() => { loadHistorico(); /* eslint-disable-next-line */ }, [filtroAcao, filtroOrigem]);

  useEffect(() => {
    let channel: any;
    let cancelled = false;
    (async () => {
      const client = await getHorarioSupabase();
      if (!client || cancelled) return;
      channel = client
        .channel('bloqueios-admin')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueios' }, () => loadAll())
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) channel.unsubscribe(); };
  }, [connected]);

  // Realtime no histórico local — pega exclusões do cron
  useEffect(() => {
    const ch = supabase
      .channel('bloqueios-historico-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bloqueios_historico' }, () => {
        loadHistorico();
        loadCleanupCfg();
        loadAll();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const salvarConfig = async () => {
    if (!cfgUrl || !cfgKey) { toast({ title: 'Preencha URL e Anon Key', variant: 'destructive' }); return; }
    setSavingCfg(true);
    try {
      await saveHorarioConfig(cfgUrl, cfgKey);
      // Também grava no Lovable Cloud pra o cron usar
      await supabase.rpc('set_horario_external_connection', { p_url: cfgUrl, p_anon_key: cfgKey });
      toast({ title: 'Conexão salva' });
      await loadAll(true);
      await loadCleanupCfg();
      setCfgOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar conexão', description: e.message, variant: 'destructive' });
    } finally { setSavingCfg(false); }
  };

  const testarConexao = async () => {
    if (!cfgUrl || !cfgKey) { toast({ title: 'Preencha URL e Anon Key antes de testar', variant: 'destructive' }); return; }
    setTesting(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(cfgUrl.trim().replace(/\/$/, ''), cfgKey.trim(), { auth: { persistSession: false, autoRefreshToken: false } });
      const { error } = await testClient.from('horario_comercial').select('id').limit(1);
      if (error) throw error;
      setConnected(true);
      toast({ title: 'Conexão OK' });
    } catch (e: any) {
      setConnected(false);
      toast({ title: 'Falha na conexão', description: e.message, variant: 'destructive' });
    } finally { setTesting(false); }
  };

  const salvarHorario = async () => {
    if (!semanaInicio || !semanaFim) { toast({ title: 'Preencha o horário de segunda a sexta', variant: 'destructive' }); return; }
    const client = await getHorarioSupabase();
    if (!client) return;
    setSaving(true);
    const payload = {
      semana_inicio: semanaInicio, semana_fim: semanaFim,
      sabado_inicio: sabadoInicio || null, sabado_fim: sabadoFim || null,
    };
    const op = horario ? client.from('horario_comercial').update(payload).eq('id', horario.id) : client.from('horario_comercial').insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Horário salvo com sucesso' });
    notifyChange(); loadAll();
  };

  const adicionarBloqueio = async () => {
    if (!novaData) { toast({ title: 'Informe a data do bloqueio', variant: 'destructive' }); return; }
    if (!novoMotivo.trim()) { toast({ title: 'Motivo obrigatório', description: 'Informe o motivo do bloqueio.', variant: 'destructive' }); return; }
    if (!diaTodo && (!horaInicio || !horaFim)) { toast({ title: 'Informe hora inicial e final do bloqueio parcial', variant: 'destructive' }); return; }
    const client = await getHorarioSupabase();
    if (!client) return;
    setAdding(true);
    const payload = {
      data: novaData, dia_todo: diaTodo,
      hora_inicio: diaTodo ? null : horaInicio,
      hora_fim: diaTodo ? null : horaFim,
      motivo: wrapMotivo(novoMotivo),
    };
    const { data, error } = await client.from('bloqueios').insert(payload).select().single();
    setAdding(false);
    if (error) { toast({ title: 'Erro ao adicionar bloqueio', description: error.message, variant: 'destructive' }); return; }
    setBloqueios((prev) => [...prev, data as Bloqueio].sort((a, b) => a.data.localeCompare(b.data)));
    await logHist('criado', data as Bloqueio, null, data);
    toast({ title: 'Bloqueio adicionado' });
    setNovaData(''); setNovoMotivo(''); setHoraInicio(''); setHoraFim(''); setDiaTodo(true);
    notifyChange();
  };

  const salvarEdicaoBloqueio = async () => {
    if (!editing) return;
    if (!editing.motivo || !editing.motivo.trim()) { toast({ title: 'Motivo obrigatório', description: 'Informe o motivo do bloqueio.', variant: 'destructive' }); return; }
    if (!editing.dia_todo && (!editing.hora_inicio || !editing.hora_fim)) { toast({ title: 'Informe hora inicial e final', variant: 'destructive' }); return; }
    const client = await getHorarioSupabase();
    if (!client) return;
    setSavingEdit(true);
    const antes = bloqueios.find((x) => x.id === editing.id);
    const payload = {
      data: editing.data, dia_todo: editing.dia_todo,
      hora_inicio: editing.dia_todo ? null : editing.hora_inicio,
      hora_fim: editing.dia_todo ? null : editing.hora_fim,
      motivo: wrapMotivo(editing.motivo),
    };
    const { error } = await client.from('bloqueios').update(payload).eq('id', editing.id);
    setSavingEdit(false);
    if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); return; }
    const novo = { ...editing, ...payload } as Bloqueio;
    setBloqueios((prev) => prev.map((b) => (b.id === editing.id ? novo : b)).sort((a, b) => a.data.localeCompare(b.data)));
    await logHist('editado', novo, antes, novo);
    toast({ title: 'Bloqueio atualizado' });
    setEditing(null);
    notifyChange();
  };

  const confirmarExclusao = async () => {
    if (!confirmDelete) return;
    const client = await getHorarioSupabase();
    if (!client) return;
    setDeleting(true);
    const prev = bloqueios;
    const alvo = confirmDelete;
    setBloqueios((p) => p.filter((b) => b.id !== alvo.id));
    const { error } = await client.from('bloqueios').delete().eq('id', alvo.id);
    setDeleting(false);
    if (error) { setBloqueios(prev); toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    await logHist('excluido', alvo, alvo, null);
    toast({ title: 'Bloqueio removido' });
    setConfirmDelete(null);
    notifyChange();
  };

  const salvarCleanup = async () => {
    setSavingCleanup(true);
    const { data, error } = await supabase.rpc('set_horario_cleanup_schedule', {
      p_hour: cleanupHour, p_minute: cleanupMinute, p_enabled: cleanupEnabled,
    });
    setSavingCleanup(false);
    if (error) { toast({ title: 'Erro ao salvar agendamento', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agendamento atualizado', description: cleanupEnabled ? `Rodará todo dia às ${String(cleanupHour).padStart(2,'0')}:${String(cleanupMinute).padStart(2,'0')} (Brasília)` : 'Cron desativado' });
    loadCleanupCfg();
  };

  const executarLimpezaAgora = async () => {
    setRunningCleanup(true);
    try {
      const { data, error } = await supabase.functions.invoke('horario-bloqueios-cleanup', { body: { source: 'manual' } });
      if (error) throw error;
      const d: any = data;
      toast({
        title: d?.ok ? `Limpeza concluída: ${d.deleted} excluído(s)` : 'Falha na limpeza',
        description: d?.error || `Total vencidos: ${d?.total_vencidos ?? 0}`,
        variant: d?.ok ? 'default' : 'destructive',
      });
      loadAll();
      loadHistorico();
      loadCleanupCfg();
    } catch (e: any) {
      toast({ title: 'Erro ao executar limpeza', description: e.message, variant: 'destructive' });
    } finally { setRunningCleanup(false); }
  };

  const hasCfg = !!cfgUrl && !!cfgKey;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Clock className="h-6 w-6 text-amber-500" />
          <div>
            <h1 className="text-xl font-bold">Horário Comercial</h1>
            <p className="text-xs text-muted-foreground">Configure o expediente, bloqueios, limpeza automática e veja o histórico</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        <Collapsible open={cfgOpen} onOpenChange={setCfgOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <button className="w-full text-left">
                <CardHeader className="hover:bg-muted/30 transition-colors rounded-t-lg">
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-blue-500" /> Conexão com Supabase
                      {connected === true && hasCfg && (
                        <span className="flex items-center gap-1 text-xs font-normal text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" /> Conectado
                        </span>
                      )}
                      {connected === false && (
                        <span className="flex items-center gap-1 text-xs font-normal text-red-600">
                          <AlertTriangle className="h-4 w-4" /> Desconectado
                        </span>
                      )}
                    </span>
                    {cfgOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </CardTitle>
                  {!cfgOpen && hasCfg && <CardDescription className="truncate">{cfgUrl}</CardDescription>}
                </CardHeader>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">URL e Anon Key do projeto Supabase externo.</p>
                <div>
                  <Label className="text-xs">Project URL</Label>
                  <Input value={cfgUrl} onChange={(e) => setCfgUrl(e.target.value)} placeholder="https://xxxxxx.supabase.co" />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><KeyRound className="h-3 w-3" /> Anon Public Key</Label>
                  <Input value={cfgKey} onChange={(e) => setCfgKey(e.target.value)} placeholder="eyJhbGciOi..." type="password" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={salvarConfig} disabled={savingCfg} className="gap-2">
                    {savingCfg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar conexão
                  </Button>
                  <Button variant="outline" onClick={testarConexao} disabled={testing} className="gap-2">
                    {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Testar
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !connected ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground text-center">
              Configure a conexão acima para carregar horário e bloqueios.
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" /> Horário de Funcionamento
                    </CardTitle>
                    <CardDescription>Domingo é considerado fechado automaticamente. Deixe sábado em branco para fechar.</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => loadAll(true)} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> Recarregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Segunda a Sexta</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Hora inicial</Label><Input type="time" value={semanaInicio} onChange={(e) => setSemanaInicio(e.target.value)} /></div>
                    <div><Label className="text-xs">Hora final</Label><Input type="time" value={semanaFim} onChange={(e) => setSemanaFim(e.target.value)} /></div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Sábado</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Hora inicial</Label><Input type="time" value={sabadoInicio} onChange={(e) => setSabadoInicio(e.target.value)} /></div>
                    <div><Label className="text-xs">Hora final</Label><Input type="time" value={sabadoFim} onChange={(e) => setSabadoFim(e.target.value)} /></div>
                  </div>
                </div>
                <Button onClick={salvarHorario} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Horário Comercial
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarX className="h-5 w-5 text-red-500" /> Bloqueios de Datas
                </CardTitle>
                <CardDescription>Feriados, reuniões, manutenções — bloqueio pode ser dia todo ou parcial.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                    <div><Label className="text-xs">Data</Label><Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} /></div>
                    <div>
                      <Label className="text-xs">Motivo <span className="text-red-500">*</span> — salvo como <code className="text-[10px]">Motivo: (texto)</code></Label>
                      <Input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Ex.: Feriado nacional" required />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={diaTodo} onCheckedChange={setDiaTodo} id="dia-todo" />
                    <Label htmlFor="dia-todo" className="text-sm cursor-pointer">Bloquear o dia todo</Label>
                  </div>
                  {!diaTodo && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Hora inicial</Label><Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></div>
                      <div><Label className="text-xs">Hora final</Label><Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></div>
                    </div>
                  )}
                  <Button onClick={adicionarBloqueio} disabled={adding} className="gap-2">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar Bloqueio
                  </Button>
                </div>

                <div className="border rounded-lg divide-y">
                  {bloqueios.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">Nenhum bloqueio cadastrado.</div>
                  ) : (
                    bloqueios.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3 hover:bg-muted/40">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm">
                            {format(parseISO(b.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            {' · '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {b.dia_todo ? 'Dia todo' : `${trim(b.hora_inicio)} – ${trim(b.hora_fim)}`}
                            </span>
                          </div>
                          {b.motivo && <div className="text-xs text-muted-foreground break-words">{b.motivo}</div>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => setEditing({ ...b, motivo: unwrapMotivo(b.motivo) })}>
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(b)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Limpeza automática */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-purple-500" /> Limpeza Automática
                </CardTitle>
                <CardDescription>
                  Cron diário que apaga bloqueios vencidos no Supabase externo e registra cada exclusão no histórico aqui.
                  Dia todo: apaga no dia seguinte. Parcial: apaga após a hora final passar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch id="cleanup-on" checked={cleanupEnabled} onCheckedChange={setCleanupEnabled} />
                  <Label htmlFor="cleanup-on" className="text-sm cursor-pointer">Cron ativo</Label>
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div>
                    <Label className="text-xs">Hora (Brasília)</Label>
                    <Input type="number" min={0} max={23} value={cleanupHour} onChange={(e) => setCleanupHour(Math.min(23, Math.max(0, +e.target.value || 0)))} />
                  </div>
                  <div>
                    <Label className="text-xs">Minuto</Label>
                    <Input type="number" min={0} max={59} value={cleanupMinute} onChange={(e) => setCleanupMinute(Math.min(59, Math.max(0, +e.target.value || 0)))} />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={salvarCleanup} disabled={savingCleanup} className="gap-2">
                    {savingCleanup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar agendamento
                  </Button>
                  <Button variant="outline" onClick={executarLimpezaAgora} disabled={runningCleanup} className="gap-2">
                    {runningCleanup ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    Executar agora
                  </Button>
                </div>
                {cleanupLastRun && (
                  <div className="text-xs text-muted-foreground">
                    Última execução: {format(parseISO(cleanupLastRun), "dd/MM/yyyy HH:mm:ss")} · {cleanupLastDeleted ?? 0} bloqueio(s) excluído(s)
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5 text-indigo-500" /> Histórico
                    </CardTitle>
                    <CardDescription>Quem criou, editou ou excluiu cada bloqueio (e o que o cron apagou).</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={filtroAcao} onValueChange={setFiltroAcao}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas ações</SelectItem>
                        <SelectItem value="criado">Criado</SelectItem>
                        <SelectItem value="editado">Editado</SelectItem>
                        <SelectItem value="excluido">Excluído</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas origens</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="cron">Cron</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={loadHistorico} className="gap-2" title="Recarregar">
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmPurge(true)}
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-500/10 border-red-500/30"
                      title="Limpar registros com mais de 90 dias"
                    >
                      <Trash2 className="h-3 w-3" />
                      Limpar &gt; 90d
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHist ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : historico.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Nenhum registro ainda.</div>
                ) : (
                  <>
                    <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto">
                      {historico.map((h) => {
                        const cor = h.acao === 'criado' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : h.acao === 'editado' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'bg-red-500/10 text-red-700 dark:text-red-400';
                        return (
                          <div key={h.id} className="p-3 text-sm hover:bg-muted/30">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={cor}>{h.acao}</Badge>
                              <Badge variant="outline" className="gap-1">
                                {h.origem === 'cron' ? <Bot className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                                {h.origem}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{format(parseISO(h.created_at), "dd/MM/yyyy HH:mm:ss")}</span>
                            </div>
                            <div className="mt-1 text-xs">
                              <span className="font-medium">{h.user_nome || '—'}</span>
                              {h.user_email && <span className="text-muted-foreground"> ({h.user_email})</span>}
                            </div>
                            {h.data_bloqueio && (
                              <div className="mt-1 text-xs text-muted-foreground break-words">
                                Bloqueio: {format(parseISO(h.data_bloqueio), "dd/MM/yyyy")}
                                {' · '}{h.dia_todo ? 'Dia todo' : `${trim(h.hora_inicio)}–${trim(h.hora_fim)}`}
                                {h.motivo && <> · {h.motivo}</>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Mostrando {historico.length} de {histTotal}</span>
                      {histHasMore && (
                        <Button variant="outline" size="sm" onClick={loadMoreHistorico} disabled={loadingMoreHist} className="gap-2">
                          {loadingMoreHist ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                          Carregar mais
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-blue-500" /> Editar Bloqueio</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div><Label className="text-xs">Data</Label><Input type="date" value={editing.data} onChange={(e) => setEditing({ ...editing, data: e.target.value })} /></div>
              <div><Label className="text-xs">Motivo <span className="text-red-500">*</span></Label><Input value={editing.motivo || ''} onChange={(e) => setEditing({ ...editing, motivo: e.target.value })} required /></div>
              <div className="flex items-center gap-3">
                <Switch checked={editing.dia_todo} onCheckedChange={(v) => setEditing({ ...editing, dia_todo: v, hora_inicio: v ? null : editing.hora_inicio, hora_fim: v ? null : editing.hora_fim })} id="edit-dia-todo" />
                <Label htmlFor="edit-dia-todo" className="text-sm cursor-pointer">Bloquear o dia todo</Label>
              </div>
              {!editing.dia_todo && (
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Hora inicial</Label><Input type="time" value={trim(editing.hora_inicio)} onChange={(e) => setEditing({ ...editing, hora_inicio: e.target.value })} /></div>
                  <div><Label className="text-xs">Hora final</Label><Input type="time" value={trim(editing.hora_fim)} onChange={(e) => setEditing({ ...editing, hora_fim: e.target.value })} /></div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={salvarEdicaoBloqueio} disabled={savingEdit} className="gap-2">
              {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && !deleting && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-red-500" /> Excluir bloqueio?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && (
                <>
                  <strong>{format(parseISO(confirmDelete.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</strong>
                  {' · '}
                  {confirmDelete.dia_todo ? 'Dia todo' : `${trim(confirmDelete.hora_inicio)}–${trim(confirmDelete.hora_fim)}`}
                  {confirmDelete.motivo && <div className="mt-1 text-xs">{confirmDelete.motivo}</div>}
                  <div className="mt-2">Esta ação não pode ser desfeita.</div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={deleting} className="bg-red-600 hover:bg-red-700 gap-2">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
