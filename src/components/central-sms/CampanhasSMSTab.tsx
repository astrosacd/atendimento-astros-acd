import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Loader2,
  ListChecks,
  Users,
  MessageSquare,
  UserPlus,
  FileUp,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePermissions } from "@/hooks/usePermissions";

type ManualContact = { nome: string; numero: string };

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D+/g, "");
  if (digits.length < 10) return null;
  return digits;
}

function parseManualContacts(text: string): ManualContact[] {
  const out: ManualContact[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((line) => {
    const l = line.trim();
    if (!l) return;
    const parts = l.split(/[,;\t]| - /).map((p) => p.trim()).filter(Boolean);
    let nome = "";
    let numeroRaw = "";
    if (parts.length === 1) {
      numeroRaw = parts[0];
    } else {
      const last = parts[parts.length - 1];
      if (/\d/.test(last)) {
        numeroRaw = last;
        nome = parts.slice(0, -1).join(" ");
      } else {
        nome = parts.join(" ");
      }
    }
    const numero = normalizePhone(numeroRaw);
    if (!numero) return;
    if (seen.has(numero)) return;
    seen.add(numero);
    out.push({ nome: nome || "Contato", numero });
  });
  return out;
}

type Campanha = {
  id: string;
  nome: string;
  template_id: string | null;
  status: string;
  total: number;
  created_at: string;
  dia_alvo: string;
  delay_minutes_override: number | null;
  sms_templates?: { nome: string } | null;
};

type Cliente = {
  id: string;
  nome: string;
  numero: string | null;
  produto: string | null;
  cobranca_ativa: boolean | null;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: any }> = {
  pendente: { label: "Pendente", cls: "bg-slate-500", icon: Clock },
  em_andamento: { label: "Em andamento", cls: "bg-blue-500", icon: MessageSquare },
  finalizada: { label: "Finalizada", cls: "bg-emerald-600", icon: CheckCircle2 },
  cancelada: { label: "Cancelada", cls: "bg-amber-500", icon: XCircle },
};

export function CampanhasSMSTab() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_sms_campanhas");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campanha | null>(null);
  const [deleting, setDeleting] = useState<Campanha | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sms_campanhas")
      .select("*, sms_templates(nome)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Erro ao carregar campanhas", description: error.message, variant: "destructive" });
    } else {
      setCampanhas((data ?? []) as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const { error } = await supabase.from("sms_campanhas").delete().eq("id", deleting.id);
    setBusy(false);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Campanha excluída", description: "Os SMS pendentes da campanha foram removidos da fila." });
    setDeleting(null);
    load();
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-cyan-500/5 border-blue-500/20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Megaphone className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold">Campanhas de SMS</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Selecione vários clientes e dispare a mesma mensagem de SMS em sequência.
                As mensagens entram na <strong>Fila do dia</strong> e são executadas com o delay configurado.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> Nova campanha
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-medium">Campanhas recentes</h4>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : campanhas.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhuma campanha criada ainda. Clique em <strong>Nova campanha</strong> para começar.
          </div>
        ) : (
          <div className="space-y-2">
            {campanhas.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-accent/40 transition"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.nome}</span>
                    {(() => {
                      const conf = STATUS_CONFIG[c.status] || STATUS_CONFIG.pendente;
                      const Icon = conf.icon;
                      return (
                        <Badge className={`${conf.cls} flex items-center gap-1`}>
                          <Icon className="h-3 w-3" />
                          {conf.label}
                        </Badge>
                      );
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.total} contato(s)
                    </span>
                    {c.sms_templates?.nome && (
                      <span>Template: {c.sms_templates.nome}</span>
                    )}
                    {c.dia_alvo && <span>Dia: {c.dia_alvo}</span>}
                    {c.delay_minutes_override != null && <span>Delay: {c.delay_minutes_override}min</span>}
                    <span>
                      {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Editar / reagendar"
                      onClick={() => setEditing(c)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Excluir campanha"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <NovaCampanhaSMSDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => { setOpen(false); load(); }}
      />

      <EditarCampanhaSMSDialog
        campanha={editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={() => { setEditing(null); load(); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha "{deleting?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação também remove todos os <strong>{deleting?.total ?? 0}</strong> SMS desta
              campanha da fila (inclusive os pendentes). Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive hover:bg-destructive/90">
              {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditarCampanhaSMSDialog({
  campanha,
  onOpenChange,
  onSaved,
}: {
  campanha: Campanha | null;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [diaAlvo, setDiaAlvo] = useState("");
  const [delayOverride, setDelayOverride] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (campanha) {
      setNome(campanha.nome ?? "");
      setDiaAlvo(campanha.dia_alvo ?? "");
      setDelayOverride(campanha.delay_minutes_override != null ? String(campanha.delay_minutes_override) : "");
    }
  }, [campanha]);

  const save = async () => {
    if (!campanha) return;
    if (!nome.trim()) return toast({ title: "Informe o nome", variant: "destructive" });
    setSaving(true);
    const overrideNum = delayOverride.trim() === "" ? null : Math.max(0, Math.min(120, Number(delayOverride)));
    const novoDia = diaAlvo || campanha.dia_alvo;
    const { error } = await supabase
      .from("sms_campanhas")
      .update({ nome: nome.trim(), dia_alvo: novoDia, delay_minutes_override: overrideNum })
      .eq("id", campanha.id);
    if (!error && novoDia !== campanha.dia_alvo) {
      await supabase
        .from("sms_agendados")
        .update({ dia_alvo: novoDia })
        .eq("campanha_id", campanha.id)
        .eq("status", "pendente");
    }
    setSaving(false);
    if (error) return toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    toast({ title: "Campanha atualizada" });
    onSaved();
  };

  return (
    <Dialog open={!!campanha} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-500" /> Editar campanha
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Reagendar para o dia</Label>
            <Input type="date" value={diaAlvo} onChange={(e) => setDiaAlvo(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">Os SMS pendentes desta campanha são movidos para o novo dia.</p>
          </div>
          <div>
            <Label>Delay entre envios (min) — opcional</Label>
            <Input
              type="number"
              min={0}
              max={120}
              placeholder="Usar delay global"
              value={delayOverride}
              onChange={(e) => setDelayOverride(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaCampanhaSMSDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [nome, setNome] = useState("");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"todos" | "mensais" | "registros">("todos");
  const [search, setSearch] = useState("");
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diaAlvo, setDiaAlvo] = useState<string>(todayISO);
  const [delayOverride, setDelayOverride] = useState<string>("");
  const [tab, setTab] = useState<"cadastrados" | "manuais">("cadastrados");
  const [manualText, setManualText] = useState<string>("");
  const manualContacts = useMemo(() => parseManualContacts(manualText), [manualText]);

  useEffect(() => {
    if (!open) {
      setNome(""); setTemplateId(""); setSelected(new Set()); setSearch(""); setFilter("todos");
      setDiaAlvo(todayISO); setDelayOverride("");
      setTab("cadastrados"); setManualText("");
      return;
    }
    (async () => {
      setLoadingData(true);
      const [r, c] = await Promise.all([
        supabase.from("sms_templates").select("id, nome, categoria, conteudo").eq("ativo", true).order("nome"),
        supabase.from("clientes").select("id, nome, numero, produto, cobranca_ativa").order("nome").limit(2000),
      ]);
      setTemplates(r.data ?? []);
      setClientes((c.data ?? []) as any);
      setLoadingData(false);
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return clientes.filter((c) => {
      if (filter === "mensais" && !c.cobranca_ativa) return false;
      if (filter === "registros" && c.cobranca_ativa) return false;
      if (!term) return true;
      return (
        c.nome?.toLowerCase().includes(term) ||
        c.numero?.toLowerCase().includes(term) ||
        c.produto?.toLowerCase().includes(term)
      );
    });
  }, [clientes, filter, search]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAllVisible = () => {
    setSelected((s) => {
      const allSelected = filtered.every((c) => s.has(c.id));
      const n = new Set(s);
      if (allSelected) filtered.forEach((c) => n.delete(c.id));
      else filtered.forEach((c) => { if (c.numero) n.add(c.id); });
      return n;
    });
  };

  const submit = async () => {
    if (!nome.trim()) return toast({ title: "Informe o nome da campanha", variant: "destructive" });
    if (!templateId) return toast({ title: "Selecione um template", variant: "destructive" });

    const useManual = tab === "manuais";
    const totalSelecionados = useManual ? manualContacts.length : selected.size;
    if (totalSelecionados === 0) {
      return toast({
        title: useManual ? "Adicione pelo menos 1 contato válido" : "Selecione ao menos 1 cliente",
        variant: "destructive",
      });
    }

    setSaving(true);
    try {
      const overrideNum = delayOverride.trim() === "" ? null : Math.max(0, Math.min(120, Number(delayOverride)));
      const { data: userData } = await supabase.auth.getUser();
      const { data: campanha, error: e1 } = await supabase
        .from("sms_campanhas")
        .insert({
          nome: nome.trim(),
          template_id: templateId,
          total: totalSelecionados,
          criado_por: userData.user?.id,
          dia_alvo: diaAlvo,
          delay_minutes_override: overrideNum,
        })
        .select()
        .single();

      if (e1) throw e1;

      if (useManual) {
        const rows = manualContacts.map((c) => ({
          campanha_id: campanha.id,
          template_id: templateId,
          nome_manual: c.nome,
          numero_manual: c.numero,
          dia_alvo: diaAlvo,
          status: "pendente",
        }));
        const { error: e2 } = await supabase.from("sms_agendados").insert(rows);
        if (e2) throw e2;
      } else {
        const rows = Array.from(selected).map((cid) => ({
          campanha_id: campanha.id,
          template_id: templateId,
          cliente_id: cid,
          dia_alvo: diaAlvo,
          status: "pendente",
        }));
        const { error: e2 } = await supabase.from("sms_agendados").insert(rows);
        if (e2) throw e2;
      }

      toast({ title: "Campanha criada!", description: `${totalSelecionados} SMS agendados para a Fila do dia.` });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro ao criar campanha", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" /> Nova campanha de SMS
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <Label>Nome da Campanha</Label>
                <Input placeholder="Ex: Promoção de Verão" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div>
                <Label>Mensagem (Template)</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o template" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.nome} ({t.categoria})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Dia do disparo</Label>
                  <Input type="date" value={diaAlvo} onChange={(e) => setDiaAlvo(e.target.value)} />
                </div>
                <div>
                  <Label>Delay entre envios (min)</Label>
                  <Input type="number" placeholder="Global" value={delayOverride} onChange={(e) => setDelayOverride(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Contatos ({tab === "manuais" ? manualContacts.length : selected.size})</Label>
                <Tabs value={tab} onValueChange={(v: any) => setTab(v)} className="w-auto">
                  <TabsList className="h-8">
                    <TabsTrigger value="cadastrados" className="text-xs">Cadastrados</TabsTrigger>
                    <TabsTrigger value="manuais" className="text-xs">Manuais</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {tab === "cadastrados" ? (
                <>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
                      <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="mensais">Mensais</SelectItem>
                        <SelectItem value="registros">Registros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 border rounded-md overflow-hidden bg-background">
                    <div className="p-2 border-b bg-muted/20 flex items-center gap-2">
                      <Checkbox id="sel-all" checked={filtered.length > 0 && filtered.every(c => selected.has(c.id))} onCheckedChange={toggleAllVisible} />
                      <Label htmlFor="sel-all" className="text-[10px] uppercase font-bold text-muted-foreground cursor-pointer">Selecionar Todos Visíveis</Label>
                    </div>
                    <div className="overflow-y-auto max-h-[180px]">
                      {loadingData ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Carregando clientes...</div>
                      ) : filtered.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">Nenhum cliente encontrado.</div>
                      ) : (
                        filtered.map((c) => (
                          <div key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 border-b last:border-0">
                            <Checkbox id={`c-${c.id}`} checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} disabled={!c.numero} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate">{c.nome}</p>
                              <p className="text-[10px] text-muted-foreground">{c.numero || "(sem número)"}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col">
                  <Textarea
                    placeholder="Cole aqui os contatos (um por linha)&#10;Exemplos:&#10;João, 85999887766&#10;85988776655&#10;Maria - 11977665544"
                    className="flex-1 min-h-[150px] text-xs font-mono"
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                  />
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    {manualContacts.length > 0 ? (
                      <span className="text-emerald-500">{manualContacts.length} contatos válidos detectados.</span>
                    ) : (
                      "Formato: Nome, Número ou apenas o Número."
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || loadingData} className="bg-blue-600 hover:bg-blue-700 min-w-[120px]">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Campanha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
