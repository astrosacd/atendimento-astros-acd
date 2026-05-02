// Catálogo único de agentes — cada agente representa um módulo do sistema
// e é posicionado em coordenadas (x, z) num grid isométrico de 18x12 unidades.
// Toda mudança de módulos da sala vive aqui.

export type AgentStatus = 'idle' | 'working' | 'thinking' | 'talking' | 'error';

export type AgentColor =
  | 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'cyan';

export interface AgentDef {
  id: string;            // chave única (usada para invocar status)
  name: string;          // nome curto exibido na placa
  role: string;          // descrição funcional
  module: string;        // rótulo da estação
  color: AgentColor;     // cor do uniforme/cubo
  position: [number, number]; // [x, z] em unidades 3D (centro 0,0)
  route?: string;        // rota para clicar e navegar
  // tabelas que este agente "observa" (informativo, usado para tooltip)
  watches: string[];
}

// Sala de 18x12: agentes distribuídos em 4 fileiras de mesas viradas para o centro.
// Convenção: x varia -8..+8, z varia -5..+5. Y é vertical (não usado aqui).
export const AGENTS: AgentDef[] = [
  // ===== Fileira NORTE (z = -4) — Núcleo de Clientes =====
  { id: 'cadastrar', name: 'Cadu', role: 'Recebe novos clientes', module: 'Cadastrar', color: 'green',
    position: [-7, -4], route: '/cadastrar', watches: ['clientes'] },
  { id: 'consultar', name: 'Lupa', role: 'Consulta e edita clientes', module: 'Consultar', color: 'blue',
    position: [-4, -4], route: '/consultar', watches: ['clientes'] },
  { id: 'atualizar', name: 'Atta', role: 'Atualiza dados em massa', module: 'Atualizar', color: 'purple',
    position: [-1, -4], route: '/atualizar', watches: ['clientes'] },
  { id: 'kanban', name: 'Kana', role: 'Move leads no funil', module: 'Pipeline', color: 'cyan',
    position: [2, -4], route: '/kanban', watches: ['clientes'] },
  { id: 'grafo', name: 'Nexo', role: 'Mapa 360° de relações', module: 'Mapa 360°', color: 'cyan',
    position: [5, -4], route: '/grafo-clientes', watches: ['clientes'] },

  // ===== Fileira CENTRO-NORTE (z = -1.5) — Cobrança & Financeiro =====
  { id: 'cobranca', name: 'Cobi', role: 'Dispara cobranças automáticas', module: 'Cobrança', color: 'orange',
    position: [-7, -1.5], route: '/admin/cobranca', watches: ['client_payments'] },
  { id: 'pagamentos', name: 'Pix', role: 'Confere comprovantes', module: 'Segurança Pgto', color: 'green',
    position: [-4, -1.5], route: '/admin/seguranca-pagamento', watches: ['client_payments'] },
  { id: 'gateway', name: 'Gate', role: 'Vendas pelo checkout', module: 'Gateway', color: 'pink',
    position: [-1, -1.5], route: '/admin/gateway', watches: ['gateway_orders'] },
  { id: 'link-pagamento', name: 'Linki', role: 'Gera links de pagamento', module: 'Link Pgto', color: 'green',
    position: [2, -1.5], route: '/link-pagamento', watches: ['client_payments'] },
  { id: 'despesas', name: 'Dexa', role: 'Lança despesas mensais', module: 'Despesas', color: 'orange',
    position: [5, -1.5], route: '/despesas', watches: ['despesas'] },

  // ===== Fileira CENTRO-SUL (z = 1) — Comunicação & Agendamentos =====
  { id: 'followups', name: 'Folly', role: 'Reengaja clientes', module: 'Follow-up', color: 'purple',
    position: [-7, 1], route: '/followups', watches: ['system_activities'] },
  { id: 'agenda', name: 'Aga', role: 'Agenda eventos e reuniões', module: 'Agenda', color: 'cyan',
    position: [-4, 1], route: '/agenda', watches: ['system_activities'] },
  { id: 'tarefas', name: 'Tafa', role: 'Cuida das tarefas', module: 'Tarefas', color: 'orange',
    position: [-1, 1], route: '/tarefas', watches: ['client_tasks'] },
  { id: 'propostas', name: 'Propi', role: 'Envia propostas comerciais', module: 'Propostas', color: 'green',
    position: [2, 1], route: '/propostas', watches: ['proposals'] },
  { id: 'chamados', name: 'Chami', role: 'Atende chamados', module: 'Chamados', color: 'orange',
    position: [5, 1], route: '/admin/chamados', watches: ['chamados'] },

  // ===== Fileira SUL (z = 3.5) — Telefonia, Marketing, IA =====
  { id: 'consulta-numeros', name: 'Tel', role: 'Consulta status de números', module: 'Consulta Núm', color: 'blue',
    position: [-7, 3.5], route: '/admin/consulta-numeros', watches: ['consulta_numeros_history'] },
  { id: 'numeros-aquecimento', name: 'Aqui', role: 'Aquece chips ativos', module: 'Núm. Aquecimento', color: 'green',
    position: [-4, 3.5], route: '/admin/numeros', watches: ['numeros_aquecimento'] },
  { id: 'lead-hunter', name: 'Hunt', role: 'Caça novos leads', module: 'Lead Hunter', color: 'orange',
    position: [-1, 3.5], route: '/lead-hunter', watches: ['lead_hunter_leads'] },
  { id: 'divulgador', name: 'Diva', role: 'Gerencia grupos WhatsApp', module: 'Divulgador', color: 'pink',
    position: [2, 3.5], route: '/admin/divulgador', watches: ['system_activities'] },
  { id: 'ia', name: 'Lyra', role: 'IA do sistema', module: 'IA & Insights', color: 'purple',
    position: [5, 3.5], route: '/admin/ia', watches: ['system_activities'] },

  // ===== Fundo (z = -6) — operacional =====
  { id: 'webhooks', name: 'Hooky', role: 'Dispara webhooks p/ n8n', module: 'Webhooks', color: 'cyan',
    position: [-5.5, -6], route: '/admin/webhooks', watches: ['webhooks'] },
  { id: 'automations', name: 'Auto', role: 'Roda automações agendadas', module: 'Automações', color: 'purple',
    position: [-2, -6], route: '/admin/cobranca', watches: ['automation_logs'] },
  { id: 'relatorios', name: 'Repo', role: 'Gera relatórios', module: 'Relatórios', color: 'blue',
    position: [1.5, -6], route: '/admin/relatorios', watches: ['system_activities'] },
  { id: 'usuarios', name: 'Usui', role: 'Cuida dos usuários', module: 'Usuários', color: 'pink',
    position: [5, -6], route: '/usuarios', watches: ['system_activities'] },
];

// Mapeia eventos do banco -> id do agente que deve animar
export function agentForEvent(table: string, action?: string): string | null {
  const t = table.toLowerCase();
  if (t === 'clientes') {
    if (action === 'INSERT') return 'cadastrar';
    if (action === 'UPDATE') return 'atualizar';
    return 'consultar';
  }
  if (t === 'client_payments') return 'pagamentos';
  if (t === 'gateway_orders') return 'gateway';
  if (t === 'proposals') return 'propostas';
  if (t === 'chamados') return 'chamados';
  if (t === 'client_tasks') return 'tarefas';
  if (t === 'lead_hunter_leads') return 'lead-hunter';
  if (t === 'consulta_numeros_history') return 'consulta-numeros';
  if (t === 'numeros_aquecimento') return 'numeros-aquecimento';
  if (t === 'despesas') return 'despesas';
  if (t === 'webhooks') return 'webhooks';
  if (t === 'automation_logs') return 'automations';
  return null;
}

// Mapeia resource_type de system_activities -> id do agente
export function agentForActivity(resourceType?: string | null, action?: string | null): string | null {
  if (!resourceType) return null;
  const r = resourceType.toLowerCase();
  if (r.includes('proposal')) return 'propostas';
  if (r.includes('payment') || r.includes('billing') || r.includes('cobranca')) return 'cobranca';
  if (r.includes('followup') || r.includes('follow_up')) return 'followups';
  if (r.includes('agenda') || r.includes('event')) return 'agenda';
  if (r.includes('task') || r.includes('tarefa')) return 'tarefas';
  if (r.includes('lead')) return 'lead-hunter';
  if (r.includes('chamado') || r.includes('ticket')) return 'chamados';
  if (r.includes('numero') || r.includes('number')) return 'consulta-numeros';
  if (r.includes('webhook')) return 'webhooks';
  if (r.includes('divulgador') || r.includes('group')) return 'divulgador';
  if (r.includes('client') || r.includes('cliente')) {
    if (action === 'create' || action === 'INSERT') return 'cadastrar';
    if (action === 'update' || action === 'UPDATE') return 'atualizar';
    return 'consultar';
  }
  if (r.includes('user')) return 'usuarios';
  if (r.includes('ai') || r.includes('ia')) return 'ia';
  return null;
}
