import { useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, RefreshCw, Trash2, Plus, FileText, Eye, Send, Copy, Download, Loader2, Beaker, CheckCircle2, XCircle, Settings as SettingsIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  useSocialProfiles, useSocialReports, useSocialReportConfig,
  useSaveProfile, useDeleteProfile, useSyncProfile,
  useGenerateReport, useSendReport, useTestCredentials, useSaveReportConfig,
  type SocialProfile,
} from "@/hooks/useSocialMediaReports";
import { copyToClipboard } from "@/utils/clipboard";
import { useSiteUrl } from "@/hooks/useSiteUrl";

function fmtNum(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR");
}

function currentMonthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function InstagramClientReports() {
  const [tab, setTab] = useState("profiles");

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="profiles" className="gap-2"><Users className="h-4 w-4" /> Perfis Monitorados</TabsTrigger>
        <TabsTrigger value="reports" className="gap-2"><FileText className="h-4 w-4" /> Relatórios</TabsTrigger>
        <TabsTrigger value="config" className="gap-2"><SettingsIcon className="h-4 w-4" /> Configurações</TabsTrigger>
      </TabsList>
      <TabsContent value="profiles" className="mt-4"><ProfilesTab /></TabsContent>
      <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
      <TabsContent value="config" className="mt-4"><ConfigTab /></TabsContent>
    </Tabs>
  );
}

/* ============================================
   TAB 1 — Perfis Monitorados
   ============================================ */
function ProfilesTab() {
  const { data: profiles = [], isLoading } = useSocialProfiles();
  const save = useSaveProfile();
  const del = useDeleteProfile();
  const sync = useSyncProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SocialProfile | null>(null);

  const empty: Partial<SocialProfile> = {
    username: "", display_name: "", is_active: true,
    notify_whatsapp: false, notify_email: false,
    whatsapp_number: "", email: "", report_day: 1, auto_send_enabled: false,
  };
  const [form, setForm] = useState<Partial<SocialProfile>>(empty);

  function openNew() { setEditing(null); setForm(empty); setDialogOpen(true); }
  function openEdit(p: SocialProfile) { setEditing(p); setForm(p); setDialogOpen(true); }

  async function handleSave() {
    if (!form.username) { toast.error("Username é obrigatório"); return; }
    const clean = { ...form, username: form.username.replace(/^@/, "").trim() };
    await save.mutateAsync(clean);
    setDialogOpen(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Perfis Monitorados</CardTitle>
          <CardDescription>Perfis dos seus clientes para gerar relatórios mensais</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => sync.mutate({ sync_all: true })} disabled={sync.isPending}>
            {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Sincronizar todos</span>
          </Button>
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Adicionar perfil</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum perfil cadastrado. Adicione o @ do seu cliente para começar a coletar dados.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/40 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-10 w-10">
                    {p.profile_picture_url && <AvatarImage src={p.profile_picture_url} alt={p.username} />}
                    <AvatarFallback>{p.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">@{p.username}</span>
                      {!p.is_active && <Badge variant="secondary">Inativo</Badge>}
                      {p.last_sync_status === "error" && <Badge variant="destructive" className="text-[10px]">Sync erro</Badge>}
                      {p.auto_send_enabled && <Badge className="text-[10px] bg-emerald-600">Envio auto dia {p.report_day}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.display_name || "—"} · {fmtNum(p.followers_count)} seguidores · {p.last_synced_at ? `sync ${format(new Date(p.last_synced_at), "dd/MM HH:mm")}` : "nunca sincronizado"}
                    </div>
                    {p.last_sync_error && (
                      <p className="text-[10px] text-destructive mt-1 truncate">{p.last_sync_error}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" title="Sincronizar agora" onClick={() => sync.mutate({ profile_id: p.id })} disabled={sync.isPending}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(p)}>
                    <SettingsIcon className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Excluir" className="text-destructive" onClick={() => { if (confirm(`Excluir @${p.username}?`)) del.mutate(p.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar perfil" : "Adicionar perfil"}</DialogTitle>
              <DialogDescription>O perfil precisa ser Business/Creator público no Instagram.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>@username *</Label>
                  <Input value={form.username || ""} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="cliente_ig" />
                </div>
                <div>
                  <Label>Nome de exibição</Label>
                  <Input value={form.display_name || ""} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Loja do Cliente" />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Perfil ativo</p>
                  <p className="text-xs text-muted-foreground">Inativo = não sincroniza nem envia</p>
                </div>
                <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-semibold">Envio automático do relatório</p>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Enviar automaticamente todo mês</Label>
                  <Switch checked={!!form.auto_send_enabled} onCheckedChange={(v) => setForm({ ...form, auto_send_enabled: v })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dia do envio (1-28)</Label>
                    <Input type="number" min={1} max={28} value={form.report_day ?? 1} onChange={(e) => setForm({ ...form, report_day: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">WhatsApp</Label>
                      <Switch checked={!!form.notify_whatsapp} onCheckedChange={(v) => setForm({ ...form, notify_whatsapp: v })} />
                    </div>
                    <Input placeholder="5511..." value={form.whatsapp_number || ""} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} disabled={!form.notify_whatsapp} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Email</Label>
                      <Switch checked={!!form.notify_email} onCheckedChange={(v) => setForm({ ...form, notify_email: v })} />
                    </div>
                    <Input type="email" placeholder="cliente@..." value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!form.notify_email} />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={save.isPending}>
                {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/* ============================================
   TAB 2 — Relatórios
   ============================================ */
function ReportsTab() {
  const { data: profiles = [] } = useSocialProfiles();
  const [selProfile, setSelProfile] = useState<string>("");
  const { data: reports = [], isLoading } = useSocialReports(selProfile || undefined);
  const gen = useGenerateReport();
  const send = useSendReport();
  const siteUrl = useSiteUrl();

  const [month, setMonth] = useState(currentMonthStr(-1));

  const profileMap = useMemo(() => Object.fromEntries(profiles.map(p => [p.id, p])), [profiles]);

  async function handleGenerate() {
    if (!selProfile) { toast.error("Selecione um perfil"); return; }
    await gen.mutateAsync({ profile_id: selProfile, month });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relatórios Mensais</CardTitle>
        <CardDescription>Gere e envie relatórios consolidados para seus clientes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-3 rounded-md border bg-muted/40">
          <div className="md:col-span-2">
            <Label className="text-xs">Perfil</Label>
            <select className="flex h-10 w-full rounded-md border bg-background px-3 text-sm" value={selProfile} onChange={(e) => setSelProfile(e.target.value)}>
              <option value="">— Todos os perfis —</option>
              {profiles.map(p => <option key={p.id} value={p.id}>@{p.username}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Mês</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} disabled={gen.isPending || !selProfile}>
            {gen.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Gerar relatório
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum relatório gerado ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map(r => {
              const prof = profileMap[r.profile_id];
              const d = r.data || {};
              const link = `${siteUrl}/r/social/${r.share_token}`;
              return (
                <div key={r.id} className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">@{prof?.username || "?"}</span>
                      <Badge variant="outline">{r.month}</Badge>
                      {r.sent_whatsapp_at && <Badge className="text-[10px] bg-emerald-600">WhatsApp ✓</Badge>}
                      {r.sent_email_at && <Badge className="text-[10px] bg-blue-600">Email ✓</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Seguidores: {fmtNum(d.followers?.start)} → {fmtNum(d.followers?.end)} ({d.followers?.gain != null ? (d.followers.gain >= 0 ? "+" : "") + d.followers.gain : "—"}) ·
                      Posts: {d.posts?.total ?? 0} · Engajamento: {fmtNum(d.engagement?.total)}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Gerado em {format(new Date(r.generated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => window.open(link, "_blank")}><Eye className="h-3.5 w-3.5 mr-1" />Ver</Button>
                    <Button size="sm" variant="outline" onClick={() => { copyToClipboard(link); toast.success("Link copiado!"); }}><Copy className="h-3.5 w-3.5 mr-1" />Link</Button>
                    {r.pdf_url && (
                      <Button size="sm" variant="outline" onClick={() => window.open(r.pdf_url!, "_blank")}><Download className="h-3.5 w-3.5 mr-1" />PDF</Button>
                    )}
                    <Button size="sm" onClick={() => send.mutate({ report_id: r.id })} disabled={send.isPending}>
                      {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================
   TAB 3 — Configurações
   ============================================ */
function ConfigTab() {
  const { data: cfg, isLoading } = useSocialReportConfig();
  const save = useSaveReportConfig();
  const test = useTestCredentials();

  const [form, setForm] = useState<any>({});
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  // Hidrata quando carregar
  useMemo(() => { if (cfg && Object.keys(form).length === 0) setForm(cfg); }, [cfg]);

  async function handleSave() {
    await save.mutateAsync(form);
  }
  async function handleTest() {
    setTestResult(null);
    const r = await test.mutateAsync({ test_phone: testPhone || undefined, test_email: testEmail || undefined });
    setTestResult(r);
  }

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (Evolution API)</CardTitle>
          <CardDescription>Usa as instâncias já cadastradas no CRM. Se vazio, usa a primeira instância ativa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>ID da instância Evolution (opcional)</Label>
            <Input value={form.evolution_instance_id || ""} onChange={(e) => setForm({ ...form, evolution_instance_id: e.target.value || null })} placeholder="UUID da instância (deixe vazio para usar a padrão)" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email (Gmail / SMTP)</CardTitle>
          <CardDescription>Para Gmail, use uma "Senha de app" gerada nas configurações de segurança da conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From (email remetente)</Label>
              <Input type="email" value={form.email_from || ""} onChange={(e) => setForm({ ...form, email_from: e.target.value })} placeholder="seu@gmail.com" />
            </div>
            <div>
              <Label>Nome do remetente</Label>
              <Input value={form.email_from_name || ""} onChange={(e) => setForm({ ...form, email_from_name: e.target.value })} placeholder="Sua Agência" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SMTP host</Label>
              <Input value={form.email_smtp_host || ""} onChange={(e) => setForm({ ...form, email_smtp_host: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <div>
              <Label>SMTP port</Label>
              <Input type="number" value={form.email_smtp_port || 465} onChange={(e) => setForm({ ...form, email_smtp_port: parseInt(e.target.value) || 465 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>SMTP usuário</Label>
              <Input value={form.email_smtp_user || ""} onChange={(e) => setForm({ ...form, email_smtp_user: e.target.value })} placeholder="seu@gmail.com" />
            </div>
            <div>
              <Label>SMTP senha (app password)</Label>
              <Input type="password" value={form.email_smtp_pass || ""} onChange={(e) => setForm({ ...form, email_smtp_pass: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cron de envio automático</CardTitle>
          <CardDescription>Quando ativado, perfis com "envio automático" enviam relatório no dia configurado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Envio automático mensal</p>
              <p className="text-xs text-muted-foreground">O cron roda diariamente e dispara quem bate o dia configurado</p>
            </div>
            <Switch checked={!!form.auto_send_enabled} onCheckedChange={(v) => setForm({ ...form, auto_send_enabled: v })} />
          </div>
          <div>
            <Label>Hora do envio (0-23 UTC)</Label>
            <Input type="number" min={0} max={23} value={form.send_hour ?? 11} onChange={(e) => setForm({ ...form, send_hour: parseInt(e.target.value) || 11 })} />
            <p className="text-[10px] text-muted-foreground mt-1">Default: 11h UTC (~8h Brasília). O cron checa de hora em hora.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar configurações
        </Button>
      </div>

      <Card className="border-amber-300 dark:border-amber-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Beaker className="h-5 w-5 text-amber-600" /> Botão TESTE</CardTitle>
          <CardDescription>Dispara mensagem teste no WhatsApp e Email + valida Graph API. Use antes de ativar envio automático.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">WhatsApp de teste</Label>
              <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5511..." />
            </div>
            <div>
              <Label className="text-xs">Email de teste</Label>
              <Input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="voce@..." />
            </div>
          </div>
          <Button onClick={handleTest} disabled={test.isPending} variant="outline" className="w-full">
            {test.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Beaker className="h-4 w-4 mr-2" />}
            Testar tudo agora
          </Button>

          {testResult && (
            <div className="space-y-2 pt-2">
              <TestRow label="Graph API (Instagram)" result={testResult.graph_api} />
              <TestRow label="WhatsApp (Evolution)" result={testResult.whatsapp} />
              <TestRow label="Email (SMTP)" result={testResult.email} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TestRow({ label, result }: { label: string; result: any }) {
  if (!result) return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded border border-dashed">
      <span>{label}: não testado</span>
    </div>
  );
  return (
    <div className={`flex items-start gap-2 text-sm p-2 rounded border ${result.success ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20" : "border-red-300 bg-red-50 dark:bg-red-950/20"}`}>
      {result.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" /> : <XCircle className="h-4 w-4 text-red-600 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}: {result.success ? "OK" : "FALHOU"}</p>
        {result.error && <p className="text-xs text-red-700 dark:text-red-300 break-all">{result.error}</p>}
        {result.username && <p className="text-xs text-muted-foreground">Conectado como @{result.username}</p>}
      </div>
    </div>
  );
}
