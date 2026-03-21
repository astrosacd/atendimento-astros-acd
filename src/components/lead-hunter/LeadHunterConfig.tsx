import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  Settings, Key, MessageSquare, Brain, Database, Plus, Trash2, Save, Loader2, Eye, EyeOff
} from 'lucide-react';
import { 
  useLeadHunterConfig, useUpdateConfig, 
  useLeadHunterInstances, useCreateInstance, useDeleteInstance,
  useLeadHunterBaserowConfig, useUpdateBaserowConfig,
} from '@/hooks/useLeadHunter';
import { toast } from 'sonner';

export default function LeadHunterConfig() {
  const { data: config = {}, isLoading: configLoading } = useLeadHunterConfig();
  const updateConfig = useUpdateConfig();
  const { data: instances = [] } = useLeadHunterInstances();
  const createInstance = useCreateInstance();
  const deleteInstance = useDeleteInstance();
  const { data: baserowConfig } = useLeadHunterBaserowConfig();
  const updateBaserow = useUpdateBaserowConfig();

  // API keys state
  const [serpApiKey, setSerpApiKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // WhatsApp instance form
  const [showInstanceDialog, setShowInstanceDialog] = useState(false);
  const [instanceForm, setInstanceForm] = useState({ instance_name: '', api_url: '', api_key: '' });

  // Baserow state
  const [brConfig, setBrConfig] = useState({ api_url: 'https://api.baserow.io', api_token: '', table_id: '', is_enabled: false });

  useEffect(() => {
    if (!configLoading && config) {
      setSerpApiKey(config.serp_api_key || '');
      setOpenaiKey(config.openai_api_key || '');
      setGroqKey(config.groq_api_key || '');
    }
  }, [config, configLoading]);

  useEffect(() => {
    if (baserowConfig) {
      setBrConfig({
        api_url: baserowConfig.api_url || 'https://api.baserow.io',
        api_token: baserowConfig.api_token || '',
        table_id: baserowConfig.table_id || '',
        is_enabled: baserowConfig.is_enabled || false,
      });
    }
  }, [baserowConfig]);

  const handleSaveApis = () => {
    updateConfig.mutate({
      serp_api_key: serpApiKey,
      openai_api_key: openaiKey,
      groq_api_key: groqKey,
    });
  };

  const handleAddInstance = async () => {
    if (!instanceForm.instance_name || !instanceForm.api_url || !instanceForm.api_key) {
      return toast.error('Preencha todos os campos');
    }
    await createInstance.mutateAsync(instanceForm as any);
    setShowInstanceDialog(false);
    setInstanceForm({ instance_name: '', api_url: '', api_key: '' });
  };

  const handleSaveBaserow = () => {
    updateBaserow.mutate(brConfig);
  };

  const toggleShowKey = (key: string) => {
    setShowKeys(p => ({ ...p, [key]: !p[key] }));
  };

  return (
    <Tabs defaultValue="apis" className="space-y-6">
      <TabsList>
        <TabsTrigger value="apis" className="gap-2"><Key className="h-4 w-4" /> APIs</TabsTrigger>
        <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</TabsTrigger>
        <TabsTrigger value="ia" className="gap-2"><Brain className="h-4 w-4" /> IA</TabsTrigger>
        <TabsTrigger value="baserow" className="gap-2"><Database className="h-4 w-4" /> Baserow</TabsTrigger>
      </TabsList>

      {/* APIs Tab */}
      <TabsContent value="apis">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Chaves de API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>SERP API Key</Label>
              <p className="text-xs text-muted-foreground mb-1">Para buscar leads no Google Maps. Obtenha em serpapi.com</p>
              <div className="flex gap-2">
                <Input
                  type={showKeys.serp ? 'text' : 'password'}
                  value={serpApiKey}
                  onChange={e => setSerpApiKey(e.target.value)}
                  placeholder="Sua SERP API Key"
                />
                <Button variant="ghost" size="icon" onClick={() => toggleShowKey('serp')}>
                  {showKeys.serp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button onClick={handleSaveApis} disabled={updateConfig.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar APIs
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* WhatsApp Tab */}
      <TabsContent value="whatsapp">
        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Instâncias WhatsApp (Evolution API)</CardTitle>
            <Button size="sm" onClick={() => setShowInstanceDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent>
            {instances.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">Nenhuma instância configurada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instances.map(inst => (
                    <TableRow key={inst.id}>
                      <TableCell className="font-medium">{inst.instance_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{inst.api_url}</TableCell>
                      <TableCell>
                        <Badge variant={inst.is_active ? 'default' : 'secondary'}>
                          {inst.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => deleteInstance.mutate(inst.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={showInstanceDialog} onOpenChange={setShowInstanceDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Instância WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome da Instância</Label>
                <Input value={instanceForm.instance_name} onChange={e => setInstanceForm(p => ({ ...p, instance_name: e.target.value }))} />
              </div>
              <div>
                <Label>URL da API</Label>
                <Input value={instanceForm.api_url} onChange={e => setInstanceForm(p => ({ ...p, api_url: e.target.value }))} placeholder="https://api.evolution.com" />
              </div>
              <div>
                <Label>API Key</Label>
                <Input value={instanceForm.api_key} onChange={e => setInstanceForm(p => ({ ...p, api_key: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInstanceDialog(false)}>Cancelar</Button>
              <Button onClick={handleAddInstance}>Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TabsContent>

      {/* IA Tab */}
      <TabsContent value="ia">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> Configuração de IA</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A IA padrão é a <strong>Lovable AI</strong> (gratuita, sem necessidade de API key).
              Opcionalmente, configure OpenAI ou Groq para usar como provedor nas campanhas.
            </p>
            
            <div>
              <Label>OpenAI API Key (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type={showKeys.openai ? 'text' : 'password'}
                  value={openaiKey}
                  onChange={e => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                />
                <Button variant="ghost" size="icon" onClick={() => toggleShowKey('openai')}>
                  {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <Label>Groq API Key (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  type={showKeys.groq ? 'text' : 'password'}
                  value={groqKey}
                  onChange={e => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                />
                <Button variant="ghost" size="icon" onClick={() => toggleShowKey('groq')}>
                  {showKeys.groq ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button onClick={handleSaveApis} disabled={updateConfig.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar Configurações
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Baserow Tab */}
      <TabsContent value="baserow">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> Integração Baserow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quando ativado, ao disparar mensagem para um lead, o sistema cria automaticamente duas linhas no Baserow 
              (formato +55 e @s.whatsapp.net) e marca o campo "Atende Humano" como true.
            </p>

            <div className="flex items-center gap-3">
              <Switch
                checked={brConfig.is_enabled}
                onCheckedChange={v => setBrConfig(p => ({ ...p, is_enabled: v }))}
              />
              <Label>Ativar integração Baserow</Label>
            </div>

            {brConfig.is_enabled && (
              <>
                <div>
                  <Label>URL da API</Label>
                  <Input value={brConfig.api_url} onChange={e => setBrConfig(p => ({ ...p, api_url: e.target.value }))} />
                </div>
                <div>
                  <Label>Token da API</Label>
                  <Input
                    type={showKeys.baserow ? 'text' : 'password'}
                    value={brConfig.api_token}
                    onChange={e => setBrConfig(p => ({ ...p, api_token: e.target.value }))}
                    placeholder="Token alfanumérico (sem prefixo 'Token ')"
                  />
                </div>
                <div>
                  <Label>ID da Tabela</Label>
                  <Input value={brConfig.table_id} onChange={e => setBrConfig(p => ({ ...p, table_id: e.target.value }))} placeholder="Ex: 12345" />
                </div>
              </>
            )}

            <Button onClick={handleSaveBaserow} disabled={updateBaserow.isPending}>
              <Save className="h-4 w-4 mr-2" /> Salvar Baserow
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
