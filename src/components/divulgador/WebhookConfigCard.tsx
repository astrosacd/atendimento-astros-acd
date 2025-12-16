import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Settings, RefreshCw, Loader2, CheckCircle2, AlertCircle, Copy } from 'lucide-react';

interface WebhookConfigCardProps {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export function WebhookConfigCard({ apiUrl, apiKey, instanceName }: WebhookConfigCardProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [webhookStatus, setWebhookStatus] = useState<'unknown' | 'configured' | 'not_configured'>('unknown');
  const webhookUrl = 'https://udxaxemoozddkwpitngq.supabase.co/functions/v1/divulgador-welcome';

  const checkWebhook = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/webhook/find/${instanceName}`, {
        headers: { 'apikey': apiKey },
      });
      
      if (response.ok) {
        const data = await response.json();
        const hasOurWebhook = data?.webhook?.url?.includes('divulgador-welcome');
        setWebhookStatus(hasOurWebhook ? 'configured' : 'not_configured');
      } else {
        setWebhookStatus('not_configured');
      }
    } catch {
      setWebhookStatus('unknown');
    }
  };

  useEffect(() => {
    if (apiUrl && apiKey && instanceName) {
      checkWebhook();
    }
  }, [apiUrl, apiKey, instanceName]);

  const configureWebhook = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      toast.error('Configure a instância WhatsApp primeiro');
      return;
    }

    setIsConfiguring(true);
    try {
      const response = await fetch(`${apiUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: true,
          webhook_base64: false,
          events: [
            'GROUP_PARTICIPANTS_UPDATE',
            'GROUPS_UPSERT',
          ],
        }),
      });

      if (response.ok) {
        toast.success('Webhook configurado com sucesso!');
        setWebhookStatus('configured');
      } else {
        const error = await response.json();
        toast.error('Erro ao configurar: ' + (error.message || 'Erro desconhecido'));
      }
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-purple-500" />Webhook Evolution API</CardTitle>
        <CardDescription>Detecta automaticamente novos participantes nos grupos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Status do Webhook</p>
              <p className="text-sm text-muted-foreground">Recebe eventos de entrada de participantes</p>
            </div>
            <Badge variant={webhookStatus === 'configured' ? 'default' : 'secondary'} className="gap-1.5">
              {webhookStatus === 'configured' ? (
                <><CheckCircle2 className="h-3 w-3" />Configurado</>
              ) : webhookStatus === 'not_configured' ? (
                <><AlertCircle className="h-3 w-3" />Não configurado</>
              ) : (
                <><Loader2 className="h-3 w-3 animate-spin" />Verificando...</>
              )}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="text-xs font-mono" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={configureWebhook} disabled={isConfiguring || !apiUrl || !apiKey || !instanceName}>
            {isConfiguring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
            Configurar Webhook na Evolution
          </Button>
          <Button variant="outline" onClick={checkWebhook}>
            <RefreshCw className="h-4 w-4 mr-2" />Verificar Status
          </Button>
        </div>

        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <strong>Importante:</strong> Após configurar, o webhook receberá notificações sempre que um participante entrar em um grupo gerenciado. A mensagem de boas-vindas será enviada automaticamente no privado.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
