import { useState, useEffect, useMemo } from "react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { toast } from "@/hooks/use-toast";
import {
  useNumerosAquecimento,
  useNumerosModelos,
  useNumerosStatus,
} from "@/hooks/useNumerosAquecimento";
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
  /** Modelo já vinculado (último check-in conectado), se houver. */
  defaultModeloId?: string | null;
}

function deriveTipoSlot(nome: string): TipoSlot {
  const n = nome.toLowerCase();
  if (/\bbusiness\b/.test(n)) return "business";
  if (/\bclone\b/.test(n)) return "clone";
  return "normal";
}

export function CheckinInlineDialog({
  open,
  onOpenChange,
  numero,
  baserowRowId,
  clienteNome,
  defaultModeloId,
}: Props) {
  const { data: modelos = [] } = useNumerosModelos();
  const { data: numeros = [] } = useNumerosAquecimento();
  const { data: statusList = [] } = useNumerosStatus();
  const ocupadosByModelo = useActiveCheckinsByModelo();
  const createMut = useCreateCheckin();

  const [modeloId, setModeloId] = useState<string>(defaultModeloId ?? "");
  const [statusConexao, setStatusConexao] = useState<StatusConexao>("conectado");
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) {
      setModeloId(defaultModeloId ?? "");
      setStatusConexao("conectado");
      setObservacao("");
    }
  }, [open, defaultModeloId]);

  // Calcula vagas por modelo (mesma lógica do CapacityBanner)
  const modelosComVagas = useMemo(() => {
    const vendidoId = statusList.find((s) => s.nome === "Vendido")?.id;
    const estoque = vendidoId
      ? numeros.filter((n) => n.status_id !== vendidoId)
      : numeros;

    return modelos
      .filter((m) => m.capacidade_whatsapp > 0)
      .filter((m) => m.aparece_no_checkin !== false || m.id === defaultModeloId)
      .map((m) => {
        const doModelo = estoque.filter((n) => n.modelo_id === m.id).length;
        const extra = ocupadosByModelo.get(m.id)?.total ?? 0;
        const ocupados = doModelo + extra;
        const livres = Math.max(0, m.capacidade_whatsapp - ocupados);
        return { modelo: m, ocupados, capacidade: m.capacidade_whatsapp, livres };
      })
      .filter((o) => o.livres > 0 || o.modelo.id === defaultModeloId)
      .sort((a, b) => a.modelo.nome.localeCompare(b.modelo.nome));
  }, [modelos, numeros, statusList, ocupadosByModelo, defaultModeloId]);

  const selectedModelo = modelos.find((m) => m.id === modeloId);
  const isExterno = modeloId === "__externo__";

  const handleSave = async () => {
    if (!modeloId) {
      toast({ title: "Selecione o modelo do aparelho", variant: "destructive" });
      return;
    }
    if (!isExterno && !selectedModelo) {
      toast({ title: "Modelo inválido", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync({
        numero,
        baserow_row_id: baserowRowId,
        cliente_nome: clienteNome,
        aparelho_id: null,
        modelo_id: isExterno ? null : modeloId,
        modelo_snapshot: isExterno ? "Aparelho externo" : selectedModelo!.nome,
        tipo_slot: isExterno ? "normal" : deriveTipoSlot(selectedModelo!.nome),
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
            <Label>Modelo do aparelho *</Label>
            <SearchableSelect
              value={modeloId}
              onValueChange={setModeloId}
              placeholder="Selecione um modelo disponível"
              searchPlaceholder="Buscar modelo…"
              emptyMessage="Nenhum modelo encontrado"
              options={[
                { value: "__externo__", label: "📦 Sem modelo (aparelho externo)" },
                ...modelosComVagas.map((o) => ({
                  value: o.modelo.id,
                  label: `${o.modelo.nome} · ${o.ocupados}/${o.capacidade}${o.livres > 0 ? ` · falta ${o.livres}` : ""}`,
                })),
              ]}
            />
            {isExterno && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Use para números em aparelhos de terceiros (não cadastrados no sistema).
              </p>
            )}
            {modelosComVagas.length === 0 && !isExterno && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Nenhum modelo com vaga disponível — selecione "Sem modelo" se for aparelho externo.
              </p>
            )}
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
                <SelectItem value="conectado">🟢 Conectado</SelectItem>
                <SelectItem value="desconectado_cliente">🟡 Desconectado do Cliente</SelectItem>
                <SelectItem value="desconectado">🔴 Desconectado (banido)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">
              <strong>Desconectado do Cliente</strong>: o WhatsApp está ativo no celular, mas não está vinculado ao cliente.
            </p>
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
