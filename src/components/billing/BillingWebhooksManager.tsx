import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { copyToClipboard } from "@/utils/clipboard";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import {
  Copy, Webhook, CheckCircle2, AlertTriangle, ExternalLink, Save, Loader2,
  Eye, EyeOff, Info, PlugZap, XCircle, RefreshCw, History, Trash2, Search,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const MP_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/client-payment-mp-webhook`;
const STRIPE_WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/client-payment-stripe-webhook`;
const LOG_PAGE_SIZE = 100;

// Snippet pronto pro nó HTTP Request do n8n espelhar o evento do MP
const N8N_MP_CURL = `curl -X POST '${MP_WEBHOOK_URL}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "type": "payment",
    "data": { "id": "{{ $(\\'Obter detalhes pagamento\\').item.json.id }}" }
  }'`;

type TestResult = { ok: boolean; message: string; raw?: any } | null;

type WebhookLog = {
  id: string;
  provider: "mercadopago" | "stripe";
  event_type: string | null;
  external_id: string | null;
  http_status: number | null;
  result: string;
  message: string | null;
  is_test: boolean;
  created_at: string;
};

type OrphanPayment = {
  id: string;
  cliente_nome: string | null;
  payment_id: string;
  payment_type: string;
  amount: number;
  status: string;
  billing_date: string;
  created_at: string;
  reason: string;
};

export function BillingWebhooksManager() {
  const { canManageCobrancaWebhooks, canCleanupCobrancaOrphanPayments } = usePermissions();
  const canManage = canManageCobrancaWebhooks();
  const canCleanup = canCleanupCobrancaOrphanPayments();

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

  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logProvider, setLogProvider] = useState<"all" | "mercadopago" | "stripe">("all");
  const [logPage, setLogPage] = useState(1);
  const [logTotal, setLogTotal] = useState(0);

  const [orphanPayments, setOrphanPayments] = useState<OrphanPayment[]>([]);
  const [loadingOrphans, setLoadingOrphans] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);

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

  const loadLogs = async (page = logPage, provider = logProvider) => {
    setLoadingLogs(true);
    const from = (page - 1) * LOG_PAGE_SIZE;
    const to = from + LOG_PAGE_SIZE - 1;
    let query = supabase
      .from("billing_webhook_logs" as any)
      .select("id, provider, event_type, external_id, http_status, result, message, is_test, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (provider !== "all") query = query.eq("provider", provider);
    const { data, error, count } = await query;
    if (!error && data) setLogs(data as any);
    setLogTotal(count || 0);
    setLoadingLogs(false);
  };

  useEffect(() => { load(); loadLogs(); }, []);
  useEffect(() => { loadLogs(logPage, logProvider); }, [logPage, logProvider]);

  const previewOrphans = async () => {
    if (!canCleanup) return;
    setLoadingOrphans(true);
    const { data, error } = await supabase.rpc("preview_cobranca_orphan_payments" as any, { p_days_old: 30 });
    setLoadingOrphans(false);
    if (error) return toast.error("Erro ao buscar órfãos: " + error.message);
    setOrphanPayments((data || []) as any);
    toast.info(`${data?.length || 0} pagamento(s) órfão(s) encontrado(s)`);
  };

  const cleanupOrphans = async () => {
    if (!canCleanup) return;
    const confirmed = window.confirm(
      `Excluir ${orphanPayments.length} pagamento(s) órfão(s)? Apenas registros sem quitação serão removidos.`,
    );
    if (!confirmed) return;
    setCleaningOrphans(true);
    const { data, error } = await supabase.rpc("cleanup_cobranca_orphan_payments" as any, { p_days_old: 30 });
    setCleaningOrphans(false);
    if (error) return toast.error("Erro ao limpar órfãos: " + error.message);
    toast.success(`${Number((data as any)?.deleted || 0)} pagamento(s) órfão(s) excluído(s)`);
    setOrphanPayments([]);
  };

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) toast.success(`${label} copiada`);
    else toast.error("Não foi possível copiar");
  };

  // Abre em nova aba contornando o iframe da preview (resolve ERR_BLOCKED_BY_RESPONSE)
  const openExternal = (url: string) => {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      // popup bloqueado — copia URL como fallback
      copyToClipboard(url);
      toast.info("Popup bloqueado — URL copiada. Cole numa nova aba do navegador.");
    }
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
        headers: { "Content-Type": "application/json", "x-webhook-test": "ping" },
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
        toast.error(`Webhook ${providerLabel}: pendência detectada`);
      }
    } catch (e: any) {
      setResult({ ok: false, message: e?.message || "Falha de rede" });
      toast.error(`Erro ao chamar webhook: ${e?.message || ""}`);
    } finally {
      setBusy(false);
      loadLogs();
    }
  };

  const mpConfigured = true;
  const stripeConfigured = !!savedSecret;
  const totalLogPages = Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE));

  return (
    <div className="space-y-4">
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
            <Button
              variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => openExternal("https://www.mercadopago.com.br/developers/panel/app")}
            >
              Abrir painel MP <ExternalLink className="w-3 h-3" />
            </Button>
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
                (Link de Pagamento), <strong>NÃO troque a URL</strong>. Em vez disso, faça o n8n "espelhar" o evento
                também para este endpoint. Copie o cURL abaixo e cole num nó <strong>HTTP Request</strong> em paralelo
                ao nó que chama <code>payment-link-webhook</code>:
              </p>
              <div className="relative">
                <pre className="mt-1 bg-background border rounded p-2 overflow-x-auto pr-10 text-[11px] leading-relaxed">{N8N_MP_CURL}</pre>
                <Button
                  size="icon" variant="ghost"
                  className="absolute top-1 right-1 h-7 w-7"
                  onClick={() => handleCopy(N8N_MP_CURL, "cURL")}
                >
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p>
                No n8n, configure o nó assim: <strong>Method</strong> POST · <strong>URL</strong> <code className="break-all">{MP_WEBHOOK_URL}</code> ·
                <strong> Body</strong> JSON com <code>{`{ "type": "payment", "data": { "id": "{{ $('Obter detalhes pagamento').item.json.id }} " } }`}</code>.
              </p>
              <p>
                Este endpoint busca o pagamento na API do MP por conta própria (anti-spoof), então funciona igual recebendo
                via n8n ou direto do MP.
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
            <Button
              variant="ghost" size="sm" className="h-7 text-xs gap-1"
              onClick={() => openExternal("https://dashboard.stripe.com/webhooks")}
            >
              Abrir painel Stripe <ExternalLink className="w-3 h-3" />
            </Button>
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

    {/* LOGS */}
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-muted-foreground" />
          Limpeza de Pagamentos Órfãos
        </CardTitle>
        <CardDescription className="text-xs">
          Remove somente cobranças sem quitação, antigas/canceladas/rejeitadas ou com ID sintético sem vínculo real no gateway.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={previewOrphans} disabled={loadingOrphans || !canCleanup}>
            {loadingOrphans ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Verificar órfãos
          </Button>
          <Button variant="destructive" size="sm" onClick={cleanupOrphans} disabled={cleaningOrphans || orphanPayments.length === 0 || !canCleanup}>
            {cleaningOrphans ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Excluir encontrados ({orphanPayments.length})
          </Button>
        </div>
        {!canCleanup && <p className="text-xs text-muted-foreground italic">Sem permissão para limpar pagamentos órfãos.</p>}
        {orphanPayments.length > 0 && (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Cliente</TableHead><TableHead className="text-xs">Tipo</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Motivo</TableHead></TableRow></TableHeader>
              <TableBody>
                {orphanPayments.slice(0, 10).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs">{p.cliente_nome || "Sem cliente"}</TableCell>
                    <TableCell className="text-xs font-mono">{p.payment_type}</TableCell>
                    <TableCell className="text-xs">{p.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>

    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Histórico de Webhooks
            </CardTitle>
            <CardDescription className="text-xs">
              {logTotal} chamada(s) encontrada(s). Logs acima de 90 dias são apagados automaticamente.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={logProvider} onValueChange={(v: any) => { setLogPage(1); setLogProvider(v); }}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => loadLogs()} disabled={loadingLogs}>
              <RefreshCw className={`w-4 h-4 ${loadingLogs ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">
            Nenhum log ainda. Clique em "Testar webhook" acima para gerar a primeira entrada.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Quando</TableHead>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs">Evento</TableHead>
                  <TableHead className="text-xs">Resultado</TableHead>
                  <TableHead className="text-xs">HTTP</TableHead>
                  <TableHead className="text-xs">Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(l => {
                  const ok = ["ok", "paid", "received", "already_paid"].includes(l.result);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs font-mono">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className={l.provider === "stripe" ? "border-[#635bff]/40 text-[#635bff]" : "border-[#00b1ea]/40 text-[#00b1ea]"}>
                          {l.provider === "stripe" ? "Stripe" : "Mercado Pago"}
                        </Badge>
                        {l.is_test && <Badge variant="secondary" className="ml-1 text-[10px]">teste</Badge>}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{l.event_type || "-"}</TableCell>
                      <TableCell className="text-xs">
                        <span className={`inline-flex items-center gap-1 ${ok ? "text-emerald-500" : "text-red-500"}`}>
                          {ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {l.result}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{l.http_status ?? "-"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate" title={l.message || ""}>
                        {l.message || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {logTotal > LOG_PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Button variant="outline" size="sm" disabled={logPage <= 1 || loadingLogs} onClick={() => setLogPage(p => Math.max(1, p - 1))}>Anterior</Button>
            <span>Página {logPage} de {totalLogPages}</span>
            <Button variant="outline" size="sm" disabled={logPage >= totalLogPages || loadingLogs} onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}>Próxima</Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
