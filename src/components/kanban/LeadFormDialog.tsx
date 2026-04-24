import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { ProductSelector } from './ProductSelector';

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (lead: { name: string; phone: string; email: string; produto: string }) => Promise<void>;
}

export function LeadFormDialog({ open, onOpenChange, onSubmit }: LeadFormDialogProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [produto, setProduto] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim(), produto: produto.trim() });
      setName(''); setPhone(''); setEmail(''); setProduto('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserPlus className="h-5 w-5 text-primary" />
            Novo Lead
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do lead" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Telefone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Número de contato" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">E-mail</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail do lead" className="bg-secondary border-border" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Produto de interesse *</Label>
            <ProductSelector value={produto} onChange={setProduto} placeholder="Selecione o produto ou serviço" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !produto.trim() || saving}>
            {saving ? 'Salvando...' : 'Adicionar Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
