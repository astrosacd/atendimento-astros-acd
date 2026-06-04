import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowRightCircle } from 'lucide-react';
import { ProductSelector } from './ProductSelector';

interface ConvertLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: { id: string; lead_name: string; lead_phone: string; lead_email: string; lead_produto: string } | null;
  onConvert: (data: {
    pipelineId: string;
    nome: string;
    email: string;
    numero: string;
    produto: string;
    cpf: string;
    valor: number;
    moeda: string;
    data_renovacao: string;
    cobranca_ativa: boolean;
    ciclo_cobranca: string;
    observacao: string;
  }) => Promise<void>;
}

export function ConvertLeadDialog({ open, onOpenChange, lead, onConvert }: ConvertLeadDialogProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [numero, setNumero] = useState('');
  const [produto, setProduto] = useState('');
  const [cpf, setCpf] = useState('');
  const [valor, setValor] = useState('0');
  const [moeda, setMoeda] = useState('BRL');
  const [dataRenovacao, setDataRenovacao] = useState(new Date().toISOString().split('T')[0]);
  const [cobrancaAtiva, setCobrancaAtiva] = useState(true);
  const [cicloCobranca, setCicloCobranca] = useState('mensal');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      setNome(lead.lead_name || '');
      setEmail(lead.lead_email || '');
      setNumero(lead.lead_phone || '');
      setProduto(lead.lead_produto || '');
    }
  }, [lead]);

  const handleSubmit = async () => {
    if (!nome.trim() || !email.trim() || !numero.trim() || !produto.trim() || !cpf.trim()) return;
    setSaving(true);
    try {
      await onConvert({
        pipelineId: lead?.id || '',
        nome: nome.trim(),
        email: email.trim(),
        numero: numero.trim(),
        produto: produto.trim(),
        cpf: cpf.trim(),
        valor: Number(valor) || 0,
        moeda,
        data_renovacao: dataRenovacao,
        cobranca_ativa: cobrancaAtiva,
        ciclo_cobranca: cicloCobranca,
        observacao: observacao.trim(),
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const tipo = cobrancaAtiva ? 'Mensal' : 'Registro';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ArrowRightCircle className="h-5 w-5 text-primary" />
            Cadastrar Cliente — {lead?.lead_name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados para converter o lead em cliente ({tipo}).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">CPF *</Label>
              <Input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">E-mail *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Número *</Label>
              <Input value={numero} onChange={e => setNumero(e.target.value)} className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Produto *</Label>
              <ProductSelector value={produto} onChange={setProduto} category={cobrancaAtiva ? 'mensal' : 'registro'} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data Renovação</Label>
              <Input type="date" value={dataRenovacao} onChange={e => setDataRenovacao(e.target.value)} className="bg-secondary border-border h-11" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Valor</Label>
              <Input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="bg-secondary border-border" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Moeda</Label>
              <Select value={moeda} onValueChange={setMoeda}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ciclo</Label>
              <Select value={cicloCobranca} onValueChange={setCicloCobranca}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={cobrancaAtiva} onCheckedChange={setCobrancaAtiva} />
            <Label className="text-sm">
              {cobrancaAtiva ? 'Cliente Mensal (cobrança ativa)' : 'Cliente Registro (sem cobrança)'}
            </Label>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Observação</Label>
            <Textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} className="bg-secondary border-border" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!nome.trim() || !email.trim() || !numero.trim() || !produto.trim() || !cpf.trim() || saving}>
            {saving ? 'Cadastrando...' : 'Cadastrar Cliente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
