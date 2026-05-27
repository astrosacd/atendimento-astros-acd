import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Settings, History, Search, CheckCircle2, XCircle, Loader2, Plus, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  useQrScanConfig, useUpdateQrScanConfig, useAutoHospedadoNumbers,
  useQrScanHistory, useMonthlyCounters, useToggleAutoHospedado,
  useRegisterScan, useConfirmScanPayment, useSearchNumbers,
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

export function QrScansTab() {
  const { isAdmin } = useAuth();
  const { data: config } = useQrScanConfig();
  const updateConfig = useUpdateQrScanConfig();
  const { data: autoHosp = [], isLoading: loadingHosp } = useAutoHospedadoNumbers();
  const { data: history = [], isLoading: loadingHist } = useQrScanHistory();
  const { data: counters } = useMonthlyCounters();
  const toggleHosp = useToggleAutoHospedado();
  const registerScan = useRegisterScan();
  const confirmPay = useConfirmScanPayment();

  // Dialog states
  const [flagDialogOpen, setFlagDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults = [], isFetching: searchingNumbers } = useSearchNumbers(searchQuery);
  const [localSearchResults, setLocalSearchResults] = useState<any[]>([]);

  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [scanTarget, setScanTarget] = useState<any>(null);
  const [scanStep, setScanStep] = useState<"initial" | "payment">("initial");
  const [scanObs, setScanObs] = useState("");
  const [needsPaymentInfo, setNeedsPaymentInfo] = useState<{ valor: number } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("manual_pix");
  const [manualObs, setManualObs] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");

  const pendentes = history.filter((h) => h.payment_status === "pendente");

  const getCounter = (id: number) => counters?.get(id) ?? { qtd_gratis_usados: 0, qtd_pagos: 0 };

  useEffect(() => {
    setLocalSearchResults(searchResults);
  }, [searchResults]);

  const handleOpenScan = (n: any) => {
    setScanTarget(n);
    setScanStep("initial");
    setScanObs("");
    setNeedsPaymentInfo(null);
    setPaymentMethod("manual_pix");
    setManualObs("");
    setComprovanteUrl("");
    setScanDialogOpen(true);
  };

  const handleSubmitScan = async () => {
    if (!scanTarget) return;
    try {
      const payload: any = { baserow_row_id: scanTarget.baserow_row_id, observacao: scanObs };
      if (scanStep === "payment") {
        payload.payment_method = paymentMethod;
        payload.payment_manual_observacao = manualObs;
        payload.payment_comprovante_url = comprovanteUrl || undefined;
      }
      const res = await registerScan.mutateAsync(payload);
      if (res?.status === "needs_payment") {
        setNeedsPaymentInfo({ valor: res.valor });
        setScanStep("payment");
        return;
      }
      if (res?.status === "gratis_registrado") {
        toast({ title: "✅ Escaneamento registrado (grátis)", description: `Restam ${res.restantes_gratis} grátis este mês.` });
        setScanDialogOpen(false);
      } else if (res?.status === "pendente_pagamento") {
        toast({ title: "💸 Cobrança registrada — aguardando pagamento", description: `Confirme o pagamento na aba "Pendentes".` });
        setScanDialogOpen(false);
      }
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao registrar", variant: "destructive" });
    }
  };

  const handleConfirmPayment = async (scanId: string) => {
    try {
      await confirmPay.mutateAsync({ qr_scan_id: scanId, action: "confirm" });
      toast({ title: "✅ Pagamento confirmado", description: "Escaneamento liberado." });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" });
    }
  };

  const handleCancelPayment = async (scanId: string) => {
    try {
      await confirmPay.mutateAsync({ qr_scan_id: scanId, action: "cancel" });
      toast({ title: "Cobrança cancelada" });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha", variant: "destructive" });
    }
  };

  const handleToggleSearchResult = async (row: any, value: boolean) => {
    try {
      const updated = await toggleHosp.mutateAsync({ baserowRowId: row.baserow_row_id, value });
      setLocalSearchResults((current) => current.map((item) => (
        item.baserow_row_id === row.baserow_row_id ? { ...item, ...updated } : item
      )));
      toast({
        title: value ? "✅ Número marcado como auto-hospedado" : "Número desmarcado",
        description: value ? "Ele já aparece como marcado no painel." : "Ele saiu da lista de auto-hospedados.",
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e?.message ?? "Falha ao alterar número", variant: "destructive" });
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
            Controle de QR Codes para números auto-hospedados ({config?.qtd_gratis_por_mes ?? 4} grátis/mês por número, depois R$ {Number(config?.valor_excedente ?? 14.97).toFixed(2)})
          </p>
        </div>
        <Button onClick={() => setFlagDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Marcar número como auto-hospedado
        </Button>
      </div>

      <Tabs defaultValue="numeros" className="w-full">
        <TabsList>
          <TabsTrigger value="numeros"><QrCode className="h-4 w-4 mr-2" /> Números ({autoHosp.length})</TabsTrigger>
          <TabsTrigger value="pendentes">
            <AlertCircle className="h-4 w-4 mr-2" /> Pendentes ({pendentes.length})
          </TabsTrigger>
          <TabsTrigger value="historico"><History className="h-4 w-4 mr-2" /> Histórico</TabsTrigger>
          {isAdmin && <TabsTrigger value="config"><Settings className="h-4 w-4 mr-2" /> Configurações</TabsTrigger>}
        </TabsList>

        {/* Numbers */}
        <TabsContent value="numeros" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Números auto-hospedados</CardTitle>
              <CardDescription>Clique em "Registrar escaneamento" para contabilizar um QR.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHosp ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : autoHosp.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhum número marcado como auto-hospedado ainda.</p>
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
                          <TableCell className="font-mono">{rd.numero ?? "—"}</TableCell>
                          <TableCell>{rd.nome ?? rd.cliente ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={c.qtd_gratis_usados >= max ? "destructive" : "secondary"}>
                              {c.qtd_gratis_usados}/{max}
                            </Badge>
                          </TableCell>
                          <TableCell>{c.qtd_pagos}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{n.auto_hospedado_observacao ?? "—"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button size="sm" onClick={() => handleOpenScan(n)}>
                              📲 Registrar escaneamento
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleHosp.mutate({ baserowRowId: n.baserow_row_id, value: false })}>
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
              <CardDescription>Confirme o pagamento (PIX, saldo, link MP/Stripe) para liberar o escaneamento.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendentes.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Nenhuma cobrança pendente.</p>
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
                        <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="font-mono">{s.numero}</TableCell>
                        <TableCell>{s.cliente_nome ?? "—"}</TableCell>
                        <TableCell>R$ {Number(s.valor_cobrado ?? 0).toFixed(2)}</TableCell>
                        <TableCell>{PAYMENT_METHOD_LABELS[s.payment_method ?? ""] ?? s.payment_method}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{s.payment_manual_observacao ?? "—"}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" onClick={() => handleConfirmPayment(s.id)}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Confirmar pagto
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleCancelPayment(s.id)}>
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
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
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
                      const b = STATUS_BADGES[s.payment_status] ?? { label: s.payment_status, variant: "outline" };
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="font-mono">{s.numero}</TableCell>
                          <TableCell>{s.cliente_nome ?? "—"}</TableCell>
                          <TableCell><Badge variant={s.tipo === "gratis" ? "secondary" : "default"}>{s.tipo}</Badge></TableCell>
                          <TableCell>{s.valor_cobrado ? `R$ ${Number(s.valor_cobrado).toFixed(2)}` : "—"}</TableCell>
                          <TableCell><Badge variant={b.variant}>{b.label}</Badge></TableCell>
                          <TableCell className="text-xs">{s.payment_method ? PAYMENT_METHOD_LABELS[s.payment_method] : "—"}</TableCell>
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
                {config && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Qtd grátis por mês (por número)</Label>
                        <Input type="number" defaultValue={config.qtd_gratis_por_mes}
                          onBlur={(e) => updateConfig.mutate({ id: config.id, qtd_gratis_por_mes: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Qtd máxima por dia</Label>
                        <Input type="number" defaultValue={config.qtd_max_por_dia}
                          onBlur={(e) => updateConfig.mutate({ id: config.id, qtd_max_por_dia: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Valor por scan excedente (R$)</Label>
                        <Input type="number" step="0.01" defaultValue={config.valor_excedente}
                          onBlur={(e) => updateConfig.mutate({ id: config.id, valor_excedente: Number(e.target.value) })} />
                      </div>
                      <div>
                        <Label>Provedor padrão</Label>
                        <Select defaultValue={config.payment_provider_default}
                          onValueChange={(v) => updateConfig.mutate({ id: config.id, payment_provider_default: v as any })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                            <SelectItem value="stripe">Stripe</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={config.ativo}
                        onCheckedChange={(v) => updateConfig.mutate({ id: config.id, ativo: v })} />
                      <Label>Módulo ativo</Label>
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
            <DialogDescription>Busque por número, nome, email ou cliente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input className="pl-9" placeholder="Digite ao menos 2 caracteres..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {localSearchResults.map((r: any) => (
                <div key={r.baserow_row_id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                  <div>
                    <div className="font-mono text-sm">{r.row_data?.numero}</div>
                    <div className="text-xs text-muted-foreground">{r.row_data?.nome ?? r.row_data?.cliente ?? "—"} · {r.row_data?.email ?? ""}</div>
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
                      <Button size="sm" disabled={toggleHosp.isPending} onClick={() => handleToggleSearchResult(r, true)}>Marcar</Button>
                    )}
                  </div>
                </div>
              ))}
              {searchingNumbers && (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Buscando...</div>
              )}
              {searchQuery.length >= 2 && !searchingNumbers && localSearchResults.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">Nenhum número encontrado.</p>
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
              Número: <span className="font-mono">{scanTarget?.row_data?.numero}</span> · Cliente: {scanTarget?.row_data?.nome ?? "—"}
            </DialogDescription>
          </DialogHeader>

          {scanStep === "initial" && (
            <div className="space-y-3">
              <p className="text-sm">
                {scanTarget && (() => {
                  const c = getCounter(scanTarget.baserow_row_id);
                  const max = config?.qtd_gratis_por_mes ?? 4;
                  return c.qtd_gratis_usados < max
                    ? <>Você tem <strong>{max - c.qtd_gratis_usados} grátis</strong> restantes este mês.</>
                    : <>Limite grátis atingido. Cada novo scan custa <strong>R$ {Number(config?.valor_excedente ?? 14.97).toFixed(2)}</strong>.</>;
                })()}
              </p>
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea value={scanObs} onChange={(e) => setScanObs(e.target.value)} />
              </div>
            </div>
          )}

          {scanStep === "payment" && needsPaymentInfo && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-sm">
                ⚠️ Cobrança de <strong>R$ {needsPaymentInfo.valor.toFixed(2)}</strong>. Escolha como o cliente vai pagar:
              </div>
              <div>
                <Label>Método de pagamento</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Observação do pagamento</Label>
                <Textarea value={manualObs} onChange={(e) => setManualObs(e.target.value)} placeholder="Ex: PIX enviado às 14h, ID 12345..." />
              </div>
              <div>
                <Label>URL do comprovante (opcional)</Label>
                <Input value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} placeholder="https://..." />
              </div>
              <p className="text-xs text-muted-foreground">
                A cobrança ficará <strong>pendente</strong>. Confirme manualmente na aba "Pendentes" assim que receber o pagamento — só então o escaneamento será liberado.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setScanDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmitScan} disabled={registerScan.isPending}>
              {registerScan.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {scanStep === "initial" ? "Registrar" : "Criar cobrança"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
