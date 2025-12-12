import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, ClienteInput } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, X, UserPlus, FileText } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { formatCPFOrCNPJ, formatCurrency, formatPhone, parseCurrency, unformat } from '@/utils/formatters';

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
    observacao: '',
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
      observacao: '',
    });
    setShowSuccess(false);
  };

  if (showSuccess) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-4">
          <Card className="w-full max-w-xl bg-card border-border shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-primary mb-6">Cliente cadastrado com sucesso!</h2>
              <div className="flex gap-4 justify-center">
                <Button onClick={resetForm} className="btn-3d bg-primary text-primary-foreground hover:bg-primary/90 h-11">
                  Novo Cadastro
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline" className="btn-3d border-border text-muted-foreground h-11">
                  Voltar ao Menu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Cadastro de Cliente
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!showConfirmation ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="nome" className="text-foreground font-medium">Nome</Label>
                  <Input
                    id="nome"
                    placeholder="Digite o nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero" className="text-foreground font-medium">Número WhatsApp</Label>
                  <Input
                    id="numero"
                    placeholder="(00) 00000-0000"
                    value={formatPhone(formData.numero)}
                    onChange={(e) => setFormData({ ...formData, numero: unformat(e.target.value) })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-foreground font-medium">CPF ou CNPJ</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={formatCPFOrCNPJ(formData.cpf)}
                    onChange={(e) => setFormData({ ...formData, cpf: unformat(e.target.value) })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite o email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="produto" className="text-foreground font-medium">Produto</Label>
                  <Input
                    id="produto"
                    placeholder="Nome do produto"
                    value={formData.produto}
                    onChange={(e) => setFormData({ ...formData, produto: e.target.value })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_renovacao" className="text-foreground font-medium">Data de Renovação</Label>
                  <Input
                    id="data_renovacao"
                    type="date"
                    value={formData.data_renovacao}
                    onChange={(e) => setFormData({ ...formData, data_renovacao: e.target.value })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plano" className="text-foreground font-medium">Plano Revendedor</Label>
                  <Select
                    value={formData.plano}
                    onValueChange={(value) => setFormData({ ...formData, plano: value })}
                  >
                    <SelectTrigger className="bg-secondary border-border text-foreground h-11">
                      <SelectValue placeholder="Selecione o plano" />
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
                  <Label htmlFor="valor" className="text-foreground font-medium">Valor do Produto</Label>
                  <Input
                    id="valor"
                    placeholder="R$ 0,00"
                    value={formData.valor ? formatCurrency((formData.valor * 100).toString()) : ''}
                    onChange={(e) => setFormData({ ...formData, valor: parseCurrency(e.target.value) })}
                    className="bg-secondary border-border text-foreground h-11"
                    required
                  />
                </div>
              </div>

              {/* Campo de Observações Melhorado */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="observacao" className="text-foreground font-medium">Observações</Label>
                </div>
                <Textarea
                  id="observacao"
                  placeholder="Adicione notas, observações ou informações importantes sobre o cliente..."
                  value={formData.observacao || ''}
                  onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                  className="bg-secondary border-border text-foreground min-h-[100px] resize-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">Campo opcional para anotações internas</p>
              </div>

              <Button 
                type="submit" 
                className="btn-3d w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-medium mt-4"
                disabled={isLoading}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Cadastrar
              </Button>

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-primary text-center">Confirme os dados abaixo:</h2>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-2 text-sm">
                <p className="text-muted-foreground">Nome: <span className="text-foreground font-medium">{formData.nome}</span></p>
                <p className="text-muted-foreground">Número: <span className="text-foreground">{formData.numero}</span></p>
                <p className="text-muted-foreground">Produto: <span className="text-foreground">{formData.produto}</span></p>
                <p className="text-muted-foreground">Data Renovação: <span className="text-foreground">{formData.data_renovacao}</span></p>
                <p className="text-muted-foreground">Email: <span className="text-foreground">{formData.email}</span></p>
                <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{formData.cpf}</span></p>
                <p className="text-muted-foreground">Plano: <span className="text-foreground">{formData.plano || 'Nenhum'}</span></p>
                <p className="text-muted-foreground">Valor: <span className="text-primary font-medium">R$ {Number(formData.valor).toFixed(2)}</span></p>
                {formData.observacao && (
                  <p className="text-muted-foreground mt-2">Observações: <span className="text-foreground italic">{formData.observacao}</span></p>
                )}
              </div>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleConfirm}
                  className="btn-3d bg-primary text-primary-foreground hover:bg-primary/90 h-11"
                  disabled={isLoading}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isLoading ? 'Salvando...' : 'Confirmar'}
                </Button>
                <Button 
                  onClick={handleCancel}
                  variant="outline"
                  className="btn-3d border-destructive text-destructive hover:bg-destructive/10 h-11"
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
    </DashboardLayout>
  );
}
