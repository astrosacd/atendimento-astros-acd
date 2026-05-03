import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { agentForActivity, agentForEvent, AGENTS, AgentStatus } from './agents';

export interface AgentEvent {
  id: string;            // uuid local
  agentId: string;
  status: Exclude<AgentStatus, 'idle'>;
  message: string;       // texto curto p/ balão
  detail?: string;       // texto p/ painel lateral
  ts: number;
}

interface AgentRuntimeState {
  status: AgentStatus;
  message?: string;
  busyUntil: number; // timestamp em ms
  position: [number, number]; // [x, z] atual
}

const VALID_AGENT_IDS = new Set(AGENTS.map(a => a.id));

// Tabelas críticas escutadas via realtime
const REALTIME_TABLES = [
  'client_payments',
  'clientes',
  'proposals',
  'chamados',
  'client_tasks',
  'agenda_events', // pode não existir, ignorado se falhar
];

// Polling de system_activities a cada 8s
const POLL_INTERVAL_MS = 8000;
const BUSY_DURATION_MS = 4500;
const RECENT_EVENTS_KEEP = 40;

function makeMessage(table: string, action: string, payload: any): { msg: string; detail: string } {
  const t = table.toLowerCase();
  const a = action.toUpperCase();
  if (t === 'clientes') {
    const nome = payload?.new?.nome || payload?.old?.nome || 'cliente';
    if (a === 'INSERT') return { msg: `Novo cliente: ${nome}`, detail: `Cadastro de ${nome}` };
    if (a === 'UPDATE') return { msg: `Atualizou ${nome}`, detail: `Cliente ${nome} atualizado` };
    if (a === 'DELETE') return { msg: `Removeu ${nome}`, detail: `Cliente ${nome} excluído` };
  }
  if (t === 'client_payments') {
    const status = payload?.new?.status || payload?.old?.status;
    if (status === 'pending_approval') return { msg: 'Comprovante chegou', detail: 'Pagamento aguardando aprovação' };
    if (status === 'paid') return { msg: 'Pagamento aprovado', detail: 'Cliente renovado' };
    if (status === 'rejected') return { msg: 'Pagamento reprovado', detail: 'Comprovante rejeitado' };
    return { msg: 'Mexendo em pagamento', detail: 'Atualizou registro de pagamento' };
  }
  if (t === 'proposals') {
    if (a === 'INSERT') return { msg: 'Nova proposta', detail: 'Proposta criada' };
    if (a === 'UPDATE') {
      const st = payload?.new?.status;
      if (st === 'sent') return { msg: 'Proposta enviada', detail: 'Proposta enviada ao cliente' };
      if (st === 'accepted') return { msg: 'Proposta aceita 🎉', detail: 'Cliente aceitou' };
      if (st === 'rejected') return { msg: 'Proposta recusada', detail: 'Cliente recusou' };
      return { msg: 'Proposta atualizada', detail: 'Status alterado' };
    }
  }
  if (t === 'chamados') {
    if (a === 'INSERT') return { msg: 'Novo chamado', detail: 'Chamado aberto' };
    if (a === 'UPDATE') return { msg: 'Mexeu no chamado', detail: 'Chamado atualizado' };
  }
  if (t === 'client_tasks') {
    if (a === 'INSERT') return { msg: 'Nova tarefa', detail: 'Tarefa criada' };
    if (a === 'UPDATE') return { msg: 'Tarefa atualizada', detail: 'Status de tarefa alterado' };
  }
  return { msg: `${a.toLowerCase()} em ${table}`, detail: `${a} ${table}` };
}

function statusForEvent(table: string, payload: any): Exclude<AgentStatus, 'idle'> {
  const t = table.toLowerCase();
  if (t === 'client_payments') {
    const st = payload?.new?.status;
    if (st === 'rejected') return 'error';
    if (st === 'pending_approval') return 'thinking';
    if (st === 'paid') return 'working';
  }
  if (t === 'proposals') {
    const st = payload?.new?.status;
    if (st === 'sent') return 'talking';
    if (st === 'rejected') return 'error';
    if (st === 'accepted') return 'working';
  }
  if (t === 'chamados') return 'talking';
  return 'working';
}

export function useAgentRoomEvents() {
  const [runtime, setRuntime] = useState<Record<string, AgentRuntimeState>>(() => {
    const init: Record<string, AgentRuntimeState> = {};
    AGENTS.forEach(a => {
      init[a.id] = { 
        status: 'idle', 
        busyUntil: 0, 
        position: [...a.position] as [number, number] 
      };
    });
    return init;
  });
  const [history, setHistory] = useState<AgentEvent[]>([]);
  const lastActivityIdRef = useRef<string | null>(null);
  const seenEventKeys = useRef<Set<string>>(new Set());

  // Despacha um evento para a sala
  const dispatchEvent = useCallback((agentId: string, status: Exclude<AgentStatus, 'idle'>, message: string, detail?: string) => {
    if (!VALID_AGENT_IDS.has(agentId)) return;
    const now = Date.now();
    
    // Pequeno delay aleatório para parecer que o agente "notou" o evento
    const delay = Math.random() * 800;
    
    setTimeout(() => {
      const evt: AgentEvent = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        agentId,
        status,
        message,
        detail,
        ts: now,
      };
      setHistory(prev => [evt, ...prev].slice(0, RECENT_EVENTS_KEEP));
      setRuntime(prev => ({
        ...prev,
        [agentId]: { 
          ...prev[agentId], 
          status, 
          message, 
          busyUntil: now + BUSY_DURATION_MS,
          position: [...AGENTS.find(a => a.id === agentId)!.position] as [number, number]
        },
      }));
    }, delay);
  }, []);

  // ===== Realtime =====
  useEffect(() => {
    const channels = REALTIME_TABLES.map(table => {
      const ch = supabase
        .channel(`sala-agentes-${table}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table },
          (payload: any) => {
            const action = payload.eventType || payload.event || 'UPDATE';
            const agentId = agentForEvent(table, action);
            if (!agentId) return;
            const key = `${payload.commit_timestamp || ''}-${payload.new?.id || payload.old?.id || ''}-${action}`;
            if (seenEventKeys.current.has(key)) return;
            seenEventKeys.current.add(key);
            if (seenEventKeys.current.size > 200) {
              const arr = Array.from(seenEventKeys.current);
              seenEventKeys.current = new Set(arr.slice(-100));
            }
            const { msg, detail } = makeMessage(table, action, payload);
            dispatchEvent(agentId, statusForEvent(table, payload), msg, detail);
          },
        )
        .subscribe();
      return ch;
    });
    return () => {
      channels.forEach(c => supabase.removeChannel(c));
    };
  }, [dispatchEvent]);

  // ===== Polling system_activities =====
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const query = supabase
          .from('system_activities')
          .select('id, action, resource_type, details, created_at')
          .order('created_at', { ascending: false })
          .limit(15);
        const { data, error } = await query;
        if (error || !data || cancelled) return;

        // Primeira execução: só guardamos o cursor sem disparar
        if (lastActivityIdRef.current === null) {
          lastActivityIdRef.current = data[0]?.id || '';
          return;
        }

        const newOnes: typeof data = [];
        for (const row of data) {
          if (row.id === lastActivityIdRef.current) break;
          newOnes.push(row);
        }
        if (newOnes.length === 0) return;
        lastActivityIdRef.current = data[0].id;

        // Em ordem cronológica (mais antigo primeiro) com pequena defasagem
        newOnes.reverse().forEach((row, idx) => {
          const agentId = agentForActivity(row.resource_type, row.action);
          if (!agentId) return;
          const actionLabel = (row.action || 'evento').replace(/_/g, ' ');
          const msg = `Processando: ${actionLabel}`;
          const detail = row.details || `Módulo executando ${actionLabel} em ${row.resource_type}`;
          setTimeout(() => dispatchEvent(agentId, 'working', msg, detail), idx * 500);
        });
      } catch (e) {
        console.warn('[sala-agentes] polling error', e);
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [dispatchEvent]);

  // ===== Fade automático: volta para idle quando expira =====
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRuntime(prev => {
        let changed = false;
        const next: Record<string, AgentRuntimeState> = { ...prev };
        for (const [aid, st] of Object.entries(prev)) {
          if (st.status !== 'idle' && st.busyUntil < now) {
            next[aid] = { ...st, status: 'idle', busyUntil: 0 };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Movimento dinâmico: agentes ociosos passeiam ou visitam outras salas
  useEffect(() => {
    const id = setInterval(() => {
      setRuntime(prev => {
        const next = { ...prev };
        let changed = false;

        AGENTS.forEach(agent => {
          const st = prev[agent.id];
          if (st.status === 'idle' && Math.random() < 0.25) { // 25% de chance de mover
            const rand = Math.random();
            let newPos: [number, number];

            if (rand < 0.4) {
              // Volta para a mesa original
              newPos = [...agent.position] as [number, number];
            } else if (rand < 0.7) {
              // Passeia pela sala central (HUB)
              newPos = [(Math.random() - 0.5) * 4, -2 + (Math.random() - 0.5) * 4];
            } else {
              // Visita outra sala aleatória (Interação entre módulos)
              const otherAgent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
              newPos = [otherAgent.position[0] + 1.2, otherAgent.position[1]];
            }
            
            next[agent.id] = { ...st, position: newPos, message: rand > 0.8 ? 'Visitando módulo...' : st.message };
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 4000); // Mais frenético
    return () => clearInterval(id);
  }, []);

  // Demo: dispara um eventozinho leve a cada ~12s
  useEffect(() => {
    const id = setInterval(() => {
      setRuntime(prev => {
        const busyCount = Object.values(prev).filter(s => s.status !== 'idle').length;
        if (busyCount >= 3) return prev;
        const idleAgents = AGENTS.filter(a => prev[a.id]?.status === 'idle');
        if (idleAgents.length === 0) return prev;
        const pick = idleAgents[Math.floor(Math.random() * idleAgents.length)];
        const now = Date.now();
        return {
          ...prev,
          [pick.id]: { 
            ...prev[pick.id],
            status: 'thinking', 
            busyUntil: now + 2500, 
            message: 'Verificando...',
            position: [...pick.position] as [number, number] // volta p/ mesa
          },
        };
      });
    }, 15000);
    return () => clearInterval(id);
  }, []);

  return { runtime, history, dispatchEvent };
}
