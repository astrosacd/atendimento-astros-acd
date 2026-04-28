import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGatewaySettings } from '@/hooks/useGateway';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreditCard, Mail, ShoppingCart, Save, Timer, Link, Copy, ExternalLink, Bell, MessageSquare, CheckCircle2, Clock, Phone, ShieldCheck, UserCheck, AlertCircle, Sparkles, Key, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';

export default function GatewaySettings() {
  const { settings, isLoading, updateSetting, isUpdating } = useGatewaySettings();
  
  const [stripe, setStripe] = useState({ 
    enabled: false, 
    publishable_key: '', 
    secret_key: '',
    fee_percentage: 3.99,
    fee_fixed_usd: 0.30,
    exchange_spread: 4.0
  });
  const [mercadopago, setMercadopago] = useState({ 
    enabled: false, 
    access_token: '',
    statement_descriptor: '',
    allow_boleto: true,
    allow_pix: true,
    allow_credit_card: true,
    success_url: '',
    immediate_payment: false
  });
  
  const defaultAbandonedCartTemplate = `Olá {{nome}}!

Notamos que você estava interessado em um de nossos produtos mas não finalizou a compra.

📦 Produto: {{produto}}
💰 Valor: {{valor}}

O item ainda está esperando por você! Clique no link abaixo para finalizar:
{{link}}

Se você não iniciou esta compra, pode ignorar esta mensagem.

Atenciosamente,
Equipe de Vendas`;
  const [abandonedCart, setAbandonedCart] = useState({ 
    enabled: false, 
    delay_minutes: 30, 
    email_subject: 'Você esqueceu algo no carrinho!', 
    email_template: defaultAbandonedCartTemplate,
    delay_between_sends: 5,
    cron_interval_minutes: 5,
    gmail_user: '',
    gmail_app_password: '',
    whatsapp_enabled: false,
    whatsapp_instance_name: '',
    whatsapp_api_url: '',
    whatsapp_api_key: '',
    whatsapp_template: `Olá {{nome}}! 👋

Notamos que você não finalizou sua compra.

📦 Produto: {{produto}}
💰 Valor: {{valor}}

O item ainda está esperando por você! Acesse o link abaixo para finalizar:
{{link}}

Se precisar de ajuda, é só responder esta mensagem!`
  });
  const [checkout, setCheckout] = useState({ 
    countdown_enabled: false, 
    countdown_minutes: 10,
    countdown_message: 'Complete sua compra antes do contador chegar a zero!'
  });
  const [successPage, setSuccessPage] = useState({
    enabled: true,
    title: 'Compra Realizada!',
    message: 'Obrigado pela sua compra! Você receberá uma confirmação por WhatsApp e/ou email em breve.',
    instructions: 'Se precisar de ajuda, responda a mensagem recebida no WhatsApp ou entre em contato pelo email.',
    primary_button_text: 'Voltar ao Catálogo',
    primary_button_path: '/catalogo',
    support_whatsapp_enabled: false,
    support_whatsapp_number: '',
    support_whatsapp_button_text: 'Falar com Suporte no WhatsApp',
    support_whatsapp_message: 'Olá! Preciso de ajuda com meu pedido {pedido}.\n\nNome: {nome}\nEmail: {email}\nProduto: {produto}\nValor: {valor}\nTelefone: {telefone}'
  });
  const [notifications, setNotifications] = useState({
    whatsapp_enabled: false,
    whatsapp_instance_name: '',
    whatsapp_api_url: '',
    whatsapp_api_key: '',
    whatsapp_template: 'Olá {nome}! 🎉\n\nSeu pagamento foi confirmado!\n\n📦 Produto: {produto}\n💰 Valor: R$ {valor}\n\nObrigado pela compra!',
    email_enabled: false,
    gmail_user: '',
    gmail_app_password: '',
    email_subject: 'Pagamento Confirmado - {produto}',
    email_template: 'Olá {nome},\n\nSeu pagamento foi confirmado com sucesso!\n\nProduto: {produto}\nValor: R$ {valor}\n\nObrigado pela compra!\n\nAtenciosamente,\nEquipe de Vendas'
  });
  const [approvalConfig, setApprovalConfig] = useState({
    workflow: 'admin_only',
    ocr_enabled: true,
    whatsapp_notifications: true,
    approver_whatsapp: '',
    duplicate_id_check: true,
    required_proof: true
  });

  const [metaCredentials, setMetaCredentials] = useState({
    access_token: '',
    phone_number_id: '',
    waba_id: '',
    is_active: true
  });
  const [templateMappings, setTemplateMappings] = useState<any[]>([]);
  useEffect(() => {
    if (settings.stripe) setStripe(settings.stripe);
    if (settings.mercadopago) setMercadopago({
      enabled: settings.mercadopago.enabled ?? false,
      access_token: settings.mercadopago.access_token || '',
      statement_descriptor: settings.mercadopago.statement_descriptor || '',
      allow_boleto: settings.mercadopago.allow_boleto ?? true,
      allow_pix: settings.mercadopago.allow_pix ?? true,
      allow_credit_card: settings.mercadopago.allow_credit_card ?? true,
      success_url: settings.mercadopago.success_url || '',
      immediate_payment: settings.mercadopago.immediate_payment ?? false
    });
    
    if (settings.abandoned_cart) setAbandonedCart(settings.abandoned_cart);
    if (settings.checkout) setCheckout(settings.checkout);
    if (settings.success_page) setSuccessPage(settings.success_page);
    if (settings.payment_notifications) setNotifications(settings.payment_notifications);
    if (settings.approval_config) setApprovalConfig(settings.approval_config);
    if (settings.site_base_url?.url) setSiteBaseUrl(String(settings.site_base_url.url));

    // Load Meta credentials
    const loadMeta = async () => {
      const { data: creds } = await supabase.from('meta_credentials').select('*').limit(1).maybeSingle();
      if (creds) setMetaCredentials(creds);

      const { data: maps } = await supabase.from('meta_template_mapping').select('*').order('event_key');
      if (maps) setTemplateMappings(maps);
    };
    loadMeta();
  }, [settings]);

  const handleSaveStripe = () => {
    updateSetting({ key: 'stripe', value: stripe });
  };

  const handleSaveMercadopago = () => {
    updateSetting({ key: 'mercadopago', value: mercadopago });
  };


  const handleSaveAbandonedCart = async () => {
    updateSetting({ key: 'abandoned_cart', value: abandonedCart });
    
    // Atualizar o cron também
    if (abandonedCart.cron_interval_minutes) {
      try {
        const { error } = await supabase.rpc('update_gateway_abandoned_cart_cron', {
          p_interval_minutes: abandonedCart.cron_interval_minutes
        });
        if (error) {
          console.error('Erro ao atualizar cron:', error);
          toast.error('Erro ao atualizar intervalo do cron');
        }
      } catch (err) {
        console.error('Erro ao atualizar cron:', err);
      }
    }
  };

  const handleSaveCheckout = () => {
    updateSetting({ key: 'checkout', value: checkout });
  };

  const handleSaveNotifications = () => {
    updateSetting({ key: 'payment_notifications', value: notifications });
  };

  const handleSaveSuccessPage = () => {
    updateSetting({ key: 'success_page', value: successPage });
  };

  const handleSaveApprovalConfig = () => {
    updateSetting({ key: 'approval_config', value: approvalConfig });
  };

  const handleSaveMetaCredentials = async () => {
    try {
      const { id, created_at, updated_at, ...payload } = metaCredentials as any;
      const { error } = await supabase
        .from('meta_credentials')
        .upsert({ 
          ...(id ? { id } : {}),
          ...payload
        });
      
      if (error) throw error;
      toast.success('Credenciais Meta salvas com sucesso');
    } catch (error: any) {
      toast.error('Erro ao salvar credenciais Meta: ' + error.message);
    }
  };

  const handleUpdateTemplateMapping = async (id: string, templateName: string) => {
    try {
      const { error } = await supabase
        .from('meta_template_mapping')
        .update({ template_name: templateName })
        .eq('id', id);
      
      if (error) throw error;
      setTemplateMappings(prev => prev.map(m => m.id === id ? { ...m, template_name: templateName } : m));
      toast.success('Mapeamento atualizado');
    } catch (error: any) {
      toast.error('Erro ao atualizar mapeamento: ' + error.message);
    }
  };
  const [siteBaseUrl, setSiteBaseUrl] = useState('');
  const [localSlug, setLocalSlug] = useState('');
  const [authAccessCode, setAuthAccessCode] = useState('');

  // Carrega os valores salvos quando settings muda
  useEffect(() => {
    if (settings.catalog_slug?.slug !== undefined) {
      setLocalSlug(settings.catalog_slug.slug || '');
    }
    if (settings.auth_access_code?.code !== undefined) {
      setAuthAccessCode(settings.auth_access_code.code || '');
    }
  }, [settings.catalog_slug, settings.auth_access_code]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  const customSlug = settings.catalog_slug?.slug || '';
  const catalogPath = customSlug ? `/loja/${customSlug}` : `/catalogo`;

  const normalizedBase = siteBaseUrl.trim().replace(/\/+$/, '');
  const catalogUrl = normalizedBase ? `${normalizedBase}${catalogPath}` : catalogPath;

  const copyLink = () => {
    if (!normalizedBase) {
      toast.error('Configure a URL do site acima para copiar o link completo.');
      return;
    }
    __copyToClipboard(catalogUrl);
    toast.success('Link do catálogo copiado!');
  };

  const handleSaveSlug = () => {
    // Remove caracteres especiais e espaços
    const cleanSlug = localSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    setLocalSlug(cleanSlug);
    updateSetting({ key: 'catalog_slug', value: { slug: cleanSlug } });
  };

  const handleSaveAuthCode = () => {
    updateSetting({ key: 'auth_access_code', value: { code: authAccessCode } });
  };

  const copyLoginLink = () => {
    if (!normalizedBase) {
      toast.error('Configure a URL do site acima para copiar o link completo.');
      return;
    }
    const savedCode = authAccessCode.trim() || settings.auth_access_code?.code || '';
    if (!savedCode) {
      toast.error('Configure um código de acesso primeiro.');
      return;
    }
    const loginUrl = `${normalizedBase}/auth?codigo=${encodeURIComponent(savedCode)}`;
    __copyToClipboard(loginUrl);
    toast.success('Link de acesso ao painel copiado!');
  };

  return (
    <div className="space-y-6">
        <Card className="border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link className="h-4 w-4 text-primary" />
              Links do Site
            </CardTitle>
            <CardDescription>Configure a URL do seu site e copie os links já prontos para compartilhar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="site-base-url">URL do Site</Label>
              <div className="flex gap-2">
                <Input
                  id="site-base-url"
                  value={siteBaseUrl}
                  onChange={(e) => setSiteBaseUrl(e.target.value)}
                  placeholder="https://seusite.com"
                />
                <Button
                  variant="outline"
                  onClick={() => updateSetting({ key: 'site_base_url', value: { url: siteBaseUrl } })}
                  disabled={isUpdating}
                  className="shrink-0"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sem isso, os links copiados ficam relativos (e no preview vão apontar para o domínio do Lovable).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-slug">Slug do Catálogo (opcional)</Label>
              <div className="flex gap-2">
                <div className="flex items-center text-sm text-muted-foreground bg-muted/50 px-3 rounded-l-md border border-r-0">
                  /loja/
                </div>
                <Input
                  id="custom-slug"
                  value={localSlug}
                  onChange={(e) => setLocalSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-'))}
                  placeholder="minha-loja"
                  className="rounded-l-none"
                />
                <Button
                  variant="outline"
                  onClick={handleSaveSlug}
                  disabled={isUpdating}
                  className="shrink-0"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para usar o link padrão /catalogo
              </p>
            </div>

            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Link do Catálogo:</Label>
              <div className="flex gap-2">
                <Input value={catalogUrl} readOnly className="font-mono text-sm bg-muted/50" />
                <Button variant="outline" onClick={copyLink} className="shrink-0">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t space-y-2">
              <Label htmlFor="auth-code">Código de Acesso ao Painel</Label>
              <div className="flex gap-2">
                <Input
                  id="auth-code"
                  value={authAccessCode}
                  onChange={(e) => setAuthAccessCode(e.target.value)}
                  placeholder="codigo-secreto"
                />
                <Button
                  variant="outline"
                  onClick={handleSaveAuthCode}
                  disabled={isUpdating}
                  className="shrink-0"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Código secreto para acessar a página de login (ex: /auth?codigo=SEU_CODIGO)
              </p>
            </div>

            <div className="pt-2 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Link de Acesso ao Painel:</Label>
              <div className="flex gap-2">
                <Input 
                  value={normalizedBase && (authAccessCode.trim() || settings.auth_access_code?.code)
                    ? `${normalizedBase}/auth?codigo=${encodeURIComponent(authAccessCode.trim() || settings.auth_access_code?.code || '')}`
                    : 'Configure a URL e o código acima'} 
                  readOnly 
                  className="font-mono text-sm bg-muted/50" 
                />
                <Button variant="outline" onClick={copyLoginLink} className="shrink-0">
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

      <h2 className="text-lg font-semibold">Configurações</h2>

      <Tabs defaultValue="gateways" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1">
          <TabsTrigger value="gateways" className="gap-2 flex-shrink-0">
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Gateways</span>
          </TabsTrigger>
          <TabsTrigger value="whatsapp_official" className="gap-2 flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">WhatsApp Oficial</span>
          </TabsTrigger>
          <TabsTrigger value="checkout" className="gap-2 flex-shrink-0">
            <Timer className="h-4 w-4" />
            <span className="hidden sm:inline">Checkout</span>
          </TabsTrigger>
          <TabsTrigger value="success" className="gap-2 flex-shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            <span className="hidden sm:inline">Sucesso</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 flex-shrink-0">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Compras Aprovadas</span>
          </TabsTrigger>
          <TabsTrigger value="abandoned" className="gap-2 flex-shrink-0">
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Carrinho Abandonado</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp_official" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                WhatsApp API Oficial (Meta)
              </CardTitle>
              <CardDescription>Configure suas credenciais da plataforma Meta for Developers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Access Token (Permanente)</Label>
                  <Input 
                    type="password"
                    value={metaCredentials.access_token}
                    onChange={(e) => setMetaCredentials(prev => ({ ...prev, access_token: e.target.value }))}
                    placeholder="EAAB..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number ID</Label>
                  <Input 
                    value={metaCredentials.phone_number_id}
                    onChange={(e) => setMetaCredentials(prev => ({ ...prev, phone_number_id: e.target.value }))}
                    placeholder="1234567890..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp Business Account ID (WABA ID)</Label>
                  <Input 
                    value={metaCredentials.waba_id}
                    onChange={(e) => setMetaCredentials(prev => ({ ...prev, waba_id: e.target.value }))}
                    placeholder="1234567890..."
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <Switch 
                    checked={metaCredentials.is_active}
                    onCheckedChange={(checked) => setMetaCredentials(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>API Oficial Ativa</Label>
                </div>
              </div>
              <Button onClick={handleSaveMetaCredentials} className="w-full md:w-auto">
                <Save className="h-4 w-4 mr-2" /> Salvar Credenciais
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LayoutGrid className="h-4 w-4 text-primary" />
                Mapeamento de Templates
              </CardTitle>
              <CardDescription>Associe os eventos de cobrança aos nomes dos seus templates aprovados na Meta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Evento de Cobrança</TableHead>
                      <TableHead>Nome do Template (Meta)</TableHead>
                      <TableHead className="w-[100px] text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templateMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">
                          {mapping.event_key === 'message_d_menos_3' && 'Cobrança D-3 (3 dias antes)'}
                          {mapping.event_key === 'message_d_zero' && 'Cobrança D-0 (Dia do vencimento)'}
                          {mapping.event_key === 'message_d_mais_1' && 'Cobrança D+1 (1 dia após)'}
                          {mapping.event_key === 'message_d_mais_2' && 'Cobrança D+2 (2 dias após)'}
                          {mapping.event_key === 'message_d_mais_15' && 'Cobrança D+15 (15 dias após)'}
                          {mapping.event_key === 'message_d_mais_30' && 'Cobrança D+30 (30 dias após)'}
                        </TableCell>
                        <TableCell>
                          <Input 
                            defaultValue={mapping.template_name}
                            onBlur={(e) => handleUpdateTemplateMapping(mapping.id, e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="text-[10px]">Auto-save</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="bg-muted/30 p-4 rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  <p className="font-semibold mb-2">Instruções para Templates:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Os nomes dos templates devem ser exatamente iguais aos aprovados no Gerenciador de WhatsApp.</li>
                    <li>O sistema enviará variáveis automaticamente na ordem: {'{{1}}'} = Nome, {'{{2}}'} = Plano, {'{{3}}'} = Valor, {'{{4}}'} = Data de Vencimento/Renovação.</li>
                    <li>Certifique-se de que o template possui 4 variáveis na Meta.</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gateways" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Stripe</CardTitle>
              <CardDescription>Configure o Stripe para receber pagamentos internacionais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={stripe.enabled}
                  onCheckedChange={(checked) => setStripe(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>Habilitar Stripe</Label>
              </div>
              <div>
                <Label>Publishable Key</Label>
                <Input
                  value={stripe.publishable_key}
                  onChange={(e) => setStripe(prev => ({ ...prev, publishable_key: e.target.value }))}
                  placeholder="pk_..."
                />
              </div>
              <div>
                <Label>Secret Key</Label>
                <Input
                  type="password"
                  value={stripe.secret_key}
                  onChange={(e) => setStripe(prev => ({ ...prev, secret_key: e.target.value }))}
                  placeholder="sk_..."
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  🔗 URL do Webhook
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  Configure esta URL no painel da Stripe em Developers → Webhooks → Add endpoint
                </p>
                <div className="flex gap-2">
                  <Input
                    value="https://udxaxemoozddkwpitngq.supabase.co/functions/v1/gateway-payment-webhook"
                    readOnly
                    className="font-mono text-xs bg-muted/50"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      __copyToClipboard('https://udxaxemoozddkwpitngq.supabase.co/functions/v1/gateway-payment-webhook');
                      toast.success('URL do webhook copiada!');
                    }}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  💰 Taxas da Stripe (para cálculo do valor líquido)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Taxa percentual (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stripe.fee_percentage}
                      onChange={(e) => setStripe(prev => ({ ...prev, fee_percentage: parseFloat(e.target.value) || 0 }))}
                      placeholder="3.99"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ex: 3.99%</p>
                  </div>
                  <div>
                    <Label>Taxa fixa por venda (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stripe.fee_fixed_usd}
                      onChange={(e) => setStripe(prev => ({ ...prev, fee_fixed_usd: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.30"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ex: $0.30</p>
                  </div>
                  <div>
                    <Label>Spread de câmbio (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={stripe.exchange_spread}
                      onChange={(e) => setStripe(prev => ({ ...prev, exchange_spread: parseFloat(e.target.value) || 0 }))}
                      placeholder="4.0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ex: 4%</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveStripe} disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" /> Salvar Stripe
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Mercado Pago</CardTitle>
              <CardDescription>Configure o Mercado Pago para receber pagamentos em BRL</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={mercadopago.enabled}
                  onCheckedChange={(checked) => setMercadopago(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>Habilitar Mercado Pago</Label>
              </div>
              <div className="space-y-2">
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={mercadopago.access_token}
                  onChange={(e) => setMercadopago(prev => ({ ...prev, access_token: e.target.value }))}
                  placeholder="APP_USR-..."
                />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-sm font-semibold">Configurações Avançadas</Label>
                
                <div className="space-y-2 mt-2">
                  <Label>Soft Descriptor (Fatura do Cartão)</Label>
                  <Input
                    placeholder="Ex: MINHAEMPRESA"
                    maxLength={16}
                    value={mercadopago.statement_descriptor || ''}
                    onChange={(e) => setMercadopago(prev => ({ ...prev, statement_descriptor: e.target.value.toUpperCase() }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    O nome que aparecerá na fatura do cartão do cliente (máx 16 caracteres).
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-medium">Métodos de Pagamento Permitidos</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                      <span className="text-xs">Cartão de Crédito</span>
                      <Switch
                        checked={mercadopago.allow_credit_card}
                        onCheckedChange={(c) => setMercadopago(prev => ({ ...prev, allow_credit_card: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                      <span className="text-xs">PIX</span>
                      <Switch
                        checked={mercadopago.allow_pix}
                        onCheckedChange={(c) => setMercadopago(prev => ({ ...prev, allow_pix: c }))}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border">
                      <span className="text-xs">Boleto</span>
                      <Switch
                        checked={mercadopago.allow_boleto}
                        onCheckedChange={(c) => setMercadopago(prev => ({ ...prev, allow_boleto: c }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>URL de Sucesso (Redirecionamento)</Label>
                  <Input
                    placeholder="https://seusite.com/obrigado"
                    value={mercadopago.success_url || ''}
                    onChange={(e) => setMercadopago(prev => ({ ...prev, success_url: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Para onde o cliente será enviado após pagar.
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-background border mt-2">
                  <div className="space-y-0.5">
                    <span className="text-sm font-medium">Pagamento Imediato (Cartão/PIX)</span>
                    <p className="text-[10px] text-muted-foreground">Desativa boleto e outros métodos lentos</p>
                  </div>
                  <Switch
                    checked={mercadopago.immediate_payment}
                    onCheckedChange={(c) => setMercadopago(prev => ({ ...prev, immediate_payment: c }))}
                  />
                </div>
              </div>

              <Button onClick={handleSaveMercadopago} disabled={isUpdating} className="w-full">
                <Save className="h-4 w-4 mr-2" /> Salvar Mercado Pago
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkout">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Contador de Urgência</CardTitle>
              <CardDescription>Configure o contador regressivo no checkout para aumentar conversões</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={checkout.countdown_enabled}
                  onCheckedChange={(checked) => setCheckout(prev => ({ ...prev, countdown_enabled: checked }))}
                />
                <Label>Habilitar contador</Label>
              </div>
              <div>
                <Label>Tempo do contador (minutos)</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={checkout.countdown_minutes}
                  onChange={(e) => setCheckout(prev => ({ ...prev, countdown_minutes: parseInt(e.target.value) || 10 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  O contador iniciará neste tempo quando o cliente acessar o checkout
                </p>
              </div>
              <div>
                <Label>Mensagem do contador</Label>
                <Input
                  value={checkout.countdown_message}
                  onChange={(e) => setCheckout(prev => ({ ...prev, countdown_message: e.target.value }))}
                  placeholder="Complete sua compra antes do contador chegar a zero!"
                />
              </div>
              <Button onClick={handleSaveCheckout} disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" /> Salvar Configuração
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="success" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Página de Sucesso</CardTitle>
              <CardDescription>Personalize a mensagem exibida após o pagamento</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={successPage.enabled}
                  onCheckedChange={(checked) => setSuccessPage(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>Habilitar personalização</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Título</Label>
                  <Input
                    value={successPage.title}
                    onChange={(e) => setSuccessPage(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Compra Realizada!"
                  />
                </div>
                <div>
                  <Label>Texto do Botão</Label>
                  <Input
                    value={successPage.primary_button_text}
                    onChange={(e) => setSuccessPage(prev => ({ ...prev, primary_button_text: e.target.value }))}
                    placeholder="Voltar ao Catálogo"
                  />
                </div>
              </div>

              <div>
                <Label>Mensagem</Label>
                <Textarea
                  value={successPage.message}
                  onChange={(e) => setSuccessPage(prev => ({ ...prev, message: e.target.value }))}
                  rows={3}
                />
              </div>

              <div>
                <Label>Instruções / Como acessar</Label>
                <Textarea
                  value={successPage.instructions}
                  onChange={(e) => setSuccessPage(prev => ({ ...prev, instructions: e.target.value }))}
                  rows={4}
                  placeholder="Ex: Você receberá o acesso por WhatsApp. Guarde este comprovante..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {'{nome}'}, {'{email}'}, {'{produto}'}, {'{valor}'}, {'{telefone}'}, {'{pedido}'}
                </p>
              </div>

              <div>
                <Label>Destino do Botão (caminho)</Label>
                <Input
                  value={successPage.primary_button_path}
                  onChange={(e) => setSuccessPage(prev => ({ ...prev, primary_button_path: e.target.value }))}
                  placeholder="/catalogo"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="text-sm">Botão de Suporte (WhatsApp)</Label>
                    <p className="text-xs text-muted-foreground">Mostra um botão extra na página de sucesso para falar com seu suporte</p>
                  </div>
                  <Switch
                    checked={(successPage as any).support_whatsapp_enabled}
                    onCheckedChange={(checked) => setSuccessPage(prev => ({ ...prev, support_whatsapp_enabled: checked }))}
                  />
                </div>

                {(successPage as any).support_whatsapp_enabled ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Número do WhatsApp</Label>
                      <Input
                        value={(successPage as any).support_whatsapp_number}
                        onChange={(e) => setSuccessPage(prev => ({ ...prev, support_whatsapp_number: e.target.value }))}
                        placeholder="5511999999999"
                      />
                      <p className="text-xs text-muted-foreground mt-1">Use DDI+DDD+número (só números)</p>
                    </div>
                    <div>
                      <Label>Texto do Botão</Label>
                      <Input
                        value={(successPage as any).support_whatsapp_button_text}
                        onChange={(e) => setSuccessPage(prev => ({ ...prev, support_whatsapp_button_text: e.target.value }))}
                        placeholder="Falar com Suporte no WhatsApp"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Mensagem Automática</Label>
                      <Textarea
                        value={(successPage as any).support_whatsapp_message}
                        onChange={(e) => setSuccessPage(prev => ({ ...prev, support_whatsapp_message: e.target.value }))}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Variáveis: {'{nome}'}, {'{email}'}, {'{produto}'}, {'{valor}'}, {'{telefone}'}, {'{pedido}'}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <Button onClick={handleSaveSuccessPage} disabled={isUpdating} className="w-full">
                <Save className="h-4 w-4 mr-2" /> Salvar Página de Sucesso
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          {/* WhatsApp Notifications */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-green-500" />
                Notificação via WhatsApp
              </CardTitle>
              <CardDescription>Envie uma mensagem via WhatsApp quando o pagamento for aprovado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={notifications.whatsapp_enabled}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, whatsapp_enabled: checked }))}
                />
                <Label>Habilitar notificação WhatsApp</Label>
              </div>
              {notifications.whatsapp_enabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome da Instância</Label>
                      <Input
                        value={notifications.whatsapp_instance_name}
                        onChange={(e) => setNotifications(prev => ({ ...prev, whatsapp_instance_name: e.target.value }))}
                        placeholder="minha-instancia"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>URL da API</Label>
                      <Input
                        value={notifications.whatsapp_api_url}
                        onChange={(e) => setNotifications(prev => ({ ...prev, whatsapp_api_url: e.target.value }))}
                        placeholder="https://api.evolution.com.br"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={notifications.whatsapp_api_key}
                      onChange={(e) => setNotifications(prev => ({ ...prev, whatsapp_api_key: e.target.value }))}
                      placeholder="sua-api-key"
                    />
                  </div>
                  <div>
                    <Label>Template da Mensagem</Label>
                    <Textarea
                      value={notifications.whatsapp_template}
                      onChange={(e) => setNotifications(prev => ({ ...prev, whatsapp_template: e.target.value }))}
                      rows={5}
                      placeholder="Olá {nome}! Seu pagamento foi confirmado..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variáveis: {'{nome}'}, {'{email}'}, {'{produto}'}, {'{valor}'}, {'{telefone}'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Email Notifications */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Notificação via Email (Gmail)
              </CardTitle>
              <CardDescription>Envie um email quando o pagamento for aprovado</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={notifications.email_enabled}
                  onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email_enabled: checked }))}
                />
                <Label>Habilitar notificação Email</Label>
              </div>
              {notifications.email_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Gmail (usuário)</Label>
                      <Input
                        value={notifications.gmail_user}
                        onChange={(e) => setNotifications(prev => ({ ...prev, gmail_user: e.target.value }))}
                        placeholder="seuemail@gmail.com"
                      />
                    </div>
                    <div>
                      <Label>Senha de App</Label>
                      <Input
                        type="password"
                        value={notifications.gmail_app_password}
                        onChange={(e) => setNotifications(prev => ({ ...prev, gmail_app_password: e.target.value }))}
                        placeholder="senha-de-app-google"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Criar senha de app no Google
                        </a>
                      </p>
                    </div>
                  </div>
                  <div>
                    <Label>Assunto do Email</Label>
                    <Input
                      value={notifications.email_subject}
                      onChange={(e) => setNotifications(prev => ({ ...prev, email_subject: e.target.value }))}
                      placeholder="Pagamento Confirmado - {produto}"
                    />
                  </div>
                  <div>
                    <Label>Template do Email</Label>
                    <Textarea
                      value={notifications.email_template}
                      onChange={(e) => setNotifications(prev => ({ ...prev, email_template: e.target.value }))}
                      rows={6}
                      placeholder="Olá {nome}, seu pagamento foi confirmado..."
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Variáveis: {'{nome}'}, {'{email}'}, {'{produto}'}, {'{valor}'}, {'{telefone}'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveNotifications} disabled={isUpdating} className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar Configurações de Notificação
          </Button>
        </TabsContent>


        <TabsContent value="abandoned" className="space-y-4">
          {/* Configurações Gerais */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Configurações Gerais
              </CardTitle>
              <CardDescription>Configure quando e como enviar as mensagens de recuperação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={abandonedCart.enabled}
                  onCheckedChange={(checked) => setAbandonedCart(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>Habilitar recuperação de carrinho abandonado</Label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Tempo de espera (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={abandonedCart.delay_minutes}
                    onChange={(e) => setAbandonedCart(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 30 }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Após este tempo o pedido é considerado abandonado
                  </p>
                </div>
                <div>
                  <Label>Intervalo do Cron (minutos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={abandonedCart.cron_interval_minutes || 5}
                    onChange={(e) => setAbandonedCart(prev => ({ ...prev, cron_interval_minutes: parseInt(e.target.value) || 5 }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A cada quantos minutos verificar carrinhos abandonados
                  </p>
                </div>
                <div>
                  <Label>Delay entre envios (segundos)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={abandonedCart.delay_between_sends || 5}
                    onChange={(e) => setAbandonedCart(prev => ({ ...prev, delay_between_sends: parseInt(e.target.value) || 5 }))}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Intervalo entre cada envio para evitar bloqueios
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Email */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Notificação via Email (Gmail)
              </CardTitle>
              <CardDescription>Configure o Gmail para enviar emails de recuperação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Email do Gmail</Label>
                  <Input
                    type="email"
                    value={abandonedCart.gmail_user || ''}
                    onChange={(e) => setAbandonedCart(prev => ({ ...prev, gmail_user: e.target.value }))}
                    placeholder="seuemail@gmail.com"
                  />
                </div>
                <div>
                  <Label>Senha de App</Label>
                  <Input
                    type="password"
                    value={abandonedCart.gmail_app_password || ''}
                    onChange={(e) => setAbandonedCart(prev => ({ ...prev, gmail_app_password: e.target.value }))}
                    placeholder="xxxx xxxx xxxx xxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Criar senha de app no Google
                    </a>
                  </p>
                </div>
              </div>
              
              <div>
                <Label>Assunto do Email</Label>
                <Input
                  value={abandonedCart.email_subject}
                  onChange={(e) => setAbandonedCart(prev => ({ ...prev, email_subject: e.target.value }))}
                  placeholder="Você esqueceu algo no carrinho!"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Mensagem do Email</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAbandonedCart(prev => ({ ...prev, email_template: defaultAbandonedCartTemplate }))}
                    className="text-xs h-7"
                  >
                    Restaurar Padrão
                  </Button>
                </div>
                <Textarea
                  value={abandonedCart.email_template}
                  onChange={(e) => setAbandonedCart(prev => ({ ...prev, email_template: e.target.value }))}
                  rows={10}
                  placeholder="Digite sua mensagem aqui..."
                />
                <p className="text-xs text-muted-foreground">
                  <strong>Variáveis:</strong> {'{{nome}}'}, {'{{produto}}'}, {'{{valor}}'}, {'{{link}}'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de WhatsApp */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500" />
                Notificação via WhatsApp (Evolution)
              </CardTitle>
              <CardDescription>Configure a Evolution API para enviar mensagens de recuperação via WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={abandonedCart.whatsapp_enabled || false}
                  onCheckedChange={(checked) => setAbandonedCart(prev => ({ ...prev, whatsapp_enabled: checked }))}
                />
                <Label>Habilitar WhatsApp</Label>
              </div>
              
              {abandonedCart.whatsapp_enabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome da Instância</Label>
                      <Input
                        value={abandonedCart.whatsapp_instance_name || ''}
                        onChange={(e) => setAbandonedCart(prev => ({ ...prev, whatsapp_instance_name: e.target.value }))}
                        placeholder="minha-instancia"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>URL da API Evolution</Label>
                      <Input
                        value={abandonedCart.whatsapp_api_url || ''}
                        onChange={(e) => setAbandonedCart(prev => ({ ...prev, whatsapp_api_url: e.target.value }))}
                        placeholder="https://evolution.meusite.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={abandonedCart.whatsapp_api_key || ''}
                      onChange={(e) => setAbandonedCart(prev => ({ ...prev, whatsapp_api_key: e.target.value }))}
                      placeholder="sua-api-key"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Mensagem do WhatsApp</Label>
                    <Textarea
                      value={abandonedCart.whatsapp_template || ''}
                      onChange={(e) => setAbandonedCart(prev => ({ ...prev, whatsapp_template: e.target.value }))}
                      rows={8}
                      placeholder="Digite sua mensagem aqui..."
                    />
                    <p className="text-xs text-muted-foreground">
                      <strong>Variáveis:</strong> {'{{nome}}'}, {'{{produto}}'}, {'{{valor}}'}, {'{{link}}'}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveAbandonedCart} disabled={isUpdating} className="w-full">
            <Save className="h-4 w-4 mr-2" /> Salvar Todas as Configurações de Carrinho Abandonado
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
