import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Clock, CalendarX, Trash2, Plus, Save, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  motivo: string | null;
}

const trim = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export default function AdminHorarioComercial() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();

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
  const [adding, setAdding] = useState(false);

  const loadAll = async () => {
    const [{ data: h }, { data: b }] = await Promise.all([
      supabase.from('horario_comercial' as any).select('*').order('id').limit(1).maybeSingle(),
      supabase.from('bloqueios' as any).select('id,data,motivo').order('data', { ascending: true }),
    ]);
    const horarioData = h as any as Horario | null;
    setHorario(horarioData);
    if (horarioData) {
      setSemanaInicio(trim(horarioData.semana_inicio));
      setSemanaFim(trim(horarioData.semana_fim));
      setSabadoInicio(trim(horarioData.sabado_inicio));
      setSabadoFim(trim(horarioData.sabado_fim));
    }
    setBloqueios((b as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadAll();
  }, [isAdmin, navigate]);

  const salvarHorario = async () => {
    if (!semanaInicio || !semanaFim) {
      toast({ title: 'Preencha o horário de segunda a sexta', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      semana_inicio: semanaInicio,
      semana_fim: semanaFim,
      sabado_inicio: sabadoInicio || null,
      sabado_fim: sabadoFim || null,
    };
    const op = horario
      ? supabase.from('horario_comercial' as any).update(payload).eq('id', horario.id)
      : supabase.from('horario_comercial' as any).insert(payload);
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
    setAdding(true);
    const { error } = await supabase.from('bloqueios' as any).insert({
      data: novaData,
      dia_todo: true,
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
    loadAll();
  };

  const excluirBloqueio = async (id: number) => {
    if (!confirm('Excluir este bloqueio?')) return;
    const { error } = await supabase.from('bloqueios' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bloqueio removido' });
    loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

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
        {/* Seção 1: Horário comercial */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> Horário de Funcionamento
            </CardTitle>
            <CardDescription>
              Domingo é considerado fechado automaticamente. Deixe sábado em branco para fechar.
            </CardDescription>
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

        {/* Seção 2: Bloqueios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-red-500" /> Bloqueios de Datas
            </CardTitle>
            <CardDescription>
              Feriados, reuniões, manutenções — o sistema fica fechado nessas datas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-end">
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={novaData} onChange={(e) => setNovaData(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input value={novoMotivo} onChange={(e) => setNovoMotivo(e.target.value)} placeholder="Ex.: Feriado nacional" />
              </div>
              <Button onClick={adicionarBloqueio} disabled={adding} className="gap-2">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
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
      </main>
    </div>
  );
}
