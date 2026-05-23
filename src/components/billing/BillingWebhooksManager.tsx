import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/utils/clipboard";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Copy, Webhook, CheckCircle2, AlertTriangle, ExternalLink, Save, Loader2,
  Eye, EyeOff, Info, PlugZap, XCircle,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const MP_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/client-payment-mp-webhook`;
const STRIPE_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/client-payment-stripe-webhook`;

type TestResult = { ok: boolean; message: string; raw?: any } | null;

export function BillingWebhooksManager() {
  const { canManageCobrancaWebhooks } = usePermissions();
  const canManage = canManageCobrancaWebhooks(); // admin já inclui tudo

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [configId, setConfigId] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [savedSecret, setSavedSecret] = useState("");

  const [testingMp, setTestingMp] = useState(false);
  const [testingStripe, setTestingStripe] = useState(false);
  const [mpResult, setMpResult] = useState<TestResult>(null);
  const [stripeResult, setStripeResult] = useState<TestResult>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("billing_stripe_config")
      .select("id, stripe_enabled, stripe_webhook_secret")
      .limit(1)
      .maybeSingle();
    if (data) {
      setConfigId(data.id);
      setStripeEnabled(!!data.stripe_enabled);
      setSecret(data.stripe_webhook_secret || "");
      setSavedSecret(data.stripe_webhook_secret || "");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copiada`);
    else toast.error("Não foi possível copiar");
  };

  const handleSaveSecret = async () => {
    if (!canManage) return;
    if (!secret.startsWith("whsec_")) {
      toast.error("O Signing Secret da Stripe deve começar com 'whsec_'");
      return;
    }
    setSaving(true);
    const payload = { stripe_webhook_secret: secret };
    const q = configId
      ? await supabase.from("billing_stripe_config").update(payload).eq("id", configId)
      : await supabase.from("billing_stripe_config").insert({ ...payload, stripe_enabled: false });
    setSaving(false);
    if (q.error) return toast.error("Erro ao salvar: " + q.error.message);
    toast.success("Signing Secret salvo");
    setSavedSecret(secret);
    load();
  };

  const testWebhook = async (
    url: string,
    setBusy: (v: boolean) => void,
    setResult: (r: TestResult) => void,
    providerLabel: string,
  ) => {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-test": "ping",
        },
        body: "{}",
      });
      const text = await res.text();
      let body: any = {};
      try { body = JSON.parse(text); } catch { body = { raw: text }; }
      if (res.ok && body?.ok) {
        setResult({ ok: true, message: body.message || `Webhook ${providerLabel} acessível.`, raw: body });
        toast.success(`Webhook ${providerLabel}: OK`);
      } else {
        setResult({ ok: false, message: body?.message || body?.error || `HTTP ${res.status}`, raw: body });
        toast.error(`Webhook ${providerLabel} falhou`);
      }
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || "Falha de rede" });
      toast.error(`Erro ao chamar webhook: ${e?.message || ""}`);
    } finally {
      setBusy(false);
    }
  };

  const mpConfigured = true;
  const stripeConfigured = !!savedSecret;

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" />
          Webhooks de Pagamento (Recebimento Automático)
        </CardTitle>
        <CardDescription>
          Configure as URLs abaixo nos painéis do Mercado Pago e da Stripe para que o sistema marque os pagamentos como pagos
          automaticamente — sem precisar clicar em "Verificar Status".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Ao receber um pagamento aprovado, o webhook automaticamente: marca a cobrança como <strong>paga</strong>,
            avança a <strong>data de renovação</strong> do cliente, <strong>cancela as outras cobranças pendentes</strong> do
            mesmo ciclo e dispara o envio do <strong>recibo</strong>.
          </AlertDescription>
        </Alert>

        {/* MERCADO PAGO */}
        <div className="space-y-3 rounded-lg border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#00b1ea]" />
              <h3 className="font-semibold">Mercado Pago</h3>
              {mpConfigured ? (
                <Badge variant="outline" className="border-green-500/30 text-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Pronto
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Falta configurar
                </Badge>
              )}
            </div>
            <a
              href="https://www.mercadopago.com.br/developers/panel/app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Abrir painel MP <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">URL do Webhook (cole no campo IPN/Webhook)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={MP_WEBHOOK_URL} readOnly className="font-mono text-xs bg-background" />
              <Button variant="outline" size="icon" onClick={() => handleCopy(MP_WEBHOOK_URL, "URL")}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => testWebhook(MP_WEBHOOK_URL, setTestingMp, setMpResult, "Mercado Pago")}
                disabled={testingMp || !canManage}
                title={!canManage ? "Sem permissão" : "Testar webhook"}
              >
                {testingMp ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Testar webhook
              </Button>
            </div>
            {mpResult && (
              <div className={`mt-2 flex items-start gap-2 rounded-md border p-2 text-xs ${
                mpResult.ok ? "border-green-500/30 bg-green-500/5 text-green-600" : "border-red-500/30 bg-red-500/5 text-red-600"
              }`}>
                {mpResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
                <span>{mpResult.message}</span>
              </div>
            )}
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Como configurar (passo a passo)</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Acesse <strong>Mercado Pago → Suas integrações → Seu App → Webhooks</strong>.</li>
              <li>Em <strong>Modo Produção</strong>, clique em <em>Configurar notificações</em>.</li>
              <li>Cole a URL acima no campo <strong>URL de produção</strong>.</li>
              <li>Marque o evento <strong>Pagamentos (payment)</strong>.</li>
              <li>Salve. Não é preciso configurar segredo — usamos o <code>MERCADOPAGO_ACCESS_TOKEN</code> dos Secrets para validar.</li>
            </ol>
          </details>

          <Alert className="border-amber-500/40 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-xs space-y-2">
              <p className="font-semibold text-amber-600">
                Já tenho um webhook do Mercado Pago apontando para outro lugar (ex.: n8n)
              </p>
              <p>
                O Mercado Pago aceita <strong>apenas 1 webhook por aplicação</strong>. Se ele já aponta para o seu n8n
                (que cuida do módulo de Link de Pagamento), <strong>NÃO troque a URL</strong>. Em vez disso, faça o
                n8n "espelhar" o evento também para este endpoint:
              </p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Abra o workflow do n8n que recebe o webhook do MP.</li>
                <li>Depois do nó <em>"Obter detalhes pagamento"</em> (que faz GET em <code>api.mercadopago.com/v1/payments/{`{id}`}</code>), adicione um novo nó <strong>HTTP Request</strong> em paralelo ao nó atual que chama <code>payment-link-webhook</code>.</li>
                <li>Method: <code>POST</code> &nbsp;|&nbsp; URL: <code className="break-all">{MP_WEBHOOK_URL}</code></li>
                <li>Header: <code>Content-Type: application/json</code></li>
                <li>
                  Body (JSON):
                  <pre className="mt-1 bg-background border rounded p-2 overflow-x-auto">{`{
  "type": "payment",
  "data": {
    "id": "{{ $('Obter detalhes pagamento').item.json.id }}"
  }
}`}</pre>
                </li>
                <li>Salve e ative o workflow. Pronto — quando o MP disparar, o n8n entrega para <strong>os dois módulos</strong> (Link de Pagamento e Cobrança).</li>
              </ol>
              <p>
                Este endpoint busca o pagamento na API do MP por conta própria para confirmar (anti-spoof), então não importa
                que ele venha do n8n e não direto do MP — funciona igual.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        {/* STRIPE */}
        <div className="space-y-3 rounded-lg border bg-card/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[#635bff]" />
              <h3 className="font-semibold">Stripe</h3>
              {stripeConfigured ? (
                <Badge variant="outline" className="border-green-500/30 text-green-500">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Secret salvo
                </Badge>
              ) : (
                <Badge variant="outline" className="border-yellow-500/30 text-yellow-500">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Falta o Signing Secret
                </Badge>
              )}
            </div>
            <a
              href="https://dashboard.stripe.com/webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Abrir painel Stripe <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">URL do Endpoint (cole no Stripe)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={STRIPE_WEBHOOK_URL} readOnly className="font-mono text-xs bg-background" />
              <Button variant="outline" size="icon" onClick={() => handleCopy(STRIPE_WEBHOOK_URL, "URL")}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => testWebhook(STRIPE_WEBHOOK_URL, setTestingStripe, setStripeResult, "Stripe")}
                disabled={testingStripe || !canManage}
                title={!canManage ? "Sem permissão" : "Testar webhook"}
              >
                {testingStripe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <PlugZap className="w-4 h-4 mr-2" />}
                Testar webhook
              </Button>
            </div>
            {stripeResult && (
              <div className={`mt-2 flex items-start gap-2 rounded-md border p-2 text-xs ${
                stripeResult.ok ? "border-green-500/30 bg-green-500/5 text-green-600" : "border-red-500/30 bg-red-500/5 text-red-600"
              }`}>
                {stripeResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <XCircle className="w-4 h-4 mt-0.5" />}
                <span>{stripeResult.message}</span>
              </div>
            )}
          </div>

          <Separator />

          <div>
            <Label className="text-xs text-muted-foreground">Signing Secret (whsec_...)</Label>
            <div className="flex gap-2 mt-1">
              <Input
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="font-mono text-xs bg-background"
                disabled={loading || saving || !canManage}
              />
              <Button variant="outline" size="icon" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button onClick={handleSaveSecret} disabled={saving || loading || secret === savedSecret || !canManage}>
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Sem este segredo, o webhook da Stripe rejeitará as notificações (validação de assinatura HMAC).
            </p>
          </div>

          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer hover:text-foreground">Como configurar (passo a passo)</summary>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Acesse <strong>Stripe Dashboard → Developers → Webhooks → Add endpoint</strong>.</li>
              <li>Cole a URL acima no campo <strong>Endpoint URL</strong>.</li>
              <li>Em <em>Select events</em>, marque: <code>checkout.session.completed</code> e <code>payment_intent.succeeded</code>.</li>
              <li>Clique em <strong>Add endpoint</strong>.</li>
              <li>Na tela do endpoint criado, clique em <strong>Reveal</strong> dentro de <em>Signing secret</em> e copie o valor (começa com <code>whsec_</code>).</li>
              <li>Cole no campo acima e clique em <strong>Salvar</strong>.</li>
            </ol>
          </details>
        </div>

        {!canManage && (
          <p className="text-xs text-muted-foreground italic">
            Você está em modo somente-leitura. Para salvar o Signing Secret ou testar os webhooks, é necessária a permissão
            <strong> "Gerenciar Webhooks de Cobrança"</strong> (admin já tem por padrão).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
