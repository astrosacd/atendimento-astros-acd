import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Loader2, Bell, Key, Calendar, Info, ExternalLink, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCalendarConfig, useUpdateCalendarConfig } from '@/hooks/useCalendar';

export function AgendaConfigPanel() {
  const { data: config, isLoading } = useCalendarConfig();
  const updateConfig = useUpdateCalendarConfig();

  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleCalendarId, setGoogleCalendarId] = useState('');
  const [googleRefreshToken, setGoogleRefreshToken] = useState('');
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyHoursBefore, setNotifyHoursBefore] = useState('1');
  const [notifyChannel, setNotifyChannel] = useState('whatsapp');
  const [notifyTemplate, setNotifyTemplate] = useState('');

  useEffect(() => {
    if (config) {
      setGoogleEnabled(config.google_calendar_enabled === 'true');
      setGoogleClientId(config.google_client_id || '');
      setGoogleClientSecret(config.google_client_secret || '');
      setGoogleCalendarId(config.google_calendar_id || '');
      setGoogleRefreshToken(config.google_refresh_token || '');
      setNotifyEnabled(config.notify_client_enabled === 'true');
      setNotifyHoursBefore(config.notify_hours_before || '1');
      setNotifyChannel(config.notify_channel || 'whatsapp');
      setNotifyTemplate(config.notify_message_template || '');
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      google_calendar_enabled: googleEnabled ? 'true' : 'false',
      google_client_id: googleClientId,
      google_client_secret: googleClientSecret,
      google_calendar_id: googleCalendarId,
      google_refresh_token: googleRefreshToken,
      notify_client_enabled: notifyEnabled ? 'true' : 'false',
      notify_hours_before: notifyHoursBefore,
      notify_channel: notifyChannel,
      notify_message_template: notifyTemplate,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google Calendar Integration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Google Agenda</CardTitle>
          </div>
          <CardDescription>
            Configure as credenciais do Google Calendar para criação automática de links do Google Meet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Integração ativa</Label>
              <Badge variant="outline" className="text-[10px]">
                {googleEnabled ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <Switch checked={googleEnabled} onCheckedChange={setGoogleEnabled} />
          </div>

          {googleEnabled && (
            <div className="space-y-3 pl-1">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                  <p>
                    Para obter as credenciais, acesse o{' '}
                    <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
                      Google Cloud Console <ExternalLink className="h-3 w-3" />
                    </a>
                    , crie um projeto com a API do Google Calendar habilitada e gere as credenciais OAuth 2.0.
                  </p>
                  <p>
                    O <strong>Refresh Token</strong> é necessário para gerar links do Google Meet automaticamente.
                    Você pode obtê-lo usando o OAuth 2.0 Playground ou ferramentas como n8n/Postman.
                  </p>
                </div>
              </div>
              <TooltipProvider delayDuration={200}>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Client ID
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[320px] text-xs leading-relaxed">
                        <p className="font-semibold mb-1">Como obter o Client ID:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Acesse o Google Cloud Console</li>
                          <li>Crie um projeto (ou use um existente)</li>
                          <li>Vá em APIs e Serviços → Biblioteca</li>
                          <li>Ative a "Google Calendar API"</li>
                          <li>Vá em Credenciais → Criar credenciais → ID do cliente OAuth</li>
                          <li>Tipo: Aplicativo da Web</li>
                          <li>Em URIs de redirecionamento, adicione: https://developers.google.com/oauthplayground</li>
                          <li>O Client ID aparecerá após criar</li>
                        </ol>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    placeholder="Seu Google Client ID"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Client Secret
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[320px] text-xs leading-relaxed">
                        <p className="font-semibold mb-1">Como obter o Client Secret:</p>
                        <p>O Client Secret aparece junto com o Client ID ao criar as credenciais OAuth no Google Cloud Console (mesmo passo acima).</p>
                        <p className="mt-1">Se já criou, vá em Credenciais → clique no seu ID OAuth → o Secret estará lá.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    type="password"
                    placeholder="Seu Google Client Secret"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    Refresh Token
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[350px] text-xs leading-relaxed">
                        <p className="font-semibold mb-1">Como obter o Refresh Token:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Acesse o OAuth 2.0 Playground do Google (developers.google.com/oauthplayground)</li>
                          <li>Clique na engrenagem (⚙️) no canto superior direito</li>
                          <li>Marque "Use your own OAuth credentials"</li>
                          <li>Cole o Client ID e Client Secret</li>
                          <li>No lado esquerdo, selecione "Google Calendar API v3" → escopo: .../auth/calendar</li>
                          <li>Clique em "Authorize APIs" e faça login</li>
                          <li>Clique em "Exchange authorization code for tokens"</li>
                          <li>Copie o Refresh Token exibido</li>
                        </ol>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    type="password"
                    placeholder="Seu Google Refresh Token"
                    value={googleRefreshToken}
                    onChange={(e) => setGoogleRefreshToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    ID do Calendário
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[320px] text-xs leading-relaxed">
                        <p className="font-semibold mb-1">Como obter o ID do Calendário:</p>
                        <ol className="list-decimal list-inside space-y-0.5">
                          <li>Abra o Google Agenda (calendar.google.com)</li>
                          <li>No lado esquerdo, passe o mouse no calendário desejado</li>
                          <li>Clique nos 3 pontinhos → Configurações</li>
                          <li>Role até "Integrar agenda"</li>
                          <li>O ID do calendário estará lá</li>
                        </ol>
                        <p className="mt-1">Se for o calendário principal, geralmente é o seu email (ex: seuemail@gmail.com).</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Input
                    placeholder="Ex: seuemail@gmail.com (ou 'primary')"
                    value={googleCalendarId}
                    onChange={(e) => setGoogleCalendarId(e.target.value)}
                  />
                </div>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Notificações</CardTitle>
          </div>
          <CardDescription>
            Configure notificações automáticas para clientes no dia da reunião.
          </CardDescription>
          <div className="mt-2 p-2.5 bg-muted/60 rounded-lg border border-border/50">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>📌 De onde vêm as credenciais:</strong><br />
              • <strong>WhatsApp:</strong> Usa os segredos do sistema (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE) — mesmas credenciais configuradas em <em>Admin → Configurações</em>.<br />
              • <strong>Email:</strong> Usa os segredos do sistema (GMAIL_USER, GMAIL_APP_PASSWORD) — mesmas credenciais do módulo de cobrança.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Label>Notificar clientes</Label>
              <Badge variant="outline" className="text-[10px]">
                {notifyEnabled ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} />
          </div>

          {notifyEnabled && (
            <div className="space-y-3 pl-1">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg flex items-start gap-2">
                <Info className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700 dark:text-amber-400">
                  <p><strong>WhatsApp:</strong> Utiliza a Evolution API (URL, API Key e Instância) já configuradas no sistema.</p>
                  <p><strong>Email:</strong> Utiliza as credenciais do Gmail (GMAIL_USER e GMAIL_APP_PASSWORD) já configuradas no sistema.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Horas antes da reunião</Label>
                  <Select value={notifyHoursBefore} onValueChange={setNotifyHoursBefore}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hora</SelectItem>
                      <SelectItem value="2">2 horas</SelectItem>
                      <SelectItem value="3">3 horas</SelectItem>
                      <SelectItem value="6">6 horas</SelectItem>
                      <SelectItem value="12">12 horas</SelectItem>
                      <SelectItem value="24">24 horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Canal</Label>
                  <Select value={notifyChannel} onValueChange={setNotifyChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Modelo da Mensagem</Label>
                <Textarea
                  placeholder="Use {client_name}, {date}, {time}, {meet_link} como variáveis"
                  value={notifyTemplate}
                  onChange={(e) => setNotifyTemplate(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {'{client_name}'}, {'{date}'}, {'{time}'}, {'{meet_link}'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateConfig.isPending}>
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
