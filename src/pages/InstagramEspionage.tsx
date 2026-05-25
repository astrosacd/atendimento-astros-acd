import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, RefreshCw, Trash2, Edit, Pause, Play, Search, Sparkles, BarChart3,
  ExternalLink, Loader2, AlertTriangle, CheckCircle2, Eye, Heart, MessageCircle,
  PlayCircle, Image as ImageIcon, Settings as SettingsIcon, Clock, Hash,
  TrendingUp, Lightbulb,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { invokeFunction } from "@/utils/invokeFunction";

const MAX_COMPETITORS = 25;

const CATEGORIAS = [
  { value: "concorrente_direto", label: "Concorrente direto" },
  { value: "inspiracao", label: "Inspiração" },
  { value: "referencia_internacional", label: "Referência internacional" },
  { value: "nicho_proximo", label: "Nicho próximo" },
  { value: "outro", label: "Outro" },
];

const FREQUENCIAS = [
  { value: "manual", label: "Manual (sem automação)" },
  { value: "daily", label: "Diária (08h Brasília)" },
  { value: "3days", label: "A cada 3 dias (08h)" },
  { value: "weekly", label: "Semanal (segunda 08h)" },
];

interface Competitor {
  id: string;
  username: string;
  display_name: string | null;
  profile_picture_url: string | null;
  followers_count: number | null;
  category: string;
  notes: string | null;
  is_active: boolean;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

export default function InstagramEspionage() {
  const qc = useQueryClient();
  const isTempAccess = typeof window !== "undefined" && !!sessionStorage.getItem("temp_access_token");
  const [tab, setTab] = useState("concorrentes");

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="concorrentes" className="gap-2"><Eye className="h-4 w-4" /> Concorrentes</TabsTrigger>
          <TabsTrigger value="analises" className="gap-2"><Sparkles className="h-4 w-4" /> Análises</TabsTrigger>
          <TabsTrigger value="posts" className="gap-2"><BarChart3 className="h-4 w-4" /> Posts coletados</TabsTrigger>
          {!isTempAccess && (
            <TabsTrigger value="config" className="gap-2"><SettingsIcon className="h-4 w-4" /> Configurações</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="concorrentes" className="space-y-4">
          <CompetitorsTab />
        </TabsContent>
        <TabsContent value="analises" className="space-y-4">
          <AnalysesTab />
        </TabsContent>
        <TabsContent value="posts" className="space-y-4">
          <PostsTab />
        </TabsContent>
        {!isTempAccess && (
          <TabsContent value="config" className="space-y-4">
            <ConfigTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ===========================================================
// COMPETIDORES
// ===========================================================
function CompetitorsTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Competitor | null>(null);
  const [form, setForm] = useState({ username: "", category: "concorrente_direto", notes: "" });
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Competitor | null>(null);

  const { data: competitors = [], isLoading } = useQuery({
    queryKey: ["ig-competitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_competitors")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Competitor[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ username: "", category: "concorrente_direto", notes: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Competitor) => {
    setEditing(c);
    setForm({ username: c.username, category: c.category, notes: c.notes || "" });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const username = form.username.replace(/^@/, "").trim().toLowerCase();
      if (!username) throw new Error("Username obrigatório");
      if (!editing && competitors.length >= MAX_COMPETITORS) {
        throw new Error(`Limite de ${MAX_COMPETITORS} perfis atingido. Pause ou exclua um para adicionar outro.`);
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (editing) {
        const { error } = await supabase
          .from("instagram_competitors")
          .update({ username, category: form.category, notes: form.notes || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("instagram_competitors").insert({
          username, category: form.category, notes: form.notes || null, created_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Concorrente atualizado" : "Concorrente adicionado");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["ig-competitors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("instagram_competitors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Concorrente removido");
      qc.invalidateQueries({ queryKey: ["ig-competitors"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Competitor) => {
      const { error } = await supabase
        .from("instagram_competitors")
        .update({ is_active: !c.is_active })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ig-competitors"] }),
  });

  const syncOne = async (id: string) => {
    setSyncingId(id);
    try {
      const data = await invokeFunction<any>("instagram-spy-sync", {
        body: { competitor_id: id },
      });
      const r = data?.results?.[0];
      if (r?.status === "ok") toast.success(`${r.username}: ${r.posts_synced} posts sincronizados`);
      else if (r) toast.error(`@${r.username}: ${r.error || "erro desconhecido"}`);
      else toast.success(data?.message || "Sincronização concluída");
      qc.invalidateQueries({ queryKey: ["ig-competitors"] });
      qc.invalidateQueries({ queryKey: ["ig-posts"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncingId(null);
    }
  };

  const syncAll = async () => {
    setSyncingAll(true);
    try {
      const data = await invokeFunction<any>("instagram-spy-sync", {
        body: { sync_all: true },
      });
      const ok = data?.results?.filter((r: any) => r.status === "ok").length || 0;
      const err = data?.results?.filter((r: any) => r.status === "error").length || 0;
      const firstError = data?.results?.find((r: any) => r.status === "error");
      if (err > 0 && ok === 0) {
        toast.error(`Falha na sincronização: ${firstError?.error || "erro desconhecido"}`);
      } else {
        toast.success(`Sincronização concluída: ${ok} ok, ${err} erros`);
      }
      qc.invalidateQueries({ queryKey: ["ig-competitors"] });
      qc.invalidateQueries({ queryKey: ["ig-posts"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao sincronizar");
    } finally {
      setSyncingAll(false);
    }
  };

  // Detecta se há ao menos 1 perfil OAuth conectado (necessário para Business Discovery)
  const { data: hasOAuth, isLoading: loadingOAuth } = useQuery({
    queryKey: ["ig-has-oauth-token"],
    queryFn: async () => {
      const { count } = await supabase
        .from("social_media_client_profiles")
        .select("id", { count: "exact", head: true })
        .eq("oauth_connected", true)
        .not("oauth_access_token", "is", null)
        .gt("oauth_token_expires_at", new Date().toISOString());
      return (count || 0) > 0;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" /> Concorrentes monitorados
          </CardTitle>
          <CardDescription>
            {competitors.length} / {MAX_COMPETITORS} perfis. Apenas perfis <strong>Business ou Creator</strong> (limitação da API oficial do Instagram).
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={syncAll} disabled={syncingAll || competitors.length === 0 || !hasOAuth}>
            {syncingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar todos
          </Button>
          <Button size="sm" onClick={openCreate} disabled={competitors.length >= MAX_COMPETITORS}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!hasOAuth && (
          <div className="mb-4 rounded-lg border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="text-sm font-semibold">Token Instagram necessário para Espionagem</p>
                <p className="text-xs text-muted-foreground">
                  A API Business Discovery exige ao menos <strong>1 perfil OAuth conectado</strong> no sistema (o token desse perfil é usado para consultar concorrentes públicos).
                  Vá em <strong>Instagram → Perfis Monitorados</strong> e conecte um perfil (ou envie um link de autorização para um cliente).
                </p>
                <Button size="sm" variant="outline" asChild>
                  <a href="/instagram?tab=reports">Ir para Perfis Monitorados →</a>
                </Button>
              </div>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : competitors.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum concorrente cadastrado ainda.</p>
            <p className="text-xs mt-2">Clique em "Adicionar" para começar a espionar.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {competitors.map((c) => (
              <Card key={c.id} className={`relative group ${!c.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {c.profile_picture_url ? (
                      <img src={c.profile_picture_url} alt={c.username} className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                        <Eye className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold truncate">@{c.username}</p>
                        {!c.is_active && <Badge variant="secondary" className="text-[10px]">Pausado</Badge>}
                      </div>
                      {c.display_name && <p className="text-xs text-muted-foreground truncate">{c.display_name}</p>}
                      <Badge variant="outline" className="text-[10px] mt-1">
                        {CATEGORIAS.find((x) => x.value === c.category)?.label || c.category}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {c.followers_count != null && (
                      <p>{c.followers_count.toLocaleString("pt-BR")} seguidores</p>
                    )}
                    {c.last_synced_at ? (
                      <p className="flex items-center gap-1">
                        {c.last_sync_status === "ok" ? (
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-amber-600" />
                        )}
                        Sync {formatDistanceToNow(new Date(c.last_synced_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    ) : (
                      <p className="italic">Nunca sincronizado</p>
                    )}
                    {c.last_sync_error && (
                      <p className="text-destructive text-[10px] truncate" title={c.last_sync_error}>
                        Erro: {c.last_sync_error}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => syncOne(c.id)} disabled={syncingId === c.id} title="Sincronizar">
                      {syncingId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)} title="Editar">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive.mutate(c)} title={c.is_active ? "Pausar" : "Reativar"}>
                      {c.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(c)} title="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 ml-auto"
                      title="Abrir no Instagram"
                      onClick={() => {
                        const url = `https://www.instagram.com/${c.username}/`;
                        const w = window.open(url, "_blank", "noopener,noreferrer");
                        if (!w) {
                          // popup bloqueado — copia link como fallback
                          navigator.clipboard?.writeText(url);
                          toast.info("Popup bloqueado. Link copiado: " + url);
                        }
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar concorrente" : "Adicionar concorrente"}</DialogTitle>
            <DialogDescription>
              Use o @ do perfil. Só funciona com contas <strong>Business ou Creator</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Username (sem @)</Label>
              <Input
                placeholder="exemplo: nubank"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas (opcional)</Label>
              <Textarea
                placeholder="Por que monitorar esse perfil?"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir concorrente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>@{deleteTarget?.username}</strong>? Todos os posts coletados desse perfil serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
                setDeleteTarget(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ===========================================================
// ANÁLISES
// ===========================================================
function AnalysesTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [form, setForm] = useState({
    scope: "all" as "all" | "one",
    competitor_id: "",
    analysis_type: "insights" as "insights" | "sugestoes",
    period_days: "30",
  });

  const { data: competitors = [] } = useQuery({
    queryKey: ["ig-competitors-list"],
    queryFn: async () => {
      const { data } = await supabase.from("instagram_competitors").select("id, username, display_name").order("username");
      return data || [];
    },
  });

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ["ig-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_competitor_analyses")
        .select("*, instagram_competitors(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const generate = async () => {
    setAnalyzing(true);
    try {
      await invokeFunction("instagram-spy-analyze", {
        body: {
          competitor_id: form.scope === "one" ? form.competitor_id : null,
          analysis_type: form.analysis_type,
          period_days: parseInt(form.period_days),
        },
      });
      toast.success("Análise gerada!");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["ig-analyses"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar análise");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Análises da IA</CardTitle>
          <CardDescription>Insights e sugestões de conteúdo geradas com base nos posts coletados.</CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)} disabled={competitors.length === 0}>
          <Sparkles className="h-4 w-4 mr-2" /> Gerar análise
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : analyses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhuma análise gerada ainda.</p>
            <p className="text-xs mt-2">Sincronize concorrentes e clique em "Gerar análise".</p>
          </div>
        ) : (
          <div className="space-y-3">
            {analyses.map((a: any) => (
              <AnalysisCard key={a.id} analysis={a} />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Gerar nova análise</DialogTitle>
            <DialogDescription>
              A IA vai analisar os posts coletados no período escolhido. Custo: zero (Lovable AI).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Escopo</Label>
              <Select value={form.scope} onValueChange={(v: any) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os concorrentes (visão global)</SelectItem>
                  <SelectItem value="one">Apenas um concorrente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "one" && (
              <div>
                <Label>Concorrente</Label>
                <Select value={form.competitor_id} onValueChange={(v) => setForm({ ...form, competitor_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {competitors.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>@{c.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Tipo de análise</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, analysis_type: "insights" })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${form.analysis_type === "insights" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <TrendingUp className="h-5 w-5 mb-1 text-primary" />
                  <p className="font-semibold text-sm">Insights</p>
                  <p className="text-xs text-muted-foreground">Padrões, horários, hashtags, métricas</p>
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, analysis_type: "sugestoes" })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${form.analysis_type === "sugestoes" ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <Lightbulb className="h-5 w-5 mb-1 text-primary" />
                  <p className="font-semibold text-sm">Sugestões</p>
                  <p className="text-xs text-muted-foreground">5 ideias prontas com roteiro + legenda</p>
                </button>
              </div>
            </div>
            <div>
              <Label>Período</Label>
              <Select value={form.period_days} onValueChange={(v) => setForm({ ...form, period_days: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="15">Últimos 15 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="60">Últimos 60 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={generate} disabled={analyzing || (form.scope === "one" && !form.competitor_id)}>
              {analyzing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Gerar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AnalysisCard({ analysis }: { analysis: any }) {
  const [expanded, setExpanded] = useState(false);
  const isInsights = analysis.analysis_type === "insights";
  const c = analysis.content || {};
  const target = analysis.instagram_competitors?.username
    ? `@${analysis.instagram_competitors.username}`
    : "Todos os concorrentes";

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={isInsights ? "default" : "secondary"} className="gap-1">
                {isInsights ? <TrendingUp className="h-3 w-3" /> : <Lightbulb className="h-3 w-3" />}
                {isInsights ? "Insights" : "Sugestões"}
              </Badge>
              <Badge variant="outline">{target}</Badge>
              <Badge variant="outline">{analysis.period_days}d</Badge>
              <span className="text-xs text-muted-foreground">{analysis.posts_analyzed_count} posts</span>
            </div>
            <CardTitle className="text-sm">
              {isInsights ? (c.resumo_executivo || "Análise de insights") : (c.contexto_observado || "Sugestões de conteúdo")}
            </CardTitle>
            <CardDescription className="text-xs">
              {format(new Date(analysis.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          {isInsights ? <InsightsView content={c} /> : <SugestoesView content={c} />}
        </CardContent>
      )}
    </Card>
  );
}

function InsightsView({ content }: { content: any }) {
  return (
    <div className="space-y-4 text-sm">
      {content.padroes_horario?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-1"><Clock className="h-4 w-4" /> Melhores horários</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {content.padroes_horario.map((p: any, i: number) => (
              <div key={i} className="p-2 bg-muted rounded">
                <p className="font-medium">{p.faixa}</p>
                <p className="text-xs text-muted-foreground">{p.qtd_posts} posts · eng. {p.engajamento_medio}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {content.melhores_dias_semana?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Melhores dias da semana</h4>
          <div className="flex flex-wrap gap-1">
            {content.melhores_dias_semana.map((d: string, i: number) => <Badge key={i} variant="secondary">{d}</Badge>)}
          </div>
        </div>
      )}
      {content.top_hashtags?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-1"><Hash className="h-4 w-4" /> Top hashtags</h4>
          <div className="flex flex-wrap gap-1">
            {content.top_hashtags.map((h: any, i: number) => (
              <Badge key={i} variant="outline" title={`${h.frequencia} usos · eng. ${h.engajamento_medio}`}>
                {h.hashtag}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {content.formatos_campeoes?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Formatos campeões</h4>
          <div className="space-y-1">
            {content.formatos_campeoes.map((f: any, i: number) => (
              <div key={i} className="flex justify-between text-xs p-2 bg-muted rounded">
                <span>{f.tipo}</span>
                <span className="text-muted-foreground">{f.qtd} posts · eng. {f.engajamento_medio}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {content.ganchos_de_legenda?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Ganchos de legenda observados</h4>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            {content.ganchos_de_legenda.map((g: string, i: number) => <li key={i}>{g}</li>)}
          </ul>
        </div>
      )}
      {content.posts_destaque?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Posts em destaque</h4>
          <div className="space-y-2">
            {content.posts_destaque.map((p: any, i: number) => (
              <div key={i} className="p-2 border rounded text-xs">
                <p>{p.motivo}</p>
                <p className="text-muted-foreground mt-1">{p.likes} likes · {p.comments} comentários</p>
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer" className="text-primary text-[11px] inline-flex items-center gap-1 mt-1">
                    Ver post <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {content.recomendacoes?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2">Recomendações</h4>
          <ul className="list-disc pl-5 space-y-1">
            {content.recomendacoes.map((r: string, i: number) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function SugestoesView({ content }: { content: any }) {
  return (
    <div className="space-y-3">
      {content.sugestoes?.map((s: any, i: number) => (
        <div key={i} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Badge variant="default">{s.formato}</Badge>
              <h4 className="font-semibold mt-1">{s.titulo}</h4>
            </div>
          </div>
          <div className="text-sm space-y-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">GANCHO</p>
              <p>{s.gancho}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">ROTEIRO</p>
              <p className="whitespace-pre-wrap">{s.roteiro}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">LEGENDA</p>
              <div className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">{s.legenda}</div>
              <Button size="sm" variant="ghost" className="mt-1 h-7" onClick={() => {
                navigator.clipboard.writeText(s.legenda);
                toast.success("Legenda copiada!");
              }}>Copiar legenda</Button>
            </div>
            {s.hashtags?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground">HASHTAGS</p>
                <p className="text-xs">{s.hashtags.join(" ")}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground">CTA</p>
              <p className="text-sm">{s.cta}</p>
            </div>
            {s.inspirado_em && (
              <p className="text-[11px] text-muted-foreground italic">💡 {s.inspirado_em}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ===========================================================
// POSTS COLETADOS
// ===========================================================
function PostsTab() {
  const [filterCompetitor, setFilterCompetitor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("posted_at");

  const { data: competitors = [] } = useQuery({
    queryKey: ["ig-competitors-list"],
    queryFn: async () => {
      const { data } = await supabase.from("instagram_competitors").select("id, username").order("username");
      return data || [];
    },
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["ig-posts", filterCompetitor, filterType, sortBy],
    queryFn: async () => {
      let q = supabase
        .from("instagram_competitor_posts")
        .select("*, instagram_competitors(username, profile_picture_url)")
        .order(sortBy as any, { ascending: false })
        .limit(100);
      if (filterCompetitor !== "all") q = q.eq("competitor_id", filterCompetitor);
      if (filterType !== "all") q = q.eq("media_type", filterType);
      const { data } = await q;
      return data || [];
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Posts coletados</CardTitle>
        <CardDescription>Últimos 100 posts (mais recentes primeiro)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Select value={filterCompetitor} onValueChange={setFilterCompetitor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os concorrentes</SelectItem>
              {competitors.map((c: any) => <SelectItem key={c.id} value={c.id}>@{c.username}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="IMAGE">Imagem</SelectItem>
              <SelectItem value="VIDEO">Vídeo / Reel</SelectItem>
              <SelectItem value="CAROUSEL_ALBUM">Carrossel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="posted_at">Mais recentes</SelectItem>
              <SelectItem value="like_count">Mais curtidos</SelectItem>
              <SelectItem value="comments_count">Mais comentados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum post coletado ainda.</p>
            <p className="text-xs mt-2">Sincronize os concorrentes na aba "Concorrentes".</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {posts.map((p: any) => (
              <a key={p.id} href={p.permalink} target="_blank" rel="noopener noreferrer" className="block group">
                <div className="relative aspect-square bg-muted rounded-lg overflow-hidden">
                  {p.thumbnail_url || p.media_url ? (
                    <img src={p.thumbnail_url || p.media_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-1 right-1">
                    {p.media_type === "VIDEO" && <Badge className="text-[10px] gap-1"><PlayCircle className="h-3 w-3" /> Reel</Badge>}
                    {p.media_type === "CAROUSEL_ALBUM" && <Badge variant="secondary" className="text-[10px]">Carrossel</Badge>}
                  </div>
                </div>
                <div className="mt-1">
                  <p className="text-xs font-medium truncate">@{p.instagram_competitors?.username}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" /> {p.like_count}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" /> {p.comments_count}</span>
                  </div>
                  {p.posted_at && (
                    <p className="text-[10px] text-muted-foreground">{format(new Date(p.posted_at), "dd/MM/yy", { locale: ptBR })}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===========================================================
// CONFIGURAÇÕES
// ===========================================================
function ConfigTab() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["ig-espionage-config"],
    queryFn: async () => {
      const { data } = await supabase.from("instagram_espionage_config").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  const [local, setLocal] = useState<any>(null);
  useEffect(() => { if (config) setLocal(config); }, [config]);

  const save = async () => {
    if (!local) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("instagram_espionage_config")
        .update({
          auto_sync_enabled: local.auto_sync_enabled,
          sync_frequency: local.sync_frequency,
          auto_analysis_enabled: local.auto_analysis_enabled,
          default_analysis_type: local.default_analysis_type,
          default_analysis_period_days: local.default_analysis_period_days,
        })
        .eq("id", local.id);
      if (error) throw error;

      // Atualiza cron
      const freq = local.auto_sync_enabled ? local.sync_frequency : "manual";
      const { error: cronErr } = await supabase.rpc("update_instagram_spy_cron", { p_frequency: freq });
      if (cronErr) throw cronErr;

      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["ig-espionage-config"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !local) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SettingsIcon className="h-5 w-5" /> Configurações da Espionagem</CardTitle>
        <CardDescription>Defina como e quando a sincronização e análise automáticas acontecem.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Sincronização automática</Label>
              <p className="text-xs text-muted-foreground">Coleta posts dos concorrentes ativos automaticamente.</p>
            </div>
            <Switch
              checked={local.auto_sync_enabled}
              onCheckedChange={(v) => setLocal({ ...local, auto_sync_enabled: v })}
            />
          </div>
          {local.auto_sync_enabled && (
            <div>
              <Label>Frequência</Label>
              <Select value={local.sync_frequency} onValueChange={(v) => setLocal({ ...local, sync_frequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIAS.filter(f => f.value !== "manual").map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-3 border-t">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Análise automática após sync</Label>
              <p className="text-xs text-muted-foreground">
                ⚠️ Esta versão dispara apenas a sincronização. A análise pela IA é manual (botão "Gerar análise").
              </p>
            </div>
            <Switch
              checked={local.auto_analysis_enabled}
              onCheckedChange={(v) => setLocal({ ...local, auto_analysis_enabled: v })}
              disabled
            />
          </div>
        </div>

        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Última execução automática:</strong>{" "}
            {local.last_auto_run_at
              ? `${format(new Date(local.last_auto_run_at), "dd/MM/yyyy HH:mm", { locale: ptBR })} — ${local.last_auto_run_status || ""}`
              : "Nunca executado"}
          </p>
        </div>

        <div className="bg-muted/50 border rounded-lg p-3 text-xs space-y-1">
          <p className="font-semibold flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Limitações da API oficial do Instagram</p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
            <li>Funciona apenas com perfis <strong>Business ou Creator</strong> (perfil pessoal não retorna)</li>
            <li>Pega até <strong>25 posts mais recentes</strong> por perfil em cada sincronização</li>
            <li>Limite de <strong>25 perfis monitorados</strong> (limite diário da API Meta)</li>
            <li><strong>Não transcreve áudio de Reels</strong> — a IA analisa legenda, hashtags e métricas</li>
            <li>Para remover essas limitações: ativar a integração com Apify (versão paga, ~US$ 3/mês)</li>
          </ul>
        </div>

        <Button onClick={save} disabled={saving} className="w-full">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Salvar configurações
        </Button>
      </CardContent>
    </Card>
  );
}
