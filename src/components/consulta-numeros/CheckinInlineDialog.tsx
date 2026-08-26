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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  numero: string;
  baserowRowId: number | null;
  clienteNome: string | null;
  /** Modelo já vinculado (último check-in conectado), se houver. */
  defaultModeloId?: string | null;
  defaultIsExternal?: boolean;
  defaultModeloManual?: string | null;
  defaultStatusConexao?: StatusConexao | null;
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
  defaultIsExternal = false,
  defaultModeloManual,
  defaultStatusConexao,
}: Props) {
  const { data: modelos = [] } = useNumerosModelos();
  const { data: numeros = [] } = useNumerosAquecimento();
  const { data: statusList = [] } = useNumerosStatus();
  const ocupadosByModelo = useActiveCheckinsByModelo();
  const createMut = useCreateCheckin();

  const [modeloId, setModeloId] = useState<string>(defaultIsExternal ? "__externo__" : defaultModeloId ?? "");
  const [statusConexao, setStatusConexao] = useState<StatusConexao>(defaultStatusConexao ?? "conectado");
  const [observacao, setObservacao] = useState("");
  const [manualModelo, setManualModelo] = useState("");

  useEffect(() => {
    if (open) {
      setModeloId(defaultIsExternal ? "__externo__" : defaultModeloId ?? "");
      setStatusConexao(defaultStatusConexao ?? "conectado");
      setObservacao("");
      setManualModelo(defaultModeloManual ?? "");
    }
  }, [open, defaultModeloId, defaultIsExternal, defaultModeloManual, defaultStatusConexao]);

  const modelosComVagas = useMemo(() => {
    const vendidoId = statusList.find((s) => s.nome === "Vendido")?.id;
    const estoque = vendidoId
      ? numeros.filter((n) => n.status_id !== vendidoId)
      : numeros;

    return modelos
      .filter((m) => m.capacidade_whatsapp > 0)
      .filter((m) => m.aparece_no_checkin !== false || m.id === defaultModeloId)
      .map((m) => {
        const numbersInAquecimento = new Set(estoque.filter((n) => n.modelo_id === m.id).map(n => n.numero));
        const numbersWithCheckin = (ocupadosByModelo.get(m.id) as any)?.numbers ?? new Set<string>();
        const allUniqueNumbers = new Set([...numbersInAquecimento, ...numbersWithCheckin]);
        const ocupados = allUniqueNumbers.size;
        const livres = Math.max(0, m.capacidade_whatsapp - ocupados);
        return { modelo: m, ocupados, capacidade: m.capacidade_whatsapp, livres };
      })
      // Mantém também os modelos cheios na lista (aparecem desabilitados como "cheio")
      .sort((a, b) => {
        if ((a.livres > 0) !== (b.livres > 0)) return a.livres > 0 ? -1 : 1;
        return a.modelo.nome.localeCompare(b.modelo.nome);
      });
  }, [modelos, numeros, statusList, ocupadosByModelo, defaultModeloId]);

  const selectedModelo = modelos.find((m) => m.id === modeloId);
  const isExterno = modeloId === "__externo__";
  const externalModelLocked = defaultIsExternal && !!defaultModeloManual?.trim();

  const handleSave = async () => {
    if (!modeloId) {
      toast({ title: "Selecione o modelo do aparelho", variant: "destructive" });
      return;
    }
    if (!isExterno && !selectedModelo) {
      toast({ title: "Modelo inválido", variant: "destructive" });
      return;
    }
    if (isExterno && !manualModelo.trim()) {
      toast({ title: "Informe o modelo manual do aparelho externo", variant: "destructive" });
      return;
    }
    try {
      await createMut.mutateAsync({
        numero,
        baserow_row_id: baserowRowId,
        cliente_nome: clienteNome,
        aparelho_id: null,
        modelo_id: isExterno ? null : modeloId,
        modelo_snapshot: isExterno ? manualModelo.trim() : selectedModelo!.nome,
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
              disabled={defaultIsExternal}
              options={[
                { value: "__externo__", label: "📦 Aparelho externo" },
                ...modelosComVagas.map((o) => ({
                  value: o.modelo.id,
                  label: `${o.modelo.nome} · ${o.ocupados}/${o.capacidade}${o.livres > 0 ? ` · falta ${o.livres}` : " · cheio"}`,
                  disabled: o.livres <= 0 && o.modelo.id !== defaultModeloId,
                })),
              ]}
            />
            {isExterno && (
              <div className="mt-3 space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Modelo do aparelho externo *</Label>
                <Input
                  value={manualModelo}
                  onChange={(e) => setManualModelo(e.target.value)}
                  placeholder="Ex: Redmi 13C, iPhone 11..."
                  className="h-8 text-xs"
                  disabled={externalModelLocked}
                />
                <p className="text-[10px] text-muted-foreground">
                  {externalModelLocked
                    ? "Modelo fixo deste número externo. Para trocar, remova o número da lista e marque novamente."
                    : "Obrigatório para registrar onde o número externo está hospedado."}
                </p>
              </div>
            )}
            {modelosComVagas.every((o) => o.livres <= 0) && !isExterno && (
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
