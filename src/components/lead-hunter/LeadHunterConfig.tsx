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
  Settings, Key, MessageSquare, Brain, Database, Plus, Trash2, Save, Loader2, Eye, EyeOff, Globe, X, Sparkles, Send, RefreshCw, Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [whatsappProvider, setWhatsappProvider] = useState('evolution');
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState('');
  const [metaWabaId, setMetaWabaId] = useState('');
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [isSyncingMeta, setIsSyncingMeta] = useState(false);
  const [metaTemplates, setMetaTemplates] = useState<any[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<{ url: string, token: string } | null>(null);

  const syncMetaTemplates = async () => {
    if (!metaAccessToken || !metaWabaId) {
      toast.error("Informe Access Token e WABA ID primeiro");
      return;
    }
    
    setIsSyncingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-api', {
        body: { 
          action: 'fetch-templates',
          accessToken: metaAccessToken,
          wabaId: metaWabaId
        }
      });
      
      if (error) throw error;
      setMetaTemplates(data.templates || []);
      toast.success(`Conectado com sucesso! ${data.templates?.length || 0} templates sincronizados.`);
    } catch (err: any) {
      toast.error("Erro de conexão: Verifique se o Token e WABA ID estão corretos. Detalhe: " + err.message);
    } finally {
      setIsSyncingMeta(false);
    }
  };

  const getWebhookInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-meta-api', {
        body: { action: 'get-webhook-info' }
      });
      if (error) throw error;
      setWebhookInfo({ url: data.webhookUrl, token: data.verifyToken });
    } catch (err: any) {
      console.error("Erro ao buscar info do webhook", err);
    }
  };

  // Scraping skip domains
  const DEFAULT_SKIP_DOMAINS = [
    "instagram.com", "facebook.com", "fb.com", "twitter.com", "x.com",
    "tiktok.com", "youtube.com", "youtu.be", "wa.me", "api.whatsapp.com",
    "web.whatsapp.com", "linktr.ee", "lnktr.ee", "bityli.com", "bit.ly",
    "goo.gl", "t.co", "linkedin.com", "pinterest.com", "threads.net", "t.me", "telegram.me",
  ];
  const [skipDomains, setSkipDomains] = useState<string[]>(DEFAULT_SKIP_DOMAINS);
  const [newDomain, setNewDomain] = useState('');

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
      setWhatsappProvider(config.whatsapp_provider || 'evolution');
      setMetaAccessToken(config.meta_access_token || '');
      setMetaPhoneNumberId(config.meta_phone_number_id || '');
      setMetaWabaId(config.meta_waba_id || '');
      if (config.scrape_skip_domains) {
        try {
          setSkipDomains(JSON.parse(config.scrape_skip_domains));
        } catch { /* keep defaults */ }
      }
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
      scrape_skip_domains: JSON.stringify(skipDomains),
      whatsapp_provider: whatsappProvider,
      meta_access_token: metaAccessToken,
      meta_phone_number_id: metaPhoneNumberId,
      meta_waba_id: metaWabaId,
    });
  };

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!domain) return;
    if (skipDomains.includes(domain)) {
      toast.error('Domínio já existe na lista');
      return;
    }
    const updated = [...skipDomains, domain];
    setSkipDomains(updated);
    setNewDomain('');
    updateConfig.mutate({ scrape_skip_domains: JSON.stringify(updated) });
    toast.success(`${domain} adicionado à lista`);
  };

  const handleRemoveDomain = (domain: string) => {
    const updated = skipDomains.filter(d => d !== domain);
    setSkipDomains(updated);
    updateConfig.mutate({ scrape_skip_domains: JSON.stringify(updated) });
    toast.success(`${domain} removido da lista`);
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
      <TabsList className="flex flex-wrap gap-1 h-auto p-1">
        <TabsTrigger value="apis" className="gap-2"><Key className="h-4 w-4" /> APIs</TabsTrigger>
        <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</TabsTrigger>
        <TabsTrigger value="ia" className="gap-2"><Brain className="h-4 w-4" /> IA</TabsTrigger>
        <TabsTrigger value="scraping" className="gap-2"><Globe className="h-4 w-4" /> Scraping</TabsTrigger>
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
              <div className="overflow-x-auto -mx-2 px-2">
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
              </div>
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

      {/* Scraping Tab */}
      <TabsContent value="scraping">
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Scraping de Sites</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quando o lead possui um site, o sistema faz scraping automático para extrair informações e gerar mensagens personalizadas via IA.
              Os domínios abaixo serão <strong>ignorados</strong> (redes sociais, encurtadores, etc).
            </p>

            <div className="flex gap-2">
              <Input
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                placeholder="Ex: exemplo.com"
                onKeyDown={e => e.key === 'Enter' && handleAddDomain()}
              />
              <Button onClick={handleAddDomain} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Adicionar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
              {skipDomains.map(domain => (
                <Badge key={domain} variant="secondary" className="gap-1 pr-1">
                  {domain}
                  <button
                    onClick={() => handleRemoveDomain(domain)}
                    className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {skipDomains.length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhum domínio na lista — todos os sites serão scraped.</p>
            )}
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
