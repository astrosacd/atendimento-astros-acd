import React, { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { Phone, Plus, Play, Trash2, Loader2, PhoneCall, PhoneOff, History, Settings as SettingsIcon, FileText, Sparkles, AlertCircle, RefreshCw, CheckCircle2, Link as LinkIcon, Copy, Clock, Check, X } from "lucide-react";
import { format, subDays, startOfDay, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LigarComIADialog } from "@/components/LigarComIADialog";
import { User } from "lucide-react";
import { placeCallWithTTS, type ActiveCallHandle } from "@/lib/wavoipCall";
import { CobrancaConfigTab } from "@/components/ligacoes-ia/CobrancaConfigTab";
import { FilaLigacoesTab } from "@/components/ligacoes-ia/FilaLigacoesTab";
import { CampanhasLigacoesTab } from "@/components/ligacoes-ia/CampanhasLigacoesTab";
import { ListChecks, CalendarClock, Megaphone } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useSiteUrl } from "@/hooks/useSiteUrl";
import { copyToClipboard } from "@/utils/clipboard";

const CATEGORIAS = [
  { value: "cobranca", label: "Cobrança" },
  { value: "promocao", label: "Promoção" },
  { value: "renovacao", label: "Renovação" },
  { value: "recuperacao", label: "Recuperação" },
  { value: "boas_vindas", label: "Boas-vindas" },
  { value: "geral", label: "Geral" },
];

const STATUS_COLOR: Record<string, string> = {
  iniciando: "bg-slate-500",
  discando: "bg-blue-500",
  tocando: "bg-cyan-500",
  atendida: "bg-emerald-500",
  finalizada: "bg-emerald-600",
  nao_atendeu: "bg-amber-500",
  ocupado: "bg-orange-500",
  rejeitada: "bg-rose-500",
  erro: "bg-destructive",
};

const CATEGORY_LABEL: Record<string, string> = {
  premade: "Pré-feita",
  professional: "Profissional",
  cloned: "Clonada",
  generated: "Gerada",
};

const LIGACOES_PERMISSION_OPTIONS = [
  { id: "historico", label: "Histórico" },
  { id: "fila", label: "Fila do dia" },
  { id: "roteiros", label: "Roteiros" },
  { id: "disparo", label: "Disparo" },
  { id: "campanhas", label: "Campanhas" },
  { id: "cobranca", label: "Cobrança" },
  { id: "config", label: "Configurações" },
];

const LIGACOES_TARGET_PATH = "/ligacoes-ia";

export default function LigacoesIA() {
  const { canManageTemporaryAccess } = usePermissions();
  const siteUrl = useSiteUrl();

  const isTempAccess = !!sessionStorage.getItem("temp_access_token");
  const [tempPerms, setTempPerms] = useState<string[] | null>(null);
  const [tempLoading, setTempLoading] = useState(isTempAccess);

  useEffect(() => {
    if (!isTempAccess) { setTempLoading(false); return; }
    const load = async () => {
      const token = sessionStorage.getItem("temp_access_token");
      if (!token) { setTempPerms(null); setTempLoading(false); return; }
      const { data } = await supabase
        .from("temporary_access_tokens")
        .select("permissions")
        .eq("token", token)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      setTempPerms(((data?.permissions as string[]) ?? []));
      setTempLoading(false);
    };
    load();
    const itv = window.setInterval(load, 2000);
    window.addEventListener("focus", load);
    return () => { window.clearInterval(itv); window.removeEventListener("focus", load); };
  }, [isTempAccess]);

  const tabAllowed = (id: string) => !isTempAccess || (tempPerms ?? []).includes(id);

  const [configStatus, setConfigStatus] = useState<{ wavoip: boolean; eleven: boolean; dialer: boolean } | null>(null);

  const refreshStatus = async () => {
    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", ["wavoip_token", "wavoip_dialer_number", "elevenlabs_api_key"]);
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    setConfigStatus({
      wavoip: !!map.wavoip_token,
      dialer: !!map.wavoip_dialer_number,
      eleven: !!map.elevenlabs_api_key,
    });
  };
  useEffect(() => { refreshStatus(); }, []);

  const allOk = configStatus?.wavoip && configStatus?.dialer && configStatus?.eleven;
  const allowedTabs = LIGACOES_PERMISSION_OPTIONS.map(p => p.id).filter(tabAllowed);
  const defaultTab = isTempAccess ? (allowedTabs[0] ?? "historico") : "historico";

  const Wrapper = React.useMemo(() => {
    return ({ children }: { children: React.ReactNode }) =>
      isTempAccess ? (
        <div className="min-h-screen bg-background">
          <div className="border-b bg-card/50 backdrop-blur">
            <div className="container mx-auto max-w-7xl flex items-center justify-between px-6 py-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="h-5 w-5 text-fuchsia-500" />
                <span className="font-semibold">Ligações IA</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                <Clock className="h-3 w-3" /> Acesso Provisório
              </span>
            </div>
          </div>
          {children}
        </div>
      ) : (
        <DashboardLayout>{children}</DashboardLayout>
      );
  }, [isTempAccess]);

  if (isTempAccess && tempLoading) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando permissões...</p>
        </div>
      </Wrapper>
    );
  }

  if (isTempAccess && allowedTabs.length === 0) {
    return (
      <Wrapper>
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-3">
          <X className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground">Este link não tem nenhuma permissão habilitada.</p>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <div className="container max-w-7xl py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg">
              <PhoneCall className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                Ligações IA <Sparkles className="h-5 w-5 text-amber-400" />
              </h1>
              <p className="text-sm text-muted-foreground">
                Ligações automáticas via WhatsApp (Wavoip) com voz natural (ElevenLabs)
              </p>
            </div>
          </div>

          {!isTempAccess && canManageTemporaryAccess() && (
            <AcessoProvisorioButton siteUrl={siteUrl} />
          )}
        </div>

        {!isTempAccess && configStatus && !allOk && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="flex-1 text-sm">
              <p className="font-medium">Configuração incompleta — as ligações não funcionarão</p>
              <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                {!configStatus.wavoip && <li>Token Wavoip ausente</li>}
                {!configStatus.dialer && <li>Número discador (WhatsApp Business) ausente</li>}
                {!configStatus.eleven && <li>API Key ElevenLabs ausente</li>}
              </ul>
              <p className="text-xs mt-1">Vá para a aba <strong>Configurações</strong> abaixo.</p>
            </div>
          </div>
        )}

        {!isTempAccess && configStatus && allOk && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Configuração completa — pronto para fazer ligações.</span>
          </div>
        )}

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="flex flex-wrap w-full max-w-5xl h-auto">
            {tabAllowed("historico") && <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" />Histórico</TabsTrigger>}
            {tabAllowed("fila") && <TabsTrigger value="fila"><ListChecks className="h-4 w-4 mr-2" />Fila do dia</TabsTrigger>}
            {tabAllowed("roteiros") && <TabsTrigger value="roteiros"><FileText className="h-4 w-4 mr-2" />Roteiros</TabsTrigger>}
            {tabAllowed("disparo") && <TabsTrigger value="disparo"><Phone className="h-4 w-4 mr-2" />Disparo</TabsTrigger>}
            {tabAllowed("campanhas") && <TabsTrigger value="campanhas"><Megaphone className="h-4 w-4 mr-2" />Campanhas</TabsTrigger>}
            {tabAllowed("cobranca") && <TabsTrigger value="cobranca"><CalendarClock className="h-4 w-4 mr-2" />Cobrança</TabsTrigger>}
            {tabAllowed("config") && <TabsTrigger value="config"><SettingsIcon className="h-4 w-4 mr-2" />Configurações</TabsTrigger>}
          </TabsList>

          {tabAllowed("historico") && <TabsContent value="historico"><HistoricoTab /></TabsContent>}
          {tabAllowed("fila") && <TabsContent value="fila"><FilaLigacoesTab /></TabsContent>}
          {tabAllowed("roteiros") && <TabsContent value="roteiros"><RoteirosTab /></TabsContent>}
          {tabAllowed("disparo") && <TabsContent value="disparo"><DisparoTab /></TabsContent>}
          {tabAllowed("campanhas") && <TabsContent value="campanhas"><CampanhasLigacoesTab /></TabsContent>}
          {tabAllowed("cobranca") && <TabsContent value="cobranca"><CobrancaConfigTab /></TabsContent>}
          {tabAllowed("config") && <TabsContent value="config"><ConfigTab onSaved={refreshStatus} /></TabsContent>}
        </Tabs>
      </div>
    </Wrapper>
  );
}

// ============ ACESSO PROVISÓRIO ============
function AcessoProvisorioButton({ siteUrl }: { siteUrl: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"initial" | "success">("initial");
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [tokens, setTokens] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [form, setForm] = useState({
    duration: "4",
    max_uses: "1",
    permissions: ["fila", "historico"] as string[],
  });

  const fetchTokens = async () => {
    const { data } = await supabase
      .from("temporary_access_tokens")
      .select("*")
      .eq("target_path", LIGACOES_TARGET_PATH)
      .order("created_at", { ascending: false });
    setTokens(data ?? []);
  };

  useEffect(() => { if (open) fetchTokens(); }, [open]);

  const createLink = async () => {
    if (form.permissions.length === 0) {
      sonnerToast.error("Escolha ao menos uma permissão.");
      return;
    }
    setLoading(true);
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const expiresAt = addHours(new Date(), parseInt(form.duration)).toISOString();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("temporary_access_tokens").insert({
        created_by: user?.id,
        token,
        target_path: LIGACOES_TARGET_PATH,
        expires_at: expiresAt,
        max_uses: parseInt(form.max_uses),
        permissions: form.permissions,
      });
      if (error) throw error;
      setGeneratedLink(`${siteUrl}/access/${token}`);
      setStep("success");
      fetchTokens();
    } catch (e: any) {
      sonnerToast.error("Erro ao criar link: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteToken = async (id: string) => {
    const { error } = await supabase.from("temporary_access_tokens").delete().eq("id", id);
    if (error) sonnerToast.error("Erro ao excluir");
    else { sonnerToast.success("Link excluído"); fetchTokens(); }
  };

  const copyLink = (t: string) => {
    copyToClipboard(`${siteUrl}/access/${t}`);
    sonnerToast.success("Link copiado!");
  };

  const updatePerms = async () => {
    if (!editing) return;
    const { error } = await supabase
      .from("temporary_access_tokens")
      .update({ permissions: editPerms })
      .eq("id", editing.id);
    if (error) sonnerToast.error("Erro ao salvar");
    else { sonnerToast.success("Permissões atualizadas"); setEditing(null); fetchTokens(); }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setTimeout(() => setStep("initial"), 300); }}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <LinkIcon className="h-4 w-4" /> Acesso Provisório
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          {step === "initial" ? (
            <>
              <DialogHeader>
                <DialogTitle>Gerar Link Provisório</DialogTitle>
                <DialogDescription>
                  Link que expira sozinho — para um assistente acessar só este módulo, sem login no CRM.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Duração</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.duration}
                    onChange={(e) => setForm(p => ({ ...p, duration: e.target.value }))}
                  >
                    <option value="1">1 hora</option>
                    <option value="4">4 horas</option>
                    <option value="12">12 horas</option>
                    <option value="24">1 dia</option>
                    <option value="72">3 dias</option>
                    <option value="168">7 dias</option>
                    <option value="480">20 dias</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Permissões (abas que o assistente verá)</Label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {LIGACOES_PERMISSION_OPTIONS.map((p) => (
                      <div key={p.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`np-${p.id}`}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          checked={form.permissions.includes(p.id)}
                          onChange={(e) => setForm(prev => ({
                            ...prev,
                            permissions: e.target.checked
                              ? [...prev.permissions, p.id]
                              : prev.permissions.filter(x => x !== p.id),
                          }))}
                        />
                        <label htmlFor={`np-${p.id}`} className="text-sm leading-none cursor-pointer">{p.label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Limite de Usos</Label>
                  <Input
                    type="number"
                    value={form.max_uses}
                    onChange={(e) => setForm(p => ({ ...p, max_uses: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Quantas vezes o link pode ser aberto (1 dispositivo = 1 uso).
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <Label className="text-xs uppercase text-muted-foreground">Links Ativos</Label>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {tokens.map(t => (
                      <div key={t.id} className="flex items-center justify-between p-2 rounded bg-muted text-sm">
                        <div className="truncate flex-1 mr-2">
                          <p className="font-mono text-xs">...{t.token.substring(t.token.length - 8)}</p>
                          <p className="text-[10px] text-muted-foreground">Expira: {format(new Date(t.expires_at), "dd/MM HH:mm")}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {((t.permissions as string[]) || []).map((p) => LIGACOES_PERMISSION_OPTIONS.find(o => o.id === p)?.label || p).join(", ") || "—"}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(t); setEditPerms((t.permissions as string[]) || []); }}>
                            <SettingsIcon className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(t.token)}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteToken(t.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {tokens.length === 0 && <p className="text-xs text-center py-2 text-muted-foreground">Nenhum link ativo.</p>}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={createLink} disabled={loading}>
                  {loading ? "Gerando..." : "Gerar Link"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-500" /> Link Gerado!
                </DialogTitle>
                <DialogDescription>Copie e envie para o assistente.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 py-2">
                <Input readOnly value={generatedLink} className="font-mono text-xs" />
                <Button size="sm" onClick={() => { copyToClipboard(generatedLink); sonnerToast.success("Copiado!"); }}>
                  <Copy className="h-4 w-4 mr-1" /> Copiar
                </Button>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setOpen(false)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Permissões</DialogTitle>
            <DialogDescription>Mudanças valem na próxima atualização da aba do assistente.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {LIGACOES_PERMISSION_OPTIONS.map((p) => (
              <div key={p.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`ep-${p.id}`}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  checked={editPerms.includes(p.id)}
                  onChange={(e) => setEditPerms(prev => e.target.checked ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                />
                <label htmlFor={`ep-${p.id}`} className="text-sm leading-none cursor-pointer">{p.label}</label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={updatePerms}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ HISTÓRICO ============
function HistoricoTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("7"); // dias

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("ligacoes_ia_historico")
      .select("*, clientes(nome, numero), ligacoes_ia_roteiros(nome)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (periodo !== "all") {
      const since = startOfDay(subDays(new Date(), Number(periodo))).toISOString();
      q = q.gte("created_at", since);
    }
    const { data } = await q;
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [periodo]);

  // Realtime updates
  useEffect(() => {
    const ch = supabase.channel("ligacoes_ia_hist")
      .on("postgres_changes", { event: "*", schema: "public", table: "ligacoes_ia_historico" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold">Histórico de ligações</h2>
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Hoje</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {loading && items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Nenhuma ligação no período. Vá para a aba <strong>Disparo</strong> para testar.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_COLOR[it.status] || "bg-muted"} text-white`}>{it.status}</Badge>
                  <span className="font-medium truncate">{it.clientes?.nome || it.numero_destino}</span>
                  {it.ligacoes_ia_roteiros?.nome && (
                    <span className="text-xs text-muted-foreground">• {it.ligacoes_ia_roteiros.nome}</span>
                  )}
                  <Badge variant="outline" className="text-[10px]">{it.source || "manual"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(new Date(it.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  {it.duration_seconds ? ` • ${it.duration_seconds}s` : ""}
                  {it.error_message ? ` • erro: ${it.error_message.slice(0, 80)}` : ""}
                </div>
              </div>
              <code className="text-xs text-muted-foreground hidden md:block">{it.numero_destino}</code>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ ROTEIROS ============
function RoteirosTab() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_roteiros").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Excluir roteiro?")) return;
    await supabase.from("ligacoes_ia_roteiros").delete().eq("id", id);
    toast({ title: "Roteiro excluído" });
    load();
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Roteiros reutilizáveis</h2>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4 mr-1" /> Novo roteiro
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          Nenhum roteiro. Crie um para reutilizar nas ligações.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((r) => (
            <div key={r.id} className="p-3 rounded-lg border bg-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{r.categoria}</Badge>
                    {!r.ativo && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  <h3 className="font-medium mt-1">{r.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.texto}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(r)}>
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <RoteiroDialog
          roteiro={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </Card>
  );
}

// Hook: load voices from ElevenLabs
function useElevenVoices() {
  const [voices, setVoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = async (apiKey?: string, opts?: { silent?: boolean }) => {
    setLoading(true);
    try {
      const cleanApiKey = apiKey?.trim();
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-list-voices", {
        body: cleanApiKey ? { api_key: cleanApiKey } : {},
      });
      if (error) throw error;
      const msg = (data as any)?.error;
      if (msg) {
        if (!opts?.silent) toast({ title: "Erro ao buscar vozes", description: msg, variant: "destructive" });
        return [];
      }
      setVoices((data as any).voices ?? []);
      return (data as any).voices ?? [];
    } catch (e: any) {
      const description = e?.message?.includes("Failed to send a request")
        ? "Não foi possível chamar o backend. Atualize a página e tente novamente. Se persistir, confira se a função de vozes está publicada."
        : e.message;
      if (!opts?.silent) toast({ title: "Erro ao buscar vozes", description, variant: "destructive" });
      return [];
    } finally {
      setLoading(false);
    }
  };

  return { voices, loading, fetch, setVoices };
}

function RoteiroDialog({ roteiro, onClose, onSaved }: { roteiro: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nome: roteiro.nome ?? "",
    categoria: roteiro.categoria ?? "cobranca",
    descricao: roteiro.descricao ?? "",
    texto: roteiro.texto ?? "Olá {nome}, aqui é da empresa. Sua fatura de R$ {valor} vence em breve. Conto com você!",
    voice_id: roteiro.voice_id ?? "",
    ativo: roteiro.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const { voices, loading: loadingVoices, fetch: fetchVoices } = useElevenVoices();

  useEffect(() => { fetchVoices(undefined, { silent: true }); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!form.nome || !form.texto) {
      toast({ title: "Preencha nome e texto", variant: "destructive" });
      return;
    }
    setSaving(true);
    const variaveis = Array.from(form.texto.matchAll(/\{(\w+)\}/g)).map(m => m[1]);
    const payload = { ...form, variaveis: [...new Set(variaveis)], voice_id: form.voice_id || null };
    const { error } = roteiro.id
      ? await supabase.from("ligacoes_ia_roteiros").update(payload).eq("id", roteiro.id)
      : await supabase.from("ligacoes_ia_roteiros").insert(payload);
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Roteiro salvo" });
    onSaved();
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      const exemploVars: Record<string, string> = { nome: "João", valor: "99,90", produto: "Plano Pro", data_renovacao: "30/12/2025" };
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-tts", {
        body: { preview_text: form.texto.replace(/\{(\w+)\}/g, (_: any, k: string) => exemploVars[k] ?? `{${k}}`), preview_voice_id: form.voice_id || undefined },
      });
      if (error) throw error;
      const audio = new Audio((data as any).signed_url);
      await audio.play();
    } catch (e: any) {
      const description = e?.message?.includes("Failed to send a request")
        ? "O navegador bloqueou a chamada do preview. Atualize a página e tente novamente."
        : e.message;
      toast({ title: "Erro no preview", description, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{roteiro.id ? "Editar" : "Novo"} roteiro</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={v => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Voz {loadingVoices && <Loader2 className="h-3 w-3 inline animate-spin ml-1" />}</Label>
            <Select value={form.voice_id || "default"} onValueChange={v => setForm({ ...form, voice_id: v === "default" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Padrão das configurações" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão das configurações</SelectItem>
                {voices.map(v => (
                  <SelectItem key={v.voice_id} value={v.voice_id}>
                    {v.name} • {CATEGORY_LABEL[v.category] || v.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {voices.length === 0 && !loadingVoices && (
              <p className="text-xs text-muted-foreground mt-1">Configure a API Key ElevenLabs em Configurações para listar suas vozes.</p>
            )}
          </div>
          <div>
            <Label>Texto (use {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"})</Label>
            <Textarea rows={5} value={form.texto} onChange={e => setForm({ ...form, texto: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">
              Variáveis serão preenchidas automaticamente quando vincular a um cliente.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.ativo} onCheckedChange={c => setForm({ ...form, ativo: c })} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={preview} disabled={previewing}>
            {previewing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            Pré-ouvir
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ DISPARO ============
function DisparoTab() {
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [roteiroId, setRoteiroId] = useState("");
  const [voiceOverride, setVoiceOverride] = useState("");
  const [numero, setNumero] = useState("");
  const [nome, setNome] = useState("");
  const [valor, setValor] = useState("");
  const [calling, setCalling] = useState(false);
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const { voices, fetch: fetchVoices } = useElevenVoices();

  useEffect(() => {
    supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria").eq("ativo", true).then(({ data }) => setRoteiros(data ?? []));
    fetchVoices(undefined, { silent: true });
    // eslint-disable-next-line
  }, []);

  const [callStatus, setCallStatus] = useState("");
  const callRef = useRef<ActiveCallHandle | null>(null);

  const ligar = async () => {
    if (!roteiroId || !numero) {
      toast({ title: "Selecione roteiro e número", variant: "destructive" });
      return;
    }
    setCalling(true);
    setCallStatus("Gerando áudio do roteiro...");
    try {
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
        body: {
          roteiro_id: roteiroId,
          numero_destino: numero.replace(/\D/g, ""),
          variables: { nome, valor },
          voice_id_override: voiceOverride || undefined,
          source: "manual",
        },
      });
      if (error) throw error;
      const d = data as any;
      if (!d?.wavoip_token || !d?.audio_url || !d?.phone) {
        throw new Error("Resposta inválida do servidor (faltam token/áudio/número)");
      }
      const handle = await placeCallWithTTS({
        token: d.wavoip_token,
        phone: d.phone,
        audioUrl: d.audio_url,
        historicoId: d.historico_id,
        onStatus: (s) => setCallStatus(s),
        onEnded: () => { setCalling(false); setCallStatus(""); callRef.current = null; },
      });
      callRef.current = handle;
      toast({ title: "Ligação em andamento" });
    } catch (e: any) {
      setCalling(false);
      setCallStatus("");
      toast({ title: "Erro ao ligar", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const desligar = async () => {
    await callRef.current?.hangup();
    callRef.current = null;
    setCalling(false);
    setCallStatus("");
  };

  return (
    <Card className="p-6 max-w-2xl">
      <h2 className="font-semibold mb-4">Disparo manual de teste</h2>
      <div className="space-y-3">
        <div>
          <Label>Roteiro</Label>
          <Select value={roteiroId} onValueChange={setRoteiroId}>
            <SelectTrigger><SelectValue placeholder="Selecione um roteiro" /></SelectTrigger>
            <SelectContent>
              {roteiros.map(r => <SelectItem key={r.id} value={r.id}>{r.nome} ({r.categoria})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Voz (opcional — sobrepõe a do roteiro)</Label>
          <Select value={voiceOverride || "default"} onValueChange={v => setVoiceOverride(v === "default" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Usar voz do roteiro</SelectItem>
              {voices.map(v => (
                <SelectItem key={v.voice_id} value={v.voice_id}>{v.name} • {CATEGORY_LABEL[v.category] || v.category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Número de destino (com DDI, ex: 5511999999999)</Label>
          <Input value={numero} onChange={e => setNumero(e.target.value)} placeholder="5511999999999" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Nome (variável {"{nome}"})</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Valor (variável {"{valor}"})</Label>
            <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="99,90" />
          </div>
        </div>
        {calling && callStatus && (
          <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-fuchsia-500" />
            <span className="text-foreground">{callStatus}</span>
          </div>
        )}
        {calling ? (
          <Button className="w-full" variant="destructive" onClick={desligar}>
            <PhoneOff className="h-4 w-4 mr-2" /> Desligar
          </Button>
        ) : (
          <Button className="w-full" onClick={ligar}>
            <Phone className="h-4 w-4 mr-2" /> Ligar agora
          </Button>
        )}

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">ou</span></div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => setClienteDialogOpen(true)}>
          <User className="h-4 w-4 mr-2" />
          Ligar para um cliente cadastrado (mensais + registros)
        </Button>
      </div>

      <LigarComIADialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen} />
    </Card>
  );
}

// ============ CONFIG ============
function ConfigTab({ onSaved }: { onSaved?: () => void }) {
  const [cfg, setCfg] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { voices, loading: loadingVoices, fetch: fetchVoices } = useElevenVoices();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("ligacoes_ia_config").select("config_key, config_value");
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    setCfg(map);
    setLoading(false);
    if (map.elevenlabs_api_key) fetchVoices(undefined, { silent: true });
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    setSaving(true);
    const updates = Object.entries(cfg).map(([config_key, config_value]) =>
      supabase.from("ligacoes_ia_config").update({ config_value }).eq("config_key", config_key)
    );
    await Promise.all(updates);
    setSaving(false);
    toast({ title: "Configurações salvas" });
    onSaved?.();
  };

  const testarVozes = async () => {
    if (!cfg.elevenlabs_api_key) return toast({ title: "Cole a API Key primeiro", variant: "destructive" });
    const v = await fetchVoices(cfg.elevenlabs_api_key);
    if (v.length > 0) toast({ title: `${v.length} vozes carregadas`, description: "API Key válida ✓" });
  };

  if (loading) return <Card className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></Card>;

  const field = (key: string, label: string, hint?: string, type: string = "text") => (
    <div>
      <Label>{label}</Label>
      <Input type={type} value={cfg[key] ?? ""} onChange={e => setCfg({ ...cfg, [key]: e.target.value })} />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );

  return (
    <Card className="p-6 space-y-6 max-w-3xl">
      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Wavoip (discador)</h3>
        {field("wavoip_token", "Token Wavoip", "No painel da Wavoip, abra o Dispositivo (número WhatsApp) e copie o Token de API/Integração.", "password")}
        {field("wavoip_dialer_number", "Número WhatsApp Business discador", "Com DDI, sem símbolos. Ex: 5511999999999")}
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">ElevenLabs (voz)</h3>
        <div>
          <Label>API Key ElevenLabs</Label>
          <div className="flex gap-2 mt-1.5">
            <Input
              type="password"
              value={cfg.elevenlabs_api_key || ""}
              onChange={e => setCfg({ ...cfg, elevenlabs_api_key: e.target.value })}
              className="flex-1"
            />
            <Button variant="outline" onClick={testarVozes} disabled={loadingVoices} className="shrink-0">
              {loadingVoices ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Buscar vozes
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">elevenlabs.io → Profile → API Key. Após colar, clique em Buscar vozes.</p>
        </div>
        <div>
          <Label>Voz padrão {voices.length > 0 && <span className="text-xs text-muted-foreground">({voices.length} disponíveis)</span>}</Label>
          <Select value={cfg.elevenlabs_default_voice_id || ""} onValueChange={v => setCfg({ ...cfg, elevenlabs_default_voice_id: v })}>
            <SelectTrigger><SelectValue placeholder={voices.length === 0 ? "Configure a API Key e busque vozes" : "Selecione uma voz"} /></SelectTrigger>
            <SelectContent>
              {voices.map(v => (
                <SelectItem key={v.voice_id} value={v.voice_id}>
                  {v.name} • {CATEGORY_LABEL[v.category] || v.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {field("voice_stability", "Estabilidade (0-1)")}
          {field("voice_similarity", "Similaridade (0-1)")}
          {field("voice_speed", "Velocidade (0.7-1.2)")}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold text-sm uppercase text-muted-foreground">Retentativas</h3>
        <div className="grid grid-cols-2 gap-3">
          {field("call_attempts", "Tentativas em caso de não atender")}
          {field("retry_interval_minutes", "Intervalo entre tentativas (min)")}
        </div>
      </section>

      <Button onClick={save} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Salvar configurações
      </Button>
    </Card>
  );
}
