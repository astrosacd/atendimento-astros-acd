import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Cliente, CicloCobranca, Moeda, useClientes } from '@/hooks/useClientes';
import { useToast } from '@/hooks/use-toast';
import { CalendarClock, Repeat, Receipt, ArrowLeft, Check } from 'lucide-react';
import { formatCurrencyInput, parseCurrency } from '@/utils/formatters';

interface Props {
  cliente: Cliente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted?: () => void;
}

type Destino = null | 'mensal' | 'registro';

export function ConverterAgendadoDialog({ cliente, open, onOpenChange, onConverted }: Props) {
  const { updateCliente, isLoading } = useClientes();
  const { toast } = useToast();

  const [destino, setDestino] = useState<Destino>(null);
  const [valor, setValor] = useState<number>(0);
  const [moeda, setMoeda] = useState<Moeda>('BRL');
  const [ciclo, setCiclo] = useState<CicloCobranca | ''>('');
  const [dataRenovacao, setDataRenovacao] = useState<string>('');
  const [dataVenda, setDataVenda] = useState<string>(new Date().toISOString().split('T')[0]);

  const reset = () => {
    setDestino(null);
    setValor(0);
    setMoeda('BRL');
    setCiclo('');
    setDataRenovacao('');
    setDataVenda(new Date().toISOString().split('T')[0]);
  };

  const close = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const handleConvert = async () => {
    if (!cliente) return;

    if (destino === 'mensal') {
      if (!ciclo) {
        toast({ title: 'Ciclo obrigatório', description: 'Selecione a periodicidade da cobrança.', variant: 'destructive' });
        return;
      }
      if (!dataRenovacao) {
        toast({ title: 'Data obrigatória', description: 'Informe a data da primeira renovação.', variant: 'destructive' });
        return;
      }
      if (!valor || valor <= 0) {
        toast({ title: 'Valor obrigatório', description: 'Informe o valor da mensalidade.', variant: 'destructive' });
        return;
      }
    }

    const updates =
      destino === 'mensal'
        ? {
            status_cliente: 'ativo',
            cobranca_ativa: true,
            ciclo_cobranca: ciclo as CicloCobranca,
            valor: Number(valor),
            moeda,
            data_renovacao: dataRenovacao,
            servico_agendado: null,
            data_agendamento: null,
            convertido_em: new Date().toISOString(),
            convertido_de: 'agendado',
          }
        : {
            status_cliente: 'ativo',
            cobranca_ativa: false,
            valor: Number(valor),
            moeda,
            data_renovacao: dataVenda,
            servico_agendado: null,
            data_agendamento: null,
            convertido_em: new Date().toISOString(),
            convertido_de: 'agendado',
          };

    const result = await updateCliente(cliente.id, updates as any, cliente);
    if (result) {
      toast({
        title: 'Cliente convertido',
        description: `${cliente.nome} agora é cliente ${destino === 'mensal' ? 'mensal' : 'registro'}.`,
      });
      close(false);
      onConverted?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-sky-500" />
            Converter cliente agendado
          </DialogTitle>
          <DialogDescription>
            {cliente?.nome} agendou {cliente?.servico_agendado || cliente?.produto}. Escolha como ele entra no sistema agora.
          </DialogDescription>
        </DialogHeader>

        {!destino && (
          <div className="grid gap-3 pt-2">
            <button
              onClick={() => setDestino('mensal')}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
            >
              <Repeat className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Virar Mensal</p>
                <p className="text-xs text-muted-foreground">Cobrança recorrente com renovação automática.</p>
              </div>
            </button>
            <button
              onClick={() => setDestino('registro')}
              className="flex items-start gap-3 p-4 rounded-xl border-2 border-border hover:border-amber-500 hover:bg-amber-500/5 transition-colors text-left"
            >
              <Receipt className="w-5 h-5 text-amber-500 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Virar Registro</p>
                <p className="text-xs text-muted-foreground">Venda única, sem renovação.</p>
              </div>
            </button>
          </div>
        )}

        {destino && (
          <div className="space-y-4 pt-2">
            {destino === 'mensal' && (
              <>
                <div className="space-y-2">
                  <Label>Ciclo de Cobrança <span className="text-destructive">*</span></Label>
                  <Select value={ciclo} onValueChange={(v) => setCiclo(v as CicloCobranca)}>
                    <SelectTrigger className="bg-secondary border-border h-11">
                      <SelectValue placeholder="Selecione o ciclo" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="mensal">Mensal (1 mês)</SelectItem>
                      <SelectItem value="bimestral">Bimestral (2 meses)</SelectItem>
                      <SelectItem value="trimestral">Trimestral (3 meses)</SelectItem>
                      <SelectItem value="semestral">Semestral (6 meses)</SelectItem>
                      <SelectItem value="anual">Anual (12 meses)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Primeira Renovação <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={dataRenovacao}
                    onChange={(e) => setDataRenovacao(e.target.value)}
                    className="bg-secondary border-border h-11"
                  />
                </div>
              </>
            )}

            {destino === 'registro' && (
              <div className="space-y-2">
                <Label>Data da Venda</Label>
                <Input
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="bg-secondary border-border h-11"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>
                {destino === 'mensal' ? 'Valor da Mensalidade' : 'Valor Pago'}{' '}
                {destino === 'mensal' && <span className="text-destructive">*</span>}
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder={moeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                  value={valor ? formatCurrencyInput(Math.round(valor * 100).toString(), moeda) : ''}
                  onChange={(e) => setValor(parseCurrency(e.target.value))}
                  className="bg-secondary border-border h-11 flex-1"
                />
                <Select value={moeda} onValueChange={(v) => setMoeda(v as Moeda)}>
                  <SelectTrigger className="bg-secondary border-border h-11 w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="BRL">R$ BRL</SelectItem>
                    <SelectItem value="USD">$ USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDestino(null)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <Button
                onClick={handleConvert}
                disabled={isLoading}
                className={`flex-1 ${destino === 'mensal' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-amber-500 text-white hover:bg-amber-600'}`}
              >
                <Check className="w-4 h-4 mr-2" />
                {isLoading ? 'Convertendo...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
