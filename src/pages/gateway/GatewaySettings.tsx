import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGatewaySettings } from '@/hooks/useGateway';
import { CreditCard, Mail, ShoppingCart, Save, Timer, Link, Copy, ExternalLink, Bell, MessageSquare, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GatewaySettings() {
  const { settings, isLoading, updateSetting, isUpdating } = useGatewaySettings();
  
  const [stripe, setStripe] = useState({ enabled: false, publishable_key: '', secret_key: '' });
  const [mercadopago, setMercadopago] = useState({ enabled: false, access_token: '' });
  const [email, setEmail] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', from_email: '', from_name: '' });
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
    delay_between_sends: 5
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
  useEffect(() => {
    if (settings.stripe) setStripe(settings.stripe);
    if (settings.mercadopago) setMercadopago(settings.mercadopago);
    if (settings.email) setEmail(settings.email);
    if (settings.abandoned_cart) setAbandonedCart(settings.abandoned_cart);
    if (settings.checkout) setCheckout(settings.checkout);
    if (settings.success_page) setSuccessPage(settings.success_page);
    if (settings.payment_notifications) setNotifications(settings.payment_notifications);
    if (settings.site_base_url?.url) setSiteBaseUrl(String(settings.site_base_url.url));
  }, [settings]);

  const handleSaveStripe = () => {
    updateSetting({ key: 'stripe', value: stripe });
  };

  const handleSaveMercadopago = () => {
    updateSetting({ key: 'mercadopago', value: mercadopago });
  };

  const handleSaveEmail = () => {
    updateSetting({ key: 'email', value: email });
  };

  const handleSaveAbandonedCart = () => {
    updateSetting({ key: 'abandoned_cart', value: abandonedCart });
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
    navigator.clipboard.writeText(catalogUrl);
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
    navigator.clipboard.writeText(loginUrl);
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="gateways" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Gateways
          </TabsTrigger>
          <TabsTrigger value="checkout" className="gap-2">
            <Timer className="h-4 w-4" />
            Checkout
          </TabsTrigger>
          <TabsTrigger value="success" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Sucesso
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-2">
            <Mail className="h-4 w-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="abandoned" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrinho Abandonado
          </TabsTrigger>
        </TabsList>

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
              <div>
                <Label>Access Token</Label>
                <Input
                  type="password"
                  value={mercadopago.access_token}
                  onChange={(e) => setMercadopago(prev => ({ ...prev, access_token: e.target.value }))}
                  placeholder="APP_USR-..."
                />
              </div>
              <Button onClick={handleSaveMercadopago} disabled={isUpdating}>
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

        <TabsContent value="email">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Configurações de Email</CardTitle>
              <CardDescription>Configure o servidor SMTP para envio de emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SMTP Host</Label>
                  <Input
                    value={email.smtp_host}
                    onChange={(e) => setEmail(prev => ({ ...prev, smtp_host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={email.smtp_port}
                    onChange={(e) => setEmail(prev => ({ ...prev, smtp_port: parseInt(e.target.value) || 587 }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>SMTP User</Label>
                  <Input
                    value={email.smtp_user}
                    onChange={(e) => setEmail(prev => ({ ...prev, smtp_user: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>SMTP Password</Label>
                  <Input
                    type="password"
                    value={email.smtp_password}
                    onChange={(e) => setEmail(prev => ({ ...prev, smtp_password: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email de Envio</Label>
                  <Input
                    value={email.from_email}
                    onChange={(e) => setEmail(prev => ({ ...prev, from_email: e.target.value }))}
                    placeholder="vendas@seusite.com"
                  />
                </div>
                <div>
                  <Label>Nome do Remetente</Label>
                  <Input
                    value={email.from_name}
                    onChange={(e) => setEmail(prev => ({ ...prev, from_name: e.target.value }))}
                    placeholder="Sua Loja"
                  />
                </div>
              </div>
              <Button onClick={handleSaveEmail} disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" /> Salvar Email
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="abandoned">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Recuperação de Carrinho Abandonado</CardTitle>
              <CardDescription>Configure emails automáticos para recuperar vendas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={abandonedCart.enabled}
                  onCheckedChange={(checked) => setAbandonedCart(prev => ({ ...prev, enabled: checked }))}
                />
                <Label>Habilitar emails de recuperação</Label>
              </div>
              <div>
                <Label>Tempo de espera (minutos)</Label>
                <Input
                  type="number"
                  value={abandonedCart.delay_minutes}
                  onChange={(e) => setAbandonedCart(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 30 }))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Tempo após abandono para enviar o email
                </p>
              </div>
              <div>
                <Label>Assunto do Email</Label>
                <Input
                  value={abandonedCart.email_subject}
                  onChange={(e) => setAbandonedCart(prev => ({ ...prev, email_subject: e.target.value }))}
                  placeholder="Você esqueceu algo no carrinho!"
                />
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
                  Intervalo entre cada envio para evitar bloqueios (recomendado: 5-10 segundos)
                </p>
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
                  rows={12}
                  placeholder="Digite sua mensagem aqui..."
                />
                <p className="text-xs text-muted-foreground">
                  <strong>Variáveis:</strong> {'{{nome}}'}, {'{{produto}}'}, {'{{valor}}'}, {'{{link}}'}
                </p>
              </div>
              <Button onClick={handleSaveAbandonedCart} disabled={isUpdating}>
                <Save className="h-4 w-4 mr-2" /> Salvar Configuração
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
