import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { FileDown, Loader2, Mail, MessageSquare, Plus, Trash2, XCircle } from 'lucide-react';
import { gerarTermoCancelamentoPDF } from '@/utils/termoCancelamentoPDF';

interface Props {
  clientes: any[];
  loadingClientes: boolean;
}

interface ServicoRow {
  uid: string;
  nome: string;
  valor: number;
  data_contratacao: string | null;
  selected: boolean;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const gerarProtocolo = () =>
  `CANC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

export function TermoCancelamentoTab({ clientes, loadingClientes }: Props) {
  const { user } = useAuth();
  const [clienteId, setClienteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [servicos, setServicos] = useState<ServicoRow[]>([]);
  const [clienteNome, setClienteNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [email, setEmail] = useState('');
  const [numero, setNumero] = useState('');
  const [dataCancelamento, setDataCancelamento] = useState(todayISO());
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [quitado, setQuitado] = useState(true);
  const [protocolo, setProtocolo] = useState(gerarProtocolo());
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState<null | 'whatsapp' | 'email'>(null);
  const [pdfBaixado, setPdfBaixado] = useState(false);
  const [confirmChannel, setConfirmChannel] = useState<null | 'whatsapp' | 'email'>(null);

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

  useEffect(() => {
    setPdfBaixado(false);
    setProtocolo(gerarProtocolo());
    if (!clienteId) {
      setServicos([]);
      setClienteNome(''); setDocumento(''); setEmail(''); setNumero('');
      return;
    }
    const carregar = async () => {
      setLoading(true);
      try {
        const cliente = clientes.find((c) => c.id === clienteId);
        if (!cliente) throw new Error('Cliente não encontrado.');
        setClienteNome(cliente.nome || '');
        setDocumento(cliente.cpf || cliente.cnpj || '');
        setEmail(cliente.email || '');
        setNumero(cliente.numero || '');

        const orParts: string[] = [];
        if (cliente.nome) orParts.push(`nome.ilike.%${cliente.nome.replace(/[%]/g, '')}%`);
        if (cliente.email) orParts.push(`email.eq.${cliente.email}`);
        if (cliente.numero) orParts.push(`numero.eq.${cliente.numero}`);

        const { data: clientesRel } = await supabase
          .from('clientes')
          .select('id, nome, produto, valor, created_at')
          .or(orParts.join(','));

        const idsRel = (clientesRel || []).map((c: any) => c.id);
        const { data: purchases } = idsRel.length
          ? await supabase
              .from('client_purchases')
              .select('id, produto, descricao, valor, data_compra')
              .in('cliente_id', idsRel)
          : { data: [] as any[] };

        const rows: ServicoRow[] = [];
        (clientesRel || []).forEach((c: any) => {
          rows.push({
            uid: `cli-${c.id}`,
            nome: c.produto || 'Serviço',
            valor: Number(c.valor || 0),
            data_contratacao: (c.created_at || '').slice(0, 10) || null,
            selected: true,
          });
        });
        (purchases || []).forEach((p: any) => {
          rows.push({
            uid: `pur-${p.id}`,
            nome: p.produto || p.descricao || 'Aquisição',
            valor: Number(p.valor || 0),
            data_contratacao: p.data_compra || null,
            selected: false,
          });
        });
        setServicos(rows);
        if (rows.length === 0) toast.info('Nenhum serviço encontrado. Adicione manualmente.');
      } catch (e: any) {
        toast.error('Falha ao carregar serviços: ' + (e?.message || e));
      } finally {
        setLoading(false);
      }
    };
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const update = (uid: string, patch: Partial<ServicoRow>) =>
    setServicos((arr) => arr.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const remove = (uid: string) => setServicos((arr) => arr.filter((s) => s.uid !== uid));
  const addManual = () =>
    setServicos((arr) => [
      ...arr,
      {
        uid: `man-${Date.now()}`,
        nome: '',
        valor: 0,
        data_contratacao: null,
        selected: true,
      },
    ]);

  const selecionados = useMemo(
    () => servicos.filter((s) => s.selected && s.nome.trim()),
    [servicos],
  );

  const validate = (): string | null => {
    if (!clienteNome.trim()) return 'Informe o nome do cliente.';
    if (!dataCancelamento) return 'Informe a data do cancelamento.';
    if (selecionados.length === 0) return 'Selecione pelo menos um serviço cancelado.';
    return null;
  };

  const buildDoc = () =>
    gerarTermoCancelamentoPDF({
      cliente_nome: clienteNome.trim(),
      cliente_documento: documento.trim() || undefined,
      cliente_email: email.trim() || undefined,
      cliente_numero: numero.trim() || undefined,
      servicos: selecionados.map((s) => ({
        nome: s.nome.trim(),
        valor: s.valor,
        data_contratacao: s.data_contratacao,
      })),
      data_cancelamento: dataCancelamento,
      motivo: motivo.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      protocolo,
      quitado,
    });

  const fileName = () =>
    `termo_cancelamento_${clienteNome.trim().toLowerCase().replace(/\s+/g, '_')}_${dataCancelamento}.pdf`;

  const registrarLog = async (channel: string) => {
    try {
      await supabase.from('extrato_investimento_logs').insert([
        {
          cliente_nome: clienteNome.trim(),
          referencia: `Termo de Cancelamento · ${protocolo}`,
          total_unico: 0,
          total_mensal: 0,
          qtd_numeros: 0,
          itens: { tipo: 'termo_cancelamento', protocolo, servicos: selecionados, motivo, channel } as any,
          gerado_por: user?.id,
          gerado_por_email: user?.email,
        },
      ]);
    } catch (e) {
      console.warn('log termo falhou', e);
    }
  };

  const gerarPDF = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setGenerating(true);
    try {
      buildDoc().save(fileName());
      await registrarLog('download');
      setPdfBaixado(true);
      toast.success('Termo gerado. Confira antes de enviar ao cliente.');
    } catch (e: any) {
      toast.error('Falha ao gerar PDF: ' + (e?.message || e));
    } finally {
      setGenerating(false);
    }
  };

  const enviar = async (channel: 'whatsapp' | 'email') => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (channel === 'whatsapp' && !numero.trim()) { toast.error('Informe o número do WhatsApp.'); return; }
    if (channel === 'email' && !email.trim()) { toast.error('Informe o e-mail.'); return; }

    setSending(channel);
    try {
      const pdfBase64 = buildDoc().output('datauristring').split(',')[1];
      const { data, error } = await supabase.functions.invoke('send-extrato-investimento', {
        body: {
          channel,
          cliente_id: clienteId || undefined,
          cliente_nome: clienteNome.trim(),
          referencia: `Termo de Cancelamento · ${protocolo}`,
          destino: channel === 'whatsapp' ? numero.trim() : email.trim(),
          mensagem:
            `Olá, ${clienteNome.trim().split(' ')[0]}. Segue em anexo o Termo de Cancelamento do(s) serviço(s) ` +
            `${selecionados.map((s) => s.nome).join(', ')}, com efeito a partir de ${new Date(
              `${dataCancelamento}T00:00:00`,
            ).toLocaleDateString('pt-BR')}. Protocolo ${protocolo}.`,
          pdf_base64: pdfBase64,
          file_name: fileName(),
        },
      });
      if (error) throw error;
      if ((data as any)?.success === false) throw new Error((data as any)?.error || 'Falha no envio');
      await registrarLog(channel);
      toast.success(channel === 'whatsapp' ? 'Termo enviado por WhatsApp.' : 'Termo enviado por e-mail.');
    } catch (e: any) {
      toast.error(`Falha no envio (${channel}): ${e?.message || e}`);
    } finally {
      setSending(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">1. Selecionar cliente</CardTitle></CardHeader>
        <CardContent>
          <Label className="text-xs">Cliente</Label>
          <SearchableSelect
            value={clienteId}
            onValueChange={setClienteId}
            options={clienteOptions}
            placeholder={loadingClientes ? 'Carregando...' : 'Filtre por nome, e-mail ou número'}
            searchPlaceholder="Digite para filtrar..."
            emptyMessage="Nenhum cliente."
            disabled={loadingClientes}
          />
          {loading && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando serviços do cliente...
            </p>
          )}
        </CardContent>
      </Card>

      {clienteId && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">2. Serviço(s) cancelado(s)</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Marque somente o que foi cancelado. O que estiver desmarcado não entra no termo.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={addManual}>
                <Plus className="h-3 w-3 mr-1" /> Adicionar serviço
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {servicos.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum serviço. Use o botão acima para adicionar.
                </p>
              )}
              {servicos.map((s) => (
                <div key={s.uid} className="p-3 border rounded-lg bg-card grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-1 flex items-center gap-2 pb-2">
                    <Checkbox checked={s.selected} onCheckedChange={() => update(s.uid, { selected: !s.selected })} />
                    {s.selected && <Badge variant="destructive" className="text-[9px]">CANC.</Badge>}
                  </div>
                  <div className="md:col-span-5">
                    <Label className="text-[10px]">Serviço</Label>
                    <Input value={s.nome} placeholder="Nome do serviço" onChange={(e) => update(s.uid, { nome: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-[10px]">Valor anterior</Label>
                    <Input type="number" step="0.01" value={s.valor} onChange={(e) => update(s.uid, { valor: Number(e.target.value) || 0 })} />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-[10px]">Contratado em</Label>
                    <Input type="date" value={s.data_contratacao || ''} onChange={(e) => update(s.uid, { data_contratacao: e.target.value || null })} />
                  </div>
                  <div className="md:col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" onClick={() => remove(s.uid)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. Dados do termo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome do cliente (no PDF)</Label>
                <Input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF / CNPJ</Label>
                <Input value={documento} onChange={(e) => setDocumento(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>Data do cancelamento <span className="text-red-500">*</span></Label>
                <Input type="date" value={dataCancelamento} onChange={(e) => setDataCancelamento(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Protocolo</Label>
                <Input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Motivo do cancelamento <span className="text-muted-foreground text-xs">(aparece no PDF)</span></Label>
                <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Solicitação do cliente por reestruturação interna." />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Observações <span className="text-muted-foreground text-xs">(aparece no PDF)</span></Label>
                <Textarea rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: Dados e materiais entregues ao cliente em 01/09/2026." />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <Checkbox id="quitado" checked={quitado} onCheckedChange={(v) => setQuitado(!!v)} />
                <Label htmlFor="quitado" className="text-sm font-normal">
                  Declarar que não há pendências financeiras entre as partes
                </Label>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={gerarPDF} disabled={generating} size="lg" className="bg-amber-600 hover:bg-amber-700">
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  Baixar Termo em PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4. Enviar ao cliente</CardTitle>
              {!pdfBaixado && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <FileDown className="h-3 w-3" /> Baixe o termo acima e confira antes de habilitar o envio.
                </p>
              )}
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`space-y-2 p-3 border rounded-lg ${!pdfBaixado ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <MessageSquare className="h-4 w-4 text-emerald-500" /> WhatsApp
                </div>
                <Label className="text-xs">Número (com DDI)</Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="5585..." />
                <Button
                  onClick={() => setConfirmChannel('whatsapp')}
                  disabled={!!sending || !pdfBaixado}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {sending === 'whatsapp' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                  Enviar por WhatsApp
                </Button>
              </div>
              <div className={`space-y-2 p-3 border rounded-lg ${!pdfBaixado ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Mail className="h-4 w-4 text-blue-500" /> E-mail
                </div>
                <Label className="text-xs">Destinatário</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" />
                <Button
                  onClick={() => setConfirmChannel('email')}
                  disabled={!!sending || !pdfBaixado}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {sending === 'email' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Enviar por E-mail
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={!!confirmChannel} onOpenChange={(o) => !o && setConfirmChannel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> Confirmar envio do termo
            </AlertDialogTitle>
            <AlertDialogDescription>
              O termo de cancelamento será enviado por{' '}
              <strong>{confirmChannel === 'whatsapp' ? 'WhatsApp' : 'e-mail'}</strong> ao cliente. Confirme que revisou o PDF.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ch = confirmChannel;
                setConfirmChannel(null);
                if (ch) enviar(ch);
              }}
            >
              Sim, enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
