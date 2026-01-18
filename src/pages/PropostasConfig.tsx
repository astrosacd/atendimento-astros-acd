import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Mail, MessageSquare, Save, Loader2, Eye, EyeOff, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProposalSendConfig } from '@/hooks/useProposalSending';
import { BrandingConfig } from '@/components/proposals/BrandingConfig';

export default function PropostasConfig() {
  const navigate = useNavigate();
  const { config, isLoading, updateConfig } = useProposalSendConfig();

  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [gmailSenderName, setGmailSenderName] = useState('');
  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [evolutionApiKey, setEvolutionApiKey] = useState('');
  const [evolutionInstanceName, setEvolutionInstanceName] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  
  const [showGmailPassword, setShowGmailPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (config) {
      setGmailUser(config.gmail_user || '');
      setGmailAppPassword(config.gmail_app_password || '');
      setGmailSenderName(config.gmail_sender_name || '');
      setEvolutionApiUrl(config.evolution_api_url || '');
      setEvolutionApiKey(config.evolution_api_key || '');
      setEvolutionInstanceName(config.evolution_instance_name || '');
      setEmailEnabled(config.email_enabled);
      setWhatsappEnabled(config.whatsapp_enabled);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      gmail_user: gmailUser || null,
      gmail_app_password: gmailAppPassword || null,
      gmail_sender_name: gmailSenderName || null,
      evolution_api_url: evolutionApiUrl || null,
      evolution_api_key: evolutionApiKey || null,
      evolution_instance_name: evolutionInstanceName || null,
      email_enabled: emailEnabled,
      whatsapp_enabled: whatsappEnabled,
    });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
<div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/propostas')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Configurações de Propostas</h1>
              <p className="text-muted-foreground">
                Configure identidade visual, envio por Email e WhatsApp
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>

        <Tabs defaultValue="branding">
          <TabsList>
            <TabsTrigger value="branding" className="gap-2">
              <Palette className="h-4 w-4" />
              Identidade Visual
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email (Gmail)
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              WhatsApp (Evolution)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6 mt-6">
            <BrandingConfig />
          </TabsContent>

          <TabsContent value="email" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Configuração Gmail</CardTitle>
                    <CardDescription>
                      Configure as credenciais do Gmail para envio de propostas
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="email-enabled">Habilitado</Label>
                    <Switch
                      id="email-enabled"
                      checked={emailEnabled}
                      onCheckedChange={setEmailEnabled}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email do Gmail</Label>
                    <Input
                      type="email"
                      placeholder="seu@gmail.com"
                      value={gmailUser}
                      onChange={(e) => setGmailUser(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha de App</Label>
                    <div className="relative">
                      <Input
                        type={showGmailPassword ? 'text' : 'password'}
                        placeholder="Senha de app do Google"
                        value={gmailAppPassword}
                        onChange={(e) => setGmailAppPassword(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowGmailPassword(!showGmailPassword)}
                      >
                        {showGmailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use uma senha de app, não a senha normal do Gmail
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nome do Remetente</Label>
                  <Input
                    placeholder="Nome da Empresa"
                    value={gmailSenderName}
                    onChange={(e) => setGmailSenderName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>✨</span> Template de Email Profissional
                </CardTitle>
                <CardDescription>
                  O email é enviado com um design moderno e profissional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    O template de email inclui automaticamente:
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Cabeçalho com gradiente azul profissional</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Saudação personalizada com nome do cliente</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Card destacado com título da proposta</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Botão CTA grande para visualizar a proposta</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Link alternativo caso o botão não funcione</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Rodapé com nome do remetente configurado acima</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Configuração Evolution API</CardTitle>
                    <CardDescription>
                      Configure a API Evolution para envio via WhatsApp
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="whatsapp-enabled">Habilitado</Label>
                    <Switch
                      id="whatsapp-enabled"
                      checked={whatsappEnabled}
                      onCheckedChange={setWhatsappEnabled}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>URL da API</Label>
                  <Input
                    placeholder="https://api.evolution.com"
                    value={evolutionApiUrl}
                    onChange={(e) => setEvolutionApiUrl(e.target.value)}
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder="Sua API Key"
                        value={evolutionApiKey}
                        onChange={(e) => setEvolutionApiKey(e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Nome da Instância</Label>
                    <Input
                      placeholder="instancia01"
                      value={evolutionInstanceName}
                      onChange={(e) => setEvolutionInstanceName(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>✨</span> Template de WhatsApp Profissional
                </CardTitle>
                <CardDescription>
                  A mensagem é enviada com formatação profissional
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    O template de WhatsApp inclui automaticamente:
                  </p>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Saudação animada com emoji e nome do cliente</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Título da proposta em destaque</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Descrição convidativa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Link direto para visualização</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✓</span>
                      <span>Assinatura com nome do remetente</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-background border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">Prévia da mensagem:</p>
                  <div className="font-mono text-sm whitespace-pre-line text-foreground">
                    🎉 *Olá, [Nome do Cliente]!*{'\n\n'}
                    Sua proposta comercial está pronta!{'\n\n'}
                    📄 *Proposta:* [Título da Proposta]{'\n\n'}
                    Preparamos uma proposta especialmente para você...{'\n\n'}
                    👇 *Clique no link abaixo para visualizar:*{'\n'}
                    [Link da proposta]{'\n\n'}
                    _Atenciosamente,_{'\n'}
                    *{gmailSenderName || 'Seu Nome'}*
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
