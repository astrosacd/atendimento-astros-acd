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
import { ArrowLeft, Save, RefreshCw, Database, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

export default function ConsultaNumerosConfig() {
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState({
    baserow_api_url: '',
    baserow_api_token: '',
    baserow_table_id: '',
    baserow_database_id: '',
  });
  
  const [newFieldName, setNewFieldName] = useState('');

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
      const updates = Object.entries(config).map(([key, value]) => 
        supabase
          .from('consulta_numeros_config')
          .update({ config_value: value })
          .eq('config_key', key)
      );
      await Promise.all(updates);
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

  const isLoading = loadingConfig || loadingMaskedFields;

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

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-64" />
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-72" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <Skeleton className="h-10 w-48" />
              </CardContent>
            </Card>
          </div>
        ) : (
          <Tabs defaultValue="connection" className="space-y-6">
            <TabsList>
              <TabsTrigger value="connection" className="gap-2">
                <Database className="h-4 w-4" />
                Conexão
              </TabsTrigger>
              <TabsTrigger value="maskedFields" className="gap-2">
                <EyeOff className="h-4 w-4" />
                Campos Mascarados
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
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}
