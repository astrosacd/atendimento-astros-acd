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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Shield,
  ShieldCheck,
  ShieldAlert,
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
import { useInsuranceHistory, useRegisterInsuranceUsage, useInsuranceNumbers, useInsurancePaymentStatus, useSetInsurancePaymentStatus, useInsurancePaymentStatusHybrid } from "@/hooks/useInsurance";

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
  const { data: insuranceHistory = [], isLoading: loadingInsurance } = useInsuranceHistory();
  const { data: insuranceNumbers = [], isLoading: loadingInsuranceNumbers } = useInsuranceNumbers();
  const registerInsurance = useRegisterInsuranceUsage();
  const { data: insurancePayStatus = [] } = useInsurancePaymentStatus();
  const setInsurancePay = useSetInsurancePaymentStatus();
  const { data: payStatusMap = new Map<number, { 
    status: string; 
    clientName?: string; 
    clientNames?: string[]; 
    method: string;
    links?: { id: string; nome: string; produto: string | null; data_renovacao: string | null; isPaid: boolean }[];
  }>() } = useInsurancePaymentStatusHybrid();
  
  // Para saber se o status veio de uma marcação manual ou automática
  const manualStatusIds = new Set(insurancePayStatus.map(p => p.baserow_row_id));

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

  // Receipt upload at registration step (for manual methods)
  const [registerReceipt, setRegisterReceipt] = useState<File | null>(null);
  const [registerReceiptPreview, setRegisterReceiptPreview] = useState<string | null>(null);
  const [isUploadingRegister, setIsUploadingRegister] = useState(false);

  // View receipt dialog
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  // Insurance dialog
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [insuranceTarget, setInsuranceTarget] = useState<any>(null);
  const [insuranceObs, setInsuranceObs] = useState("");

  // Search states for tabs
  const [numerosSearch, setNumerosSearch] = useState("");
  const [pendentesSearch, setPendentesSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [insuranceSearch, setInsuranceSearch] = useState("");

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

  const filteredAutoHosp = autoHosp.filter((n) => {
    const rd = n.row_data || {};
    const search = numerosSearch.toLowerCase();
    return (
      (rd.numero?.toLowerCase() || "").includes(search) ||
      (rd.nome?.toLowerCase() || "").includes(search) ||
      (rd.cliente?.toLowerCase() || "").includes(search)
    );
  });

  const filteredPendentes = history
    .filter((h) => h.payment_status === "pendente")
    .filter((h) => {
      const search = pendentesSearch.toLowerCase();
      return (
        (h.numero?.toLowerCase() || "").includes(search) ||
        (h.cliente_nome?.toLowerCase() || "").includes(search)
      );
    });

  const filteredHistory = history.filter((h) => {
    const search = historySearch.toLowerCase();
    return (
      (h.numero?.toLowerCase() || "").includes(search) ||
      (h.cliente_nome?.toLowerCase() || "").includes(search)
      );
    });

  const filteredInsuranceHistory = insuranceHistory.filter((h) => {
    const search = insuranceSearch.toLowerCase();
    return (
      (h.numero?.toLowerCase() || "").includes(search) ||
      (h.cliente_nome?.toLowerCase() || "").includes(search)
    );
  });

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

  const maxPorDia = config?.qtd_por_dia ?? 1;
  const monthlyMax = config?.qtd_gratis_por_mes ?? 4;

  const getConfirmedScansToday = (baserowRowId: number) =>
    history.filter(
      (h) =>
        h.baserow_row_id === baserowRowId &&
        h.scan_date === todayBrt &&
        (h.payment_status === "pago" || h.payment_status === "nao_aplica"),
    );

  const getPendingScanToday = (baserowRowId: number) =>
    history.find(
      (h) =>
        h.baserow_row_id === baserowRowId &&
        h.scan_date === todayBrt &&
        h.payment_status === "pendente",
    );

  const isDailyLimitReached = (baserowRowId: number) =>
    getConfirmedScansToday(baserowRowId).length >= maxPorDia;

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
    setRegisterReceipt(null);
    setRegisterReceiptPreview(null);
    setGeneratedPaymentUrl(null);
    setScanDialogOpen(true);
  };

  const handleRegisterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O limite é 2MB.", variant: "destructive" });
      return;
    }
    setRegisterReceipt(file);
    const reader = new FileReader();
    reader.onloadend = () => setRegisterReceiptPreview(reader.result as string);
    reader.readAsDataURL(file);
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
        let finalUrl = comprovanteUrl || undefined;
        if (registerReceipt) {
          setIsUploadingRegister(true);
          try {
            finalUrl = await uploadReceipt(registerReceipt);
          } finally {
            setIsUploadingRegister(false);
          }
        }
        payload.payment_comprovante_url = finalUrl;
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
            <QrCode className="h-4 w-4 mr-2" /> Números ({filteredAutoHosp.length})
          </TabsTrigger>
          <TabsTrigger value="pendentes">
            <AlertCircle className="h-4 w-4 mr-2" /> Pendentes (
            {filteredPendentes.length})
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="seguros">
            <Shield className="h-4 w-4 mr-2" /> Seguros
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 mr-2" /> Configurações
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="numeros" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Números auto-hospedados</CardTitle>
                  <CardDescription>
                    Clique em "Registrar escaneamento" para contabilizar um QR.
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou nome..."
                    value={numerosSearch}
                    onChange={(e) => setNumerosSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingHosp ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredAutoHosp.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {numerosSearch ? "Nenhum resultado encontrado." : "Nenhum número marcado como auto-hospedado ainda."}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Grátis no mês</TableHead>
                      <TableHead>Pagos no mês</TableHead>
                      <TableHead>Hospedagem</TableHead>
                      <TableHead>Seguro</TableHead>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAutoHosp.map((n) => {
                      const c = getCounter(n.baserow_row_id);
                      const max = config?.qtd_gratis_por_mes ?? 4;
                      const rd = n.row_data || {};
                      const obsRaw = (rd.observacoes || rd.observacao || n.auto_hospedado_observacao || "").toLowerCase();
                      const temSeguro = obsRaw.includes("com seguro");
                      const usedInsuranceThisMonth = insuranceHistory.some(h => {
                        const hDate = new Date(h.used_at);
                        const now = new Date();
                        return h.baserow_row_id === n.baserow_row_id && 
                               hDate.getUTCMonth() === now.getUTCMonth() && 
                               hDate.getUTCFullYear() === now.getUTCFullYear();
                      });
                      const segPayData = payStatusMap.get(n.baserow_row_id);
                      const seguroPago = segPayData?.status === "pago";
                      
                      const hospLinks = segPayData?.links?.filter(l => 
                        l.produto === "Número Hospedado Conosco ( Auto-Hospedado )"
                      ) || [];
                      
                      const hospedagemAtiva = hospLinks.some(l => l.isPaid);
                      const hospPayData = hospLinks.find(l => l.isPaid) || [...hospLinks].sort((a, b) => (b.data_renovacao || '').localeCompare(a.data_renovacao || ''))[0];
                      const temHospedagemLink = !!hospPayData;

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
                          <TableCell>
                            {temHospedagemLink ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 cursor-help">
                                      {hospedagemAtiva ? (
                                        <Badge className="bg-emerald-500 text-white gap-1 hover:bg-emerald-600 transition-colors">
                                          <CheckCircle2 className="h-3 w-3" /> Ativa
                                        </Badge>
                                      ) : (
                                        <Badge variant="destructive" className="gap-1 hover:bg-red-600 transition-colors">
                                          <AlertCircle className="h-3 w-3" /> Vencida
                                        </Badge>
                                      )}
                                      <span className="text-[10px] text-muted-foreground opacity-70">
                                        ({hospPayData?.data_renovacao ? new Date(hospPayData.data_renovacao).toLocaleDateString('pt-BR') : 'S/D'})
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">
                                      {hospedagemAtiva ? 'Hospedagem em dia' : 'Hospedagem com pagamento atrasado'}<br />
                                      Vencimento: {hospPayData?.data_renovacao ? new Date(hospPayData.data_renovacao).toLocaleDateString('pt-BR') : 'Não informada'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge variant="outline" className="opacity-50">Manual</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!temSeguro ? (
                              <Badge variant="outline" className="opacity-50">Sem seguro</Badge>
                            ) : !seguroPago ? (
                              <Badge variant="destructive" className="gap-1">
                                <ShieldAlert className="h-3 w-3" /> Vencido
                              </Badge>
                            ) : (
                              <Badge variant={usedInsuranceThisMonth ? "destructive" : "default"} className="gap-1">
                                {usedInsuranceThisMonth ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                {usedInsuranceThisMonth ? "Acionado" : "Disponível"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {n.auto_hospedado_observacao ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-2">
                                {(() => {
                                  const confirmedToday = getConfirmedScansToday(n.baserow_row_id);
                                  const pendingToday = getPendingScanToday(n.baserow_row_id);
                                  const limitReached = confirmedToday.length >= maxPorDia;
                                  const monthlyUsed = getCounter(n.baserow_row_id).qtd_gratis_usados;
                                  const monthlyFreeReached = monthlyUsed >= monthlyMax;

                                  if (limitReached) {
                                    const lastScan = confirmedToday[0];
                                    return (
                                      <Button size="sm" variant="outline" disabled className="gap-2 border-green-200 bg-green-50 text-green-700">
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                        Registrado hoje ({formatTime(lastScan?.created_at)})
                                      </Button>
                                    );
                                  }

                                  if (pendingToday) {
                                    return (
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="gap-2 border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                        onClick={() => {
                                          setScanToConfirm(pendingToday);
                                          setPaymentReceipt(null);
                                          setPaymentReceiptPreview(null);
                                          setConfirmPaymentDialogOpen(true);
                                        }}
                                      >
                                        <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                                        Aguardando Pagamento
                                      </Button>
                                    );
                                  }

                                return (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenScan(n)}
                                    className={monthlyFreeReached ? "border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400" : ""}
                                  >
                                    {monthlyFreeReached ? (
                                      <>
                                        <Plus className="h-4 w-4 mr-1" /> Registrar (Pago)
                                      </>
                                    ) : (
                                      "📲 Registrar escaneamento"
                                    )}
                                  </Button>
                                );
                              })()}
                              {temSeguro && seguroPago && !usedInsuranceThisMonth && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                                  onClick={() => {
                                    setInsuranceTarget(n);
                                    setInsuranceObs("");
                                    setInsuranceDialogOpen(true);
                                  }}
                                >
                                  <Shield className="h-4 w-4 mr-1" /> Acionar Seguro
                                </Button>
                              )}
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
                            </div>
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

        <TabsContent value="pendentes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Cobranças pendentes</CardTitle>
                  <CardDescription>
                    Confirme o pagamento (PIX, saldo, link MP/Stripe) para liberar o
                    escaneamento.
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou nome..."
                    value={pendentesSearch}
                    onChange={(e) => setPendentesSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredPendentes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  {pendentesSearch ? "Nenhum resultado encontrado." : "Nenhuma cobrança pendente."}
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
                    {filteredPendentes.map((s) => (
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
                          {s.payment_comprovante_url ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setViewReceiptUrl(s.payment_comprovante_url!)}
                              title="Ver comprovante enviado pelo cliente"
                            >
                              <ImageIcon className="h-4 w-4 mr-1" /> Ver comprovante
                            </Button>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Sem comprovante</Badge>
                          )}
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

        <TabsContent value="seguros" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Acionamentos de Seguro</CardTitle>
                  <CardDescription>
                    Lista de seguros utilizados no mês atual. Limite de 1 por mês.
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou nome..."
                    value={insuranceSearch}
                    onChange={(e) => setInsuranceSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Section 1: Available insurance numbers */}
              <div>
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  Números com Seguro ({insuranceNumbers.length})
                </h3>
                {loadingInsuranceNumbers ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : insuranceNumbers.length === 0 ? (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    Nenhum número marcado com "COM SEGURO" nas observações.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Auto-hospedado?</TableHead>
                        <TableHead>Pagamento do mês</TableHead>
                        <TableHead>Status do mês</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insuranceNumbers
                        .filter((n) => {
                          const s = insuranceSearch.toLowerCase();
                          return !s || n.numero.toLowerCase().includes(s) || (n.cliente_nome || "").toLowerCase().includes(s);
                        })
                        .map((n) => {
                          const usedThisMonth = insuranceHistory.some(h => {
                            const hDate = new Date(h.used_at);
                            const now = new Date();
                            return h.baserow_row_id === n.baserow_row_id &&
                                   hDate.getUTCMonth() === now.getUTCMonth() &&
                                   hDate.getUTCFullYear() === now.getUTCFullYear();
                          });
                          const payData = payStatusMap.get(n.baserow_row_id);
                          const isPago = payData?.status === "pago";
                          const isVencido = !payData || payData.status === "vencido";
                          const isManual = manualStatusIds.has(n.baserow_row_id);

                          return (
                            <TableRow key={n.baserow_row_id}>
                              <TableCell className="font-mono">{n.numero}</TableCell>
                              <TableCell>{n.cliente_nome ?? "—"}</TableCell>
                              <TableCell>
                                {n.auto_hospedado ? (
                                  <Badge variant="secondary" className="text-[10px]">Sim</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px]">Não</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {isPago ? (
                                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent w-fit">
                                      <CheckCircle2 className="h-3 w-3" /> Pago
                                    </Badge>
                                  ) : (
                                    <Badge variant="destructive" className="gap-1 w-fit">
                                      <ShieldAlert className="h-3 w-3" /> Vencido / Não pago
                                    </Badge>
                                  )}
                                  <span className="text-[9px] text-muted-foreground uppercase font-semibold">
                                    {isManual ? "✍️ Marcação Manual" : (
                                      <span className="flex flex-col gap-1">
                                        <span>🤖 Detecção Automática</span>
                                        {payData?.clientNames && payData.clientNames.length > 0 && (
                                          <div className="flex items-center gap-1 normal-case opacity-70">
                                            <span className="text-[8px]">
                                              Vínculo: {payData.clientNames.join(" + ")}
                                            </span>
                                            {payData.links && payData.links.length > 0 && (
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <Button variant="ghost" size="icon" className="h-4 w-4 hover:bg-muted p-0" title="Ver clientes vinculados">
                                                    <Search className="h-2 w-2" />
                                                  </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80 p-0" align="start">
                                                  <div className="p-3 border-b bg-muted/50">
                                                    <h4 className="text-xs font-bold flex items-center gap-2">
                                                      <Search className="h-3 w-3" />
                                                      Vínculos Encontrados ({payData.links.length})
                                                    </h4>
                                                  </div>
                                                  <div className="max-h-[300px] overflow-y-auto">
                                                    <Table>
                                                      <TableHeader>
                                                        <TableRow className="hover:bg-transparent">
                                                          <TableHead className="h-8 text-[10px]">Cliente</TableHead>
                                                          <TableHead className="h-8 text-[10px]">Produto</TableHead>
                                                          <TableHead className="h-8 text-[10px]">Vence</TableHead>
                                                        </TableRow>
                                                      </TableHeader>
                                                      <TableBody>
                                                        {payData.links.map((link) => (
                                                          <TableRow key={link.id} className="text-[10px]">
                                                            <TableCell className="py-2 font-medium">
                                                              <div className="flex flex-col">
                                                                <span>{link.nome}</span>
                                                                <span className="text-[9px] text-muted-foreground">ID: {link.id.split('-')[0]}...</span>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell className="py-2">{link.produto || "—"}</TableCell>
                                                            <TableCell className="py-2 text-right">
                                                              <Badge 
                                                                variant={link.isPaid ? "default" : "destructive"}
                                                                className="text-[8px] h-4 px-1"
                                                              >
                                                                {link.data_renovacao ? new Date(link.data_renovacao).toLocaleDateString('pt-BR') : "—"}
                                                              </Badge>
                                                            </TableCell>
                                                          </TableRow>
                                                        ))}
                                                      </TableBody>
                                                    </Table>
                                                  </div>
                                                </PopoverContent>
                                              </Popover>
                                            )}
                                          </div>
                                        )}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {!isPago ? (
                                  <Badge variant="outline" className="gap-1 opacity-60">
                                    <Shield className="h-3 w-3" /> Bloqueado
                                  </Badge>
                                ) : (
                                  <Badge variant={usedThisMonth ? "destructive" : "default"} className="gap-1">
                                    {usedThisMonth ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                                    {usedThisMonth ? "Já acionado" : "Disponível"}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-2">
                                  {isVencido ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                                      disabled={setInsurancePay.isPending}
                                      onClick={() =>
                                        setInsurancePay.mutate({
                                          baserow_row_id: n.baserow_row_id,
                                          status: "pago",
                                        })
                                      }
                                    >
                                      <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar como Pago
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-muted-foreground hover:text-destructive"
                                      disabled={setInsurancePay.isPending}
                                      onClick={() =>
                                        setInsurancePay.mutate({
                                          baserow_row_id: n.baserow_row_id,
                                          status: "vencido",
                                        })
                                      }
                                    >
                                      Marcar como Vencido
                                    </Button>
                                  )}
                                  {isPago && !usedThisMonth && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                                      onClick={() => {
                                        setInsuranceTarget({
                                          baserow_row_id: n.baserow_row_id,
                                          row_data: { numero: n.numero, nome: n.cliente_nome },
                                        });
                                        setInsuranceObs("");
                                        setInsuranceDialogOpen(true);
                                      }}
                                    >
                                      <Shield className="h-4 w-4 mr-1" /> Acionar Seguro
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Section 2: Insurance usage history */}
              <div className="border-t pt-4">
                <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Acionamentos ({filteredInsuranceHistory.length})
                </h3>
                {loadingInsurance ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredInsuranceHistory.length === 0 ? (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    Nenhum acionamento registrado ainda.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data de Acionamento</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Observação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInsuranceHistory.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell>{new Date(h.used_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="font-mono">{h.numero}</TableCell>
                          <TableCell>{h.cliente_nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">{h.observacao ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Histórico completo</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por número ou nome..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
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
                      <TableHead>Confirmação</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Método</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((s) => {
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
                          <TableCell className="text-xs">
                            {s.paid_at 
                              ? new Date(s.paid_at).toLocaleString("pt-BR")
                              : "—"}
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
              {localSearchResults.map((r: any) => {
                const rd = r.row_data || {};
                const obsRaw = (rd.observacoes || rd.observacao || r.auto_hospedado_observacao || "").toLowerCase();
                const temSeguro = obsRaw.includes("com seguro");

                return (
                  <div
                    key={r.baserow_row_id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                  >
                    <div>
                      <div className="font-mono text-sm">
                        {r.row_data?.numero}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-col gap-1">
                        <span>{r.row_data?.nome ?? r.row_data?.cliente ?? "—"} · {r.row_data?.email ?? ""}</span>
                        {temSeguro && (
                          <Badge variant="secondary" className="w-fit text-[10px] py-0 h-4 gap-1 bg-blue-50 text-blue-700 border-blue-200">
                            <ShieldCheck className="h-3 w-3" /> COM SEGURO
                          </Badge>
                        )}
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
              )})}
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
            const confirmedToday = scanTarget
              ? getConfirmedScansToday(scanTarget.baserow_row_id)
              : [];
            const pendingToday = scanTarget
              ? getPendingScanToday(scanTarget.baserow_row_id)
              : undefined;
            const limitReached = confirmedToday.length >= maxPorDia;

            const c = getCounter(scanTarget?.baserow_row_id);
            const monthlyMax = config?.qtd_gratis_por_mes ?? 4;
            const monthlyFreeReached = c.qtd_gratis_usados >= monthlyMax;

            if (limitReached && confirmedToday.length > 0) {
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/40 rounded-md space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Limite diário atingido ({confirmedToday.length}/{maxPorDia})
                    </div>
                    <div className="text-xs text-emerald-800">
                      Este número já tem um escaneamento confirmado hoje ({formatTime(confirmedToday[0].created_at)}).
                    </div>
                  </div>
                </div>
              );
            }

            if (pendingToday) {
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-md space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm text-amber-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pagamento pendente
                    </div>
                    <div className="text-xs text-amber-800">
                      Já existe uma cobrança pendente para este número hoje. 
                      Por favor, confirme o pagamento na aba "Pendentes" ou clique no botão "Aguardando Pagamento" na lista.
                    </div>
                  </div>
                </div>
              );
            }

            if (monthlyFreeReached) {
              return (
                <div className="space-y-3">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/40 rounded-md space-y-2">
                    <div className="flex items-center gap-2 font-medium text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      Limite mensal grátis atingido ({c.qtd_gratis_usados}/{monthlyMax})
                    </div>
                    <div className="text-xs text-amber-800">
                      O limite de {monthlyMax} escaneamentos gratuitos por mês para este número foi atingido.
                      Deseja prosseguir com um escaneamento <strong>pago (R$ {Number(config?.valor_excedente).toFixed(2)})</strong>?
                    </div>
                  </div>
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
                  <div className="space-y-2">
                    <Label>Comprovante de pagamento (opcional)</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleRegisterFileChange}
                      className="cursor-pointer"
                    />
                    {registerReceiptPreview && (
                      <div className="relative w-full h-40 border rounded-md overflow-hidden bg-muted">
                        <img
                          src={registerReceiptPreview}
                          alt="Preview do comprovante"
                          className="w-full h-full object-contain"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => {
                            setRegisterReceipt(null);
                            setRegisterReceiptPreview(null);
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Anexe aqui o print/foto do comprovante (PIX, transferência etc). Quem for aprovar na aba "Pendentes" poderá visualizar antes de confirmar.
                    </p>
                    <div>
                      <Label className="text-xs text-muted-foreground">Ou cole uma URL externa</Label>
                      <Input
                        value={comprovanteUrl}
                        onChange={(e) => setComprovanteUrl(e.target.value)}
                        placeholder="https://..."
                        disabled={!!registerReceipt}
                      />
                    </div>
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
                  disabled={registerScan.isPending || isUploadingRegister}
                >
                  {(registerScan.isPending || isUploadingRegister) && (
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
            {scanToConfirm?.payment_comprovante_url && (
              <div className="space-y-2">
                <Label>Comprovante enviado pelo operador</Label>
                <div className="border rounded-md overflow-hidden bg-muted">
                  <img
                    src={scanToConfirm.payment_comprovante_url}
                    alt="Comprovante do cliente"
                    className="w-full max-h-64 object-contain"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="w-full"
                >
                  <a href={scanToConfirm.payment_comprovante_url} target="_blank" rel="noreferrer">
                    Abrir comprovante em nova aba
                  </a>
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>
                {scanToConfirm?.payment_comprovante_url
                  ? "Anexar outro comprovante (opcional)"
                  : "Comprovante (opcional)"}
              </Label>
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

      {/* View Receipt Dialog */}
      <Dialog open={!!viewReceiptUrl} onOpenChange={(open) => !open && setViewReceiptUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante de pagamento</DialogTitle>
            <DialogDescription>
              Verifique o comprovante antes de confirmar o pagamento.
            </DialogDescription>
          </DialogHeader>
          {viewReceiptUrl && (
            <div className="space-y-3">
              <div className="border rounded-md overflow-hidden bg-muted">
                <img
                  src={viewReceiptUrl}
                  alt="Comprovante"
                  className="w-full max-h-[70vh] object-contain"
                />
              </div>
              <Button variant="outline" asChild className="w-full">
                <a href={viewReceiptUrl} target="_blank" rel="noreferrer">
                  Abrir em nova aba
                </a>
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewReceiptUrl(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Insurance Dialog */}
      <Dialog open={insuranceDialogOpen} onOpenChange={setInsuranceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acionar Seguro de Número</DialogTitle>
            <DialogDescription>
              Número: <span className="font-mono">{insuranceTarget?.numero || insuranceTarget?.row_data?.numero}</span>
              <br />
              O acionamento do seguro permite um escaneamento extra no mês.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded text-sm text-blue-800">
              <ShieldCheck className="h-4 w-4 inline mr-2" />
              Este acionamento será registrado no histórico de seguros do cliente.
            </div>
            
            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                placeholder="Ex: Cliente relatou número banido, fornecendo novo número..."
                value={insuranceObs}
                onChange={(e) => setInsuranceObs(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setInsuranceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!insuranceTarget) return;
                try {
                  const target = insuranceTarget.row_data ? {
                    baserow_row_id: insuranceTarget.baserow_row_id,
                    numero: insuranceTarget.row_data.numero,
                    cliente_nome: insuranceTarget.row_data.nome || insuranceTarget.row_data.cliente
                  } : insuranceTarget;

                  await registerInsurance.mutateAsync({
                    baserow_row_id: target.baserow_row_id,
                    numero: target.numero,
                    cliente_nome: target.cliente_nome,
                    observacao: insuranceObs,
                  });

                  // Registrar também no histórico de scans como 'gratis' (via seguro)
                  // para liberar o número hoje.
                  await registerScan.mutateAsync({
                    baserow_row_id: target.baserow_row_id,
                    observacao: `[SEGURO] ${insuranceObs}`,
                  });

                  toast({
                    title: "✅ Seguro acionado com sucesso",
                    description: "O número foi liberado para escaneamento hoje.",
                  });
                  setInsuranceDialogOpen(false);
                } catch (e: any) {
                  toast({
                    title: "Erro ao acionar seguro",
                    description: e?.message || "Ocorreu um erro inesperado.",
                    variant: "destructive",
                  });
                }
              }}
              disabled={registerInsurance.isPending || registerScan.isPending}
            >
              {(registerInsurance.isPending || registerScan.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirmar acionamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
