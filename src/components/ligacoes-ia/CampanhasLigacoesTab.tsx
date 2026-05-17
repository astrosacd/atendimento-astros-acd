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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Megaphone,
  Plus,
  Loader2,
  ListChecks,
  Users,
  PhoneCall,
  UserPlus,
  FileUp,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type ManualContact = { nome: string; numero: string };

// Normaliza um número para apenas dígitos (mín 10 dígitos para considerar válido)
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
    // formatos aceitos: "Nome, numero" | "Nome; numero" | "Nome - numero" | "numero" | "Nome\tnumero"
    const parts = l.split(/[,;\t]| - /).map((p) => p.trim()).filter(Boolean);
    let nome = "";
    let numeroRaw = "";
    if (parts.length === 1) {
      numeroRaw = parts[0];
    } else {
      // último token com mais dígitos = número, restante = nome
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
  roteiro_id: string | null;
  status: string;
  total: number;
  created_at: string;
  ligacoes_ia_roteiros?: { nome: string } | null;
};

type Cliente = {
  id: string;
  nome: string;
  numero: string | null;
  produto: string | null;
  cobranca_ativa: boolean | null;
};

const STATUS_CLS: Record<string, string> = {
  pendente: "bg-slate-500",
  em_andamento: "bg-blue-500",
  finalizada: "bg-emerald-600",
  cancelada: "bg-amber-500",
};

export function CampanhasLigacoesTab() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("ligacoes_campanhas")
      .select("*, ligacoes_ia_roteiros(nome)")
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

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 border-fuchsia-500/20">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-fuchsia-500/10">
              <Megaphone className="h-5 w-5 text-fuchsia-500" />
            </div>
            <div>
              <h3 className="font-semibold">Campanhas de ligação</h3>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Selecione vários clientes e dispare a mesma ligação IA em sequência.
                As ligações entram na <strong>Fila do dia</strong> e são executadas com o mesmo
                delay configurado em Cobrança (precisa do navegador aberto).
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-fuchsia-600 hover:bg-fuchsia-700">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{c.nome}</span>
                    <Badge className={STATUS_CLS[c.status] ?? "bg-slate-500"}>
                      {c.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.total} cliente(s)
                    </span>
                    {c.ligacoes_ia_roteiros?.nome && (
                      <span>Roteiro: {c.ligacoes_ia_roteiros.nome}</span>
                    )}
                    <span>
                      {format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <NovaCampanhaDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => { setOpen(false); load(); }}
      />
    </div>
  );
}

function NovaCampanhaDialog({
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
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [roteiroId, setRoteiroId] = useState("");
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
      setNome(""); setRoteiroId(""); setSelected(new Set()); setSearch(""); setFilter("todos");
      setDiaAlvo(todayISO); setDelayOverride("");
      setTab("cadastrados"); setManualText("");
      return;
    }
    (async () => {
      setLoadingData(true);
      const [r, c] = await Promise.all([
        supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria").eq("ativo", true).order("nome"),
        supabase.from("clientes").select("id, nome, numero, produto, cobranca_ativa").order("nome").limit(2000),
      ]);
      setRoteiros(r.data ?? []);
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
    if (!roteiroId) return toast({ title: "Selecione um roteiro", variant: "destructive" });

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
      const { data: campanha, error: e1 } = await (supabase as any)
        .from("ligacoes_campanhas")
        .insert({
          nome: nome.trim(),
          roteiro_id: roteiroId,
          total: totalSelecionados,
          criado_por: userData.user?.id ?? null,
          dia_alvo: diaAlvo,
          delay_minutes_override: overrideNum,
        })
        .select()
        .single();
      if (e1) throw e1;

      const rows = useManual
        ? manualContacts.map((c) => ({
            cliente_id: null,
            nome_manual: c.nome,
            numero_manual: c.numero,
            roteiro_id: roteiroId,
            dia_alvo: diaAlvo,
            tipo_d: "campanha",
            status: "pendente",
            campanha_id: campanha.id,
          }))
        : Array.from(selected).map((cid) => ({
            cliente_id: cid,
            roteiro_id: roteiroId,
            dia_alvo: diaAlvo,
            tipo_d: "campanha",
            status: "pendente",
            campanha_id: campanha.id,
          }));
      const { error: e2 } = await (supabase as any).from("ligacoes_agendadas").insert(rows);
      if (e2) throw e2;

      toast({
        title: "Campanha criada",
        description: `${rows.length} ligaç${rows.length === 1 ? "ão agendada" : "ões agendadas"} para ${diaAlvo === todayISO ? "hoje" : diaAlvo}.`,
      });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro ao criar campanha", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const mensaisCount = clientes.filter((c) => c.cobranca_ativa).length;
  const registrosCount = clientes.filter((c) => !c.cobranca_ativa).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-fuchsia-500" /> Nova campanha de ligação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Nome da campanha</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Renovação Janeiro" />
            </div>
            <div>
              <Label>Roteiro</Label>
              <Select value={roteiroId} onValueChange={setRoteiroId}>
                <SelectTrigger><SelectValue placeholder="Selecione um roteiro" /></SelectTrigger>
                <SelectContent>
                  {roteiros.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.nome} ({r.categoria})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Disparar no dia</Label>
              <Input type="date" min={todayISO} value={diaAlvo} onChange={(e) => setDiaAlvo(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">A campanha entra na fila desse dia.</p>
            </div>
            <div>
              <Label>Delay entre ligações (min) — opcional</Label>
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="Usar delay global"
                value={delayOverride}
                onChange={(e) => setDelayOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Deixe em branco para usar o delay configurado em Cobrança.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <Label>Clientes</Label>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{selected.size}</span> selecionado(s) / {filtered.length} visíveis
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Button size="sm" variant={filter === "todos" ? "default" : "outline"} onClick={() => setFilter("todos")}>
                Todos ({clientes.length})
              </Button>
              <Button size="sm" variant={filter === "mensais" ? "default" : "outline"} onClick={() => setFilter("mensais")}>
                📅 Mensais ({mensaisCount})
              </Button>
              <Button size="sm" variant={filter === "registros" ? "default" : "outline"} onClick={() => setFilter("registros")}>
                📋 Registros ({registrosCount})
              </Button>
            </div>
            <Input
              placeholder="Buscar por nome, número ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2"
            />
            <Card className="p-0 max-h-72 overflow-y-auto">
              {loadingData ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando clientes...
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 sticky top-0">
                    <Checkbox
                      checked={filtered.length > 0 && filtered.every((c) => selected.has(c.id))}
                      onCheckedChange={toggleAllVisible}
                    />
                    <span className="text-xs text-muted-foreground">Selecionar todos visíveis (com número)</span>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado</div>
                  ) : (
                    filtered.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 px-3 py-2 border-b last:border-b-0 hover:bg-accent/40 cursor-pointer ${
                          !c.numero ? "opacity-50" : ""
                        }`}
                      >
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => c.numero && toggle(c.id)}
                          disabled={!c.numero}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {c.cobranca_ativa ? "📅" : "📋"} {c.nome}
                            {!c.numero && <span className="text-xs text-destructive">sem número</span>}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {c.produto || "—"} {c.numero ? `• ${c.numero}` : ""}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-200/90 flex items-start gap-2">
            <PhoneCall className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              As ligações entram na <strong>Fila do dia</strong>. Vá até a aba para iniciar o disparo — usa o mesmo delay configurado em Cobrança.
              A aba do navegador precisa ficar aberta durante a execução.
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-fuchsia-600 hover:bg-fuchsia-700">
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Criar e enfileirar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
