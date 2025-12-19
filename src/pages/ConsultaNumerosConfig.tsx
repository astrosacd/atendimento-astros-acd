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
import { ArrowLeft, Save, RefreshCw, Database, Link2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface ConfigItem {
  id: string;
  config_key: string;
  config_value: string;
}

interface FieldMapping {
  id: string;
  field_name: string;
  baserow_field_id: string;
  baserow_field_name: string;
  is_required: boolean;
}

export default function ConsultaNumerosConfig() {
  const queryClient = useQueryClient();
  
  const [config, setConfig] = useState({
    baserow_api_url: '',
    baserow_api_token: '',
    baserow_table_id: '',
    baserow_database_id: '',
  });
  
  const [mappings, setMappings] = useState<FieldMapping[]>([]);

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

  // Fetch mappings
  const { data: mappingsData, isLoading: loadingMappings } = useQuery({
    queryKey: ['consulta-numeros-mappings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_field_mappings')
        .select('*');
      if (error) throw error;
      return data as FieldMapping[];
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

  useEffect(() => {
    if (mappingsData) {
      setMappings(mappingsData);
    }
  }, [mappingsData]);

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

  // Save mappings mutation
  const saveMappingsMutation = useMutation({
    mutationFn: async () => {
      for (const mapping of mappings) {
        await supabase
          .from('consulta_numeros_field_mappings')
          .update({
            baserow_field_id: mapping.baserow_field_id,
            baserow_field_name: mapping.baserow_field_name,
          })
          .eq('id', mapping.id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Mapeamentos salvos!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros-mappings'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
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

  const updateMapping = (id: string, field: keyof FieldMapping, value: string) => {
    setMappings(prev => prev.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const isLoading = loadingConfig || loadingMappings;

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
              <TabsTrigger value="mappings" className="gap-2">
                <Link2 className="h-4 w-4" />
                Mapeamento de Campos
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

            <TabsContent value="mappings">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5" />
                    Mapeamento de Campos
                  </CardTitle>
                  <CardDescription>
                    Associe os campos do sistema aos campos da tabela do Baserow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campo do Sistema</TableHead>
                          <TableHead>Nome no Baserow</TableHead>
                          <TableHead>ID do Campo (opcional)</TableHead>
                          <TableHead>Obrigatório</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappings.map((mapping) => (
                          <TableRow key={mapping.id}>
                            <TableCell className="font-medium">{mapping.field_name}</TableCell>
                            <TableCell>
                              <Input
                                value={mapping.baserow_field_name}
                                onChange={(e) => updateMapping(mapping.id, 'baserow_field_name', e.target.value)}
                                placeholder="Nome do campo no Baserow"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={mapping.baserow_field_id}
                                onChange={(e) => updateMapping(mapping.id, 'baserow_field_id', e.target.value)}
                                placeholder="ID do campo"
                              />
                            </TableCell>
                            <TableCell>
                              {mapping.is_required ? 'Sim' : 'Não'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button onClick={() => saveMappingsMutation.mutate()} disabled={saveMappingsMutation.isPending}>
                      {saveMappingsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      {saveMappingsMutation.isPending ? 'Salvando...' : 'Salvar Mapeamentos'}
                    </Button>
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
