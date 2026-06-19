import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Search, FileText, Loader2, Download, Plus, Trash2, FileDown } from 'lucide-react';
import { gerarExtratoInvestimentoPDF, ExtratoItem } from '@/utils/extratoInvestimentoPDF';

interface RowItem extends ExtratoItem {
  uid: string;
  origem: 'cliente' | 'purchase' | 'payment' | 'manual';
  source_label: string;
  recorrente: boolean;
  selected: boolean;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ExtratoInvestimento() {
  const { user } = useAuth();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [items, setItems] = useState<RowItem[]>([]);
  const [clienteFinal, setClienteFinal] = useState('');
  const [referencia, setReferencia] = useState('');
  const [qtdNumeros, setQtdNumeros] = useState<number>(0);
  const [generating, setGenerating] = useState(false);

  const buscar = async () => {
    if (!nome && !email && !telefone) {
      toast.error('Informe nome, e-mail ou telefone para buscar.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('buscar_investimentos_cliente', {
        p_nome: nome || null,
        p_email: email || null,
        p_telefone: telefone || null,
      });
      if (error) throw error;

      const json = data as any;
      const clientesArr: any[] = json?.clientes ?? [];
      const purchasesArr: any[] = json?.purchases ?? [];
      const paymentsArr: any[] = json?.payments ?? [];

      // Map: clientes -> mensais recorrentes (valor + produto)
      const rows: RowItem[] = [];

      clientesArr.forEach((c) => {
        if (Number(c.valor) > 0) {
          rows.push({
            uid: `cli-${c.id}`,
            origem: 'cliente',
            source_label: `Cadastro · ${c.produto || 'sem produto'}`,
            recorrente: true,
            selected: true,
            nome: c.produto || 'Serviço Mensal',
            quantidade: 1,
            valor_unitario: Number(c.valor),
            unidade_label: 'núm.',
          });
        }
      });

      purchasesArr.forEach((p) => {
        rows.push({
          uid: `pur-${p.id}`,
          origem: 'purchase',
          source_label: `Compra · ${p.data_compra ?? ''}`,
          recorrente: false,
          selected: true,
          nome: p.produto || p.descricao || 'Aquisição',
          quantidade: 1,
          valor_unitario: Number(p.valor),
          unidade_label: 'un.',
          descricao: p.descricao || undefined,
        });
      });

      paymentsArr.forEach((p) => {
        // Skip recurring/mensalidade hint? Mark all as unique payments.
        rows.push({
          uid: `pay-${p.id}`,
          origem: 'payment',
          source_label: `Pagamento · ${p.payment_type || 'avulso'} · ${p.paid_at?.slice(0, 10) ?? ''}`,
          recorrente: false,
          selected: false, // pagamentos por padrão desmarcados (evitar duplicar com purchases)
          nome: `Pagamento ${p.receipt_number ?? p.payment_id ?? ''}`.trim(),
          quantidade: 1,
          valor_unitario: Number(p.amount),
          unidade_label: 'un.',
        });
      });

      setItems(rows);

      // Pré-preencher cliente final com o nome mais frequente
      const counts: Record<string, number> = {};
      clientesArr.forEach((c) => {
        if (c.nome) counts[c.nome] = (counts[c.nome] || 0) + 1;
      });
      const topNome = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      setClienteFinal(topNome || nome || '');

      // Estimar qtdNumeros somando "quantidade" implícita dos cadastros mensais (1 por cadastro)
      setQtdNumeros(clientesArr.length);

      setSearched(true);
      if (rows.length === 0) toast.info('Nenhum registro encontrado.');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha na busca: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (uid: string) =>
    setItems((arr) => arr.map((it) => (it.uid === uid ? { ...it, selected: !it.selected } : it)));

  const updateItem = (uid: string, patch: Partial<RowItem>) =>
    setItems((arr) => arr.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));

  const removeItem = (uid: string) =>
    setItems((arr) => arr.filter((it) => it.uid !== uid));

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
        quantidade: 1,
        valor_unitario: 0,
        unidade_label: recorrente ? 'núm.' : 'un.',
      },
    ]);
  };

  const itensSelecionados = useMemo(() => items.filter((i) => i.selected && i.nome.trim()), [items]);
  const itensUnicos = useMemo(() => itensSelecionados.filter((i) => !i.recorrente), [itensSelecionados]);
  const itensMensais = useMemo(() => itensSelecionados.filter((i) => i.recorrente), [itensSelecionados]);

  const totalUnico = itensUnicos.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);
  const totalMensal = itensMensais.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  const gerarPDF = async () => {
    if (!clienteFinal.trim()) {
      toast.error('Informe o nome do cliente.');
      return;
    }
    if (itensSelecionados.length === 0) {
      toast.error('Selecione pelo menos um item.');
      return;
    }
    setGenerating(true);
    try {
      const doc = gerarExtratoInvestimentoPDF({
        cliente_nome: clienteFinal.trim(),
        referencia: referencia.trim() || `${qtdNumeros} item(ns)`,
        qtd_numeros: qtdNumeros,
        itens_unicos: itensUnicos.map(({ uid, origem, source_label, recorrente, selected, ...rest }) => rest),
        itens_mensais: itensMensais.map(({ uid, origem, source_label, recorrente, selected, ...rest }) => rest),
      });

      const fileName = `extrato_${clienteFinal.trim().toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      // Log
      await supabase.from('extrato_investimento_logs').insert({
        cliente_nome: clienteFinal.trim(),
        referencia: referencia.trim() || null,
        total_unico: totalUnico,
        total_mensal: totalMensal,
        qtd_numeros: qtdNumeros,
        itens: { unicos: itensUnicos, mensais: itensMensais },
        gerado_por: user?.id,
        gerado_por_email: user?.email,
      });

      toast.success('PDF gerado e baixado.');
    } catch (e: any) {
      console.error(e);
      toast.error('Falha ao gerar PDF: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
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
            <p className="text-sm text-muted-foreground">Consolida cadastros do cliente e gera o PDF no padrão Astros.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Buscar cliente</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@cliente.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <Button onClick={buscar} disabled={loading} className="h-10">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Buscar
            </Button>
          </CardContent>
        </Card>

        {searched && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">2. Revisar registros encontrados</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Desmarque o que não deve constar no PDF. Edite valores se necessário.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => addManual(false)}>
                  <Plus className="h-3 w-3 mr-1" /> Item único
                </Button>
                <Button size="sm" variant="outline" onClick={() => addManual(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Item mensal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {items.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">Nenhum registro. Use os botões acima para adicionar manualmente.</p>}
              {items.map((it) => (
                <div key={it.uid} className="flex items-center gap-3 p-3 border rounded-lg bg-card">
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
                  <Input
                    className="w-20"
                    type="number"
                    min={1}
                    value={it.quantidade}
                    onChange={(e) => updateItem(it.uid, { quantidade: Number(e.target.value) || 0 })}
                  />
                  <Input
                    className="w-20"
                    placeholder="un."
                    value={it.unidade_label ?? ''}
                    onChange={(e) => updateItem(it.uid, { unidade_label: e.target.value })}
                  />
                  <Input
                    className="w-28"
                    type="number"
                    step="0.01"
                    value={it.valor_unitario}
                    onChange={(e) => updateItem(it.uid, { valor_unitario: Number(e.target.value) || 0 })}
                  />
                  <div className="w-28 text-right font-bold text-amber-600">
                    {fmtBRL(it.quantidade * it.valor_unitario)}
                    {it.recorrente && <span className="text-[10px] text-muted-foreground">/mês</span>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem(it.uid)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Único</p>
                  <p className="text-xl font-extrabold text-amber-600">{fmtBRL(totalUnico)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Total Mensal</p>
                  <p className="text-xl font-extrabold text-amber-600">{fmtBRL(totalMensal)}/mês</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {searched && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3. Dados do extrato</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-1">
                <Label>Nome do cliente (no PDF)</Label>
                <Input value={clienteFinal} onChange={(e) => setClienteFinal(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label>Referência / subtítulo</Label>
                <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex: 20 Números Aquecidos Premium" />
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label>Qtd. de números (KPI)</Label>
                <Input type="number" value={qtdNumeros} onChange={(e) => setQtdNumeros(Number(e.target.value) || 0)} />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button onClick={gerarPDF} disabled={generating} size="lg" className="bg-amber-600 hover:bg-amber-700">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Gerar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
