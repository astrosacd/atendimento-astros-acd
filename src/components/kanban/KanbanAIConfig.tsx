import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Brain, Save, Loader2 } from "lucide-react";

interface AIConfig {
  id: string;
  provider: string;
  api_key: string | null;
  model: string;
  prompt_template: string;
  enabled: boolean;
}

export function KanbanAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('pipeline_ai_config')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig(data);
      } else {
        // Initialize with default if not exists
        setConfig({
          id: '',
          provider: 'lovable',
          api_key: '',
          model: 'gpt-4o',
          prompt_template: `Analise o seguinte lead e forneça um score de 0 a 100, um motivo para o score e uma sugestão de próxima ação.
Lead: {{lead_name}}
Telefone: {{lead_phone}}
Email: {{lead_email}}
Notas/Conversas: {{notes}}

Responda APENAS em formato JSON:
{
  "score": number,
  "reason": "string",
  "suggestion": "string"
}`,
          enabled: false
        });
      }
    } catch (error: any) {
      console.error('Error fetching AI config:', error);
      toast.error('Erro ao carregar configurações de IA');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { id, ...dataToSave } = config;
      let error;

      if (id) {
        const { error: updateError } = await supabase
          .from('pipeline_ai_config')
          .update(dataToSave)
          .eq('id', id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('pipeline_ai_config')
          .insert(dataToSave);
        error = insertError;
      }

      if (error) throw error;
      toast.success('Configurações salvas com sucesso');
      fetchConfig();
    } catch (error: any) {
      console.error('Error saving AI config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Configuração de IA para Scores
        </CardTitle>
        <CardDescription>
          Configure o provedor e o prompt usado para analisar e pontuar seus leads automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between space-x-2">
          <div className="flex flex-col space-y-1">
            <Label htmlFor="ai-enabled">Ativar pontuação por IA</Label>
            <span className="text-xs text-muted-foreground">
              Se desativado, o sistema usará a lógica padrão de pontuação.
            </span>
          </div>
          <Switch
            id="ai-enabled"
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select
              value={config.provider}
              onValueChange={(val) => setConfig({ ...config, provider: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o provedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable AI (Padrão)</SelectItem>
                <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modelo</Label>
            <Input
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder="ex: gpt-4o, claude-3-5-sonnet-20240620"
            />
          </div>
        </div>

        {config.provider !== 'lovable' && (
          <div className="space-y-2">
            <Label>Chave de API</Label>
            <Input
              type="password"
              value={config.api_key || ''}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="Sua chave de API"
            />
          </div>
        )}

        {config.provider === 'lovable' && (
          <p className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-md border border-primary/20">
            O provedor Lovable AI utiliza o gateway de IA padrão do sistema. 
            Você não precisa de uma chave de API própria.
          </p>
        )}

        <div className="space-y-2">
          <Label>Prompt Template</Label>
          <Textarea
            value={config.prompt_template}
            onChange={(e) => setConfig({ ...config, prompt_template: e.target.value })}
            className="min-h-[200px] font-mono text-sm"
            placeholder="Template do prompt..."
          />
          <p className="text-xs text-muted-foreground">
            Use as variáveis {"{{lead_name}}"}, {"{{lead_phone}}"}, {"{{lead_email}}"} e {"{{notes}}"} para personalizar o prompt.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            className="w-full" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Configurações
          </Button>
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              setConfig({
                ...config,
                provider: 'lovable',
                model: 'gpt-4o',
                prompt_template: `Analise o seguinte lead e forneça um score de 0 a 100, um motivo para o score e uma sugestão de próxima ação.
Lead: {{lead_name}}
Telefone: {{lead_phone}}
Email: {{lead_email}}
Notas/Conversas: {{notes}}

Responda APENAS em formato JSON:
{
  "score": number,
  "reason": "string",
  "suggestion": "string"
}`,
                api_key: ''
              });
              toast.info('Configurações padrão carregadas. Não esqueça de salvar.');
            }}
          >
            Restaurar Padrão Lovable
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
