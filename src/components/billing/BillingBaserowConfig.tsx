import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Database, Eye, EyeOff } from 'lucide-react';

const BILLING_EVENTS = [
  { key: 'billing.d_menos_3', label: 'D-3 (3 dias antes)' },
  { key: 'billing.d_zero', label: 'D0 (Dia do vencimento)' },
  { key: 'billing.d_mais_1', label: 'D+1 (1 dia após)' },
  { key: 'billing.d_mais_2', label: 'D+2 (2 dias após)' },
  { key: 'billing.d_mais_15', label: 'D+15 (15 dias após)' },
  { key: 'billing.d_mais_30', label: 'D+30 (30 dias após)' },
];

export const BillingBaserowConfig = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [tableId, setTableId] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: config } = useQuery({
    queryKey: ['baserow-config-billing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baserow_integrations')
        .select('*')
        .eq('module', 'billing')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setIsEnabled(config.is_enabled ?? false);
      setApiUrl(config.api_url || '');
      setApiToken(config.api_token || '');
      setTableId(config.table_id || '');
      setEvents(config.events || []);
    }
  }, [config]);

  const toggleEvent = (evt: string) => {
    setEvents(prev =>
      prev.includes(evt) ? prev.filter(e => e !== evt) : [...prev, evt]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('baserow_integrations')
        .update({
          is_enabled: isEnabled,
          api_url: apiUrl,
          api_token: apiToken,
          table_id: tableId,
          events,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('module', 'billing');
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['baserow-config-billing'] });
      toast({
        title: 'Configuração Baserow salva!',
        description: 'Integração de cobrança com Baserow atualizada.',
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Integração Baserow — Cobrança
          </CardTitle>
          <CardDescription>
            Quando uma mensagem de cobrança é enviada, o número do cliente é automaticamente criado/atualizado no Baserow com o campo "Atende Humano" marcado como true.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativar integração</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          <div className="space-y-2">
            <Label>URL da API do Baserow</Label>
            <Input
              placeholder="https://api.baserow.io"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">URL base da API (sem barra no final)</p>
          </div>

          <div className="space-y-2">
            <Label>Token da API</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? 'text' : 'password'}
                placeholder="Token alfanumérico"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Apenas o token (sem o prefixo "Token ")</p>
          </div>

          <div className="space-y-2">
            <Label>ID da Tabela</Label>
            <Input
              placeholder="Ex: 456"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Eventos habilitados</Label>
            <div className="flex flex-wrap gap-2">
              {BILLING_EVENTS.map(evt => (
                <Badge
                  key={evt.key}
                  variant={events.includes(evt.key) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => toggleEvent(evt.key)}
                >
                  {evt.label}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione em quais tipos de cobrança o Baserow deve ser acionado
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Configurações Baserow'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
