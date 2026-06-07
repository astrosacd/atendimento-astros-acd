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
  room: 'operacional' | 'smart' | 'comercial' | 'administrativo'; // Nova categoria de sala
  route?: string;        // rota para clicar e navegar
  watches: string[];
}

// Sala AMPLA de 36x24: agentes distribuídos em 4 grandes departamentos virados ao centro.
// Convenção: x varia -16..+16, z varia -10..+10. Y é vertical (não usado aqui).
export const AGENTS: AgentDef[] = [
  // ===== COMERCIAL (lado esquerdo: x < -5) =====
  { id: 'cadastrar', name: 'Cadu', role: 'Recebe novos clientes', module: 'Cadastrar', color: 'green',
    position: [-14, -7], room: 'comercial', route: '/cadastrar', watches: ['clientes'] },
  { id: 'consultar', name: 'Lupa', role: 'Consulta e edita clientes', module: 'Consultar', color: 'blue',
    position: [-14, -3], room: 'comercial', route: '/consultar', watches: ['clientes'] },
  { id: 'atualizar', name: 'Atta', role: 'Atualiza dados em massa', module: 'Atualizar', color: 'purple',
    position: [-14, 1], room: 'comercial', route: '/atualizar', watches: ['clientes'] },
  { id: 'kanban', name: 'Kana', role: 'Move leads no funil', module: 'Pipeline', color: 'cyan',
    position: [-11, -7], room: 'comercial', route: '/kanban', watches: ['clientes'] },
  { id: 'propostas', name: 'Propi', role: 'Envia propostas comerciais', module: 'Propostas', color: 'green',
    position: [-11, -3], room: 'comercial', route: '/propostas', watches: ['proposals'] },
  { id: 'lead-hunter', name: 'Hunt', role: 'Caça novos leads', module: 'Lead Hunter', color: 'orange',
    position: [-11, 1], room: 'comercial', route: '/lead-hunter', watches: ['lead_hunter_leads'] },
  { id: 'gateway', name: 'Gato', role: 'Vende no checkout', module: 'Gateway', color: 'green',
    position: [-8, -7], room: 'comercial', route: '/gateway', watches: ['gateway_orders'] },
  { id: 'link-pagamento', name: 'Linki', role: 'Gera links de pagamento', module: 'Gerador Link', color: 'cyan',
    position: [-8, -3], room: 'comercial', route: '/gerador-link-pagamento', watches: ['system_activities'] },

  // ===== SMART / IA (centro: -4 < x < 4) =====
  { id: 'ia', name: 'Lyra', role: 'IA do sistema', module: 'IA & Insights', color: 'purple',
    position: [-3, -7], room: 'smart', route: '/admin/ia', watches: ['system_activities'] },
  { id: 'grafo', name: 'Nexo', role: 'Mapa 360° de relações', module: 'Mapa 360°', color: 'cyan',
    position: [0, -7], room: 'smart', route: '/grafo-clientes', watches: ['clientes'] },
  { id: 'central-ajuda', name: 'Helpi', role: 'Central de ajuda IA', module: 'Central Ajuda', color: 'blue',
    position: [3, -7], room: 'smart', route: '/central-ajuda', watches: ['system_activities'] },
  { id: 'instagram', name: 'Insta', role: 'Cria publicações Instagram', module: 'Instagram', color: 'pink',
    position: [-3, -3], room: 'smart', route: '/instagram', watches: ['system_activities'] },
  { id: 'divulgador', name: 'Diva', role: 'Gerencia grupos WhatsApp', module: 'Divulgador', color: 'pink',
    position: [0, -3], room: 'smart', route: '/admin/divulgador', watches: ['system_activities'] },
  { id: 'recaptcha', name: 'Cap', role: 'Valida reCAPTCHA', module: 'reCAPTCHA', color: 'purple',
    position: [3, -3], room: 'smart', route: '/admin/recaptcha', watches: ['system_activities'] },

  // ===== ADMINISTRATIVO / FINANCEIRO (lado direito: x > 5) =====
  { id: 'cobranca', name: 'Cobi', role: 'Dispara cobranças automáticas', module: 'Cobrança', color: 'orange',
    position: [8, -7], room: 'administrativo', route: '/admin/cobranca', watches: ['client_payments'] },
  { id: 'pagamentos', name: 'Pix', role: 'Confere comprovantes', module: 'Segurança Pgto', color: 'green',
    position: [11, -7], room: 'administrativo', route: '/admin/seguranca-pagamento', watches: ['client_payments'] },
  { id: 'despesas', name: 'Dexa', role: 'Lança despesas mensais', module: 'Despesas', color: 'orange',
    position: [14, -7], room: 'administrativo', route: '/despesas', watches: ['despesas'] },
  { id: 'relatorios', name: 'Repo', role: 'Gera relatórios', module: 'Relatórios', color: 'blue',
    position: [8, -3], room: 'administrativo', route: '/admin/relatorios', watches: ['system_activities'] },
  { id: 'usuarios', name: 'Usui', role: 'Cuida dos usuários', module: 'Usuários', color: 'pink',
    position: [11, -3], room: 'administrativo', route: '/usuarios', watches: ['system_activities'] },
  { id: 'tags', name: 'Taggi', role: 'Organiza tags e categorias', module: 'Tags', color: 'purple',
    position: [14, -3], room: 'administrativo', route: '/admin/tags', watches: ['system_activities'] },

  // ===== OPERACIONAL (Fundo: z > 3) =====
  { id: 'consulta-numeros', name: 'Tel', role: 'Consulta status de números', module: 'Consulta Núm', color: 'blue',
    position: [-13, 5], room: 'operacional', route: '/admin/consulta-numeros', watches: ['consulta_numeros_history'] },
  { id: 'numeros-aquecimento', name: 'Aqui', role: 'Aquece chips ativos', module: 'Núm. Aquecimento', color: 'green',
    position: [-9, 5], room: 'operacional', route: '/admin/numeros', watches: ['numeros_aquecimento'] },
  { id: 'chamados', name: 'Chami', role: 'Atende chamados', module: 'Chamados', color: 'orange',
    position: [-5, 5], room: 'operacional', route: '/admin/chamados', watches: ['chamados'] },
  { id: 'tarefas', name: 'Tafa', role: 'Cuida das tarefas', module: 'Tarefas', color: 'orange',
    position: [-1, 5], room: 'operacional', route: '/tarefas', watches: ['client_tasks'] },
  { id: 'agenda', name: 'Aga', role: 'Agenda eventos e reuniões', module: 'Agenda', color: 'cyan',
    position: [3, 5], room: 'operacional', route: '/agenda', watches: ['system_activities'] },
  { id: 'followups', name: 'Folly', role: 'Reengaja clientes', module: 'Follow-up', color: 'purple',
    position: [7, 5], room: 'operacional', route: '/followups', watches: ['system_activities'] },
  { id: 'webhooks', name: 'Hooky', role: 'Dispara webhooks p/ n8n', module: 'Webhooks', color: 'cyan',
    position: [11, 5], room: 'operacional', route: '/admin/webhooks', watches: ['webhooks'] },
  { id: 'audit', name: 'Audi', role: 'Auditoria e logs', module: 'Auditoria', color: 'blue',
    position: [14, 5], room: 'operacional', route: '/admin/audit-logs', watches: ['system_activities'] },

  // ===== NOVOS MÓDULOS (fileira frontal: z = 9) =====
  { id: 'boas-vindas', name: 'Vindi', role: 'Mensagens de boas-vindas', module: 'Boas-Vindas', color: 'green',
    position: [-13, 9], room: 'comercial', route: '/admin/boas-vindas', watches: ['system_activities'] },
  { id: 'chat-config', name: 'Chati', role: 'Configura chat interno', module: 'Chat Config', color: 'pink',
    position: [-9, 9], room: 'smart', route: '/admin/chat-config', watches: ['system_activities'] },
  { id: 'permissoes', name: 'Perm', role: 'Gerencia permissões e papéis', module: 'Permissões', color: 'purple',
    position: [-5, 9], room: 'administrativo', route: '/admin/permissoes', watches: ['system_activities'] },
  { id: 'api-keys', name: 'Keys', role: 'Gera e revoga API Keys', module: 'API Keys', color: 'cyan',
    position: [-1, 9], room: 'smart', route: '/admin/api-keys', watches: ['system_activities'] },
  { id: 'planos', name: 'Plano', role: 'Cuida dos planos do revendedor', module: 'Planos', color: 'green',
    position: [3, 9], room: 'administrativo', route: '/admin/planos-revendedor', watches: ['system_activities'] },
  { id: 'recuperacao', name: 'Recu', role: 'Recupera senhas dos usuários', module: 'Recuperação', color: 'orange',
    position: [7, 9], room: 'administrativo', route: '/admin/recuperacao-senha', watches: ['system_activities'] },
  { id: 'perfil', name: 'Perfi', role: 'Perfil do usuário', module: 'Meu Perfil', color: 'blue',
    position: [11, 9], room: 'administrativo', route: '/perfil', watches: ['system_activities'] },
  { id: 'central-help', name: 'Guia', role: 'Guia interativo', module: 'Guia', color: 'cyan',
    position: [14, 9], room: 'smart', route: '/central-ajuda', watches: ['system_activities'] },
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
  if (t === 'automation_logs') return 'webhooks';
  if (t === 'instagram_posts' || t === 'instagram_settings') return 'instagram';
  if (t === 'gateway_orders' || t === 'gateway_products') return 'gateway';
  if (t === 'audit_logs') return 'audit';
  return null;
}

// Mapeia resource_type de system_activities -> id do agente
export function agentForActivity(resourceType?: string | null, action?: string | null): string | null {
  if (!resourceType) return null;
  const r = resourceType.toLowerCase();
  const a = (action || '').toLowerCase();

  // Mapeamentos diretos pelos ActivityType de useSystemActivities
  if (r === 'consulta') return 'consulta-numeros';
  if (r === 'pagamento') return 'pagamentos';
  if (r === 'venda') return 'gateway';
  if (r === 'duvida') return 'central-ajuda';
  if (r === 'cliente') {
    if (a.includes('cria') || a.includes('cadastr') || a === 'create' || a === 'insert') return 'cadastrar';
    if (a.includes('atualiz') || a.includes('edit') || a === 'update') return 'atualizar';
    return 'consultar';
  }
  if (r === 'config') return 'permissoes';
  if (r === 'lead_hunter') return 'lead-hunter';
  if (r === 'numeros_aquecimento') return 'numeros-aquecimento';
  if (r === 'proposta') return 'propostas';
  if (r === 'tarefa') return 'tarefas';
  if (r === 'webhook') return 'webhooks';
  if (r === 'despesa') return 'despesas';
  if (r === 'followup') return 'followups';
  if (r === 'admin') return 'audit';
  if (r === 'pipeline') return 'kanban';
  if (r === 'contato') return 'consultar';
  if (r === 'chamado') return 'chamados';

  // Fallbacks por substring (cobre logs antigos / variantes)
  if (r.includes('proposal') || r.includes('proposta')) return 'propostas';
  if (r.includes('payment') || r.includes('billing') || r.includes('cobranca')) return 'cobranca';
  if (r.includes('followup') || r.includes('follow_up')) return 'followups';
  if (r.includes('agenda') || r.includes('event') || r.includes('calendar')) return 'agenda';
  if (r.includes('task') || r.includes('tarefa')) return 'tarefas';
  if (r.includes('lead')) return 'lead-hunter';
  if (r.includes('chamado') || r.includes('ticket')) return 'chamados';
  if (r.includes('numero') || r.includes('number')) return 'consulta-numeros';
  if (r.includes('aquec')) return 'numeros-aquecimento';
  if (r.includes('webhook')) return 'webhooks';
  if (r.includes('divulgador') || r.includes('group') || r.includes('grupo')) return 'divulgador';
  if (r.includes('instagram') || r.includes('post')) return 'instagram';
  if (r.includes('sms')) return 'consulta-numeros';
  if (r.includes('ligac') || r.includes('call')) return 'cobranca';
  if (r.includes('despesa') || r.includes('expense')) return 'despesas';
  if (r.includes('gateway') || r.includes('checkout') || r.includes('order') || r.includes('venda')) return 'gateway';
  if (r.includes('link') || r.includes('pagamento')) return 'link-pagamento';
  if (r.includes('client') || r.includes('cliente')) {
    if (a === 'create' || a === 'insert' || a.includes('cria') || a.includes('cadastr')) return 'cadastrar';
    if (a === 'update' || a.includes('atualiz') || a.includes('edit')) return 'atualizar';
    return 'consultar';
  }
  if (r.includes('user') || r.includes('usuario') || r.includes('login') || r.includes('auth')) return 'usuarios';
  if (r.includes('tag')) return 'tags';
  if (r.includes('ai') || r.includes('ia') || r.includes('lyra')) return 'ia';
  if (r.includes('audit') || r.includes('log')) return 'audit';
  if (r.includes('config') || r.includes('setting') || r.includes('permiss')) return 'permissoes';
  return 'ia'; // fallback: IA central acusa qualquer atividade não mapeada
}
