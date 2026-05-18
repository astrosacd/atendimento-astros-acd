import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const KEYS = ['recaptcha_enabled', 'recaptcha_site_key', 'recaptcha_secret_key'] as const;

export default function AdminRecaptcha() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [siteKey, setSiteKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('key,value')
        .in('key', KEYS as unknown as string[]);
      const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value ?? '']));
      setEnabled(map.recaptcha_enabled === 'true');
      setSiteKey(map.recaptcha_site_key ?? '');
      setSecretKey(map.recaptcha_secret_key ?? '');
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (enabled && (!siteKey.trim() || !secretKey.trim())) {
      toast.error('Para habilitar o reCAPTCHA preencha a Site Key e a Secret Key.');
      return;
    }
    setSaving(true);
    const rows = [
      { key: 'recaptcha_enabled', value: enabled ? 'true' : 'false' },
      { key: 'recaptcha_site_key', value: siteKey.trim() },
      { key: 'recaptcha_secret_key', value: secretKey.trim() },
    ];
    const { error } = await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } else {
      toast.success('Configurações de reCAPTCHA salvas.');
    }
  };

  return (
    <DashboardLayout>
      <div className="container max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Google reCAPTCHA v2</h1>
            <p className="text-sm text-muted-foreground">
              Proteja a tela de login contra bots habilitando o reCAPTCHA "Não sou um robô".
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Obtenha suas chaves em{' '}
              <a
                href="https://www.google.com/recaptcha/admin/create"
                referrerPolicy="no-referrer"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline"
              >
                https://www.google.com/recaptcha/admin <ExternalLink className="h-3 w-3" />
              </a>{' '}
              (escolha o tipo <strong>reCAPTCHA v2 — "Não sou um robô"</strong>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="text-base">Habilitar reCAPTCHA na tela de login</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Quando ativo, o usuário precisa marcar "Não sou um robô" antes de entrar.
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="site-key">Site Key (chave do site)</Label>
                  <Input
                    id="site-key"
                    placeholder="6Lc..."
                    value={siteKey}
                    onChange={(e) => setSiteKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secret-key">Secret Key (chave secreta)</Label>
                  <Input
                    id="secret-key"
                    type="password"
                    placeholder="6Lc..."
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A chave secreta nunca é exposta no frontend público.
                  </p>
                </div>

                <Button onClick={save} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar configurações
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
