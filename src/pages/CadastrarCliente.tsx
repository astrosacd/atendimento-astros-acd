import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, ClienteInput } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, X } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';

const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  numero: z.string().min(10, 'Número deve ter pelo menos 10 dígitos'),
  produto: z.string().min(2, 'Produto é obrigatório'),
  data_renovacao: z.string().min(1, 'Data de renovação é obrigatória'),
  email: z.string().email('Email inválido'),
  cpf: z.string().min(11, 'CPF/CNPJ deve ter pelo menos 11 dígitos'),
  plano: z.string().optional(),
  valor: z.number().positive('Valor deve ser maior que zero'),
});

export default function CadastrarCliente() {
  const navigate = useNavigate();
  const { createCliente, isLoading } = useClientes();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<ClienteInput>({
    nome: '',
    numero: '',
    produto: '',
    data_renovacao: '',
    email: '',
    cpf: '',
    plano: '',
    valor: 0,
  });
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = clienteSchema.safeParse({
      ...formData,
      valor: Number(formData.valor),
    });
    
    if (!result.success) {
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }
    
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    const cliente = await createCliente({
      ...formData,
      valor: Number(formData.valor),
    });
    
    if (cliente) {
      setShowConfirmation(false);
      setShowSuccess(true);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      numero: '',
      produto: '',
      data_renovacao: '',
      email: '',
      cpf: '',
      plano: '',
      valor: 0,
    });
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-xl bg-card border-border">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-primary mb-4">Cliente cadastrado com sucesso!</h2>
            <div className="flex gap-4 justify-center">
              <Button onClick={resetForm} className="bg-primary text-primary-foreground">
                Novo Cadastro
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="border-border">
                Voltar ao Menu
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-primary text-center">
            Cadastro de Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!showConfirmation ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-foreground">Nome</Label>
                <Input
                  id="nome"
                  placeholder="Digite o nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="numero" className="text-foreground">Número WhatsApp</Label>
                <Input
                  id="numero"
                  placeholder="Digite o número"
                  value={formData.numero}
                  onChange={(e) => setFormData({ ...formData, numero: e.target.value.replace(/\D/g, '') })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="produto" className="text-foreground">Produto</Label>
                <Input
                  id="produto"
                  placeholder="Nome do produto"
                  value={formData.produto}
                  onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_renovacao" className="text-foreground">Data de Renovação</Label>
                <Input
                  id="data_renovacao"
                  type="date"
                  value={formData.data_renovacao}
                  onChange={(e) => setFormData({ ...formData, data_renovacao: e.target.value })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite o email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-foreground">CPF ou CNPJ</Label>
                <Input
                  id="cpf"
                  placeholder="Digite o CPF ou CNPJ"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '') })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plano" className="text-foreground">Plano Revendedor</Label>
                <Select
                  value={formData.plano}
                  onValueChange={(value) => setFormData({ ...formData, plano: value })}
                >
                  <SelectTrigger className="bg-input border-border text-foreground">
                    <SelectValue placeholder="Selecione o Plano Revendedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="Plano Starter">Plano Starter</SelectItem>
                    <SelectItem value="Plano Pro">Plano Pro</SelectItem>
                    <SelectItem value="Plano Agência">Plano Agência</SelectItem>
                    <SelectItem value="Nenhum">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="valor" className="text-foreground">Valor do Produto</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  placeholder="Digite o valor"
                  value={formData.valor || ''}
                  onChange={(e) => setFormData({ ...formData, valor: parseFloat(e.target.value) || 0 })}
                  className="bg-input border-border text-foreground"
                  required
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isLoading}
              >
                Cadastrar
              </Button>

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-secondary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-primary text-center">Confirme os dados abaixo:</h2>
              <div className="space-y-2 text-sm">
                <p><strong className="text-muted-foreground">Nome:</strong> {formData.nome}</p>
                <p><strong className="text-muted-foreground">Número:</strong> {formData.numero}</p>
                <p><strong className="text-muted-foreground">Produto:</strong> {formData.produto}</p>
                <p><strong className="text-muted-foreground">Data Renovação:</strong> {formData.data_renovacao}</p>
                <p><strong className="text-muted-foreground">Email:</strong> {formData.email}</p>
                <p><strong className="text-muted-foreground">CPF/CNPJ:</strong> {formData.cpf}</p>
                <p><strong className="text-muted-foreground">Plano:</strong> {formData.plano || 'Nenhum'}</p>
                <p><strong className="text-muted-foreground">Valor:</strong> R$ {Number(formData.valor).toFixed(2)}</p>
              </div>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleConfirm}
                  className="bg-primary text-primary-foreground"
                  disabled={isLoading}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isLoading ? 'Salvando...' : 'Confirmar'}
                </Button>
                <Button 
                  onClick={handleCancel}
                  variant="destructive"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
