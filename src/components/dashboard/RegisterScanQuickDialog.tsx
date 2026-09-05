import { useState, useMemo } from "react";
import { copyToClipboard } from "@/utils/clipboard";
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
import { toast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  useRegisterScan,
  useQrScanConfig,
  useMonthlyCounters,
  useQrScanHistory,
  useAutoHospedadoNumbers,
  useToggleAutoHospedado,
} from "@/hooks/useQrScan";

import { PAYMENT_METHOD_LABELS } from "@/constants/qrScan";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  baserowRowId: number;
  numero: string;
  clienteNome?: string | null;
}

export function RegisterScanQuickDialog({
  open,
  onOpenChange,
  baserowRowId,
  numero,
  clienteNome,
}: Props) {
  const { data: config } = useQrScanConfig();
  const { data: counters } = useMonthlyCounters();
  const { data: history = [] } = useQrScanHistory();
  const registerScan = useRegisterScan();

  const [step, setStep] = useState<"initial" | "payment">("initial");
  const [obs, setObs] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("link_mp");
  const [manualObs, setManualObs] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [needsValor, setNeedsValor] = useState<number | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const maxGratis = config?.qtd_gratis_por_mes ?? 4;
  const maxPorDia = config?.qtd_por_dia ?? 1;
  const valorExced = Number(config?.valor_excedente ?? 14.97);

  const counter = counters?.get(baserowRowId) ?? { qtd_gratis_usados: 0, qtd_pagos: 0 };
  const freeRestantes = Math.max(0, maxGratis - counter.qtd_gratis_usados);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayScans = useMemo(
    () => history.filter((h) => h.baserow_row_id === baserowRowId && h.created_at.slice(0, 10) === todayStr),
    [history, baserowRowId, todayStr],
  );
  const confirmedToday = todayScans.filter((s) => s.payment_status === "pago" || s.payment_status === "nao_aplica");
  const pendingToday = todayScans.find((s) => s.payment_status === "pendente");
  const limitReached = confirmedToday.length >= maxPorDia;

  const reset = () => {
    setStep("initial");
    setObs("");
    setManualObs("");
    setComprovanteUrl("");
    setNeedsValor(null);
    setGeneratedUrl(null);
    setPaymentMethod("link_mp");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    try {
      const payload: any = { baserow_row_id: baserowRowId, observacao: obs };
      if (step === "payment") {
        payload.payment_method = paymentMethod;
        payload.payment_manual_observacao = manualObs;
        payload.payment_comprovante_url = comprovanteUrl || undefined;
      }
      const res: any = await registerScan.mutateAsync(payload);
      if (res?.status === "daily_limit") {
        toast({ title: "Limite diário atingido", description: res.message ?? "Já houve scan hoje.", variant: "destructive" });
        return;
      }
      if (res?.status === "needs_payment") {
        setNeedsValor(res.valor);
        setStep("payment");
        return;
      }
      if (res?.status === "gratis_registrado") {
        toast({ title: "✅ Escaneamento grátis registrado", description: `Restam ${res.restantes_gratis} grátis este mês.` });
        handleClose(false);
      } else if (res?.status === "pendente_pagamento") {
        if (res.payment_url) {
          setGeneratedUrl(res.payment_url);
          toast({ title: "🔗 Link de pagamento gerado", description: "Envie ao cliente." });
        } else {
          toast({ title: "💸 Cobrança registrada", description: 'Confirme em "Pendentes" assim que receber.' });
          handleClose(false);
        }
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao registrar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar escaneamento de QR</DialogTitle>
          <DialogDescription>
            <span className="font-mono">{numero}</span>
            {clienteNome ? ` · ${clienteNome}` : ""}
          </DialogDescription>
        </DialogHeader>

        {step === "initial" && (
          <div className="space-y-3">
            {limitReached ? (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm flex gap-2 items-start">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
                <div>
                  Limite diário atingido ({confirmedToday.length}/{maxPorDia}). Já existe escaneamento confirmado hoje.
                </div>
              </div>
            ) : pendingToday ? (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/40 text-sm flex gap-2 items-start">
                <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-amber-600 shrink-0" />
                <div>
                  Já existe uma cobrança <strong>pendente</strong> hoje para este número. Confirme em "Pendentes" no módulo Consulta Números.
                </div>
              </div>
            ) : (
              <>
                <div className="p-3 rounded-md bg-muted/40 border text-sm">
                  {freeRestantes > 0 ? (
                    <>Você tem <strong>{freeRestantes} grátis</strong> restantes este mês.</>
                  ) : (
                    <>Limite grátis atingido. Cada novo scan custa <strong>R$ {valorExced.toFixed(2)}</strong>.</>
                  )}
                </div>
                <div>
                  <Label>Observação (opcional)</Label>
                  <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}

        {step === "payment" && !generatedUrl && (
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm">
              ⚠️ Cobrança de <strong>R$ {(needsValor ?? valorExced).toFixed(2)}</strong>. Como o cliente vai pagar?
            </div>
            <div>
              <Label>Método</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {paymentMethod !== "link_mp" && paymentMethod !== "link_stripe" && (
              <>
                <div>
                  <Label>Observação do pagamento</Label>
                  <Textarea rows={2} value={manualObs} onChange={(e) => setManualObs(e.target.value)} placeholder="Ex: PIX 14h, ID 123…" />
                </div>
                <div>
                  <Label className="text-xs">URL do comprovante (opcional)</Label>
                  <Input value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} placeholder="https://…" />
                </div>
                <p className="text-[11px] text-muted-foreground flex items-start gap-1">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  Cobrança ficará pendente — confirme em "Pendentes" no módulo Consulta Números.
                </p>
              </>
            )}
          </div>
        )}

        {generatedUrl && (
          <div className="space-y-2">
            <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-sm">
              ✅ Link gerado! Envie ao cliente:
            </div>
            <div className="flex gap-2">
              <Input value={generatedUrl} readOnly className="font-mono text-xs" />
              <Button size="sm" onClick={async () => {
                const ok = await copyToClipboard(generatedUrl);
                toast({
                  title: ok ? "Copiado!" : "Não foi possível copiar",
                  description: ok ? undefined : "Selecione o link manualmente e use Ctrl+C / Cmd+C.",
                  variant: ok ? undefined : "destructive",
                });
              }}>
                Copiar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            {generatedUrl ? "Fechar" : "Cancelar"}
          </Button>
          {!generatedUrl && !limitReached && !pendingToday && (
            <Button onClick={handleSubmit} disabled={registerScan.isPending}>
              {registerScan.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {step === "payment" ? "Confirmar cobrança" : "📲 Registrar escaneamento"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
