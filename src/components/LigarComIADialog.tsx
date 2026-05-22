import { useState, useEffect, useMemo, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Loader2, Phone, AlertCircle, PhoneOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { placeCallWithTTS, type ActiveCallHandle } from "@/lib/wavoipCall";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { valorPorExtenso, formatMoeda, type MoedaExtenso } from "@/lib/valorExtenso";

interface Props {
  clienteId?: string;
  clienteNome?: string;
  clienteNumero?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LigarComIADialog({ clienteId, clienteNome, clienteNumero, open, onOpenChange }: Props) {
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [roteiroId, setRoteiroId] = useState("");
  const [calling, setCalling] = useState(false);
  const [configOk, setConfigOk] = useState<boolean | null>(null);

  // Pickable clients (when no clienteId is passed)
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string>(clienteId ?? "");
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [fetchedCliente, setFetchedCliente] = useState<any | null>(null);

  useEffect(() => { setSelectedClienteId(clienteId ?? ""); }, [clienteId, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const promises: any[] = [
        supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria, texto, moeda, idioma, tipo").eq("ativo", true).order("nome"),
        supabase.from("ligacoes_ia_config").select("config_key, config_value").in("config_key", ["wavoip_token", "wavoip_dialer_number", "elevenlabs_api_key"]),
      ];
      if (!clienteId) {
        setLoadingClientes(true);
        promises.push(supabase.from("clientes").select("id, nome, numero, tipo, produto, valor, cobranca_ativa, ciclo_cobranca, data_renovacao").order("nome").limit(2000));
      }
      const results = await Promise.all(promises);
      const [r, c, cli] = results;
      setRoteiros(r.data ?? []);
      const map: Record<string, string> = {};
      (c.data ?? []).forEach((x: any) => map[x.config_key] = x.config_value ?? "");
      setConfigOk(!!map.wavoip_token && !!map.wavoip_dialer_number && !!map.elevenlabs_api_key);
      if (cli) {
        setClientes(cli.data ?? []);
        setLoadingClientes(false);
      }
    })();
  }, [open, clienteId]);

  // When opened from a client card (clienteId in props), fetch the full record
  // so the preview can fill {valor}, {produto}, {data_renovacao}.
  useEffect(() => {
    if (!open || !clienteId) { setFetchedCliente(null); return; }
    let cancelled = false;
    supabase.from("clientes")
      .select("id, nome, numero, produto, valor, moeda, data_renovacao")
      .eq("id", clienteId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setFetchedCliente(data ?? null); });
    return () => { cancelled = true; };
  }, [open, clienteId]);

  const selectedCliente = useMemo(() => {
    if (clienteId) {
      if (fetchedCliente) return fetchedCliente;
      return { id: clienteId, nome: clienteNome ?? "", numero: clienteNumero ?? "" };
    }
    return clientes.find(c => c.id === selectedClienteId) ?? null;
  }, [clienteId, clienteNome, clienteNumero, clientes, selectedClienteId, fetchedCliente]);

  const [callStatus, setCallStatus] = useState<string>("");
  const [valorExtenso, setValorExtenso] = useState<boolean>(false);
  const callRef = useRef<ActiveCallHandle | null>(null);

  const ligar = async () => {
    if (!roteiroId) return toast({ title: "Selecione um roteiro", variant: "destructive" });
    if (!selectedCliente?.id) return toast({ title: "Selecione um cliente", variant: "destructive" });
    setCalling(true);
    setCallStatus("Gerando áudio do roteiro...");
    try {
      const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
        body: { cliente_id: selectedCliente.id, roteiro_id: roteiroId, source: "cliente_card", valor_extenso: valorExtenso },
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
      toast({ title: "Ligação em andamento", description: `Para ${selectedCliente.nome}` });
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

  const preview = roteiros.find(r => r.id === roteiroId);

  // Build preview text with variables filled (same formatting as backend)
  // + detect variables used in the script that have no value in the client record.
  const { filledPreview, missingVars, usedVars, moedaUsada, moedaMismatch } = useMemo(() => {
    if (!preview) return { filledPreview: "", missingVars: [] as string[], usedVars: [] as string[], moedaUsada: "BRL" as MoedaExtenso, moedaMismatch: false };
    const c: any = selectedCliente ?? {};
    const moeda: MoedaExtenso = (preview.moeda ?? "BRL") as MoedaExtenso;
    const clienteMoeda: MoedaExtenso = (c.moeda ?? "BRL") as MoedaExtenso;
    const valorRaw = c.valor;
    const valorFmt = valorRaw != null && valorRaw !== ""
      ? (valorExtenso ? valorPorExtenso(Number(valorRaw), moeda) : formatMoeda(Number(valorRaw), moeda))
      : "";
    let dataFmt = "";
    if (c.data_renovacao) {
      const [y, m, d] = String(c.data_renovacao).split("T")[0].split("-");
      if (y && m && d) {
        dataFmt = preview.idioma === "pt-BR" ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
      } else dataFmt = String(c.data_renovacao);
    }
    const vars: Record<string, string> = {
      nome: c.nome ?? "",
      produto: c.produto ?? "",
      valor: valorFmt,
      data_renovacao: dataFmt,
    };
    const used = Array.from(new Set([...preview.texto.matchAll(/\{(\w+)\}/g)].map((m: any) => m[1])));
    const missing = used.filter((k) => !vars[k] || vars[k] === "");
    const filled = preview.texto.replace(/\{(\w+)\}/g, (_: string, k: string) => {
      const v = vars[k];
      if (!v) return `⚠️[${k} não cadastrado]`;
      return v;
    });
    return { filledPreview: filled, missingVars: missing, usedVars: used, moedaUsada: moeda, moedaMismatch: clienteMoeda !== moeda };
  }, [preview, selectedCliente, valorExtenso]);

  const isMensal = (c: any) => !!c.cobranca_ativa;
  const isRegistro = (c: any) => !c.cobranca_ativa;

  const mensaisCount = useMemo(() => clientes.filter(isMensal).length, [clientes]);
  const registrosCount = useMemo(() => clientes.filter(isRegistro).length, [clientes]);

  const clienteOptions = useMemo(() =>
    clientes.map(c => {
      const tipoLabel = isMensal(c) ? "📅 MENSAL" : "📋 REGISTRO";
      const produto = c.produto ? ` — ${c.produto}` : "";
      const numero = c.numero ? ` (${c.numero})` : "";
      return {
        value: c.id,
        label: `[${tipoLabel}] ${c.nome}${produto}${numero}`,
      };
    }),
    [clientes]
  );

  const showPicker = !clienteId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-fuchsia-500" />
            Ligar com IA{clienteId && clienteNome ? ` para ${clienteNome}` : ""}
          </DialogTitle>
        </DialogHeader>

        {configOk === false && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-medium">Configuração incompleta</p>
              <p className="text-muted-foreground text-xs">Configure Wavoip e ElevenLabs antes de ligar.</p>
              <Link to="/ligacoes-ia" className="text-xs text-primary underline">Ir para Configurações →</Link>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {showPicker && (
            <div>
              <Label>Cliente</Label>
              <SearchableSelect
                options={clienteOptions}
                value={selectedClienteId}
                onValueChange={setSelectedClienteId}
                placeholder={loadingClientes ? "Carregando clientes..." : "Buscar cliente por nome ou número..."}
                searchPlaceholder="Digite nome, número ou produto..."
                emptyMessage="Nenhum cliente encontrado"
                disabled={loadingClientes}
              />
              <p className="text-xs text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <span className="font-medium text-foreground">{clientes.length}</span> clientes
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  📅 <span className="font-medium text-foreground">{mensaisCount}</span> mensais
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                  📋 <span className="font-medium text-foreground">{registrosCount}</span> registros
                </span>
              </p>
            </div>
          )}

          {selectedCliente && (
            <div className="text-sm text-muted-foreground">
              Destino: <span className="font-mono text-foreground">{selectedCliente.numero || "—"}</span>
            </div>
          )}

          <div>
            <Label>Roteiro</Label>
            <Select value={roteiroId} onValueChange={setRoteiroId}>
              <SelectTrigger><SelectValue placeholder="Selecione um roteiro ativo" /></SelectTrigger>
              <SelectContent>
                {roteiros.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">Nenhum roteiro ativo. Crie um em Ligações IA.</div>
                ) : roteiros.map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome} ({r.categoria}) · {r.moeda ?? "BRL"}{r.idioma && r.idioma !== "pt-BR" ? ` · ${r.idioma}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {moedaMismatch && preview && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Moeda do roteiro ({moedaUsada}) difere da moeda do cliente ({(selectedCliente as any)?.moeda ?? "BRL"}). O valor será falado em {moedaUsada}.
              </p>
            )}
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">Pré-visualização (variáveis preenchidas):</p>
                {usedVars.includes("valor") && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <Switch checked={valorExtenso} onCheckedChange={setValorExtenso} />
                    <span className="text-[10px] text-muted-foreground">Valor por extenso</span>
                  </label>
                )}
              </div>
              <p className="text-foreground whitespace-pre-wrap">{filledPreview}</p>
              {missingVars.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/50">
                  <span className="text-[10px] text-muted-foreground">Faltando no cadastro:</span>
                  {missingVars.map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px] border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                      ⚠ {v} não cadastrado
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">
                Variáveis suportadas: {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"}.
              </p>
            </div>
          )}
        </div>

        {calling && callStatus && (
          <div className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/5 p-3 text-xs flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-fuchsia-500" />
            <span className="text-foreground">{callStatus}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={calling}>Fechar</Button>
          {calling ? (
            <Button variant="destructive" onClick={desligar}>
              <PhoneOff className="h-4 w-4 mr-1" /> Desligar
            </Button>
          ) : (
            <Button onClick={ligar} disabled={!roteiroId || !selectedCliente?.id || configOk === false}>
              <Phone className="h-4 w-4 mr-1" /> Ligar agora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
