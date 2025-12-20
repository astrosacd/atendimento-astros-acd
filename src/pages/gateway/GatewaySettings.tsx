import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGatewaySettings } from '@/hooks/useGateway';
import { CreditCard, Mail, ShoppingCart, Save } from 'lucide-react';

export default function GatewaySettings() {
  const { settings, isLoading, updateSetting, isUpdating } = useGatewaySettings();
  
  const [stripe, setStripe] = useState({ enabled: false, publishable_key: '', secret_key: '' });
  const [mercadopago, setMercadopago] = useState({ enabled: false, access_token: '' });
  const [email, setEmail] = useState({ smtp_host: '', smtp_port: 587, smtp_user: '', smtp_password: '', from_email: '', from_name: '' });
  const [abandonedCart, setAbandonedCart] = useState({ enabled: false, delay_minutes: 30, email_subject: '', email_template: '' });

  useEffect(() => {
    if (settings.stripe) setStripe(settings.stripe);
    if (settings.mercadopago) setMercadopago(settings.mercadopago);
    if (settings.email) setEmail(settings.email);
    if (settings.abandoned_cart) setAbandonedCart(settings.abandoned_cart);
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Configurações</h2>

      <Tabs defaultValue="gateways" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gateways" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Gateways
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
                <Label>Template do Email (HTML)</Label>
                <Textarea
                  value={abandonedCart.email_template}
                  onChange={(e) => setAbandonedCart(prev => ({ ...prev, email_template: e.target.value }))}
                  rows={6}
                  placeholder="<h1>Olá {{nome}}</h1><p>Você deixou {{produto}} no carrinho...</p>"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Variáveis: {'{{nome}}'}, {'{{produto}}'}, {'{{link}}'}
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
