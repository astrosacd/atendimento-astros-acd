import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MessageSquare, Save, Loader2, RefreshCw } from 'lucide-react';

export function ChatwootIntegration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    id: '',
    chatwoot_url: '',
    chatwoot_api_key: '',
    account_id: '',
    inbox_id: '',
    enabled: false,
    sync_conversations: false,
    sync_leads: false,
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_chatwoot_config')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig(data);
      }
    } catch (err) {
      console.error('Error loading Chatwoot config:', err);
      toast.error('Erro ao carregar configurações do Chatwoot');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('pipeline_chatwoot_config')
        .upsert({
          id: config.id || undefined,
          chatwoot_url: config.chatwoot_url,
          chatwoot_api_key: config.chatwoot_api_key,
          account_id: config.account_id,
          inbox_id: config.inbox_id,
          enabled: config.enabled,
          sync_conversations: config.sync_conversations,
          sync_leads: config.sync_leads,
        });

      if (error) throw error;
      toast.success('Configurações do Chatwoot salvas com sucesso');
      loadConfig();
    } catch (err) {
      console.error('Error saving Chatwoot config:', err);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    toast.info('Iniciando sincronização com Chatwoot...');
    try {
      const { data, error } = await supabase.functions.invoke('chatwoot-sync', {
        body: { action: 'sync_all' }
      });
      if (error) throw error;
      toast.success('Sincronização concluída com sucesso');
    } catch (err) {
      console.error('Error syncing with Chatwoot:', err);
      toast.error('Erro ao sincronizar com Chatwoot. Verifique as credenciais.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-secondary/50 border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-indigo-400" />
            <CardTitle>Configuração Chatwoot</CardTitle>
          </div>
          <CardDescription>
            Integre seu Pipeline com o Chatwoot para sincronizar conversas e leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chatwoot_url">URL do Chatwoot</Label>
              <Input
                id="chatwoot_url"
                placeholder="https://chat.suaempresa.com"
                value={config.chatwoot_url || ''}
                onChange={(e) => setConfig({ ...config, chatwoot_url: e.target.value })}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">URL base da sua instância do Chatwoot (sem /api/v1)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="chatwoot_api_key">Token de Acesso (API Key)</Label>
              <Input
                id="chatwoot_api_key"
                type="password"
                placeholder="Sua API Key"
                value={config.chatwoot_api_key || ''}
                onChange={(e) => setConfig({ ...config, chatwoot_api_key: e.target.value })}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Token do perfil do usuário no Chatwoot</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account_id">ID da Conta</Label>
              <Input
                id="account_id"
                placeholder="Ex: 1"
                value={config.account_id || ''}
                onChange={(e) => setConfig({ ...config, account_id: e.target.value })}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inbox_id">ID da Inbox (Opcional)</Label>
              <Input
                id="inbox_id"
                placeholder="Ex: 5"
                value={config.inbox_id || ''}
                onChange={(e) => setConfig({ ...config, inbox_id: e.target.value })}
                className="bg-background"
              />
              <p className="text-[10px] text-muted-foreground">Deixe vazio para sincronizar todas as inboxes</p>
            </div>
          </div>

          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Habilitar Integração</Label>
                <p className="text-sm text-muted-foreground">Ativa as funcionalidades do Chatwoot no Pipeline</p>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sincronizar Conversas</Label>
                <p className="text-sm text-muted-foreground">Busca conversas recentes para análise de IA</p>
              </div>
              <Switch
                checked={config.sync_conversations}
                onCheckedChange={(checked) => setConfig({ ...config, sync_conversations: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Importar Contatos como Leads</Label>
                <p className="text-sm text-muted-foreground">Cria leads automaticamente a partir de novos contatos</p>
              </div>
              <Switch
                checked={config.sync_leads}
                onCheckedChange={(checked) => setConfig({ ...config, sync_leads: checked })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
            <Button onClick={handleSync} variant="outline" className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sincronizar Agora
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card className="bg-secondary/30 border-dashed">
        <CardHeader className="py-4">
          <CardTitle className="text-sm">Webhook do Chatwoot (Opcional)</CardTitle>
          <CardDescription className="text-xs">
            Para sincronização em tempo real, configure este Webhook na sua conta Chatwoot:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-black/20 p-2 rounded text-[10px] font-mono break-all border border-border">
            {window.location.origin.replace('lovable.app', 'supabase.co')}/functions/v1/chatwoot-webhook
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
