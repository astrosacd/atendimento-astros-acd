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

  useEffect(() => { setSelectedClienteId(clienteId ?? ""); }, [clienteId, open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const promises: any[] = [
        supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria, texto").eq("ativo", true).order("nome"),
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

  const selectedCliente = useMemo(() => {
    if (clienteId) return { id: clienteId, nome: clienteNome ?? "", numero: clienteNumero ?? "" };
    return clientes.find(c => c.id === selectedClienteId) ?? null;
  }, [clienteId, clienteNome, clienteNumero, clientes, selectedClienteId]);

  const ligar = async () => {
    if (!roteiroId) return toast({ title: "Selecione um roteiro", variant: "destructive" });
    if (!selectedCliente?.id) return toast({ title: "Selecione um cliente", variant: "destructive" });
    const callPopup = window.open("", "wavoip_call", "width=360,height=640");
    callPopup?.document.write("<title>Ligação Wavoip</title><p style='font-family:sans-serif;padding:16px'>Preparando ligação...</p>");
    setCalling(true);
    const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
      body: { cliente_id: selectedCliente.id, roteiro_id: roteiroId, source: "cliente_card" },
    });
    setCalling(false);
    if (error) {
      callPopup?.close();
      const description = error.message?.includes("Failed to send a request")
        ? "O navegador bloqueou a chamada da ligação. Atualize a página e tente novamente."
        : error.message;
      return toast({ title: "Erro ao ligar", description, variant: "destructive" });
    }
    if ((data as any)?.call_url) {
      if (callPopup) callPopup.location.href = (data as any).call_url;
      else window.open((data as any).call_url, "wavoip_call", "width=360,height=640");
    }
    toast({ title: "Ligação aberta na Wavoip", description: `Para ${selectedCliente.nome}` });
    onOpenChange(false);
  };

  const preview = roteiros.find(r => r.id === roteiroId);

  // Build preview text with variables filled
  const filledPreview = useMemo(() => {
    if (!preview || !selectedCliente) return preview?.texto ?? "";
    const c: any = selectedCliente;
    const vars: Record<string, string> = {
      nome: c.nome ?? "",
      produto: c.produto ?? "",
      valor: c.valor != null ? String(c.valor) : "",
      data_renovacao: c.data_renovacao ?? "",
    };
    return preview.texto.replace(/\{(\w+)\}/g, (_: string, k: string) => vars[k] ?? `{${k}}`);
  }, [preview, selectedCliente]);

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
                  <SelectItem key={r.id} value={r.id}>{r.nome} ({r.categoria})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preview && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-medium mb-1">Pré-visualização do texto (variáveis preenchidas):</p>
              <p className="text-foreground whitespace-pre-wrap">{filledPreview}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">
                Variáveis suportadas: {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"}.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={ligar} disabled={calling || !roteiroId || !selectedCliente?.id || configOk === false}>
            {calling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Phone className="h-4 w-4 mr-1" />}
            Ligar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
