import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Clock, CalendarX, Trash2, Plus, Save, Loader2, Link2, KeyRound, CheckCircle2, AlertTriangle, RefreshCw, Pencil } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getHorarioSupabase, getCachedHorarioConfig, saveHorarioConfig } from '@/integrations/horario-supabase/client';

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

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export default function AdminHorarioComercial() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  // Conexão externa
  const initial = getCachedHorarioConfig();
  const [cfgUrl, setCfgUrl] = useState(initial.url);
  const [cfgKey, setCfgKey] = useState(initial.key);
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

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

  // Edição de bloqueio
  const [editing, setEditing] = useState<Bloqueio | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

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
    } else {
      setSemanaInicio('');
      setSemanaFim('');
      setSabadoInicio('');
      setSabadoFim('');
    }
    const lista = (b as any as Bloqueio[]) || [];
    setBloqueios(lista);
    setLoading(false);
    if (notify) {
      toast({
        title: 'Sincronizado',
        description: `${horarioData ? 'Horário carregado' : 'Nenhum horário cadastrado'} · ${lista.length} bloqueio(s)`,
      });
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAll();
  }, [isAdmin, navigate]);

  const salvarConfig = async () => {
    if (!cfgUrl || !cfgKey) {
      toast({ title: 'Preencha URL e Anon Key', variant: 'destructive' });
      return;
    }
    setSavingCfg(true);
    try {
      await saveHorarioConfig(cfgUrl, cfgKey);
      toast({ title: 'Conexão salva' });
      await loadAll(true);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar conexão', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCfg(false);
    }
  };

  const salvarEdicaoBloqueio = async () => {
    if (!editing) return;
    if (!editing.dia_todo && (!editing.hora_inicio || !editing.hora_fim)) {
      toast({ title: 'Informe hora inicial e final', variant: 'destructive' });
      return;
    }
    const client = await getHorarioSupabase();
    if (!client) return;
    setSavingEdit(true);
    const { error } = await client.from('bloqueios').update({
      data: editing.data,
      dia_todo: editing.dia_todo,
      hora_inicio: editing.dia_todo ? null : editing.hora_inicio,
      hora_fim: editing.dia_todo ? null : editing.hora_fim,
      motivo: editing.motivo || null,
    }).eq('id', editing.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bloqueio atualizado' });
    setEditing(null);
    loadAll();
  };

  const testarConexao = async () => {
    if (!cfgUrl || !cfgKey) {
      toast({ title: 'Preencha URL e Anon Key antes de testar', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const testClient = createClient(cfgUrl.trim().replace(/\/$/, ''), cfgKey.trim(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error } = await testClient.from('horario_comercial').select('id').limit(1);
      if (error) throw error;
      setConnected(true);
      toast({ title: 'Conexão OK', description: 'Clique em "Salvar conexão" para persistir.' });
    } catch (e: any) {
      setConnected(false);
      toast({ title: 'Falha na conexão', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  const salvarHorario = async () => {
    if (!semanaInicio || !semanaFim) {
      toast({ title: 'Preencha o horário de segunda a sexta', variant: 'destructive' });
      return;
    }
    const client = await getHorarioSupabase();
    if (!client) return;
    setSaving(true);
    const payload = {
      semana_inicio: semanaInicio,
      semana_fim: semanaFim,
      sabado_inicio: sabadoInicio || null,
      sabado_fim: sabadoFim || null,
    };
    const op = horario
      ? client.from('horario_comercial').update(payload).eq('id', horario.id)
      : client.from('horario_comercial').insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Horário salvo com sucesso' });
    loadAll();
  };

  const adicionarBloqueio = async () => {
    if (!novaData) {
      toast({ title: 'Informe a data do bloqueio', variant: 'destructive' });
      return;
    }
    if (!diaTodo && (!horaInicio || !horaFim)) {
      toast({ title: 'Informe hora inicial e final do bloqueio parcial', variant: 'destructive' });
      return;
    }
    const client = await getHorarioSupabase();
    if (!client) return;
    setAdding(true);
    const { error } = await client.from('bloqueios').insert({
      data: novaData,
      dia_todo: diaTodo,
      hora_inicio: diaTodo ? null : horaInicio,
      hora_fim: diaTodo ? null : horaFim,
      motivo: novoMotivo || null,
    });
    setAdding(false);
    if (error) {
      toast({ title: 'Erro ao adicionar bloqueio', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bloqueio adicionado' });
    setNovaData('');
    setNovoMotivo('');
    setHoraInicio('');
    setHoraFim('');
    setDiaTodo(true);
    loadAll();
  };

  const excluirBloqueio = async (id: number) => {
    if (!confirm('Excluir este bloqueio?')) return;
    const client = await getHorarioSupabase();
    if (!client) return;
    const { error } = await client.from('bloqueios').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bloqueio removido' });
    loadAll();
  };

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
            <p className="text-xs text-muted-foreground">Configure o expediente e bloqueios de datas</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
        {/* Conexão Supabase externo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-blue-500" /> Conexão com Supabase
              {connected === true && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {connected === false && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </CardTitle>
            <CardDescription>
              Informe a URL e a Anon Key do seu Supabase onde estão as tabelas <code>horario_comercial</code> e <code>bloqueios</code>.
              <br />
              <span className="text-xs">A URL fica em <strong>Settings → API</strong> (formato <code>https://SEU-REF.supabase.co</code>). A Anon Key está em <strong>Settings → API Keys → anon public</strong>.</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
        </Card>

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
            {/* Horário */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-amber-500" /> Horário de Funcionamento
                    </CardTitle>
                    <CardDescription>
                      Domingo é considerado fechado automaticamente. Deixe sábado em branco para fechar.
                    </CardDescription>
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
                    <div>
                      <Label className="text-xs">Hora inicial</Label>
                      <Input type="time" value={semanaInicio} onChange={(e) => setSemanaInicio(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Hora final</Label>
                      <Input type="time" value={semanaFim} onChange={(e) => setSemanaFim(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Sábado</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Hora inicial</Label>
                      <Input type="time" value={sabadoInicio} onChange={(e) => setSabadoInicio(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Hora final</Label>
                      <Input type="time" value={sabadoFim} onChange={(e) => setSabadoFim(e.target.value)} />
                    </div>
                  </div>
                </div>
                <Button onClick={salvarHorario} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Horário Comercial
                </Button>
              </CardContent>
            </Card>

            {/* Bloqueios */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarX className="h-5 w-5 text-red-500" /> Bloqueios de Datas
                </CardTitle>
                <CardDescription>
                  Feriados, reuniões, manutenções — bloqueio pode ser dia todo ou parcial.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                    <div>
                      <Label className="text-xs">Data</Label>
                      <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Motivo (opcional)</Label>
                      <Input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Ex.: Feriado nacional" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={diaTodo} onCheckedChange={setDiaTodo} id="dia-todo" />
                    <Label htmlFor="dia-todo" className="text-sm cursor-pointer">Bloquear o dia todo</Label>
                  </div>
                  {!diaTodo && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Hora inicial</Label>
                        <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                      </div>
                      <div>
                        <Label className="text-xs">Hora final</Label>
                        <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                      </div>
                    </div>
                  )}
                  <Button onClick={adicionarBloqueio} disabled={adding} className="gap-2">
                    {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Adicionar Bloqueio
                  </Button>
                </div>

                <div className="border rounded-lg divide-y">
                  {bloqueios.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum bloqueio cadastrado.
                    </div>
                  ) : (
                    bloqueios.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-3 hover:bg-muted/40">
                        <div>
                          <div className="font-medium text-sm">
                            {format(parseISO(b.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            {' · '}
                            <span className="text-xs font-normal text-muted-foreground">
                              {b.dia_todo ? 'Dia todo' : `${trim(b.hora_inicio)} – ${trim(b.hora_fim)}`}
                            </span>
                          </div>
                          {b.motivo && <div className="text-xs text-muted-foreground">{b.motivo}</div>}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => excluirBloqueio(b.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
