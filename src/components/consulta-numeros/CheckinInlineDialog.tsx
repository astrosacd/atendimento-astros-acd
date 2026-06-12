import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAparelhos } from "@/hooks/useAparelhos";
import {
  useCreateCheckin,
  useActiveCheckinsByModelo,
  type TipoSlot,
  type StatusConexao,
} from "@/hooks/useCheckinDiario";
import { Smartphone } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  numero: string;
  baserowRowId: number | null;
  clienteNome: string | null;
  /** Aparelho já vinculado (último check-in conectado), se houver. */
  defaultAparelhoId?: string | null;
  defaultTipoSlot?: TipoSlot;
}

export function CheckinInlineDialog({
  open,
  onOpenChange,
  numero,
  baserowRowId,
  clienteNome,
  defaultAparelhoId,
  defaultTipoSlot,
}: Props) {
  const { data: aparelhos = [] } = useAparelhos();
  const ocupadosByModelo = useActiveCheckinsByModelo();
  const createMut = useCreateCheckin();

  const [aparelhoId, setAparelhoId] = useState<string>(defaultAparelhoId ?? "");
  const [tipoSlot, setTipoSlot] = useState<TipoSlot>(defaultTipoSlot ?? "normal");
  const [statusConexao, setStatusConexao] = useState<StatusConexao>("conectado");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) {
      setAparelhoId(defaultAparelhoId ?? "");
      setTipoSlot(defaultTipoSlot ?? "normal");
      setStatusConexao("conectado");
      setObservacao("");
    }
  }, [open, defaultAparelhoId, defaultTipoSlot]);

  const selectedAparelho = aparelhos.find((a) => a.id === aparelhoId);

  const handleSave = async () => {
    if (!aparelhoId) {
      toast({ title: "Selecione o aparelho", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync({
        numero,
        baserow_row_id: baserowRowId,
        cliente_nome: clienteNome,
        aparelho_id: aparelhoId,
        modelo_snapshot: selectedAparelho
          ? `${selectedAparelho.modelo?.nome ?? ""} (${selectedAparelho.apelido})`.trim()
          : null,
        tipo_slot: tipoSlot,
        status_conexao: statusConexao,
        observacao: observacao.trim() || null,
      });
      toast({ title: "✅ Check-in registrado" });
      onOpenChange(false);
    } catch (e: any) {
      toast({
        title: "Erro ao registrar",
        description: e?.message ?? "Falha",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check-in do número</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{numero}</span>
            {clienteNome ? ` — ${clienteNome}` : ""}
            {baserowRowId ? ` · linha #${baserowRowId}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Aparelho (modelo físico) *</Label>
            <Select value={aparelhoId} onValueChange={setAparelhoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um aparelho" />
              </SelectTrigger>
              <SelectContent>
                {aparelhos.map((a) => {
                  const ocup = a.modelo_id
                    ? ocupadosByModelo.get(a.modelo_id)?.total ?? 0
                    : 0;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="inline-flex items-center gap-1">
                        <Smartphone className="h-3 w-3" />
                        {a.apelido}
                        {a.modelo?.nome ? ` — ${a.modelo.nome}` : ""}
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          {ocup}/{a.capacidade_total}
                        </Badge>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de slot *</Label>
              <Select value={tipoSlot} onValueChange={(v) => setTipoSlot(v as TipoSlot)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="clone">Clone</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status conexão *</Label>
              <Select
                value={statusConexao}
                onValueChange={(v) => setStatusConexao(v as StatusConexao)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conectado">Conectado</SelectItem>
                  <SelectItem value="desconectado">Desconectado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Observação</Label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              placeholder="Ex.: ok / banido / status do papel…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={createMut.isPending}>
            {createMut.isPending ? "Salvando…" : "✅ Foi checado agora"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
