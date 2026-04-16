import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSystemActivities } from '@/hooks/useSystemActivities';

export interface LeadHunterLead {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  empresa: string | null;
  website: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  categoria: string | null;
  avaliacao: number | null;
  fonte: string;
  dados_extras: Record<string, any>;
  status: string;
  erro_mensagem: string | null;
  enviado_at: string | null;
  enviado_por_instancia: string | null;
  campanha_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadHunterCampanha {
  id: string;
  nome: string;
  descricao: string | null;
  status: string;
  tipo_mensagem: string;
  mensagem_modelo: string | null;
  prompt_ia: string | null;
  provedor_ia: string;
  modelo_ia: string | null;
  total_leads: number;
  total_enviados: number;
  total_erros: number;
  total_respondidos: number;
  delay_entre_mensagens: number;
  created_at: string;
  updated_at: string;
}

export interface LeadHunterWhatsAppInstance {
  id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface LeadHunterLog {
  id: string;
  lead_id: string | null;
  campanha_id: string | null;
  tipo: string;
  mensagem: string | null;
  resultado: string | null;
  detalhes: Record<string, any>;
  created_at: string;
}

export interface LeadHunterBusca {
  id: string;
  query: string;
  localizacao: string | null;
  total_resultados: number;
  status: string;
  erro_mensagem: string | null;
  created_at: string;
}

// ========== LEADS ==========
export function useLeadHunterLeads(campanhaId?: string) {
  return useQuery({
    queryKey: ['lead-hunter-leads', campanhaId],
    queryFn: async () => {
      let q = supabase
        .from('lead_hunter_leads')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (campanhaId) q = q.eq('campanha_id', campanhaId);
      
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as LeadHunterLead[];
    },
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<LeadHunterLead>) => {
      const { data, error } = await supabase
        .from('lead_hunter_leads')
        .insert(lead as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-leads'] });
      toast.success('Lead adicionado!');
    },
    onError: (e: any) => {
      if (e?.code === '23505') {
        toast.error('Este telefone já está cadastrado');
      } else {
        toast.error('Erro ao adicionar lead');
      }
    },
  });
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_hunter_leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-leads'] });
      toast.success('Lead removido');
    },
    onError: () => toast.error('Erro ao remover lead'),
  });
}

// ========== CAMPANHAS ==========
export function useLeadHunterCampanhas() {
  return useQuery({
    queryKey: ['lead-hunter-campanhas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_hunter_campanhas')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LeadHunterCampanha[];
    },
  });
}

export function useCreateCampanha() {
  const qc = useQueryClient();
  const { logActivity } = useSystemActivities();
  return useMutation({
    mutationFn: async (campanha: Partial<LeadHunterCampanha>) => {
      const { data, error } = await supabase
        .from('lead_hunter_campanhas')
        .insert(campanha as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-campanhas'] });
      toast.success('Campanha criada!');
    },
    onError: () => toast.error('Erro ao criar campanha'),
  });
}

export function useUpdateCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeadHunterCampanha> & { id: string }) => {
      const { data, error } = await supabase
        .from('lead_hunter_campanhas')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-campanhas'] });
      toast.success('Campanha atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar campanha'),
  });
}

export function useDeleteCampanha() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // First unlink leads from this campaign
      await supabase.from('lead_hunter_leads').update({ campanha_id: null } as any).eq('campanha_id', id);
      const { error } = await supabase.from('lead_hunter_campanhas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-campanhas'] });
      qc.invalidateQueries({ queryKey: ['lead-hunter-leads'] });
      toast.success('Campanha excluída');
    },
    onError: () => toast.error('Erro ao excluir campanha'),
  });
}

// ========== WHATSAPP INSTANCES ==========
export function useLeadHunterInstances() {
  return useQuery({
    queryKey: ['lead-hunter-instances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_hunter_whatsapp_instances')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as LeadHunterWhatsAppInstance[];
    },
  });
}

export function useCreateInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (instance: Partial<LeadHunterWhatsAppInstance>) => {
      const { data, error } = await supabase
        .from('lead_hunter_whatsapp_instances')
        .insert(instance as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-instances'] });
      toast.success('Instância adicionada!');
    },
    onError: () => toast.error('Erro ao adicionar instância'),
  });
}

export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lead_hunter_whatsapp_instances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-instances'] });
      toast.success('Instância removida');
    },
    onError: () => toast.error('Erro ao remover instância'),
  });
}

// ========== CONFIG ==========
export function useLeadHunterConfig() {
  return useQuery({
    queryKey: ['lead-hunter-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_hunter_config')
        .select('*');
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((row: any) => { map[row.config_key] = row.config_value; });
      return map;
    },
  });
}

export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (configs: Record<string, string>) => {
      for (const [key, value] of Object.entries(configs)) {
        const { error } = await supabase
          .from('lead_hunter_config')
          .upsert({ config_key: key, config_value: value } as any, { onConflict: 'config_key' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-config'] });
      toast.success('Configurações salvas!');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });
}

// ========== BASEROW CONFIG ==========
export function useLeadHunterBaserowConfig() {
  return useQuery({
    queryKey: ['lead-hunter-baserow-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_hunter_baserow_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useUpdateBaserowConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (config: any) => {
      const { data: existing } = await supabase
        .from('lead_hunter_baserow_config')
        .select('id')
        .limit(1)
        .maybeSingle();
      
      if (existing?.id) {
        const { error } = await supabase
          .from('lead_hunter_baserow_config')
          .update(config)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_hunter_baserow_config')
          .insert(config);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-hunter-baserow-config'] });
      toast.success('Configuração Baserow salva!');
    },
    onError: () => toast.error('Erro ao salvar configuração Baserow'),
  });
}

// ========== LOGS ==========
export function useLeadHunterLogs(campanhaId?: string) {
  return useQuery({
    queryKey: ['lead-hunter-logs', campanhaId],
    queryFn: async () => {
      let q = supabase
        .from('lead_hunter_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (campanhaId) q = q.eq('campanha_id', campanhaId);
      
      const { data, error } = await q;
      if (error) throw error;
      return data as unknown as LeadHunterLog[];
    },
  });
}

// ========== BUSCAS ==========
export function useLeadHunterBuscas() {
  return useQuery({
    queryKey: ['lead-hunter-buscas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_hunter_buscas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as LeadHunterBusca[];
    },
  });
}
