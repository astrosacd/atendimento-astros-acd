import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  reason: 'open' | 'closed_hours' | 'closed_sunday' | 'blocked' | 'no_config';
  todayLabel: string;
  bloqueio?: Bloqueio;
  horario?: BusinessHours;
  loading: boolean;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatTime = (t: string | null) => (t ? t.slice(0, 5) : '');

const inRange = (now: Date, start: string, end: string) => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const cur = now.getHours() * 60 + now.getMinutes();
  return cur >= sh * 60 + sm && cur <= eh * 60 + em;
};

export function useBusinessHoursStatus() {
  const [horario, setHorario] = useState<BusinessHours | null>(null);
  const [bloqueioHoje, setBloqueioHoje] = useState<Bloqueio | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  const load = async () => {
    const [{ data: h }, { data: b }] = await Promise.all([
      supabase.from('horario_comercial' as any).select('*').order('id').limit(1).maybeSingle(),
      supabase.from('bloqueios' as any).select('*').eq('data', todayStr()).maybeSingle(),
    ]);
    setHorario((h as any) || null);
    setBloqueioHoje((b as any) || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('business-hours-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horario_comercial' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bloqueios' }, load)
      .subscribe();
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(interval);
    };
  }, []);

  const compute = (): BusinessHoursStatus => {
    if (loading) return { isOpen: false, reason: 'no_config', todayLabel: '...', loading: true };
    if (bloqueioHoje) {
      return {
        isOpen: false,
        reason: 'blocked',
        todayLabel: bloqueioHoje.motivo ? `Bloqueio: ${bloqueioHoje.motivo}` : 'Fechado por bloqueio',
        bloqueio: bloqueioHoje,
        horario: horario || undefined,
        loading: false,
      };
    }
    if (!horario) return { isOpen: false, reason: 'no_config', todayLabel: 'Sem configuração', loading: false };
    const now = new Date();
    const dow = now.getDay(); // 0=dom
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
    const open = inRange(now, start, end);
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
