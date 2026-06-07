import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { agentForActivity, agentForEvent, AGENTS, AgentStatus } from './agents';

export interface AgentEvent {
  id: string;
  agentId: string;
  status: Exclude<AgentStatus, 'idle'>;
  message: string;
  detail?: string;
  ts: number;
}

interface AgentRuntimeState {
  status: AgentStatus;
  message?: string;
  busyUntil: number;
  position: [number, number];
}

const VALID_AGENT_IDS = new Set(AGENTS.map(a => a.id));
const REALTIME_TABLES = ['client_payments', 'clientes', 'proposals', 'chamados', 'client_tasks'];
const POLL_INTERVAL_MS = 8000;
const BUSY_DURATION_MS = 4500;
const RECENT_EVENTS_KEEP = 40;

function makeMessage(table: string, action: string, payload: any): { msg: string; detail: string } {
  const t = table.toLowerCase();
  const a = action.toUpperCase();
  if (t === 'clientes') {
    const nome = payload?.new?.nome || payload?.old?.nome || 'cliente';
    if (a === 'INSERT') return { msg: `Novo cliente: ${nome}`, detail: `Cadastro de ${nome}` };
    return { msg: `${a.toLowerCase()} em clientes`, detail: `${a} em clientes` };
  }
  return { msg: `${a.toLowerCase()} em ${table}`, detail: `${a} em ${table}` };
}

function statusForEvent(table: string, payload: any): Exclude<AgentStatus, 'idle'> {
  return 'working';
}

export function useAgentRoomEvents() {
  const [runtime, setRuntime] = useState<Record<string, AgentRuntimeState>>(() => {
    const init: Record<string, AgentRuntimeState> = {};
    AGENTS.forEach(a => {
      init[a.id] = { status: 'idle', busyUntil: 0, position: [...a.position] as [number, number] };
    });
    return init;
  });
  const [history, setHistory] = useState<AgentEvent[]>([]);
  const lastActivityIdRef = useRef<string | null>(null);
  const seenEventKeys = useRef<Set<string>>(new Set());

  const dispatchEvent = useCallback((agentId: string, status: Exclude<AgentStatus, 'idle'>, message: string, detail?: string) => {
    if (!VALID_AGENT_IDS.has(agentId)) return;
    const now = Date.now();
    const delay = Math.random() * 800;
    
    setTimeout(() => {
      const evt: AgentEvent = {
        id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
        agentId, status, message, detail, ts: now,
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

  useEffect(() => {
    const channels = REALTIME_TABLES.map(table => {
      return supabase.channel(`sala-agentes-${table}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table }, (payload: any) => {
          const action = payload.eventType || 'UPDATE';
          const agentId = agentForEvent(table, action);
          if (!agentId) return;
          const { msg, detail } = makeMessage(table, action, payload);
          dispatchEvent(agentId, statusForEvent(table, payload), msg, detail);
        }).subscribe();
    });

    // Canal dedicado: espelha 100% das atividades do sistema (system_activities)
    const activityChannel = supabase
      .channel('sala-agentes-system-activities')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'system_activities' },
        (payload: any) => {
          const row = payload?.new || {};
          const resourceType: string | undefined = row.resource_type;
          const actionLabel: string = row.action || 'atividade';
          const details: string | undefined = row.details || undefined;
          const agentId = agentForActivity(resourceType, actionLabel);
          if (!agentId || !VALID_AGENT_IDS.has(agentId)) return;
          // Dedup: evita repetir o mesmo evento se o realtime entregar duplicado
          const key = `${row.id || ''}-${resourceType}-${actionLabel}`;
          if (seenEventKeys.current.has(key)) return;
          seenEventKeys.current.add(key);
          if (seenEventKeys.current.size > 200) {
            seenEventKeys.current = new Set(Array.from(seenEventKeys.current).slice(-100));
          }
          const msg = actionLabel.length > 60 ? actionLabel.slice(0, 57) + '...' : actionLabel;
          const detail = details || `${resourceType || 'sistema'} • ${actionLabel}`;
          dispatchEvent(agentId, 'working', msg, detail);
        }
      )
      .subscribe();

    return () => {
      channels.forEach(c => supabase.removeChannel(c));
      supabase.removeChannel(activityChannel);
    };
  }, [dispatchEvent]);

  useEffect(() => {
    const id = setInterval(() => {
      const busyCount = Object.values(runtime).filter(s => s.status !== 'idle').length;
      if (busyCount >= 4) return; 
      const idleAgents = AGENTS.filter(a => runtime[a.id]?.status === 'idle');
      if (idleAgents.length === 0) return;
      const pick = idleAgents[Math.floor(Math.random() * idleAgents.length)];
      const msgs = ['Monitorando CRM...', 'Sincronizando dados', 'Verificando novos eventos', 'IA pronta para agir'];
      dispatchEvent(pick.id, 'thinking', msgs[Math.floor(Math.random() * msgs.length)], 'Monitoramento automático em execução');
    }, 10000);
    return () => clearInterval(id);
  }, [dispatchEvent, runtime]);

  // Pontos de lazer onde agentes ociosos vão de vez em quando
  const LEISURE_SPOTS: [number, number][] = [
    [10, 7],   // copa
    [11, 6.5], // copa - cafeteira
    [-10, 7],  // academia
    [-9, 6.5], // academia
    [0, 7],    // sala reunião
    [-2, 7],   // sala reunião
    [11, -8],  // banheiro
  ];

  useEffect(() => {
    const id = setInterval(() => {
      setRuntime(prev => {
        const next = { ...prev };
        let changed = false;
        AGENTS.forEach(agent => {
          const st = prev[agent.id];
          if (st.status === 'idle' && Math.random() < 0.35) {
            const rand = Math.random();
            let newPos: [number, number];
            if (rand < 0.35) {
              // volta pra mesa
              newPos = [...agent.position] as [number, number];
            } else if (rand < 0.65) {
              // vai para lazer
              newPos = [...LEISURE_SPOTS[Math.floor(Math.random() * LEISURE_SPOTS.length)]] as [number, number];
            } else if (rand < 0.85) {
              // anda perto da mesa
              newPos = [agent.position[0] + (Math.random() - 0.5) * 2, agent.position[1] + (Math.random() - 0.5) * 2];
            } else {
              // passeia pelo centro
              newPos = [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 4];
            }
            next[agent.id] = { ...st, position: newPos };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setRuntime(prev => {
        let changed = false;
        const next = { ...prev };
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

  return { runtime, history, dispatchEvent };
}
