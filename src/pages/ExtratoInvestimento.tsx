import { useState, useMemo, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClientes } from '@/hooks/useClientes';
import { FileText, Loader2, FileDown, Plus, Trash2, MessageSquare, Mail, Eye } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  gerarExtratoInvestimentoPDF,
  ExtratoItemV2,
  ProductType,
  PRODUCT_TYPE_LABEL,
  unidadeForType,
  StatusRenovacao,
} from '@/utils/extratoInvestimentoPDF';

interface RowItem extends ExtratoItemV2 {
  uid: string;
  origem: 'cliente' | 'purchase' | 'manual';
  source_label: string;
  recorrente: boolean;
  selected: boolean;
  obs_interna?: string;
  obs_origem_nome?: string;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const todayISO = () => new Date().toISOString().slice(0, 10);

// Infere o tipo de produto a partir do nome
function inferirTipo(nome: string): ProductType {
  const n = (nome || '').toLowerCase();
  if (/canva|chatgpt|capcut|adobe|figma|netflix|disney|spotify|youtube premium|gpt|midjourney/.test(n))
    return 'ferramenta_software';
  if (/social ?media|gestão de redes|gerenciamento de redes|instagram|tiktok|facebook (?:ads|gestão)/.test(n))
    return 'social_media';
  if (/hospedagem|host|vps|servidor|cloud/.test(n)) return 'hospedagem';
  if (/seguro|manuten[cç][aã]o/.test(n)) return 'seguro_manutencao';
  if (/n[uú]mero|whatsapp|chip/.test(n)) return 'numeros';
  if (/software|licen[cç]a|sistema|saas|plataforma/.test(n)) return 'software_mensal';
  return 'outro';
}

function computeStatus(dataRenovacao?: string | null): StatusRenovacao {
  if (!dataRenovacao) return 'em_dia';
  const d = new Date(`${dataRenovacao}T00:00:00`);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const diff = (d.getTime() - now.getTime()) / 86400000;
  if (diff < 0) return 'atrasada';
  if (diff <= 7) return 'proxima';
  return 'em_dia';
}

const CICLO_MESES_LABEL: Record<string, string> = {
  mensal: 'Mensal',
  bimestral: 'Bimestral',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export default function ExtratoInvestimento() {
  const { user } = useAuth();
  const { fetchClientes, isLoading: loadingClientes } = useClientes();
  const [clientes, setClientes] = useState<any[]>([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClientes().then(setClientes).catch(() => {}); }, []);
  const [selectedClienteId, setSelectedClienteId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RowItem[]>([]);
  const [clienteFinal, setClienteFinal] = useState('');
  const [referencia, setReferencia] = useState('');
  const [totalInvestidoHist, setTotalInvestidoHist] = useState<number>(0);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<null | 'whatsapp' | 'email'>(null);
  const [pdfBaixado, setPdfBaixado] = useState(false);
  const [emailMensagem, setEmailMensagem] = useState('');
  const [whatsMensagem, setWhatsMensagem] = useState('');
  const [destinoEmail, setDestinoEmail] = useState('');
  const [destinoWhats, setDestinoWhats] = useState('');

  // Opções do dropdown (clientes cadastrados, sem digitação livre)
  const clienteOptions = useMemo(
    () =>
      (clientes || [])
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((c) => ({
          value: c.id,
          label: `${c.nome}${c.email ? ` · ${c.email}` : ''}${c.numero ? ` · ${c.numero}` : ''}`,
        })),
    [clientes],
  );

  const carregarDadosCliente = async (clienteId: string) => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const cliente = clientes.find((c) => c.id === clienteId);
      if (!cliente) throw new Error('Cliente não encontrado.');

      // 1) Outros cadastros vinculados (mesmo nome / email / numero) → mensais
      const orParts: string[] = [];
      if (cliente.nome) orParts.push(`nome.ilike.%${cliente.nome.replace(/[%]/g, '')}%`);
      if (cliente.email) orParts.push(`email.eq.${cliente.email}`);
      if (cliente.numero) orParts.push(`numero.eq.${cliente.numero}`);

      const { data: clientesRel } = await supabase
        .from('clientes')
        .select('id, nome, email, numero, produto, valor, ciclo_cobranca, data_renovacao, created_at, cobranca_ativa, observacao')
        .or(orParts.join(','));

      // 2) Purchases (únicos) - vinculadas a qualquer cliente relacionado
      const idsRel = (clientesRel || []).map((c: any) => c.id);
      const { data: purchasesArr } = idsRel.length
        ? await supabase
            .from('client_purchases')
            .select('id, cliente_id, produto, descricao, valor, data_compra')
            .in('cliente_id', idsRel)
        : { data: [] as any[] };

      // 3) Soma dos payments aprovados → Total investido histórico
      const { data: paymentsArr } = idsRel.length
        ? await supabase
            .from('client_payments')
            .select('amount, status, cliente_id')
            .in('cliente_id', idsRel)
            .in('status', ['paid', 'approved'])
        : { data: [] as any[] };

      const totalPagamentos = (paymentsArr || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const totalPurchases = (purchasesArr || []).reduce((s: number, p: any) => s + Number(p.valor || 0), 0);
      setTotalInvestidoHist(totalPagamentos + totalPurchases);




      const rows: RowItem[] = [];

      (clientesRel || []).forEach((c: any) => {
        if (Number(c.valor || 0) <= 0) return;
        const nome = c.produto || 'Serviço';
        const tipo = inferirTipo(nome);
        const recorrente = !!c.cobranca_ativa;
        rows.push({
          uid: `cli-${c.id}`,
          origem: 'cliente',
          source_label: recorrente
            ? `Cadastro · ${c.ciclo_cobranca || 'mensal'}`
            : 'Cadastro · Pagamento único',
          recorrente,
          selected: true,
          nome,
          product_type: tipo,
          quantidade: 1,
          valor_unitario: Number(c.valor || 0),
          unidade_label: unidadeForType(tipo),
          data_compra: (c.created_at || '').slice(0, 10) || null,
          data_renovacao: recorrente ? c.data_renovacao || null : null,
          ciclo_label: recorrente ? (CICLO_MESES_LABEL[c.ciclo_cobranca] || 'Mensal') : undefined,
          status: recorrente ? computeStatus(c.data_renovacao) : 'unico',
          obs_interna: (c.observacao || '').trim() || undefined,
          obs_origem_nome: c.nome || undefined,
        });
      });

      (purchasesArr || []).forEach((p: any) => {
        const nome = p.produto || p.descricao || 'Aquisição';
        const tipo = inferirTipo(nome);
        rows.push({
          uid: `pur-${p.id}`,
          origem: 'purchase',
          source_label: 'Compra única',
          recorrente: false,
          selected: true,
          nome,
          product_type: tipo,
          quantidade: 1,
          valor_unitario: Number(p.valor || 0),
          unidade_label: unidadeForType(tipo),
          data_compra: p.data_compra || null,
          data_renovacao: null,
          status: 'unico',
          descricao: p.descricao || undefined,
        });
      });

      setItems(rows);
      setClienteFinal(cliente.nome);
      setDestinoEmail(cliente.email || '');
      setDestinoWhats(cliente.numero || '');
      if (rows.length === 0) toast.info('Nenhum produto ativo encontrado para este cliente.');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao carregar dados: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPdfBaixado(false);
    if (selectedClienteId) carregarDadosCliente(selectedClienteId);
    else {
      setItems([]); setClienteFinal(''); setTotalInvestidoHist(0);
      setDestinoEmail(''); setDestinoWhats('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClienteId]);

  const toggle = (uid: string) =>
    setItems((arr) => arr.map((it) => (it.uid === uid ? { ...it, selected: !it.selected } : it)));

  const updateItem = (uid: string, patch: Partial<RowItem>) =>
    setItems((arr) => arr.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));

  const removeItem = (uid: string) => setItems((arr) => arr.filter((it) => it.uid !== uid));

  const addManual = (recorrente: boolean) => {
    setItems((arr) => [
      ...arr,
      {
        uid: `man-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        origem: 'manual',
        source_label: 'Adicionado manualmente',
        recorrente,
        selected: true,
        nome: '',
        product_type: 'outro',
        quantidade: 1,
        valor_unitario: 0,
        unidade_label: unidadeForType('outro'),
        data_compra: todayISO(),
        data_renovacao: recorrente ? null : null,
        status: recorrente ? 'em_dia' : 'unico',
      },
    ]);
  };

  const itensSelecionados = useMemo(() => items.filter((i) => i.selected && i.nome.trim()), [items]);
  const itensUnicos = useMemo(() => itensSelecionados.filter((i) => !i.recorrente), [itensSelecionados]);
  const itensMensais = useMemo(() => itensSelecionados.filter((i) => i.recorrente), [itensSelecionados]);

  const totalUnico = itensUnicos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const totalMensal = itensMensais.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const pendencias = itensMensais.filter((i) => i.status === 'atrasada').length;
  const proximas = itensMensais.filter((i) => i.status === 'proxima').length;

  const validate = (): string | null => {
    if (!clienteFinal.trim()) return 'Informe o nome do cliente.';
    if (!referencia.trim()) return 'O campo "Referência do título" é obrigatório.';
    if (itensSelecionados.length === 0) return 'Selecione pelo menos um item.';
    return null;
  };

  const buildPdfData = () => ({
    cliente_nome: clienteFinal.trim(),
    referencia: referencia.trim(),
    itens_unicos: itensUnicos.map(({ uid, origem, source_label, recorrente, selected, ...rest }) => rest),
    itens_mensais: itensMensais.map(({ uid, origem, source_label, recorrente, selected, ...rest }) => rest),
    total_investido_historico: totalInvestidoHist || (totalUnico),
  });

  const baixarLog = async (channel: 'download' | 'whatsapp' | 'email') => {
    try {
      await supabase.from('extrato_investimento_logs').insert([{
        cliente_nome: clienteFinal.trim(),
        referencia: referencia.trim(),
        total_unico: totalUnico,
        total_mensal: totalMensal,
        qtd_numeros: itensMensais.filter(i => i.product_type === 'numeros').reduce((s, i) => s + i.quantidade, 0),
        itens: { unicos: itensUnicos, mensais: itensMensais, channel } as any,
        gerado_por: user?.id,
        gerado_por_email: user?.email,
      }]);
    } catch (e) { console.warn('log falhou', e); }
  };

  const gerarPDF = async () => {
    const err = validate(); if (err) { toast.error(err); return; }
    setGenerating(true);
    try {
      const doc = gerarExtratoInvestimentoPDF(buildPdfData());
      const fileName = `extrato_${clienteFinal.trim().toLowerCase().replace(/\s+/g, '_')}_${todayISO()}.pdf`;
      doc.save(fileName);
      await baixarLog('download');
      setPdfBaixado(true);
      toast.success('PDF gerado. Agora você pode enviar ao cliente.');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao gerar PDF: ' + (e?.message || e));
    } finally { setGenerating(false); }
  };

  const enviar = async (channel: 'whatsapp' | 'email') => {
    const err = validate(); if (err) { toast.error(err); return; }
    if (channel === 'whatsapp' && !destinoWhats.trim()) { toast.error('Informe o número do WhatsApp.'); return; }
    if (channel === 'email' && !destinoEmail.trim()) { toast.error('Informe o e-mail.'); return; }

    setSending(channel);
    try {
      const doc = gerarExtratoInvestimentoPDF(buildPdfData());
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      const fileName = `extrato_${clienteFinal.trim().toLowerCase().replace(/\s+/g, '_')}_${todayISO()}.pdf`;

      const { data, error } = await supabase.functions.invoke('send-extrato-investimento', {
        body: {
          channel,
          cliente_id: selectedClienteId,
          cliente_nome: clienteFinal.trim(),
          referencia: referencia.trim(),
          destino: channel === 'whatsapp' ? destinoWhats.trim() : destinoEmail.trim(),
          mensagem: channel === 'whatsapp' ? whatsMensagem.trim() : emailMensagem.trim(),
          pdf_base64: pdfBase64,
          file_name: fileName,
          total_investido: totalInvestidoHist,
          total_mensal: totalMensal,
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error || 'Falha no envio');

      await baixarLog(channel);
      toast.success(channel === 'whatsapp' ? 'Extrato enviado por WhatsApp.' : 'Extrato enviado por e-mail.');
    } catch (e: any) {
      console.error(e);
      toast.error(`Falha no envio (${channel}): ${e?.message || e}`);
    } finally { setSending(null); }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <FileText className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Extrato de Investimento</h1>
            <p className="text-sm text-muted-foreground">Selecione um cliente cadastrado para consolidar e gerar o PDF.</p>
          </div>
        </div>

        {/* 1. Seleção via filtro */}
        <Card>
          <CardHeader><CardTitle className="text-base">1. Selecionar cliente cadastrado</CardTitle></CardHeader>
          <CardContent>
            <Label className="text-xs">Cliente</Label>
            <SearchableSelect
              value={selectedClienteId}
              onValueChange={setSelectedClienteId}
              options={clienteOptions}
              placeholder={loadingClientes ? 'Carregando...' : 'Filtre por nome, e-mail ou número'}
              searchPlaceholder="Digite para filtrar..."
              emptyMessage="Nenhum cliente."
              disabled={loadingClientes}
            />
            {loading && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando contratos do cliente...
              </p>
            )}
          </CardContent>
        </Card>

        {selectedClienteId && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">2. Revisar registros</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Defina o tipo de cada produto. Desmarque itens que não devem constar.
                </p>
              </div>
              <div className="flex gap-2 items-center">
                <Button size="sm" variant="outline" onClick={() => addManual(false)}>
                  <Plus className="h-3 w-3 mr-1" /> Item único
                </Button>
                <Button size="sm" variant="outline" onClick={() => addManual(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Item mensal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum produto. Use os botões acima para adicionar manualmente.
                </p>
              )}

              {items.map((it) => (
                <div key={it.uid} className="p-3 border rounded-lg bg-card space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <Checkbox checked={it.selected} onCheckedChange={() => toggle(it.uid)} />
                    <Badge variant={it.recorrente ? 'default' : 'secondary'} className="text-[10px]">
                      {it.recorrente ? 'MENSAL' : 'ÚNICO'}
                    </Badge>
                    <Input
                      className="flex-1 min-w-[200px]"
                      placeholder="Nome do produto/serviço"
                      value={it.nome}
                      onChange={(e) => updateItem(it.uid, { nome: e.target.value })}
                    />
                    {it.obs_interna && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Observação interna deste cadastro (somente você)"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-96 max-h-[60vh] overflow-y-auto" side="left">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 pb-2 border-b">
                              <Eye className="h-4 w-4 text-amber-600" />
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Observação interna
                              </p>
                            </div>
                            {it.obs_origem_nome && (
                              <p className="text-[11px] text-muted-foreground">
                                Cadastro: <strong>{it.obs_origem_nome}</strong>
                              </p>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{it.obs_interna}</p>
                            <p className="text-[10px] text-muted-foreground italic pt-2 border-t">
                              Visível somente para você. Use para extrair texto e colar no campo
                              "Observação para o cliente" abaixo (esse sim aparece no PDF).
                            </p>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => removeItem(it.uid)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pl-8">
                    <div className="col-span-2">
                      <Label className="text-[10px]">Tipo do produto</Label>
                      <Select
                        value={it.product_type}
                        onValueChange={(v: ProductType) => updateItem(it.uid, {
                          product_type: v,
                          unidade_label: unidadeForType(v),
                        })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(PRODUCT_TYPE_LABEL) as ProductType[]).map((k) => (
                            <SelectItem key={k} value={k}>{PRODUCT_TYPE_LABEL[k]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px]">Qtd.</Label>
                      <Input type="number" min={1} value={it.quantidade}
                        onChange={(e) => updateItem(it.uid, { quantidade: Number(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Unidade</Label>
                      <Input value={it.unidade_label ?? ''} onChange={(e) => updateItem(it.uid, { unidade_label: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-[10px]">Valor unit.</Label>
                      <Input type="number" step="0.01" value={it.valor_unitario}
                        onChange={(e) => updateItem(it.uid, { valor_unitario: Number(e.target.value) || 0 })} />
                    </div>
                    <div className="text-right">
                      <Label className="text-[10px]">Total</Label>
                      <div className="h-9 flex items-center justify-end font-bold text-amber-600">
                        {fmtBRL(it.quantidade * it.valor_unitario)}{it.recorrente && <span className="text-[10px] text-muted-foreground ml-1">/mês</span>}
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px]">Data da compra</Label>
                      <Input type="date" value={it.data_compra || ''}
                        onChange={(e) => updateItem(it.uid, { data_compra: e.target.value || null })} />
                    </div>
                    {it.recorrente && (
                      <>
                        <div>
                          <Label className="text-[10px]">Próx. renovação</Label>
                          <Input type="date" value={it.data_renovacao || ''}
                            onChange={(e) => updateItem(it.uid, {
                              data_renovacao: e.target.value || null,
                              status: computeStatus(e.target.value),
                            })} />
                        </div>
                        <div>
                          <Label className="text-[10px]">Status</Label>
                          <Select value={it.status || 'em_dia'} onValueChange={(v: StatusRenovacao) => updateItem(it.uid, { status: v })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="em_dia">Em dia</SelectItem>
                              <SelectItem value="proxima">Renova em breve</SelectItem>
                              <SelectItem value="atrasada">Atrasada</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    <div className="col-span-2 md:col-span-6">
                      <Label className="text-[10px] flex items-center gap-1">
                        Observação para o cliente
                        <span className="text-muted-foreground font-normal">(aparece no PDF)</span>
                      </Label>
                      <Textarea
                        rows={2}
                        className="text-xs resize-none"
                        value={it.descricao || ''}
                        onChange={(e) => updateItem(it.uid, { descricao: e.target.value })}
                        placeholder="Ex.: Inclui suporte técnico 24/7 e backup diário."
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs text-muted-foreground">Total Investido</p>
                  <p className="text-xl font-extrabold text-amber-600">{fmtBRL(totalInvestidoHist || totalUnico)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Recorrência Mensal</p>
                  <p className="text-xl font-extrabold">{fmtBRL(totalMensal)}<span className="text-xs">/mês</span></p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Pendências</p>
                  <p className="text-xl font-extrabold text-red-500">{pendencias}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Renova em ≤ 7d</p>
                  <p className="text-xl font-extrabold text-amber-500">{proximas}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedClienteId && (
          <Card>
            <CardHeader><CardTitle className="text-base">3. Dados do extrato</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do cliente (no PDF)</Label>
                <Input value={clienteFinal} onChange={(e) => setClienteFinal(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Referência do título <span className="text-red-500">*</span></Label>
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Ex: Histórico de investimento — Junho/2026"
                  required
                />
                {!referencia.trim() && (
                  <p className="text-[11px] text-red-500">Obrigatório para gerar ou enviar o PDF.</p>
                )}
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={gerarPDF} disabled={generating} size="lg" className="bg-amber-600 hover:bg-amber-700">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Baixar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedClienteId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Enviar ao cliente</CardTitle>
              {!pdfBaixado && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <FileDown className="h-3 w-3" />
                  Baixe o PDF acima e confira antes de habilitar o envio.
                </p>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WhatsApp */}
              <div className={`space-y-2 p-3 border rounded-lg ${!pdfBaixado ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 font-semibold text-sm"><MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp</div>
                <Label className="text-xs">Número (com DDI)</Label>
                <Input value={destinoWhats} onChange={(e) => setDestinoWhats(e.target.value)} placeholder="5511..." />
                <Label className="text-xs">Mensagem (opcional)</Label>
                <Textarea
                  rows={3}
                  value={whatsMensagem}
                  onChange={(e) => setWhatsMensagem(e.target.value)}
                  placeholder="Olá! Segue em anexo seu extrato de investimento."
                />
                <Button
                  onClick={() => enviar('whatsapp')}
                  disabled={!!sending || !pdfBaixado}
                  title={!pdfBaixado ? 'Baixe o PDF antes de enviar' : ''}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {sending === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Enviar por WhatsApp
                </Button>
              </div>

              {/* E-mail */}
              <div className={`space-y-2 p-3 border rounded-lg ${!pdfBaixado ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 font-semibold text-sm"><Mail className="h-4 w-4 text-blue-500" /> E-mail</div>
                <Label className="text-xs">Destinatário</Label>
                <Input value={destinoEmail} onChange={(e) => setDestinoEmail(e.target.value)} placeholder="cliente@email.com" />
                <Label className="text-xs">Mensagem personalizada (opcional)</Label>
                <Textarea
                  rows={3}
                  value={emailMensagem}
                  onChange={(e) => setEmailMensagem(e.target.value)}
                  placeholder="Prezado(a), conforme solicitado segue em anexo o extrato consolidado do seu investimento."
                />
                <p className="text-[10px] text-muted-foreground">
                  Seu texto aparece destacado no topo de um e-mail HTML personalizado da Astros, com o PDF em anexo.
                </p>
                <Button
                  onClick={() => enviar('email')}
                  disabled={!!sending || !pdfBaixado}
                  title={!pdfBaixado ? 'Baixe o PDF antes de enviar' : ''}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {sending === 'email' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Enviar por E-mail
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
