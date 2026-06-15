import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, Save, X, Plus, History, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/utils/invokeFunction";
import { toast } from "sonner";

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

interface Config {
  id?: string;
  is_active: boolean;
  day_of_week: number;
  schedule_hour: number;
  schedule_minute: number;
  notify_whatsapp: boolean;
  notify_email: boolean;
  whatsapp_recipients: string[];
  email_recipients: string[];
  whatsapp_instance_id: string | null;
  gmail_user: string | null;
  gmail_app_password: string | null;
  gmail_sender_name: string | null;
  send_when_empty: boolean;
  include_renewals: boolean;
  include_payments: boolean;
  last_sent_at: string | null;
}

interface WhatsAppInstance {
  id: string;
  instance_name: string;
}

interface LogRow {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  total_renewals: number;
  total_payments: number;
  total_amount_brl: number;
  is_test: boolean;
  created_at: string;
  error_message: string | null;
}

const defaultConfig: Config = {
  is_active: false,
  day_of_week: 1,
  schedule_hour: 8,
  schedule_minute: 0,
  notify_whatsapp: false,
  notify_email: false,
  whatsapp_recipients: [],
  email_recipients: [],
  whatsapp_instance_id: null,
  gmail_user: "",
  gmail_app_password: "",
  gmail_sender_name: "",
  send_when_empty: true,
  include_renewals: true,
  include_payments: true,
  last_sent_at: null,
};

export function WeeklyRenewalsReportConfig() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [newWhats, setNewWhats] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [preview, setPreview] = useState<string>("");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewCounts, setPreviewCounts] = useState<{ renewals: number; payments: number; churnRisk: number } | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [cfgRes, instRes, logsRes] = await Promise.all([
        supabase.from("weekly_renewals_report_config").select("*").limit(1).maybeSingle(),
        supabase.from("billing_whatsapp_instances").select("id, instance_name").eq("is_active", true),
        supabase.from("weekly_renewals_report_logs").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      if (cfgRes.data) setConfig({ ...defaultConfig, ...cfgRes.data });
      if (instRes.data) setInstances(instRes.data as WhatsAppInstance[]);
      if (logsRes.data) setLogs(logsRes.data as LogRow[]);
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        is_active: config.is_active,
        day_of_week: config.day_of_week,
        schedule_hour: config.schedule_hour,
        schedule_minute: config.schedule_minute,
        notify_whatsapp: config.notify_whatsapp,
        notify_email: config.notify_email,
        whatsapp_recipients: config.whatsapp_recipients,
        email_recipients: config.email_recipients,
        whatsapp_instance_id: config.whatsapp_instance_id,
        gmail_user: config.gmail_user,
        gmail_app_password: config.gmail_app_password,
        gmail_sender_name: config.gmail_sender_name,
        send_when_empty: config.send_when_empty,
        include_renewals: config.include_renewals,
        include_payments: config.include_payments,
      };

      let savedId = config.id;
      if (config.id) {
        const { error } = await supabase
          .from("weekly_renewals_report_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("weekly_renewals_report_config")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        savedId = data?.id;
        setConfig((c) => ({ ...c, id: savedId }));
      }

      // Atualiza/Desativa cron
      if (config.is_active) {
        const { error: cronErr } = await supabase.rpc("update_weekly_renewals_report_cron", {
          p_day_of_week: config.day_of_week,
          p_hour: config.schedule_hour,
          p_minute: config.schedule_minute,
        });
        if (cronErr) throw cronErr;
      } else {
        await supabase.rpc("disable_weekly_renewals_report_cron");
      }

      toast.success("Configuração salva!");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setPreview("");
    try {
      const data = await invokeFunction("weekly-renewals-report", {
        body: {
          test: true,
          overrides: {
            notify_whatsapp: config.notify_whatsapp,
            notify_email: config.notify_email,
            whatsapp_recipients: config.whatsapp_recipients,
            email_recipients: config.email_recipients,
            whatsapp_instance_id: config.whatsapp_instance_id,
            gmail_user: config.gmail_user,
            gmail_app_password: config.gmail_app_password,
            gmail_sender_name: config.gmail_sender_name,
            include_renewals: config.include_renewals,
            include_payments: config.include_payments,
            send_when_empty: true,
          },
        },
      });
      setPreview(data?.preview || "");
      const errors = (data?.results || []).filter((r: any) => r.status === "error");
      if (errors.length > 0) {
        toast.warning(`Teste concluído com ${errors.length} erro(s). Veja histórico.`);
      } else {
        toast.success("Teste enviado!");
      }
      loadAll();
    } catch (e: any) {
      toast.error("Erro no teste: " + e.message);
    } finally {
      setTesting(false);
    }
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreview("");
    setPreviewHtml("");
    setPreviewCounts(null);
    try {
      const data = await invokeFunction("weekly-renewals-report", {
        body: { preview_only: true },
      });
      setPreview(data?.preview || "");
      setPreviewHtml(data?.html || "");
      setPreviewCounts(data?.counts || null);
      toast.success("Pré-visualização gerada (nenhum envio realizado).");
    } catch (e: any) {
      toast.error("Erro ao gerar preview: " + e.message);
    } finally {
      setPreviewing(false);
    }
  }

  function addWhats() {
    const v = newWhats.replace(/\D/g, "");
    if (!v) return;
    if (config.whatsapp_recipients.includes(v)) {
      toast.error("Número já adicionado");
      return;
    }
    setConfig((c) => ({ ...c, whatsapp_recipients: [...c.whatsapp_recipients, v] }));
    setNewWhats("");
  }

  function removeWhats(n: string) {
    setConfig((c) => ({ ...c, whatsapp_recipients: c.whatsapp_recipients.filter((x) => x !== n) }));
  }

  function addEmail() {
    const v = newEmail.trim().toLowerCase();
    if (!v || !v.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    if (config.email_recipients.includes(v)) {
      toast.error("Email já adicionado");
      return;
    }
    setConfig((c) => ({ ...c, email_recipients: [...c.email_recipients, v] }));
    setNewEmail("");
  }

  function removeEmail(e: string) {
    setConfig((c) => ({ ...c, email_recipients: c.email_recipients.filter((x) => x !== e) }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>Relatório Semanal de Clientes</CardTitle>
              <CardDescription>
                Envio automático semanal com renovações de assinatura e pagamentos efetivados dos clientes, com comparativo da semana anterior.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="active-toggle" className="text-sm">Ativo</Label>
              <Switch
                id="active-toggle"
                checked={config.is_active}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, is_active: v }))}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Conteúdo do relatório */}
          <div>
            <Label className="text-sm font-semibold">Conteúdo do relatório</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Renovações de assinatura</p>
                  <p className="text-xs text-muted-foreground">Clientes que tiveram data de renovação alterada</p>
                </div>
                <Switch
                  checked={config.include_renewals}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, include_renewals: v }))}
                />
              </div>
              <div className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">Pagamentos efetivados</p>
                  <p className="text-xs text-muted-foreground">Pagamentos confirmados na semana</p>
                </div>
                <Switch
                  checked={config.include_payments}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, include_payments: v }))}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Agendamento */}
          <div>
            <Label className="text-sm font-semibold">Agendamento (horário de Brasília)</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Dia da semana</Label>
                <Select
                  value={String(config.day_of_week)}
                  onValueChange={(v) => setConfig((c) => ({ ...c, day_of_week: Number(v) }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Hora (0-23)</Label>
                <Input
                  type="number" min={0} max={23}
                  value={config.schedule_hour}
                  onChange={(e) => setConfig((c) => ({ ...c, schedule_hour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Minuto (0-59)</Label>
                <Input
                  type="number" min={0} max={59}
                  value={config.schedule_minute}
                  onChange={(e) => setConfig((c) => ({ ...c, schedule_minute: Math.min(59, Math.max(0, Number(e.target.value) || 0)) }))}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium">Enviar mesmo sem renovações</p>
                <p className="text-xs text-muted-foreground">Manda relatório com "0 renovações" quando a semana não tiver movimentação</p>
              </div>
              <Switch
                checked={config.send_when_empty}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, send_when_empty: v }))}
              />
            </div>
          </div>

          <Separator />

          {/* WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">📱 WhatsApp</Label>
              <Switch
                checked={config.notify_whatsapp}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, notify_whatsapp: v }))}
              />
            </div>
            {config.notify_whatsapp && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/30">
                <div>
                  <Label className="text-xs text-muted-foreground">Instância (opcional, usa primeira ativa se vazio)</Label>
                  <Select
                    value={config.whatsapp_instance_id || "auto"}
                    onValueChange={(v) => setConfig((c) => ({ ...c, whatsapp_instance_id: v === "auto" ? null : v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automática</SelectItem>
                      {instances.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Destinatários (com DDI+DDD)</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="5511999999999"
                      value={newWhats}
                      onChange={(e) => setNewWhats(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addWhats())}
                    />
                    <Button type="button" variant="outline" onClick={addWhats}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {config.whatsapp_recipients.map((n) => (
                      <Badge key={n} variant="secondary" className="gap-1">
                        {n}
                        <button onClick={() => removeWhats(n)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Email */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-semibold">✉️ Email</Label>
              <Switch
                checked={config.notify_email}
                onCheckedChange={(v) => setConfig((c) => ({ ...c, notify_email: v }))}
              />
            </div>
            {config.notify_email && (
              <div className="space-y-3 pl-2 border-l-2 border-primary/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Gmail (remetente)</Label>
                    <Input
                      placeholder="seu@gmail.com"
                      value={config.gmail_user || ""}
                      onChange={(e) => setConfig((c) => ({ ...c, gmail_user: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Senha de App</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={config.gmail_app_password || ""}
                      onChange={(e) => setConfig((c) => ({ ...c, gmail_app_password: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Nome do remetente</Label>
                  <Input
                    placeholder="Relatório Semanal"
                    value={config.gmail_sender_name || ""}
                    onChange={(e) => setConfig((c) => ({ ...c, gmail_sender_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Destinatários</Label>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="financeiro@empresa.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEmail())}
                    />
                    <Button type="button" variant="outline" onClick={addEmail}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {config.email_recipients.map((e) => (
                      <Badge key={e} variant="secondary" className="gap-1">
                        {e}
                        <button onClick={() => removeEmail(e)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar configuração
            </Button>
            <Button onClick={handlePreview} disabled={previewing} variant="secondary" className="flex-1">
              {previewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
              Ver relatório agora
            </Button>
            <Button onClick={handleTest} disabled={testing} variant="outline" className="flex-1">
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar teste agora
            </Button>
          </div>

          {config.last_sent_at && (
            <p className="text-xs text-muted-foreground">
              Último envio: {new Date(config.last_sent_at).toLocaleString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span>Pré-visualização do relatório</span>
              {previewCounts && (
                <span className="text-xs font-normal text-muted-foreground">
                  {previewCounts.renewals} renovação(ões) · {previewCounts.payments} pagamento(s) · {previewCounts.churnRisk} churn
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewHtml && (
              <div
                className="rounded-md border bg-white overflow-auto max-h-[500px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
            <details>
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                Ver versão em texto (igual à mensagem do WhatsApp)
              </summary>
              <Textarea readOnly value={preview} className="font-mono text-xs min-h-[300px] mt-2" />
            </details>
          </CardContent>
        </Card>
      )}


      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" />
            Histórico de envios (últimos 20)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between text-sm border rounded-lg p-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={log.status === "sent" ? "default" : "destructive"} className="shrink-0">
                      {log.status}
                    </Badge>
                    <span className="font-mono text-xs truncate">{log.channel} → {log.recipient}</span>
                    {log.is_test && <Badge variant="outline" className="shrink-0">teste</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0 ml-2">
                    {log.total_renewals}R / {log.total_payments}P · {new Date(log.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
