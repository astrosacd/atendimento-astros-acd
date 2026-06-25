import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, RefreshCw, Database, EyeOff, Loader2, Plus, Trash2, Tag, Mail, Bell, Clock, Zap, Pencil, Ban, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Flame, Star, Circle } from 'lucide-react';
import { AutoSyncConfigCard } from '@/components/consulta-numeros/AutoSyncConfigCard';
import { ReminderConfigTab } from '@/components/consulta-numeros/ReminderConfigTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const PRESET_ICONS = [
  { key: 'Tag', Icon: Tag },
  { key: 'Ban', Icon: Ban },
  { key: 'ShieldAlert', Icon: ShieldAlert },
  { key: 'CheckCircle2', Icon: CheckCircle2 },
  { key: 'XCircle', Icon: XCircle },
  { key: 'AlertTriangle', Icon: AlertTriangle },
  { key: 'Zap', Icon: Zap },
  { key: 'Flame', Icon: Flame },
  { key: 'Star', Icon: Star },
  { key: 'Circle', Icon: Circle },
];
const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'];
const getPresetIcon = (key?: string | null) => PRESET_ICONS.find(i => i.key === key)?.Icon || Tag;

interface ConfigItem {
  id: string;
  config_key: string;
  config_value: string;
}

interface MaskedField {
  id: string;
  field_name: string;
  is_masked: boolean;
}

interface ObsTag {
  id: string;
  nome: string;
  cor: string;
}

interface ObsPreset {
  id: string;
  label: string;
  texto_observacao: string;
  status_padrao: string | null;
  ordem: number;
  ativo: boolean;
  cor: string | null;
  icone: string | null;
}

interface BaserowSelectOption {
  id: number;
  value: string;
  color: string;
}

interface BaserowField {
  id: number;
  name: string;
  type: string;
  order: number;
  primary: boolean;
}

export default function ConsultaNumerosConfig() {
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState({
    baserow_api_url: '',
    baserow_api_token: '',
    baserow_table_id: '',
    baserow_database_id: '',
    email_gmail_user: '',
    email_gmail_app_password: '',
    email_subject_template: '',
    email_body_template: '',
    email_enabled: 'true',
  });
  
  const [newFieldName, setNewFieldName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#ef4444');

  // Preset form state + dialog
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<{ id: string; label: string } | null>(null);
  const [presetForm, setPresetForm] = useState<{ id: string | null; label: string; texto_observacao: string; status_padrao: string; ordem: number; ativo: boolean; cor: string; icone: string }>({
    id: null, label: '', texto_observacao: '', status_padrao: '', ordem: 0, ativo: true, cor: '#3b82f6', icone: 'Tag',
  });
  const openNewPreset = () => {
    setPresetForm({ id: null, label: '', texto_observacao: '', status_padrao: '', ordem: 0, ativo: true, cor: '#3b82f6', icone: 'Tag' });
    setPresetDialogOpen(true);
  };
  const openEditPreset = (p: ObsPreset) => {
    setPresetForm({
      id: p.id, label: p.label, texto_observacao: p.texto_observacao,
      status_padrao: p.status_padrao || '', ordem: p.ordem, ativo: p.ativo,
      cor: p.cor || '#3b82f6', icone: p.icone || 'Tag',
    });
    setPresetDialogOpen(true);
  };

  // Fetch config
  const { data: configData, isLoading: loadingConfig } = useQuery({
    queryKey: ['consulta-numeros-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_config')
        .select('*');
      if (error) throw error;
      return data as ConfigItem[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Fetch masked fields
  const { data: maskedFields = [], isLoading: loadingMaskedFields } = useQuery({
    queryKey: ['consulta-numeros-masked-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_masked_fields')
        .select('*')
        .order('field_name');
      if (error) throw error;
      return data as MaskedField[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  // Fetch Baserow fields (from backend) to auto-add into masked fields list
  const { data: baserowFields = [] } = useQuery<BaserowField[]>({
    queryKey: ['consulta-numeros-campos'],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) return [];

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/campos`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) return [];
      const json = await res.json();
      return json.success ? (json.data as BaserowField[]) : [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: false,
  });

  // Fetch observation tags
  const { data: obsTags = [], isLoading: loadingObsTags } = useQuery({
    queryKey: ['consulta-numeros-obs-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_obs_tags')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as ObsTag[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  useEffect(() => {
    if (configData) {
      const newConfig: any = {};
      configData.forEach(item => {
        newConfig[item.config_key] = item.config_value;
      });
      setConfig(prev => ({ ...prev, ...newConfig }));
    }
  }, [configData]);

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.entries(config).map(([key, value]) => ({
        config_key: key,
        config_value: value,
      }));
      
      const { error } = await supabase
        .from('consulta_numeros_config')
        .upsert(upserts, { onConflict: 'config_key' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Configurações salvas!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-config'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    },
  });

  // Toggle masked field mutation
  const toggleMaskedMutation = useMutation({
    mutationFn: async ({ id, is_masked }: { id: string; is_masked: boolean }) => {
      const { error } = await supabase
        .from('consulta_numeros_masked_fields')
        .update({ is_masked, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-masked-fields'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Add masked field mutation
  const addFieldMutation = useMutation({
    mutationFn: async (field_name: string) => {
      const { error } = await supabase
        .from('consulta_numeros_masked_fields')
        .insert({ field_name, is_masked: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Campo adicionado!' });
      setNewFieldName('');
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-masked-fields'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  // Delete masked field mutation
  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consulta_numeros_masked_fields')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Campo removido!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-masked-fields'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  // Add observation tag mutation
  const addObsTagMutation = useMutation({
    mutationFn: async ({ nome, cor }: { nome: string; cor: string }) => {
      const { error } = await supabase
        .from('consulta_numeros_obs_tags')
        .insert({ nome, cor });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tag adicionada!' });
      setNewTagName('');
      setNewTagColor('#ef4444');
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-tags'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' });
    },
  });

  // Delete observation tag mutation
  const deleteObsTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('consulta_numeros_obs_tags')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tag removida!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-tags'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    },
  });

  // ===== Observation Presets =====
  const { data: obsPresets = [], isLoading: loadingObsPresets } = useQuery({
    queryKey: ['consulta-numeros-obs-presets-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_obs_presets')
        .select('*')
        .order('ordem', { ascending: true })
        .order('label', { ascending: true });
      if (error) throw error;
      return (data || []) as ObsPreset[];
    },
    staleTime: 60_000,
  });

  // Fetch real status options from Baserow cache (single source of truth)
  const { data: statusOptions = [] } = useQuery({
    queryKey: ['baserow-excluido-options'],
    queryFn: async () => {
      const { data } = await supabase
        .from('consulta_numeros_fields_cache')
        .select('fields_data')
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const fields = ((data?.fields_data as any[]) || []);
      const f = fields.find((x: any) => x.name === 'excluido_da_base');
      return (f?.select_options as BaserowSelectOption[]) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertPresetMutation = useMutation({
    mutationFn: async (form: typeof presetForm) => {
      const payload = {
        label: form.label.trim(),
        texto_observacao: form.texto_observacao.trim(),
        status_padrao: form.status_padrao.trim() || null,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
        cor: form.cor || null,
        icone: form.icone || null,
      };
      if (form.id) {
        const { error } = await supabase.from('consulta_numeros_obs_presets').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('consulta_numeros_obs_presets').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: presetForm.id ? 'Preset atualizado!' : 'Preset adicionado!' });
      setPresetDialogOpen(false);
      setPresetForm({ id: null, label: '', texto_observacao: '', status_padrao: '', ordem: 0, ativo: true, cor: '#3b82f6', icone: 'Tag' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets-admin'] });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets'] });
    },
    onError: (error: Error) => toast({ title: 'Erro ao salvar preset', description: error.message, variant: 'destructive' }),
  });

  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('consulta_numeros_obs_presets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Preset removido!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets-admin'] });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets'] });
    },
    onError: (error: Error) => toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' }),
  });

  const togglePresetAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('consulta_numeros_obs_presets').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets-admin'] });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-obs-presets'] });
    },
    onError: (error: Error) => toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }),
  });

  const handleSavePreset = () => {
    if (!presetForm.label.trim() || !presetForm.texto_observacao.trim()) {
      toast({ title: 'Preencha label e texto da observação', variant: 'destructive' });
      return;
    }
    upsertPresetMutation.mutate(presetForm);
  };

  // Auto-sync: ensure every Baserow field exists in masked fields table (default: not masked)
  const syncMaskedFieldsMutation = useMutation({
    mutationFn: async (fieldNames: string[]) => {
      if (fieldNames.length === 0) return;
      const payload = fieldNames.map((field_name) => ({ field_name, is_masked: false }));

      // Use upsert to avoid duplicate inserts causing runtime errors / UI blank screens.
      const { error } = await supabase
        .from('consulta_numeros_masked_fields')
        .upsert(payload, { onConflict: 'field_name' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-masked-fields'] });
    },
    onError: () => {
      // Silent: this is a best-effort sync and should never break the settings screen.
    },
  });

  useEffect(() => {
    const normalized = baserowFields
      .map((f) => f.name)
      .filter((name) => !!name)
      .filter((name) => !['id', 'order'].includes(name.toLowerCase()));

    if (!normalized.length || !maskedFields.length) return;

    const existing = new Set(maskedFields.map((m) => m.field_name));
    const missing = normalized.filter((name) => !existing.has(name));
    if (missing.length === 0) return;

    // Avoid infinite loops
    if (!syncMaskedFieldsMutation.isPending) {
      syncMaskedFieldsMutation.mutate(missing);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baserowFields, maskedFields]);

  const [testingConnection, setTestingConnection] = useState(false);

  // Test connection
  const testConnection = async () => {
    if (!config.baserow_api_url || !config.baserow_api_token || !config.baserow_table_id) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setTestingConnection(true);
    try {
      const url = `${config.baserow_api_url}/api/database/rows/table/${config.baserow_table_id}/?user_field_names=true&size=1`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token ${config.baserow_api_token}`,
        },
      });

      if (response.ok) {
        toast({ title: 'Conexão bem-sucedida!' });
      } else {
        const error = await response.text();
        toast({ title: 'Erro na conexão', description: error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Erro na conexão', description: error.message, variant: 'destructive' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleAddField = () => {
    if (!newFieldName.trim()) {
      toast({ title: 'Digite o nome do campo', variant: 'destructive' });
      return;
    }
    addFieldMutation.mutate(newFieldName.trim());
  };

  const handleAddObsTag = () => {
    if (!newTagName.trim()) {
      toast({ title: 'Digite o nome da tag', variant: 'destructive' });
      return;
    }
    addObsTagMutation.mutate({ nome: newTagName.trim(), cor: newTagColor });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Configure a integração com o Baserow</p>
          </div>
        </div>

        {(

          <Tabs defaultValue="connection" className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="connection" className="gap-2">
                <Database className="h-4 w-4" />
                Conexão
              </TabsTrigger>
              <TabsTrigger value="maskedFields" className="gap-2">
                <EyeOff className="h-4 w-4" />
                Campos Mascarados
              </TabsTrigger>
              <TabsTrigger value="obsTags" className="gap-2">
                <Tag className="h-4 w-4" />
                Tags de Observação
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="h-4 w-4" />
                Email Desbanimento
              </TabsTrigger>
              <TabsTrigger value="reminders" className="gap-2">
                <Bell className="h-4 w-4" />
                Lembretes
              </TabsTrigger>
              <TabsTrigger value="obsPresets" className="gap-2">
                <Zap className="h-4 w-4" />
                Presets de Observação
              </TabsTrigger>
              <TabsTrigger value="auto-sync" className="gap-2">
                <Clock className="h-4 w-4" />
                Sincronização Automática
              </TabsTrigger>
            </TabsList>

            <TabsContent value="connection">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Configuração do Baserow
                  </CardTitle>
                  <CardDescription>
                    Configure as credenciais e dados de conexão com o Baserow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="api_url">URL da API do Baserow *</Label>
                    <Input
                      id="api_url"
                      placeholder="https://api.baserow.io"
                      value={config.baserow_api_url}
                      onChange={(e) => setConfig(prev => ({ ...prev, baserow_api_url: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      URL base da API do Baserow (sem barra no final)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="api_token">Token da API *</Label>
                    <Input
                      id="api_token"
                      type="password"
                      placeholder="Seu token de API do Baserow"
                      value={config.baserow_api_token}
                      onChange={(e) => setConfig(prev => ({ ...prev, baserow_api_token: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Apenas o valor do token (sem a palavra "Token" na frente)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="database_id">ID do Database</Label>
                      <Input
                        id="database_id"
                        placeholder="Ex: 123"
                        value={config.baserow_database_id}
                        onChange={(e) => setConfig(prev => ({ ...prev, baserow_database_id: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="table_id">ID da Tabela *</Label>
                      <Input
                        id="table_id"
                        placeholder="Ex: 456"
                        value={config.baserow_table_id}
                        onChange={(e) => setConfig(prev => ({ ...prev, baserow_table_id: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={testConnection} variant="outline" disabled={testingConnection}>
                      {testingConnection ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {testingConnection ? 'Testando...' : 'Testar Conexão'}
                    </Button>
                    <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                      {saveConfigMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saveConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maskedFields">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <EyeOff className="h-5 w-5" />
                    Campos Mascarados
                  </CardTitle>
                  <CardDescription>
                    Configure quais campos devem ser mascarados (embaçados) para usuários sem permissão.
                    Usuários com a permissão "Ver dados sem máscara" verão os dados normalmente.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Nome do campo (ex: email, CPF, telefone)"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddField()}
                    />
                    <Button onClick={handleAddField} disabled={addFieldMutation.isPending}>
                      {addFieldMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Digite o nome exato do campo como aparece no Baserow (case-sensitive)
                  </p>

                  <div className="rounded-md border">
                    <div className="overflow-x-auto -mx-2 px-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome do Campo</TableHead>
                            <TableHead className="w-[120px]">Mascarado</TableHead>
                            <TableHead className="w-[80px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {maskedFields.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                Nenhum campo configurado
                              </TableCell>
                            </TableRow>
                          ) : (
                            maskedFields.map((field) => (
                              <TableRow key={field.id}>
                                <TableCell className="font-medium">{field.field_name}</TableCell>
                                <TableCell>
                                  <Switch
                                    checked={field.is_masked}
                                    onCheckedChange={(checked) => 
                                      toggleMaskedMutation.mutate({ id: field.id, is_masked: checked })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => deleteFieldMutation.mutate(field.id)}
                                    disabled={deleteFieldMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Campos marcados como "Mascarado" terão seus valores embaçados na tabela</li>
                      <li>• Admins sempre veem todos os dados sem máscara</li>
                      <li>• Outros usuários precisam da permissão "Ver dados sem máscara" para ver os valores reais</li>
                      <li>• Configure as permissões em Admin → Permissões</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="obsTags">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="h-5 w-5" />
                    Tags de Observação
                  </CardTitle>
                  <CardDescription>
                    Gerencie as tags rápidas que podem ser usadas no campo de observações ao editar registros
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <Input
                      placeholder="Nome da tag (ex: SIM não aprovisionado)"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddObsTag()}
                      className="flex-1"
                    />
                    <div className="flex items-center gap-2">
                      <Label htmlFor="tagColor" className="text-xs text-muted-foreground whitespace-nowrap">Cor:</Label>
                      <input
                        type="color"
                        id="tagColor"
                        value={newTagColor}
                        onChange={(e) => setNewTagColor(e.target.value)}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                    </div>
                    <Button onClick={handleAddObsTag} disabled={addObsTagMutation.isPending}>
                      {addObsTagMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="rounded-md border">
                    <div className="overflow-x-auto -mx-2 px-2">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tag</TableHead>
                            <TableHead className="w-[100px]">Cor</TableHead>
                            <TableHead className="w-[80px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {obsTags.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                Nenhuma tag configurada
                              </TableCell>
                            </TableRow>
                          ) : (
                            obsTags.map((tag) => (
                              <TableRow key={tag.id}>
                                <TableCell>
                                  <span
                                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: tag.cor,
                                      color: '#fff',
                                    }}
                                  >
                                    {tag.nome}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <div
                                    className="w-6 h-6 rounded border"
                                    style={{ backgroundColor: tag.cor }}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => deleteObsTagMutation.mutate(tag.id)}
                                    disabled={deleteObsTagMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• As tags aparecem ao editar um registro no campo de observações</li>
                      <li>• O usuário pode selecionar uma ou mais tags clicando nelas</li>
                      <li>• As tags selecionadas são adicionadas automaticamente à observação</li>
                      <li>• O usuário também pode digitar texto livre além das tags</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="email">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Configuração de Email - Desbanimento OK
                  </CardTitle>
                  <CardDescription>
                    Configure o envio de email automático quando o status "Desbanimento OK" for selecionado.
                    Use as variáveis {'{{numero}}'} e {'{{nome}}'} no assunto e corpo do email.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">Envio de Email Habilitado</p>
                      <p className="text-sm text-muted-foreground">Ativar/desativar o envio automático de emails</p>
                    </div>
                    <Switch
                      checked={config.email_enabled === 'true'}
                      onCheckedChange={(checked) => setConfig(prev => ({ ...prev, email_enabled: checked ? 'true' : 'false' }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="gmail_user">Email do Gmail *</Label>
                      <Input
                        id="gmail_user"
                        type="email"
                        placeholder="seuemail@gmail.com"
                        value={config.email_gmail_user}
                        onChange={(e) => setConfig(prev => ({ ...prev, email_gmail_user: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        O email do Gmail que será usado para enviar os emails
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gmail_password">Senha de App do Gmail *</Label>
                      <Input
                        id="gmail_password"
                        type="password"
                        placeholder="Senha de app de 16 caracteres"
                        value={config.email_gmail_app_password}
                        onChange={(e) => setConfig(prev => ({ ...prev, email_gmail_app_password: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Gere uma senha de app em: Conta Google → Segurança → Senhas de app
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-6 space-y-4">
                    <h4 className="font-medium">Template do Email</h4>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email_subject">Assunto do Email</Label>
                      <Input
                        id="email_subject"
                        placeholder="Número {{numero}} - Desbanimento Concluído"
                        value={config.email_subject_template}
                        onChange={(e) => setConfig(prev => ({ ...prev, email_subject_template: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email_body">Corpo do Email</Label>
                      <Textarea
                        id="email_body"
                        placeholder={`Olá {{nome}},\n\nInformamos que o seu número {{numero}} foi desbanido com sucesso!\n\nSegue em anexo a imagem comprovando o desbanimento.\n\nAtenciosamente,\nEquipe de Suporte`}
                        value={config.email_body_template}
                        onChange={(e) => setConfig(prev => ({ ...prev, email_body_template: e.target.value }))}
                        rows={8}
                      />
                    </div>

                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <p className="text-sm font-medium">Variáveis disponíveis:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li><code className="bg-muted px-1 rounded">{'{{numero}}'}</code> - Número do cliente</li>
                        <li><code className="bg-muted px-1 rounded">{'{{nome}}'}</code> - Nome do cliente</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={() => saveConfigMutation.mutate()} disabled={saveConfigMutation.isPending}>
                      {saveConfigMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saveConfigMutation.isPending ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reminders">
              <ReminderConfigTab />
            </TabsContent>

            <TabsContent value="obsPresets">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Presets de Observação
                  </CardTitle>
                  <CardDescription>
                    Atalhos rápidos exibidos no editor de registros (campo Observações). Aparecem somente em números do tipo <strong>IN</strong> (interno).
                    Cada preset define um texto e, opcionalmente, um status padrão a ser aplicado em <code>excluido_da_base</code>.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex justify-end">
                    <Button onClick={openNewPreset}>
                      <Plus className="h-4 w-4 mr-1" /> Novo preset
                    </Button>
                  </div>

                  {/* List */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Ordem</TableHead>
                          <TableHead>Preset</TableHead>
                          <TableHead>Texto</TableHead>
                          <TableHead className="w-[180px]">Status padrão</TableHead>
                          <TableHead className="w-[80px]">Ativo</TableHead>
                          <TableHead className="w-[120px]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loadingObsPresets ? (
                          <TableRow><TableCell colSpan={6}><Skeleton className="h-8" /></TableCell></TableRow>
                        ) : obsPresets.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              Nenhum preset configurado
                            </TableCell>
                          </TableRow>
                        ) : (
                          obsPresets.map((p) => {
                            const Icon = getPresetIcon(p.icone);
                            const cor = p.cor || '#3b82f6';
                            return (
                              <TableRow key={p.id}>
                                <TableCell>{p.ordem}</TableCell>
                                <TableCell>
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border"
                                    style={{ backgroundColor: `${cor}20`, borderColor: `${cor}66`, color: cor }}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {p.label}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground max-w-[280px] truncate">{p.texto_observacao}</TableCell>
                                <TableCell>{p.status_padrao || <span className="text-muted-foreground">—</span>}</TableCell>
                                <TableCell>
                                  <Switch
                                    checked={p.ativo}
                                    onCheckedChange={(v) => togglePresetAtivoMutation.mutate({ id: p.id, ativo: v })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => openEditPreset(p)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setPresetToDelete({ id: p.id, label: p.label })}
                                      disabled={deletePresetMutation.isPending}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Como funciona:</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Os botões só aparecem para números do tipo <strong>IN</strong> (interno).</li>
                      <li>• Ao clicar, o texto preenche o campo Observações e o status padrão (se houver) é aplicado em <code>excluido_da_base</code>.</li>
                      <li>• O <strong>Status padrão</strong> é sincronizado em tempo real com as opções reais do Baserow.</li>
                      <li>• Use o toggle <strong>Ativo</strong> para desativar sem excluir.</li>
                      <li>• Permissão necessária para editar: <code>manage_consulta_numeros_obs_presets</code>.</li>
                    </ul>
                  </div>

                  {/* Edit/Create Dialog */}
                  <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>{presetForm.id ? 'Editar preset' : 'Novo preset'}</DialogTitle>
                        <DialogDescription>
                          Configure o atalho que aparecerá no editor do campo Observações (números IN).
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4 py-2">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-1">
                            <Label>Label (texto do botão)</Label>
                            <Input
                              placeholder="Ex: SIM não aprovisionado"
                              value={presetForm.label}
                              onChange={(e) => setPresetForm(prev => ({ ...prev, label: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Status padrão (opcional)</Label>
                            <Select
                              value={presetForm.status_padrao || '__none__'}
                              onValueChange={(v) => setPresetForm(prev => ({ ...prev, status_padrao: v === '__none__' ? '' : v }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Não aplicar" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Não aplicar —</SelectItem>
                                {statusOptions.map(opt => (
                                  <SelectItem key={opt.id} value={opt.value}>{opt.value}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {statusOptions.length === 0 && (
                              <p className="text-[11px] text-muted-foreground">Nenhuma opção carregada do Baserow. Rode a sincronização para popular.</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label>Texto da observação (será inserido no campo)</Label>
                          <Textarea
                            rows={2}
                            placeholder="Ex: SIM não aprovisionado"
                            value={presetForm.texto_observacao}
                            onChange={(e) => setPresetForm(prev => ({ ...prev, texto_observacao: e.target.value }))}
                          />
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Cor</Label>
                            <div className="flex flex-wrap gap-2">
                              {PRESET_COLORS.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setPresetForm(prev => ({ ...prev, cor: c }))}
                                  className={`h-7 w-7 rounded-full border-2 transition ${presetForm.cor === c ? 'ring-2 ring-offset-2 ring-offset-background' : 'border-transparent'}`}
                                  style={{ backgroundColor: c, borderColor: presetForm.cor === c ? c : 'transparent' }}
                                  aria-label={`Cor ${c}`}
                                />
                              ))}
                              <input
                                type="color"
                                value={presetForm.cor}
                                onChange={(e) => setPresetForm(prev => ({ ...prev, cor: e.target.value }))}
                                className="h-7 w-7 rounded cursor-pointer bg-transparent border"
                                aria-label="Cor personalizada"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>Ícone</Label>
                            <div className="flex flex-wrap gap-1.5">
                              {PRESET_ICONS.map(({ key, Icon }) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setPresetForm(prev => ({ ...prev, icone: key }))}
                                  className={`h-8 w-8 rounded-md border flex items-center justify-center transition ${presetForm.icone === key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}
                                  aria-label={key}
                                >
                                  <Icon className="h-4 w-4" style={{ color: presetForm.cor }} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="space-y-1">
                            <Label>Ordem</Label>
                            <Input
                              type="number"
                              className="w-24"
                              value={presetForm.ordem}
                              onChange={(e) => setPresetForm(prev => ({ ...prev, ordem: Number(e.target.value) }))}
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-5">
                            <Switch
                              checked={presetForm.ativo}
                              onCheckedChange={(v) => setPresetForm(prev => ({ ...prev, ativo: v }))}
                            />
                            <Label className="text-sm">Ativo</Label>
                          </div>
                          <div className="ml-auto pt-5">
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border"
                              style={{ backgroundColor: `${presetForm.cor}20`, borderColor: `${presetForm.cor}66`, color: presetForm.cor }}
                            >
                              {(() => { const I = getPresetIcon(presetForm.icone); return <I className="h-4 w-4" />; })()}
                              {presetForm.label || 'Pré-visualização'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setPresetDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSavePreset} disabled={upsertPresetMutation.isPending}>
                          {upsertPresetMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                          {presetForm.id ? 'Atualizar' : 'Adicionar'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog open={!!presetToDelete} onOpenChange={(o) => !o && setPresetToDelete(null)}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir preset?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja excluir o preset <strong>"{presetToDelete?.label}"</strong>? Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => {
                            if (presetToDelete) {
                              deletePresetMutation.mutate(presetToDelete.id);
                              setPresetToDelete(null);
                            }
                          }}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auto-sync">
              <AutoSyncConfigCard />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
