import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Phone, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface Props {
  clienteId: string;
  clienteNome: string;
  clienteNumero: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LigarComIADialog({ clienteId, clienteNome, clienteNumero, open, onOpenChange }: Props) {
  const [roteiros, setRoteiros] = useState<any[]>([]);
  const [roteiroId, setRoteiroId] = useState("");
  const [calling, setCalling] = useState(false);
  const [configOk, setConfigOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [r, c] = await Promise.all([
        supabase.from("ligacoes_ia_roteiros").select("id, nome, categoria, texto").eq("ativo", true).order("nome"),
        supabase.from("ligacoes_ia_config").select("config_key, config_value").in("config_key", ["wavoip_token", "wavoip_dialer_number", "elevenlabs_api_key"]),
      ]);
      setRoteiros(r.data ?? []);
      const map: Record<string, string> = {};
      (c.data ?? []).forEach((x: any) => map[x.config_key] = x.config_value ?? "");
      setConfigOk(!!map.wavoip_token && !!map.wavoip_dialer_number && !!map.elevenlabs_api_key);
    })();
  }, [open]);

  const ligar = async () => {
    if (!roteiroId) {
      toast({ title: "Selecione um roteiro", variant: "destructive" });
      return;
    }
    setCalling(true);
    const { data, error } = await supabase.functions.invoke("ligacoes-ia-call", {
      body: { cliente_id: clienteId, roteiro_id: roteiroId, source: "cliente_card" },
    });
    setCalling(false);
    if (error) return toast({ title: "Erro ao ligar", description: error.message, variant: "destructive" });
    toast({ title: "Ligação disparada!", description: `Para ${clienteNome} • cache: ${(data as any)?.cache_hit ? "sim" : "não"}` });
    onOpenChange(false);
  };

  const preview = roteiros.find(r => r.id === roteiroId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-fuchsia-500" /> Ligar com IA para {clienteNome}
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
          <div className="text-sm text-muted-foreground">
            Destino: <span className="font-mono text-foreground">{clienteNumero}</span>
          </div>
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
              <p className="font-medium mb-1">Pré-visualização do texto:</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{preview.texto}</p>
              <p className="mt-2 text-[10px] text-muted-foreground">Variáveis {"{nome}"}, {"{valor}"}, {"{produto}"}, {"{data_renovacao}"} serão preenchidas automaticamente com os dados do cliente.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={ligar} disabled={calling || !roteiroId || configOk === false}>
            {calling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Phone className="h-4 w-4 mr-1" />}
            Ligar agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
