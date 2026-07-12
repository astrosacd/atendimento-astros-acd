import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, MessageCircle, Webhook, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

type LogRow = {
  id: string;
  event_type: string;
  status: string;
  channel: string | null;
  target: string | null;
  message: string | null;
  metadata: any;
  created_at: string;
};

type Settings = {
  token_expires_at: string | null;
  account_username: string | null;
  last_renewal_notification_at: string | null;
  notify_whatsapp: boolean | null;
  manager_numbers: string[] | null;
  webhook_verify_token?: string | null;
};

const EVENT_LABEL: Record<string, string> = {
  token_refresh: "Renovação de token",
  whatsapp_alert: "Notificação WhatsApp",
  test_notification: "Teste manual",
  webhook_received: "Webhook recebido",
  webhook_signature_invalid: "Webhook — assinatura inválida",
  deauthorize: "Revogação (deauth)",
  data_deletion: "Pedido de exclusão",
};

const STATUS_STYLE: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  received: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

interface Props {
  onGoToSettings?: () => void;
}

export default function InstagramHealth({ onGoToSettings }: Props) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [runningCron, setRunningCron] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [logsRes, settingsRes] = await Promise.all([
        supabase
          .from("instagram_notification_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("instagram_settings")
          .select("token_expires_at, account_username, last_renewal_notification_at, notify_whatsapp, manager_numbers, webhook_verify_token")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (logsRes.error) console.error(logsRes.error);
      if (settingsRes.error) console.error(settingsRes.error);
      setLogs((logsRes.data as LogRow[]) || []);
      setSettings((settingsRes.data as Settings) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const tokenStatus = useMemo(() => {
    if (!settings?.token_expires_at) return { label: "Não configurado", tone: "warn", days: null as number | null };
    const expiry = new Date(settings.token_expires_at);
    const now = new Date();
    const days = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
    if (isBefore(expiry, now)) return { label: `Expirado há ${Math.abs(days)}d`, tone: "danger", days };
    if (isBefore(expiry, addDays(now, 3))) return { label: `Expira em ${days}d`, tone: "danger", days };
    if (isBefore(expiry, addDays(now, 15))) return { label: `Expira em ${days}d`, tone: "warn", days };
    return { label: `Válido — ${days}d restantes`, tone: "ok", days };
  }, [settings?.token_expires_at]);

  const needsReconnect = tokenStatus.tone === "danger";

  const lastRefresh = useMemo(() => logs.find((l) => l.event_type === "token_refresh"), [logs]);
  const lastWhatsapp = useMemo(() => logs.find((l) => l.channel === "whatsapp"), [logs]);
  const lastWebhook = useMemo(() => logs.find((l) => (l.event_type || "").startsWith("webhook")), [logs]);

  const runManualCron = async () => {
    setRunningCron(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-token-auto-refresh", {
        body: { manual: true },
      });
      if (error) throw error;
      toast.success(`Cron executado — renovados: ${data?.summary?.renewed ?? 0}, falhas: ${data?.summary?.failed ?? 0}`);
      await loadAll();
    } catch (e: any) {
      toast.error("Erro ao rodar cron: " + (e?.message || e));
    } finally {
      setRunningCron(false);
    }
  };

  const toneClass = (tone: string) =>
    tone === "danger"
      ? "border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800"
      : tone === "warn"
      ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
      : "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Reconexão guiada */}
      {needsReconnect && (
        <Card className="border-red-300 bg-red-50/60 dark:bg-red-950/20 dark:border-red-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" /> Reconexão necessária
            </CardTitle>
            <CardDescription className="text-red-700/80 dark:text-red-300/80">
              {tokenStatus.days !== null && tokenStatus.days < 0
                ? `Seu Meta Access Token expirou há ${Math.abs(tokenStatus.days)} dia(s). Publicações, auto-resposta e webhooks estão parados até você gerar um token novo.`
                : `Seu Meta Access Token expira em menos de 3 dias. A renovação automática pode ter falhado — gere um token novo agora para evitar interrupção.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm text-red-900/90 dark:text-red-200/90 list-decimal list-inside">
              <li>Acesse <a className="underline font-medium" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Meta Graph API Explorer</a>.</li>
              <li>Selecione seu App e gere um <b>User Access Token</b> com os scopes: <code className="text-xs">instagram_basic</code>, <code className="text-xs">instagram_manage_insights</code>, <code className="text-xs">pages_read_engagement</code>, <code className="text-xs">business_management</code>.</li>
              <li>Troque por um <b>Long-Lived Token</b> (60 dias).</li>
              <li>Cole o token na aba <b>Configurações → Meta Access Token</b> e salve.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={() => onGoToSettings?.()}
              >
                <ShieldCheck className="h-4 w-4 mr-2" /> Ir para Configurações
              </Button>
              <Button variant="outline" onClick={runManualCron} disabled={runningCron}>
                <RefreshCw className={`h-4 w-4 mr-2 ${runningCron ? "animate-spin" : ""}`} />
                Tentar renovar agora
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de status */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className={toneClass(tokenStatus.tone)}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Clock className="h-4 w-4" /> Token Meta</CardDescription>
            <CardTitle className="text-lg">{tokenStatus.label}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {settings?.token_expires_at
              ? `Expira em ${format(new Date(settings.token_expires_at), "dd/MM/yyyy", { locale: ptBR })}`
              : "Nenhum token salvo"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Última renovação</CardDescription>
            <CardTitle className="text-lg">
              {lastRefresh
                ? formatDistanceToNow(new Date(lastRefresh.created_at), { addSuffix: true, locale: ptBR })
                : "Nunca"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground truncate">
            {lastRefresh ? `${lastRefresh.status} — ${lastRefresh.message ?? ""}` : "Aguardando primeiro ciclo (03:00 BRT)"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> WhatsApp gestores</CardDescription>
            <CardTitle className="text-lg">
              {settings?.notify_whatsapp
                ? `${settings?.manager_numbers?.length || 0} número(s)`
                : "Desativado"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground truncate">
            {lastWhatsapp
              ? `Último envio ${formatDistanceToNow(new Date(lastWhatsapp.created_at), { addSuffix: true, locale: ptBR })}`
              : "Nenhum envio registrado"}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook Meta</CardDescription>
            <CardTitle className="text-lg">
              {lastWebhook
                ? formatDistanceToNow(new Date(lastWebhook.created_at), { addSuffix: true, locale: ptBR })
                : "Sem atividade"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground truncate">
            {settings?.webhook_verify_token ? "Verify Token configurado" : "Sem Verify Token"}
          </CardContent>
        </Card>
      </div>

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Histórico de eventos</CardTitle>
            <CardDescription>Últimos 50 eventos de saúde do módulo Instagram (renovações, notificações, testes e webhooks).</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => { setRefreshing(true); await loadAll(); setRefreshing(false); }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda. Após o primeiro ciclo do cron (03:00 BRT) ou um teste manual, os registros aparecem aqui.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const ok = log.status === "success" || log.status === "sent" || log.status === "received";
                const Icon = ok ? CheckCircle2 : log.status === "expired" || log.status === "failed" ? XCircle : AlertTriangle;
                return (
                  <div key={log.id} className="flex items-start gap-3 py-3">
                    <Icon className={`h-4 w-4 mt-0.5 ${ok ? "text-emerald-600" : log.status === "failed" || log.status === "expired" ? "text-red-600" : "text-amber-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{EVENT_LABEL[log.event_type] || log.event_type}</span>
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLE[log.status] || ""}`}>{log.status}</Badge>
                        {log.channel && <span className="text-xs text-muted-foreground">via {log.channel}</span>}
                        {log.target && <span className="text-xs text-muted-foreground truncate">→ {log.target}</span>}
                      </div>
                      {log.message && <p className="text-xs text-muted-foreground mt-0.5 break-words">{log.message}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
