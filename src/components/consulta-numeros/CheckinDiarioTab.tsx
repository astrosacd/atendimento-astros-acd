import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAparelhos } from "@/hooks/useAparelhos";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  CalendarCheck, Plus, Smartphone, Wifi, WifiOff, Trash2, Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TipoSlot = "normal" | "business" | "clone";
type StatusConexao = "conectado" | "desconectado";

interface Checkin {
  id: string;
  numero: string;
  baserow_row_id: number | null;
  cliente_nome: string | null;
  aparelho_id: string | null;
  modelo_snapshot: string | null;
  tipo_slot: TipoSlot;
  status_conexao: StatusConexao;
  status_geral: string | null;
  data_checkin: string;
  observacao: string | null;
  created_at: string;
}

const TIPO_LABEL: Record<TipoSlot, string> = {
  normal: "Normal",
  business: "Business",
  clone: "Clone",
};

const TIPO_COLOR: Record<TipoSlot, string> = {
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  business: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  clone: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
};

function useCheckins(filter: { dateFrom?: string; numero?: string; aparelho?: string }) {
  return useQuery({
    queryKey: ["qr-scan-checkins", filter],
    queryFn: async () => {
      let q = supabase
        .from("qr_scan_checkins_diarios" as any)
        .select("*")
        .order("data_checkin", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter.dateFrom) q = q.gte("data_checkin", filter.dateFrom);
      if (filter.numero) q = q.ilike("numero", `%${filter.numero}%`);
      if (filter.aparelho) q = q.eq("aparelho_id", filter.aparelho);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Checkin[];
    },
  });
}

function useCreateCheckin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      numero: string;
      baserow_row_id?: number | null;
      cliente_nome?: string | null;
      aparelho_id: string | null;
      modelo_snapshot: string | null;
      tipo_slot: TipoSlot;
      status_conexao: StatusConexao;
      status_geral?: string | null;
      observacao?: string | null;
    }) => {
      const { error } = await supabase
        .from("qr_scan_checkins_diarios" as any)
        .insert({ ...payload, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-checkins"] });
      toast({ title: "Check-in registrado" });
    },
    onError: (e: Error) =>
      toast({ title: "Erro ao registrar", description: e.message, variant: "destructive" }),
  });
}

function useDeleteCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("qr_scan_checkins_diarios" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-checkins"] });
      toast({ title: "Check-in removido" });
    },
  });
}

function useSearchCacheNumero(q: string) {
  return useQuery({
    queryKey: ["checkin-search-cache", q],
    enabled: q.trim().length >= 3,
    queryFn: async () => {
      const like = `*${q.trim()}*`;
      const { data, error } = await supabase
        .from("consulta_numeros_cache")
        .select("baserow_row_id, row_data")
        .or(`row_data->>numero.ilike.${like}`)
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function CheckinDiarioTab() {
  const { isAdmin } = useAuth();
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [searchNumero, setSearchNumero] = useState("");
  const [aparelhoFilter, setAparelhoFilter] = useState<string>("");

  const { data: aparelhos = [] } = useAparelhos();
  const { data: checkins = [], isLoading } = useCheckins({
    dateFrom,
    numero: searchNumero,
    aparelho: aparelhoFilter || undefined,
  });
  const createMut = useCreateCheckin();
  const deleteMut = useDeleteCheckin();

  // Form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formNumero, setFormNumero] = useState("");
  const [formBaserowId, setFormBaserowId] = useState<number | null>(null);
  const [formCliente, setFormCliente] = useState("");
  const [formAparelhoId, setFormAparelhoId] = useState<string>("");
  const [formTipo, setFormTipo] = useState<TipoSlot>("normal");
  const [formStatusConexao, setFormStatusConexao] = useState<StatusConexao>("conectado");
  const [formStatusGeral, setFormStatusGeral] = useState("ok");
  const [formObs, setFormObs] = useState("");
  const { data: cacheMatches = [] } = useSearchCacheNumero(formNumero);

  const resetForm = () => {
    setFormNumero(""); setFormBaserowId(null); setFormCliente("");
    setFormAparelhoId(""); setFormTipo("normal");
    setFormStatusConexao("conectado"); setFormStatusGeral("ok"); setFormObs("");
  };

  const selectedAparelho = aparelhos.find((a) => a.id === formAparelhoId);

  const handleSubmit = async () => {
    if (!formNumero.trim()) {
      toast({ title: "Informe o número", variant: "destructive" });
      return;
    }
    if (!formAparelhoId) {
      toast({ title: "Selecione o aparelho", variant: "destructive" });
      return;
    }
    await createMut.mutateAsync({
      numero: formNumero.trim(),
      baserow_row_id: formBaserowId,
      cliente_nome: formCliente.trim() || null,
      aparelho_id: formAparelhoId,
      modelo_snapshot: selectedAparelho
        ? `${(selectedAparelho as any).modelo?.nome ?? ""} (${selectedAparelho.apelido})`.trim()
        : null,
      tipo_slot: formTipo,
      status_conexao: formStatusConexao,
      status_geral: formStatusGeral.trim() || null,
      observacao: formObs.trim() || null,
    });
    resetForm();
    setDialogOpen(false);
  };

  // Capacidade ocupada por aparelho + tipo (último check-in conectado por número)
  const capacityByAparelho = useMemo(() => {
    const map = new Map<string, { normal: Set<string>; business: Set<string>; clone: Set<string> }>();
    // Ordenar do mais recente para o mais antigo, e considerar apenas a entrada mais recente de cada (numero+aparelho)
    const seen = new Set<string>();
    for (const c of checkins) {
      if (!c.aparelho_id || c.status_conexao !== "conectado") continue;
      const key = `${c.aparelho_id}|${c.numero}|${c.tipo_slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!map.has(c.aparelho_id)) {
        map.set(c.aparelho_id, { normal: new Set(), business: new Set(), clone: new Set() });
      }
      map.get(c.aparelho_id)![c.tipo_slot].add(c.numero);
    }
    return map;
  }, [checkins]);

  const handleSelectCacheMatch = (m: any) => {
    const rd = m.row_data || {};
    setFormNumero(String(rd.numero ?? ""));
    setFormBaserowId(m.baserow_row_id ?? null);
    setFormCliente(String(rd.nome ?? rd.Nome ?? ""));
  };

  return (
    <div className="space-y-4">
      {/* Header + Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarCheck className="h-5 w-5" /> Check-in Diário de Números
              </CardTitle>
              <CardDescription>
                Registre quais números estão hospedados em cada aparelho físico hoje.
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> Novo Check-in</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Novo Check-in</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do número e selecione o aparelho onde está hospedado.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div>
                      <Label>Número *</Label>
                      <Input
                        value={formNumero}
                        onChange={(e) => setFormNumero(e.target.value)}
                        placeholder="Ex: 85996937903"
                      />
                      {formNumero.trim().length >= 3 && cacheMatches.length > 0 && !formBaserowId && (
                        <div className="mt-1 border rounded-md max-h-32 overflow-auto bg-popover">
                          {cacheMatches.slice(0, 5).map((m: any) => (
                            <button
                              key={m.baserow_row_id}
                              type="button"
                              className="w-full text-left px-2 py-1 text-xs hover:bg-muted"
                              onClick={() => handleSelectCacheMatch(m)}
                            >
                              <span className="font-mono">{m.row_data?.numero}</span>
                              {" — "}
                              <span className="text-muted-foreground">
                                #{m.baserow_row_id} {m.row_data?.nome ?? ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {formBaserowId && (
                        <p className="text-xs text-emerald-400 mt-1">
                          Linha Baserow #{formBaserowId} vinculada
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Cliente (opcional)</Label>
                      <Input
                        value={formCliente}
                        onChange={(e) => setFormCliente(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Aparelho *</Label>
                      <Select value={formAparelhoId} onValueChange={setFormAparelhoId}>
                        <SelectTrigger><SelectValue placeholder="Selecione um aparelho" /></SelectTrigger>
                        <SelectContent>
                          {aparelhos.map((a) => {
                            const cap = capacityByAparelho.get(a.id);
                            const total = (cap?.normal.size ?? 0) + (cap?.business.size ?? 0) + (cap?.clone.size ?? 0);
                            return (
                              <SelectItem key={a.id} value={a.id}>
                                {a.apelido}
                                {(a as any).modelo?.nome ? ` — ${(a as any).modelo.nome}` : ""}
                                {" "}({total}/{a.capacidade_total})
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Tipo de slot *</Label>
                        <Select value={formTipo} onValueChange={(v) => setFormTipo(v as TipoSlot)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="clone">Clone</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Status conexão *</Label>
                        <Select value={formStatusConexao} onValueChange={(v) => setFormStatusConexao(v as StatusConexao)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conectado">Conectado</SelectItem>
                            <SelectItem value="desconectado">Desconectado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Status geral</Label>
                      <Input
                        value={formStatusGeral}
                        onChange={(e) => setFormStatusGeral(e.target.value)}
                        placeholder="ok / banido / tag / etc."
                      />
                    </div>
                    <div>
                      <Label>Observação</Label>
                      <Textarea
                        value={formObs}
                        onChange={(e) => setFormObs(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancelar</Button>
                    <Button onClick={handleSubmit} disabled={createMut.isPending}>
                      {createMut.isPending ? "Salvando..." : "Salvar Check-in"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1 flex-1 min-w-[180px]">
              <Label className="text-xs">Buscar número</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={searchNumero}
                  onChange={(e) => setSearchNumero(e.target.value)}
                  placeholder="Filtrar por número…"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Aparelho</Label>
              <Select value={aparelhoFilter || "all"} onValueChange={(v) => setAparelhoFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {aparelhos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.apelido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Capacidade por aparelho */}
      {aparelhos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {aparelhos.map((a) => {
            const cap = capacityByAparelho.get(a.id);
            const n = cap?.normal.size ?? 0;
            const b = cap?.business.size ?? 0;
            const c = cap?.clone.size ?? 0;
            const total = n + b + c;
            const pct = a.capacidade_total > 0 ? Math.min(100, Math.round((total / a.capacidade_total) * 100)) : 0;
            return (
              <Card key={a.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Smartphone className="h-4 w-4" /> {a.apelido}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {(a as any).modelo?.nome ?? "—"} • {total}/{a.capacidade_total} ocupado
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge className={TIPO_COLOR.normal} variant="outline">Normal: {n}</Badge>
                    <Badge className={TIPO_COLOR.business} variant="outline">Business: {b}</Badge>
                    <Badge className={TIPO_COLOR.clone} variant="outline">Clone: {c}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Tabela de check-ins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Check-ins ({checkins.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : checkins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum check-in encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Linha</TableHead>
                  <TableHead>Aparelho</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Conexão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Obs.</TableHead>
                  {isAdmin && <TableHead></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkins.map((c) => {
                  const ap = aparelhos.find((a) => a.id === c.aparelho_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs">
                        {format(new Date(c.data_checkin + "T00:00:00"), "dd/MM", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                      <TableCell className="text-xs">
                        {c.baserow_row_id ? `#${c.baserow_row_id}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {ap?.apelido ?? c.modelo_snapshot ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={TIPO_COLOR[c.tipo_slot]} variant="outline">
                          {TIPO_LABEL[c.tipo_slot]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {c.status_conexao === "conectado" ? (
                          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1">
                            <Wifi className="h-3 w-3" /> Conectado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 gap-1">
                            <WifiOff className="h-3 w-3" /> Desconectado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{c.status_geral ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{c.observacao ?? "—"}</TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm("Remover este check-in?")) deleteMut.mutate(c.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
