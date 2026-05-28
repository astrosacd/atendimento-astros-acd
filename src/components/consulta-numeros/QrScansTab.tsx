import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QrCode,
  Settings,
  History,
  Search,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  AlertCircle,
  Image as ImageIcon,
  Camera,
  Upload,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useQrScanConfig,
  useUpdateQrScanConfig,
  useAutoHospedadoNumbers,
  useQrScanHistory,
  useMonthlyCounters,
  useToggleAutoHospedado,
  useRegisterScan,
  useConfirmScanPayment,
  useSearchNumbers,
} from "@/hooks/useQrScan";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  link_mp: "🔗 Link Mercado Pago",
  link_stripe: "🔗 Link Stripe",
  manual_pix: "💰 PIX (manual)",
  manual_saldo: "💼 Saldo do cliente",
  manual_outro: "📝 Outro (manual)",
};

const STATUS_BADGES: Record<string, { label: string; variant: any }> = {
  nao_aplica: { label: "Grátis", variant: "secondary" },
  pendente: { label: "Pendente", variant: "outline" },
  pago: { label: "Pago", variant: "default" },
  cancelado: { label: "Cancelado", variant: "destructive" },
};

const EMPTY_SEARCH_RESULTS: any[] = [];

export function QrScansTab() {
  const { isAdmin } = useAuth();
  const { data: config } = useQrScanConfig();
  const updateConfig = useUpdateQrScanConfig();
  const { data: autoHosp = [], isLoading: loadingHosp } =
    useAutoHospedadoNumbers();
  const { data: history = [], isLoading: loadingHist } = useQrScanHistory();
  const { data: counters } = useMonthlyCounters();
  const toggleHosp = useToggleAutoHospedado();
  const registerScan = useRegisterScan();
  const confirmPay = useConfirmScanPayment();

  // Dialog states
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: searchResults = EMPTY_SEARCH_RESULTS,
    isFetching: searchingNumbers,
  } = useSearchNumbers(searchQuery);
  const [localSearchResults, setLocalSearchResults] = useState<any[]>([]);

  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<any>(null);
  const [scanStep, setScanStep] = useState<"initial" | "payment">("initial");
  const [scanObs, setScanObs] = useState("");
  const [needsPaymentInfo, setNeedsPaymentInfo] = useState<{
    valor: number;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("link_mp");
  const [manualObs, setManualObs] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");
  const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState<string | null>(null);

  // Local draft for config form (controlled, saved on click)
  const [configDraft, setConfigDraft] = useState<{
    qtd_gratis_por_mes: number;
    qtd_por_dia: number;
    valor_excedente: number;
    payment_provider_default: "mercadopago" | "stripe";
    ativo: boolean;
  } | null>(null);

  // Payment confirmation dialog
  const [confirmPaymentDialogOpen, setConfirmPaymentDialogOpen] = useState(false);
  const [scanToConfirm, setScanToConfirm] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<File | null>(null);
  const [paymentReceiptPreview, setPaymentReceiptPreview] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setConfigDraft({
        qtd_gratis_por_mes: config.qtd_gratis_por_mes,
        qtd_por_dia: config.qtd_por_dia ?? 2,
        valor_excedente: Number(config.valor_excedente),
        payment_provider_default: config.payment_provider_default,
        ativo: config.ativo,
      });
    }
  }, [config]);

  const configDirty =
    !!config &&
    !!configDraft &&
    (configDraft.qtd_gratis_por_mes !== config.qtd_gratis_por_mes ||
      configDraft.qtd_por_dia !== (config.qtd_por_dia ?? 2) ||
      Number(configDraft.valor_excedente) !== Number(config.valor_excedente) ||
      configDraft.payment_provider_default !== config.payment_provider_default ||
      configDraft.ativo !== config.ativo);

  const pendentes = history.filter((h) => h.payment_status === "pendente");

  const getCounter = (id: number) =>
    counters?.get(id) ?? { qtd_gratis_usados: 0, qtd_pagos: 0 };

  // BRT today (YYYY-MM-DD) — must match edge function
  const todayBrt = (() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const g = (t: string) => parts.find((p) => p.type === t)!.value;
    return `${g("year")}-${g("month")}-${g("day")}`;
  })();

  const maxPorDia = config?.qtd_por_dia ?? 2;

  const getTodayFreeScans = (baserowRowId: number) =>
    history.filter(
      (h) => h.baserow_row_id === baserowRowId && h.scan_date === todayBrt && h.tipo === "gratis",
    );

  const getLastTodayScan = (baserowRowId: number) => {
    const scans = history.filter(
      (h) => h.baserow_row_id === baserowRowId && h.scan_date === todayBrt,
    );
    return scans.length > 0 ? scans[0] : undefined;
  };

  const isDailyFreeLimitReached = (baserowRowId: number) =>
    getTodayFreeScans(baserowRowId).length >= maxPorDia;

  const formatTime = (iso?: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  };

  const msUntilMidnightBrt = () => {
    const now = new Date();
    const brtNow = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
    );
    const midnight = new Date(brtNow);
    midnight.setHours(24, 0, 0, 0);
    return midnight.getTime() - brtNow.getTime();
  };

  const formatCountdown = () => {
    const ms = msUntilMidnightBrt();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}min`;
  };

  useEffect(() => {
    setLocalSearchResults(searchResults);
  }, [searchResults]);

  const handleOpenScan = (n: any) => {
    setScanTarget(n);
    setScanStep("initial");
    setScanObs("");
    setNeedsPaymentInfo(null);
    setPaymentMethod("link_mp");
    setManualObs("");
    setComprovanteUrl("");
    setGeneratedPaymentUrl(null);
    setScanDialogOpen(true);
  };

  const handleSubmitScan = async () => {
    if (!scanTarget) return;
    try {
      const payload: any = {
        baserow_row_id: scanTarget.baserow_row_id,
        observacao: scanObs,
      };
      if (scanStep === "payment") {
        payload.payment_method = paymentMethod;
        payload.payment_manual_observacao = manualObs;
        payload.payment_comprovante_url = comprovanteUrl || undefined;
      }
      const res = await registerScan.mutateAsync(payload);
      if (res?.status === "daily_limit") {
        toast({
          title: "Limite diário atingido",
          description:
            res.message ??
            "Este número já tem um escaneamento registrado hoje.",
          variant: "destructive",
        });
        return;
      }
      if (res?.status === "needs_payment") {
        setNeedsPaymentInfo({ valor: res.valor });
        setScanStep("payment");
        return;
      }
      if (res?.status === "gratis_registrado") {
        toast({
          title: "✅ Escaneamento registrado (grátis)",
          description: `Restam ${res.restantes_gratis} grátis este mês.`,
        });
        setScanDialogOpen(false);
      } else if (res?.status === "pendente_pagamento") {
        if (res.payment_url) {
          // Link gerado: mantém o dialog aberto para o usuário copiar/enviar
          setGeneratedPaymentUrl(res.payment_url);
          toast({
            title: "🔗 Link de pagamento gerado",
            description:
              "Envie ao cliente. O scan será liberado automaticamente quando o pagamento for confirmado.",
          });
        } else {
          toast({
            title: "💸 Cobrança registrada — aguardando pagamento",
            description: `Confirme o pagamento na aba "Pendentes".`,
          });
          setScanDialogOpen(false);
        }
      }
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao registrar",
        variant: "destructive",
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O limite é 2MB.",
          variant: "destructive",
        });
        return;
      }
      setPaymentReceipt(file);
      const reader = new FileReader();
      reader.onloadend = () => setPaymentReceiptPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const uploadReceipt = async (file: File) => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `qr-scan-receipts/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("divulgador-media")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("divulgador-media").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleConfirmPayment = async (scan: any) => {
    setScanToConfirm(scan);
    setPaymentReceipt(null);
    setPaymentReceiptPreview(null);
    setConfirmPaymentDialogOpen(true);
  };

  const processPaymentConfirmation = async () => {
    if (!scanToConfirm) return;
    setIsUploading(true);
    try {
      let finalComprovanteUrl = "";
      if (paymentReceipt) {
        finalComprovanteUrl = await uploadReceipt(paymentReceipt);
      }

      await confirmPay.mutateAsync({
        qr_scan_id: scanToConfirm.id,
        action: "confirm",
        comprovante_url: finalComprovanteUrl || undefined,
      });

      toast({
        title: "✅ Pagamento confirmado",
        description: "Escaneamento liberado.",
      });
      setConfirmPaymentDialogOpen(false);
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPayment = async (scanId: string) => {
    try {
      await confirmPay.mutateAsync({ qr_scan_id: scanId, action: "cancel" });
      toast({ title: "Cobrança cancelada" });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha",
        variant: "destructive",
      });
    }
  };

  const handleToggleSearchResult = async (row: any, value: boolean) => {
    try {
      const updated = await toggleHosp.mutateAsync({
        baserowRowId: row.baserow_row_id,
        value,
      });
      setLocalSearchResults((current) =>
        current.map((item) =>
          item.baserow_row_id === row.baserow_row_id
            ? { ...item, ...updated }
            : item,
        ),
      );
      toast({
        title: value
          ? "✅ Número marcado como auto-hospedado"
          : "Número desmarcado",
        description: value
          ? "Ele já aparece como marcado no painel."
          : "Ele saiu da lista de auto-hospedados.",
      });
    } catch (e: any) {
      toast({
        title: "Erro",
        description: e?.message ?? "Falha ao alterar número",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <QrCode className="h-6 w-6" />
            Controle de Escaneamento QR
          </h2>
          <p className="text-sm text-muted-foreground">
            Controle de QR Codes para números auto-hospedados (
            {config?.qtd_gratis_por_mes ?? 4} grátis/mês por número, depois R${" "}
            {Number(config?.valor_excedente ?? 14.97).toFixed(2)})
          </p>
        </div>
        <Button onClick={() => setFlagDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Marcar número como auto-hospedado
        </Button>
      </div>

      <Tabs defaultValue="numeros" className="w-full">
        <TabsList>
          <TabsTrigger value="numeros">
            <QrCode className="h-4 w-4 mr-2" /> Números ({autoHosp.length})
          </TabsTrigger>
          <TabsTrigger value="pendentes">
            <AlertCircle className="h-4 w-4 mr-2" /> Pendentes (
            {pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" /> Histórico
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </TabsTrigger>
          )}
        </TabsList>

        {/* Numbers */}
        <TabsContent value="numeros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Números auto-hospedados</CardTitle>
              <CardDescription>
                Clique em "Registrar escaneamento" para contabilizar um QR.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHosp ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : autoHosp.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhum número marcado como auto-hospedado ainda.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Grátis no mês</TableHead>
                      <TableHead>Pagos no mês</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {autoHosp.map((n) => {
                      const c = getCounter(n.baserow_row_id);
                      const max = config?.qtd_gratis_por_mes ?? 4;
                      const rd = n.row_data || {};
                      return (
                        <TableRow key={n.baserow_row_id}>
                          <TableCell className="font-mono">
                            {rd.numero ?? "—"}
                          </TableCell>
                          <TableCell>{rd.nome ?? rd.cliente ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                c.qtd_gratis_usados >= max
                                  ? "destructive"
                                  : "secondary"
                              }
                            >
                              {c.qtd_gratis_usados}/{max}
                            </Badge>
                          </TableCell>
                          <TableCell>{c.qtd_pagos}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {n.auto_hospedado_observacao ?? "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            {(() => {
                              const todayFreeCount = getTodayFreeScans(n.baserow_row_id).length;
                              const lastToday = getLastTodayScan(n.baserow_row_id);
                              const freeLimitReached = todayFreeCount >= maxPorDia;
                              const monthlyMax = config?.qtd_gratis_por_mes ?? 4;
                              const monthlyUsed = getCounter(n.baserow_row_id).qtd_gratis_usados;
                              const monthlyLimitReached = monthlyUsed >= monthlyMax;

                              if (freeLimitReached || monthlyLimitReached) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-amber-500/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
                                    onClick={() => handleOpenScan(n)}
                                  >
                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                    Registrar (Pago)
                                    <span className="ml-1 text-[10px] opacity-70">
                                      {freeLimitReached ? "(Limite diário)" : "(Limite mensal)"}
                                    </span>
                                  </Button>
                                );
                              }
                              return (
                                <Button size="sm" onClick={() => handleOpenScan(n)}>
                                  📲 Registrar escaneamento
                                  {maxPorDia > 1 && (
                                    <span className="ml-1 text-xs opacity-80">
                                      ({todayFreeCount}/{maxPorDia} hoje)
                                    </span>
                                  )}
                                </Button>
                              );
                            })()}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                toggleHosp.mutate({
                                  baserowRowId: n.baserow_row_id,
                                  value: false,
                                })
                              }
                            >
                              Desmarcar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pendentes */}
        <TabsContent value="pendentes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cobranças pendentes</CardTitle>
              <CardDescription>
                Confirme o pagamento (PIX, saldo, link MP/Stripe) para liberar o
                escaneamento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendentes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  Nenhuma cobrança pendente.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead>Obs</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-xs">
                          {new Date(s.created_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-mono">{s.numero}</TableCell>
                        <TableCell>{s.cliente_nome ?? "—"}</TableCell>
                        <TableCell>
                          R$ {Number(s.valor_cobrado ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {PAYMENT_METHOD_LABELS[s.payment_method ?? ""] ??
                            s.payment_method}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {s.payment_manual_observacao ?? "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmPayment(s)}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar
                            pagto
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelPayment(s.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" /> Cancelar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico completo</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHist ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((s) => {
                      const b = STATUS_BADGES[s.payment_status] ?? {
                        label: s.payment_status,
                        variant: "outline",
                      };
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">
                            {new Date(s.created_at).toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="font-mono">
                            {s.numero}
                          </TableCell>
                          <TableCell>{s.cliente_nome ?? "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.tipo === "gratis" ? "secondary" : "default"
                              }
                            >
                              {s.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {s.valor_cobrado
                              ? `R$ ${Number(s.valor_cobrado).toFixed(2)}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={b.variant}>{b.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {s.payment_method
                              ? PAYMENT_METHOD_LABELS[s.payment_method]
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Config admin */}
        {isAdmin && (
          <TabsContent value="config" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações</CardTitle>
                <CardDescription>Apenas admin pode alterar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {config && configDraft && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Qtd grátis por mês (por número)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={configDraft.qtd_gratis_por_mes}
                          onChange={(e) =>
                            setConfigDraft({
                              ...configDraft,
                              qtd_gratis_por_mes: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Limite diário</Label>
                        <Input 
                          type="number" 
                          min={1}
                          value={configDraft.qtd_por_dia} 
                          onChange={(e) => 
                            setConfigDraft({
                              ...configDraft,
                              qtd_por_dia: Number(e.target.value),
                            })
                          }
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Cada número pode receber no máximo <strong>{configDraft.qtd_por_dia} 
                          escaneamentos por dia</strong>.
                        </p>
                      </div>
                      <div>
                        <Label>Valor por scan excedente (R$)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={configDraft.valor_excedente}
                          onChange={(e) =>
                            setConfigDraft({
                              ...configDraft,
                              valor_excedente: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label>Provedor padrão</Label>
                        <Select
                          value={configDraft.payment_provider_default}
                          onValueChange={(v) =>
                            setConfigDraft({
                              ...configDraft,
                              payment_provider_default: v as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mercadopago">
                              Mercado Pago
                            </SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={configDraft.ativo}
                        onCheckedChange={(v) =>
                          setConfigDraft({ ...configDraft, ativo: v })
                        }
                      />
                      <Label>Módulo ativo</Label>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2 border-t">
                      {configDirty && (
                        <span className="text-xs text-amber-600 mr-auto">
                          ⚠️ Alterações não salvas
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!configDirty || updateConfig.isPending}
                        onClick={() =>
                          setConfigDraft({
                            qtd_gratis_por_mes: config.qtd_gratis_por_mes,
                            qtd_por_dia: config.qtd_por_dia ?? 2,
                            valor_excedente: Number(config.valor_excedente),
                            payment_provider_default: config.payment_provider_default,
                            ativo: config.ativo,
                          })
                        }
                      >
                        Cancelar
                      </Button>
                      <Button
                        disabled={!configDirty || updateConfig.isPending}
                        onClick={() => {
                          updateConfig.mutate(
                            { id: config.id, ...configDraft },
                            {
                              onSuccess: () =>
                                toast({
                                  title: "Configurações salvas",
                                  description:
                                    "As novas regras já valem para os próximos escaneamentos.",
                                }),
                              onError: (err: any) =>
                                toast({
                                  title: "Erro ao salvar",
                                  description: err?.message ?? String(err),
                                  variant: "destructive",
                                }),
                            },
                          );
                        }}
                      >
                        {updateConfig.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Salvar configurações
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Flag dialog */}
      <Dialog open={flagDialogOpen} onOpenChange={setFlagDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Marcar número como auto-hospedado</DialogTitle>
            <DialogDescription>
              Busque por número, nome, email ou cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Digite ao menos 2 caracteres..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {localSearchResults.map((r: any) => (
                <div
                  key={r.baserow_row_id}
                  className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                >
                  <div>
                    <div className="font-mono text-sm">
                      {r.row_data?.numero}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.row_data?.nome ?? r.row_data?.cliente ?? "—"} ·{" "}
                      {r.row_data?.email ?? ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.auto_hospedado ? (
                      <>
                        <Badge variant="secondary">✓ Auto-hospedado</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={toggleHosp.isPending}
                          onClick={() => handleToggleSearchResult(r, false)}
                        >
                          Desmarcar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={toggleHosp.isPending}
                        onClick={() => handleToggleSearchResult(r, true)}
                      >
                        Marcar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {searchingNumbers && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...
                </div>
              )}
              {searchQuery.length >= 2 &&
                !searchingNumbers &&
                localSearchResults.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    Nenhum número encontrado.
                  </p>
                )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Scan register dialog */}
      <Dialog open={scanDialogOpen} onOpenChange={setScanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar escaneamento de QR</DialogTitle>
            <DialogDescription>
              Número:{" "}
              <span className="font-mono">{scanTarget?.row_data?.numero}</span>{" "}
              · Cliente: {scanTarget?.row_data?.nome ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {scanStep === "initial" && (() => {
            const todayFreeCount = scanTarget
              ? getTodayFreeScans(scanTarget.baserow_row_id).length
              : 0;
            const todayScan = scanTarget
              ? getLastTodayScan(scanTarget.baserow_row_id)
              : undefined;
            const freeLimitReached = scanTarget
              ? isDailyFreeLimitReached(scanTarget.baserow_row_id)
              : false;

            if (freeLimitReached && todayScan) {
              const statusInfo = STATUS_BADGES[todayScan.payment_status] ?? {
                label: todayScan.payment_status,
                variant: "outline",
              };
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-md space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Limite diário grátis atingido ({todayFreeCount}/{maxPorDia})
                    </div>
                    <div className="text-xs text-amber-800">
                      Você pode continuar registrando scans hoje, mas eles serão <strong>pagos</strong>.
                    </div>
                      <div>
                        <span className="text-muted-foreground">Horário:</span>{" "}
                        <strong>{formatTime(todayScan.created_at)}</strong> (BRT)
                      </div>
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>{" "}
                        <strong>
                          {todayScan.tipo === "gratis" ? "Grátis" : "Pago"}
                        </strong>
                        {todayScan.valor_cobrado ? (
                          <> — R$ {Number(todayScan.valor_cobrado).toFixed(2)}</>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge variant={statusInfo.variant}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {todayScan.observacao && (
                        <div>
                          <span className="text-muted-foreground">Obs:</span>{" "}
                          {todayScan.observacao}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t border-amber-500/20">
                      ⏳ Aguarde até <strong>00:00 (BRT)</strong> para um novo
                      registro — faltam <strong>{formatCountdown()}</strong>.
                    </div>
                  </div>
      {/* Payment Confirmation Dialog */}
      <Dialog open={confirmPaymentDialogOpen} onOpenChange={setConfirmPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
            <DialogDescription>
              Deseja confirmar o pagamento do scan para o número <strong>{scanToConfirm?.numero}</strong>?
              Isso irá liberar o escaneamento para o cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Comprovante (opcional)</Label>
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
                {paymentReceiptPreview && (
                  <div className="relative w-full h-40 border rounded-md overflow-hidden bg-muted">
                    <img
                      src={paymentReceiptPreview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => {
                        setPaymentReceipt(null);
                        setPaymentReceiptPreview(null);
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmPaymentDialogOpen(false)}
              disabled={isUploading}
            >
              Não, cancelar
            </Button>
            <Button
              onClick={processPaymentConfirmation}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Sim, confirmar pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

            return (
              <div className="space-y-3">
                <p className="text-sm">
                  {scanTarget &&
                    (() => {
                      const c = getCounter(scanTarget.baserow_row_id);
                      const max = config?.qtd_gratis_por_mes ?? 4;
                      return c.qtd_gratis_usados < max ? (
                        <>
                          Você tem{" "}
                          <strong>{max - c.qtd_gratis_usados} grátis</strong>{" "}
                          restantes este mês.
                        </>
                      ) : (
                        <>
                          Limite grátis atingido. Cada novo scan custa{" "}
                          <strong>
                            R${" "}
                            {Number(config?.valor_excedente ?? 14.97).toFixed(2)}
                          </strong>
                          .
                        </>
                      );
                    })()}
                </p>
                <div>
                  <Label>Observação (opcional)</Label>
                  <Textarea
                    value={scanObs}
                    onChange={(e) => setScanObs(e.target.value)}
                  />
                </div>
              </div>
            );
          })()}

          {scanStep === "payment" && needsPaymentInfo && !generatedPaymentUrl && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                ⚠️ Cobrança de{" "}
                <strong>R$ {needsPaymentInfo.valor.toFixed(2)}</strong>. Escolha
                como o cliente vai pagar:
              </div>
              <div>
                <Label>Método de pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(paymentMethod === "link_mp" || paymentMethod === "link_stripe") && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Vamos gerar um link de pagamento. O cliente pode pagar com
                    cartão, PIX ou boleto direto na página do provedor. Quando o
                    pagamento for confirmado, o escaneamento é liberado
                    automaticamente.
                  </p>
                )}
              </div>
              {paymentMethod !== "link_mp" && paymentMethod !== "link_stripe" && (
                <>
                  <div>
                    <Label>Observação do pagamento</Label>
                    <Textarea
                      value={manualObs}
                      onChange={(e) => setManualObs(e.target.value)}
                      placeholder="Ex: PIX enviado às 14h, ID 12345..."
                    />
                  </div>
                  <div>
                    <Label>URL do comprovante (opcional)</Label>
                    <Input
                      value={comprovanteUrl}
                      onChange={(e) => setComprovanteUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A cobrança ficará <strong>pendente</strong>. Confirme
                    manualmente na aba "Pendentes" assim que receber o pagamento
                    — só então o escaneamento será liberado.
                  </p>
                </>
              )}
            </div>
          )}

          {scanStep === "payment" && generatedPaymentUrl && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded text-sm">
                ✅ Link de pagamento gerado! Envie para o cliente:
              </div>
              <div className="flex gap-2">
                <Input value={generatedPaymentUrl} readOnly className="font-mono text-xs" />
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPaymentUrl);
                    toast({ title: "Copiado!" });
                  }}
                >
                  Copiar
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={generatedPaymentUrl} target="_blank" rel="noreferrer">Abrir</a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Status fica <strong>pendente</strong> na aba "Pendentes". Assim
                que o cliente pagar, o escaneamento é liberado
                automaticamente.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setScanDialogOpen(false)}>
              {generatedPaymentUrl ? "Fechar" : "Cancelar"}
            </Button>
            {!generatedPaymentUrl && (() => {
              const isLink = paymentMethod === "link_mp" || paymentMethod === "link_stripe";
              return (
                <Button
                  onClick={handleSubmitScan}
                  disabled={registerScan.isPending}
                >
                  {registerScan.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {scanStep === "initial"
                    ? "Registrar"
                    : isLink
                      ? "Gerar link de pagamento"
                      : "Criar cobrança"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
