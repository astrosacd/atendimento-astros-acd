import { useEffect, useState } from 'react';
import { getHorarioSupabase } from '@/integrations/horario-supabase/client';

export interface BusinessHours {
  id: number;
  semana_inicio: string;
  semana_fim: string;
  sabado_inicio: string | null;
  sabado_fim: string | null;
}

export interface Bloqueio {
  id: number;
  data: string;
  dia_todo: boolean;
  hora_inicio: string | null;
  hora_fim: string | null;
  motivo: string | null;
}

export interface BusinessHoursStatus {
  isOpen: boolean;
  reason: 'open' | 'closed_hours' | 'closed_sunday' | 'blocked' | 'no_config' | 'no_connection';
  todayLabel: string;
  bloqueio?: Bloqueio;
  horario?: BusinessHours;
  loading: boolean;
}

// Sempre considera o fuso horário de São Paulo (Brasília)
const SP_TZ = 'America/Sao_Paulo';

const spParts = () => {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SP_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date()).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value; return acc;
  }, {});
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    dow: wdMap[parts.weekday] ?? 0,
  };
};

const todayStr = () => spParts().date;
const formatTime = (t: string | null) => (t ? t.slice(0, 5) : '');

const inRange = (curMinutes: number, start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return curMinutes >= sh * 60 + sm && curMinutes <= eh * 60 + em;
};

export function useBusinessHoursStatus() {
  const [horario, setHorario] = useState<BusinessHours | null>(null);
  const [bloqueiosHoje, setBloqueiosHoje] = useState<Bloqueio[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean>(true);
  const [, setTick] = useState(0);

  const load = async () => {
    const client = await getHorarioSupabase();
    if (!client) {
      setConnected(false);
      setLoading(false);
      return;
    }
    setConnected(true);
    const [{ data: h }, { data: b }] = await Promise.all([
      client.from('horario_comercial').select('*').order('id').limit(1).maybeSingle(),
      client.from('bloqueios').select('*').eq('data', todayStr()),
    ]);
    setHorario((h as any) || null);
    setBloqueiosHoje((b as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onCfg = () => load();
    window.addEventListener('horario-config-changed', onCfg);
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      load();
    }, 60_000);
    return () => {
      window.removeEventListener('horario-config-changed', onCfg);
      clearInterval(interval);
    };
  }, []);

  const compute = (): BusinessHoursStatus => {
    if (loading) return { isOpen: false, reason: 'no_config', todayLabel: '...', loading: true };
    if (!connected) {
      return { isOpen: false, reason: 'no_connection', todayLabel: 'Supabase não configurado', loading: false };
    }
    const { minutes: nowMin, dow } = spParts();

    // Bloqueio dia todo
    const blocoTotal = bloqueiosHoje.find((b) => b.dia_todo);
    if (blocoTotal) {
      return {
        isOpen: false,
        reason: 'blocked',
        todayLabel: blocoTotal.motivo ? `Bloqueio: ${blocoTotal.motivo}` : 'Fechado por bloqueio',
        bloqueio: blocoTotal,
        horario: horario || undefined,
        loading: false,
      };
    }
    // Bloqueio parcial ativo agora
    const blocoParcial = bloqueiosHoje.find((b) => !b.dia_todo && b.hora_inicio && b.hora_fim && inRange(nowMin, b.hora_inicio, b.hora_fim));
    if (blocoParcial) {
      return {
        isOpen: false,
        reason: 'blocked',
        todayLabel: `Bloqueio ${formatTime(blocoParcial.hora_inicio)}–${formatTime(blocoParcial.hora_fim)}${blocoParcial.motivo ? `: ${blocoParcial.motivo}` : ''}`,
        bloqueio: blocoParcial,
        horario: horario || undefined,
        loading: false,
      };
    }

    if (!horario) return { isOpen: false, reason: 'no_config', todayLabel: 'Sem configuração', loading: false };
    if (dow === 0) {
      return { isOpen: false, reason: 'closed_sunday', todayLabel: 'Fechado (domingo)', horario, loading: false };
    }
    let start: string | null = null;
    let end: string | null = null;
    if (dow === 6) {
      start = horario.sabado_inicio;
      end = horario.sabado_fim;
    } else {
      start = horario.semana_inicio;
      end = horario.semana_fim;
    }
    if (!start || !end) {
      return { isOpen: false, reason: 'closed_hours', todayLabel: 'Fechado hoje', horario, loading: false };
    }
    const open = inRange(nowMin, start, end);
    return {
      isOpen: open,
      reason: open ? 'open' : 'closed_hours',
      todayLabel: `Hoje: ${formatTime(start)} às ${formatTime(end)}`,
      horario,
      loading: false,
    };
  };

  return compute();
}
