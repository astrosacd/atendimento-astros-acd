import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Receipt, RefreshCw } from 'lucide-react';
import { DespesaCategoria, DespesaFormData, Despesa } from '@/hooks/useDespesas';

interface DespesaFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categorias: DespesaCategoria[];
  editingDespesa: Despesa | null;
  onSubmit: (data: DespesaFormData) => Promise<boolean>;
}

export function DespesaFormDialog({
  isOpen,
  onClose,
  categorias,
  editingDespesa,
  onSubmit,
}: DespesaFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<DespesaFormData>({
    descricao: '',
    valor: 0,
    moeda: 'BRL',
    categoria_id: null,
    data_vencimento: new Date().toISOString().split('T')[0],
    tipo: 'avulsa',
    recorrencia: 'mensal',
    observacao: '',
  });

  useEffect(() => {
    if (editingDespesa) {
      setFormData({
        descricao: editingDespesa.descricao,
        valor: editingDespesa.valor,
        moeda: editingDespesa.moeda,
        categoria_id: editingDespesa.categoria_id,
        data_vencimento: editingDespesa.data_vencimento,
        tipo: editingDespesa.tipo,
        recorrencia: editingDespesa.recorrencia || 'mensal',
        observacao: editingDespesa.observacao || '',
      });
    } else {
      setFormData({
        descricao: '',
        valor: 0,
        moeda: 'BRL',
        categoria_id: null,
        data_vencimento: new Date().toISOString().split('T')[0],
        tipo: 'avulsa',
        recorrencia: 'mensal',
        observacao: '',
      });
    }
  }, [editingDespesa, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const success = await onSubmit(formData);
    
    setIsSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingDespesa ? 'Editar Despesa' : 'Nova Despesa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Conta de internet"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
            />
          </div>

          {/* Valor e Moeda */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="valor">Valor *</Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.valor || ''}
                onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="moeda">Moeda</Label>
              <Select 
                value={formData.moeda} 
                onValueChange={(v) => setFormData({ ...formData, moeda: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select 
              value={formData.categoria_id || 'none'} 
              onValueChange={(v) => setFormData({ ...formData, categoria_id: v === 'none' ? null : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria</SelectItem>
                {categorias.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cat.cor || '#6366f1' }}
                      />
                      {cat.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data de Vencimento */}
          <div className="space-y-2">
            <Label htmlFor="data_vencimento">Data de Vencimento *</Label>
            <Input
              id="data_vencimento"
              type="date"
              value={formData.data_vencimento}
              onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
              required
            />
          </div>

          {/* Tipo */}
          <div className="space-y-3">
            <Label>Tipo de Despesa</Label>
            <RadioGroup
              value={formData.tipo}
              onValueChange={(v: 'fixa' | 'avulsa') => setFormData({ ...formData, tipo: v })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="avulsa" id="avulsa" />
                <Label htmlFor="avulsa" className="flex items-center gap-2 cursor-pointer">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  Avulsa
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="fixa" id="fixa" />
                <Label htmlFor="fixa" className="flex items-center gap-2 cursor-pointer">
                  <RefreshCw className="h-4 w-4 text-info" />
                  Fixa (Recorrente)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Recorrência (só aparece se for fixa) */}
          {formData.tipo === 'fixa' && (
            <div className="space-y-2">
              <Label htmlFor="recorrencia">Recorrência</Label>
              <Select 
                value={formData.recorrencia || 'mensal'} 
                onValueChange={(v) => setFormData({ ...formData, recorrencia: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              placeholder="Observações adicionais..."
              value={formData.observacao || ''}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {editingDespesa ? 'Salvar' : 'Criar Despesa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
