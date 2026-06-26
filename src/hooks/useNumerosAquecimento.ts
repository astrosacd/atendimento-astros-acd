import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import type { Json } from '@/integrations/supabase/types';

export interface NumeroAquecimento {
  id: string;
  numero: string;
  modelo_id: string | null;
  status_id: string | null;
  aparelho_id: string | null;
  tipo_whatsapp: 'normal' | 'business' | null;
  ultima_atividade: string;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  modelo?: NumeroModelo | null;
  status?: NumeroStatus | null;
}

export interface NumeroStatus {
  id: string;
  nome: string;
  cor: string;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface NumeroModelo {
  id: string;
  nome: string;
  marca: string | null;
  descricao: string | null;
  capacidade_whatsapp: number;
  aparece_no_checkin: boolean;
  created_at: string;
  updated_at: string;
}

export interface NumeroHistory {
  id: string;
  numero_id: string | null;
  numero_valor: string;
  acao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  campos_alterados: string[] | null;
  usuario_id: string | null;
  usuario_email: string | null;
  created_at: string;
}

export interface NumeroWebhook {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  secret_key: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NumeroApiKey {
  id: string;
  nome: string;
  api_key: string;
  descricao: string | null;
  is_active: boolean;
  last_used_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Format date for "Última Atividade"
export type AtividadeTipo = 'cadastro' | 'st' | 'obs' | 'mod' | 'st + obs' | 'st + mod' | 'obs + mod' | 'st + obs + mod';

export function formatUltimaAtividade(tipo: AtividadeTipo): string {
  const date = new Date().toLocaleDateString('pt-BR');
  return `${tipo} - ${date}`;
}

// Calculate activity type based on what changed
export function calcularTipoAtividade(
  statusChanged: boolean,
  obsChanged: boolean,
  modeloChanged: boolean
): AtividadeTipo {
  const parts: string[] = [];
  if (statusChanged) parts.push('st');
  if (obsChanged) parts.push('obs');
  if (modeloChanged) parts.push('mod');
  
  if (parts.length === 0) return 'obs'; // fallback
  return parts.join(' + ') as AtividadeTipo;
}

// Hook for main numbers list
export function useNumerosAquecimento(filters?: {
  search?: string;
  status_id?: string;
  modelo_id?: string;
}) {
  return useQuery({
    queryKey: ['numeros-aquecimento', filters],
    queryFn: async () => {
      let query = supabase
        .from('numeros_aquecimento')
        .select(`
          *,
          modelo:numeros_aquecimento_modelos(*),
          status:numeros_aquecimento_status(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.search) {
        query = query.or(`numero.ilike.%${filters.search}%,observacoes.ilike.%${filters.search}%`);
      }
      if (filters?.status_id) {
        query = query.eq('status_id', filters.status_id);
      }
      if (filters?.modelo_id) {
        query = query.eq('modelo_id', filters.modelo_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as NumeroAquecimento[];
    },
  });
}

// Hook for status list
export function useNumerosStatus() {
  return useQuery({
    queryKey: ['numeros-aquecimento-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_status')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as NumeroStatus[];
    },
  });
}

// Hook for models list
export function useNumerosModelos() {
  return useQuery({
    queryKey: ['numeros-aquecimento-modelos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_modelos')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as NumeroModelo[];
    },
  });
}

// Hook for history
export function useNumeroHistory(numeroId?: string) {
  return useQuery({
    queryKey: ['numeros-aquecimento-history', numeroId],
    queryFn: async () => {
      let query = supabase
        .from('numeros_aquecimento_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (numeroId) {
        query = query.eq('numero_id', numeroId);
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as NumeroHistory[];
    },
    enabled: true,
  });
}

// Hook for webhooks
export function useNumerosWebhooks() {
  return useQuery({
    queryKey: ['numeros-aquecimento-webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_webhooks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NumeroWebhook[];
    },
  });
}

// Hook for API keys
export function useNumerosApiKeys() {
  return useQuery({
    queryKey: ['numeros-aquecimento-api-keys'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('numeros_aquecimento_api_keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NumeroApiKey[];
    },
  });
}

// Mutations
export function useCreateNumero() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { logActivity } = useSystemActivities();

  return useMutation({
    mutationFn: async (data: {
      numero: string;
      modelo_id: string | null;
      status_id: string | null;
      observacoes?: string;
    }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      const ultima_atividade = formatUltimaAtividade('cadastro');

      const { data: numero, error } = await supabase
        .from('numeros_aquecimento')
        .insert({
          ...data,
          ultima_atividade,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('numeros_aquecimento_history').insert([{
        numero_id: numero.id,
        numero_valor: numero.numero,
        acao: 'cadastro',
        dados_novos: numero as Json,
        usuario_id: user?.id,
        usuario_email: profile?.email || user?.email,
      }]);

      // Trigger webhooks
      await triggerWebhook('numero.created', numero);

      return numero;
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-history'] });
      toast.success('Número cadastrado com sucesso');
      logActivity(`Cadastrou novo número: ${data.numero}`, 'numeros_aquecimento');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao cadastrar número: ${error.message}`);
    },
  });
}

export function useUpdateNumero() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { logActivity } = useSystemActivities();

  return useMutation({
    mutationFn: async ({
      id,
      data,
      previousData,
    }: {
      id: string;
      data: Partial<NumeroAquecimento>;
      previousData: NumeroAquecimento;
    }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Determine what changed
      const changedFields: string[] = [];
      const statusChanged = data.status_id !== undefined && data.status_id !== previousData.status_id;
      const obsChanged = data.observacoes !== undefined && data.observacoes !== previousData.observacoes;
      const modeloChanged = data.modelo_id !== undefined && data.modelo_id !== previousData.modelo_id;

      if (statusChanged) changedFields.push('status');
      if (obsChanged) changedFields.push('observacoes');
      if (modeloChanged) changedFields.push('modelo');

      // Determine ultima_atividade type using the helper
      const tipo = calcularTipoAtividade(statusChanged, obsChanged, modeloChanged);

      const updateData = {
        ...data,
        ultima_atividade: formatUltimaAtividade(tipo),
      };

      const { data: numero, error } = await supabase
        .from('numeros_aquecimento')
        .update(updateData as never)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log history
      await supabase.from('numeros_aquecimento_history').insert([{
        numero_id: numero.id,
        numero_valor: numero.numero,
        acao: 'edicao',
        dados_anteriores: previousData as unknown as Json,
        dados_novos: numero as Json,
        campos_alterados: changedFields,
        usuario_id: user?.id,
        usuario_email: profile?.email || user?.email,
      }]);

      // Trigger webhooks
      if (statusChanged) {
        await triggerWebhook('numero.status_updated', numero);
      }
      if (obsChanged) {
        await triggerWebhook('numero.obs_updated', numero);
      }
      if (modeloChanged) {
        await triggerWebhook('numero.modelo_updated', numero);
      }
      await triggerWebhook('numero.updated', numero);

      return numero;
    },
    onSuccess: (updatedNumero) => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-history'] });
      toast.success('Número atualizado com sucesso');
      logActivity(`Atualizou número: ${updatedNumero.numero}`, 'numeros_aquecimento');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar número: ${error.message}`);
    },
  });
}

export function useDeleteNumero() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { logActivity } = useSystemActivities();

  return useMutation({
    mutationFn: async ({ numero, motivo }: { numero: NumeroAquecimento; motivo: string }) => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('user_id', user?.id)
        .maybeSingle();

      // Log history before delete - set numero_id to null so history persists
      await supabase.from('numeros_aquecimento_history').insert([{
        numero_id: null, // Set to null so FK doesn't cascade delete
        numero_valor: numero.numero,
        acao: 'exclusao',
        dados_anteriores: {
          ...numero,
          motivo_exclusao: motivo,
          data_exclusao: new Date().toISOString(),
        } as unknown as Json,
        usuario_id: user?.id,
        usuario_email: profile?.email || user?.email,
      }]);

      const { error } = await supabase
        .from('numeros_aquecimento')
        .delete()
        .eq('id', numero.id);

      if (error) throw error;

      // Trigger webhook with motivo
      await triggerWebhook('numero.deleted', { ...numero, motivo_exclusao: motivo });

      return numero;
    },
    onSuccess: (deletedNumero) => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento'] });
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-history'] });
      toast.success('Número excluído com sucesso');
      logActivity(`Excluiu número: ${deletedNumero.numero}`, 'numeros_aquecimento');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir número: ${error.message}`);
    },
  });
}

// Status CRUD
export function useCreateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { nome: string; cor: string; descricao?: string }) => {
      const { data: status, error } = await supabase
        .from('numeros_aquecimento_status')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      
      // Trigger webhook for status creation
      await triggerWebhook('status.created', status);
      
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-status'] });
      toast.success('Status criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar status: ${error.message}`);
    },
  });
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NumeroStatus> }) => {
      const { data: status, error } = await supabase
        .from('numeros_aquecimento_status')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return status;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-status'] });
      toast.success('Status atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar status: ${error.message}`);
    },
  });
}

export function useDeleteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('numeros_aquecimento_status')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-status'] });
      toast.success('Status excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir status: ${error.message}`);
    },
  });
}

// Modelo CRUD
export function useCreateModelo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { nome: string; marca?: string; descricao?: string; capacidade_whatsapp?: number; aparece_no_checkin?: boolean }) => {
      const { data: modelo, error } = await supabase
        .from('numeros_aquecimento_modelos')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return modelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-modelos'] });
      toast.success('Modelo criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar modelo: ${error.message}`);
    },
  });
}

export function useUpdateModelo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NumeroModelo> }) => {
      const { data: modelo, error } = await supabase
        .from('numeros_aquecimento_modelos')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return modelo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-modelos'] });
      toast.success('Modelo atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar modelo: ${error.message}`);
    },
  });
}

export function useDeleteModelo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('numeros_aquecimento_modelos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-modelos'] });
      toast.success('Modelo excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir modelo: ${error.message}`);
    },
  });
}

// Webhook CRUD
export function useCreateWebhook() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { nome: string; url: string; eventos: string[]; secret_key?: string }) => {
      const { data: webhook, error } = await supabase
        .from('numeros_aquecimento_webhooks')
        .insert({ ...data, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-webhooks'] });
      toast.success('Webhook criado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NumeroWebhook> }) => {
      const { data: webhook, error } = await supabase
        .from('numeros_aquecimento_webhooks')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return webhook;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-webhooks'] });
      toast.success('Webhook atualizado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('numeros_aquecimento_webhooks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-webhooks'] });
      toast.success('Webhook excluído com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir webhook: ${error.message}`);
    },
  });
}

// API Key CRUD
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: { nome: string; descricao?: string }) => {
      const apiKey = `na_${crypto.randomUUID().replace(/-/g, '')}`;
      const { data: key, error } = await supabase
        .from('numeros_aquecimento_api_keys')
        .insert({ ...data, api_key: apiKey, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-api-keys'] });
      toast.success('API Key criada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar API Key: ${error.message}`);
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<NumeroApiKey> }) => {
      const { data: key, error } = await supabase
        .from('numeros_aquecimento_api_keys')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return key;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-api-keys'] });
      toast.success('API Key atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar API Key: ${error.message}`);
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('numeros_aquecimento_api_keys')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['numeros-aquecimento-api-keys'] });
      toast.success('API Key excluída com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir API Key: ${error.message}`);
    },
  });
}

// Trigger webhook helper
async function triggerWebhook(event: string, data: unknown) {
  try {
    // Build a clean payload (avoids sending DB internals and keeps webhook consistent)
    const numeroData = data as Record<string, any>;

    // Ensure we have modelo/status objects when we only have IDs
    let modelo = numeroData.modelo ?? null;
    let status = numeroData.status ?? null;

    if (!modelo && numeroData.modelo_id) {
      const { data: m } = await supabase
        .from('numeros_aquecimento_modelos')
        .select('*')
        .eq('id', String(numeroData.modelo_id))
        .maybeSingle();
      modelo = m ?? null;
    }

    if (!status && numeroData.status_id) {
      const { data: s } = await supabase
        .from('numeros_aquecimento_status')
        .select('*')
        .eq('id', String(numeroData.status_id))
        .maybeSingle();
      status = s ?? null;
    }

    const formattedPayload = {
      evento: event,
      timestamp: new Date().toISOString(),
      numero: {
        id: numeroData.id,
        numero: numeroData.numero,
        modelo_id: numeroData.modelo_id,
        status_id: numeroData.status_id,
        modelo,
        status,
        modelo_nome: modelo?.nome ?? null,
        status_nome: status?.nome ?? null,
        ultima_atividade: numeroData.ultima_atividade,
        observacoes: numeroData.observacoes || null,
        created_by: numeroData.created_by,
        created_at: numeroData.created_at,
        updated_at: numeroData.updated_at,
      },
      modelo,
      status,
      modelo_nome: modelo?.nome ?? null,
      status_nome: status?.nome ?? null,
      ...(numeroData.motivo_exclusao
        ? {
            exclusao: {
              motivo: numeroData.motivo_exclusao,
              data: numeroData.data_exclusao || new Date().toISOString(),
            },
          }
        : {}),
    };

    // Send from backend (avoids browser CORS/no-cors, and n8n will parse JSON correctly)
    const { error } = await supabase.functions.invoke('numeros-webhook-proxy', {
      body: formattedPayload,
    });

    if (error) {
      console.error('numeros-webhook-proxy error:', error);
    }
  } catch (err) {
    console.error('Error triggering webhooks:', err);
  }
}
