import { useState, useEffect, useRef } from 'react';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { useNavigate } from 'react-router-dom';
import { useClientes, ClienteInput, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, X, UserPlus, FileText, Tag, Repeat, Calendar, Infinity, Upload, File, Trash2, Image, ShieldCheck, CreditCard } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { formatCPFOrCNPJ, formatCurrencyInput, formatPhone, parseCurrency, unformat } from '@/utils/formatters';
import { TagInput } from '@/components/TagInput';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PhoneInputWithCountry } from '@/components/PhoneInputWithCountry';
import { useTranslation } from 'react-i18next';
import { useDuplicateCheck } from '@/hooks/useDuplicateCheck';
import { usePaymentStatus } from '@/hooks/usePaymentStatus';
import { DuplicateClientWarning } from '@/components/DuplicateClientWarning';
import { AlertTriangle, Package } from 'lucide-react';
import { ProductSelector } from '@/components/kanban/ProductSelector';
const clienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  numero: z.string().min(10, 'Número deve ter pelo menos 10 dígitos'),
  produto: z.string().min(1, 'Produto é obrigatório'),
  data_renovacao: z.string().min(1, 'Data de renovação é obrigatória'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cpf: z.string().optional().or(z.literal('')),
  plano: z.string().optional(),
  valor: z.number().positive('Valor deve ser maior que zero'),
  moeda: z.enum(['BRL', 'USD'], { required_error: 'Moeda é obrigatória' }),
});

const clienteVitalicioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  numero: z.string().min(10, 'Número deve ter pelo menos 10 dígitos'),
  produto: z.string().min(1, 'Produto é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  cpf: z.string().optional().or(z.literal('')),
  valor: z.number().min(0, 'Valor deve ser zero ou maior'),
  moeda: z.enum(['BRL', 'USD']).optional(),
});

type ClienteType = 'mensal' | 'registro' | null;

interface UploadedFile {
  file: File;
  preview?: string;
}

export default function CadastrarCliente() {
  const navigate = useNavigate();
  const { createCliente, isLoading } = useClientes();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { logActivity } = useSystemActivities();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [clienteType, setClienteType] = useState<ClienteType>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [countryCode, setCountryCode] = useState('BR');
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [pixProof, setPixProof] = useState<File | null>(null);
  // Link de Pagamento (MP/Stripe) flow
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string>('');
  const [selectedPaymentLinkId, setSelectedPaymentLinkId] = useState<string>('');
  const [recentPaymentLinks, setRecentPaymentLinks] = useState<Array<{
    id: string; empresa: string; provider: string; payment_url: string;
    valor_com_taxa: number; status: string; created_at: string; mp_payment_id: string | null;
  }>>([]);
  const [isValidatingLink, setIsValidatingLink] = useState(false);
  const [linkValidation, setLinkValidation] = useState<{
    state: 'idle' | 'success' | 'divergent' | 'duplicate' | 'invalid' | 'pending';
    message: string;
    amount?: number;
    transactionId?: string;
  }>({ state: 'idle', message: '' });
  
  const [formData, setFormData] = useState<ClienteInput>({
    nome: '',
    numero: '',
    produto: '',
    data_renovacao: '',
    email: '',
    cpf: '',
    plano: '',
    valor: 0,
    moeda: undefined,
    observacao: '',
    tags: [],
    cobranca_ativa: true,
    ciclo_cobranca: 'mensal',
    tipo: '',
    excluir_metricas: false,
  });
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdClienteId, setCreatedClienteId] = useState<string | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const { registerEarlyPayment, registerLinkPayment } = usePaymentStatus();
  const dupCheck = useDuplicateCheck();

  useEffect(() => {
    const fetchTags = async () => {
      const { data: configData } = await supabase
        .from('billing_config')
        .select('config_value')
        .like('config_key', 'tag_%');

      const configTags = configData
        ? configData
            .map((c) => c.config_value as string | null)
            .filter((t): t is string => !!t)
        : [];

      setExistingTags(configTags);
    };

    fetchTags();
  }, []);

  // Fetch recent payment links (last 30 days, pending) for the dropdown
  useEffect(() => {
    if (paymentMethod !== 'link_pagamento') return;
    const fetchLinks = async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('payment_links')
        .select('id, empresa, provider, payment_url, valor_com_taxa, status, created_at, mp_payment_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentPaymentLinks((data as any) || []);
    };
    fetchLinks();
  }, [paymentMethod]);

  useEffect(() => {
    if (clienteType === 'mensal') {
      setFormData(prev => ({ ...prev, cobranca_ativa: true }));
    } else if (clienteType === 'registro') {
      setFormData(prev => ({ 
        ...prev, 
        cobranca_ativa: false,
        data_renovacao: new Date().toISOString().split('T')[0],
        plano: 'Nenhum',
        moeda: 'BRL'
      }));
    }
  }, [clienteType]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    
    Array.from(files).forEach(file => {
      const isImage = file.type.startsWith('image/');
      const preview = isImage ? URL.createObjectURL(file) : undefined;
      newFiles.push({ file, preview });
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const uploadFilesToStorage = async (clienteId: string) => {
    if (uploadedFiles.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const { file } of uploadedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${clienteId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        await supabase.from('client_files').insert({
          cliente_id: clienteId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          created_by: user?.id
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Validate the pasted/selected payment link against MP/Stripe
  const handleValidateLink = async () => {
    const declared = Number(formData.valor) || 0;
    if (declared <= 0) {
      toast({ title: 'Informe o valor', description: 'Preencha o valor antes de validar o link.', variant: 'destructive' });
      return;
    }
    if (!paymentLinkUrl && !selectedPaymentLinkId) {
      toast({ title: 'Cole o link', description: 'Cole a URL do link de pagamento ou escolha um da lista.', variant: 'destructive' });
      return;
    }

    setIsValidatingLink(true);
    setLinkValidation({ state: 'idle', message: 'Consultando gateway...' });
    try {
      // Resolve IDs
      let mpPaymentId: string | undefined;
      let stripePaymentId: string | undefined;
      let urlForLookup = paymentLinkUrl.trim();

      if (selectedPaymentLinkId) {
        const link = recentPaymentLinks.find(l => l.id === selectedPaymentLinkId);
        if (link) {
          urlForLookup = link.payment_url;
          if (link.mp_payment_id) {
            if (link.provider === 'stripe') stripePaymentId = link.mp_payment_id;
            else mpPaymentId = link.mp_payment_id;
          }
        }
      }

      if (!mpPaymentId && !stripePaymentId && urlForLookup) {
        const stripeMatch = urlForLookup.match(/\b(pi|cs|cs_test|cs_live|plink)_[A-Za-z0-9]+/);
        const mpQs = urlForLookup.match(/[?&](?:payment_id|collection_id)=(\d+)/);
        if (stripeMatch) stripePaymentId = stripeMatch[0];
        else if (mpQs) mpPaymentId = mpQs[1];
      }

      if (!mpPaymentId && !stripePaymentId) {
        setLinkValidation({
          state: 'pending',
          message: 'Não foi possível extrair o ID do link automaticamente. Será enviado para aprovação manual em "Segurança de Pagamento".',
        });
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('check-payment-link-status', {
        body: mpPaymentId ? { mp_payment_id: mpPaymentId } : { stripe_payment_id: stripePaymentId },
      });

      if (error || !result || result.error) {
        setLinkValidation({
          state: 'invalid',
          message: result?.error || 'Não foi possível consultar o pagamento. Confira o link.',
        });
        return;
      }

      const isApproved = ['approved', 'paid', 'succeeded'].includes(result.status);
      const gatewayAmount = typeof result.amount === 'number' ? result.amount : undefined;
      const txnId = result.payment_id;

      if (!isApproved) {
        setLinkValidation({
          state: 'pending',
          message: `Pagamento ainda não confirmado pelo gateway (status: ${result.status}). Será enviado para aprovação.`,
          amount: gatewayAmount, transactionId: txnId,
        });
        return;
      }

      if (gatewayAmount !== undefined && Math.abs(gatewayAmount - declared) > 0.01) {
        setLinkValidation({
          state: 'divergent',
          message: `Valor divergente! Gateway: ${gatewayAmount.toFixed(2)} × Digitado: ${declared.toFixed(2)}.`,
          amount: gatewayAmount, transactionId: txnId,
        });
        return;
      }

      setLinkValidation({
        state: 'success',
        message: `Pagamento aprovado no gateway. Valor: ${(gatewayAmount ?? declared).toFixed(2)}.`,
        amount: gatewayAmount, transactionId: txnId,
      });
    } catch (err: any) {
      setLinkValidation({ state: 'invalid', message: err?.message || 'Erro ao validar link.' });
    } finally {
      setIsValidatingLink(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validação: Meio de Pagamento é obrigatório
    if (!paymentMethod) {
      toast({
        title: 'Meio de Pagamento obrigatório',
        description: 'Selecione como o cliente pagou para continuar.',
        variant: 'destructive',
      });
      return;
    }

    // Validação: Tipo de Cadastro é obrigatório
    if (!formData.tipo) {
      toast({
        title: 'Tipo de Cadastro obrigatório',
        description: 'Selecione o tipo de cadastro antes de continuar.',
        variant: 'destructive',
      });
      return;
    }
    
    const schema = clienteType === 'registro' ? clienteVitalicioSchema : clienteSchema;
    
    const dataToValidate = clienteType === 'registro'
      ? {
          nome: formData.nome,
          numero: formData.numero,
          produto: formData.produto,
          email: formData.email,
          cpf: formData.cpf,
          valor: Number(formData.valor),
          moeda: formData.moeda,
        }
      : {
          ...formData,
          valor: Number(formData.valor),
        };
    
    const result = schema.safeParse(dataToValidate);
    
    if (!result.success) {
      toast({
        title: 'Erro de validação',
        description: result.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    // Final duplicate check before showing confirmation
    await Promise.all([
      formData.cpf ? dupCheck.checkField('cpf', formData.cpf) : Promise.resolve(),
      formData.email ? dupCheck.checkField('email', formData.email) : Promise.resolve(),
      formData.numero ? dupCheck.checkField('numero', formData.numero) : Promise.resolve(),
    ]);

    setDuplicateAcknowledged(false);
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    const cliente = await createCliente({
      ...formData,
      valor: Number(formData.valor),
      moeda: formData.moeda || 'BRL',
    });
    
    if (cliente) {
      setCreatedClienteId(cliente.id);
      
      // Se for pagamento via Pix, registra o pagamento para análise
      if (paymentMethod === 'pix' && formData.valor > 0 && pixProof) {
        await registerEarlyPayment(cliente.id, Number(formData.valor), pixProof);
      }
      
      if (clienteType === 'registro' && uploadedFiles.length > 0) {
        await uploadFilesToStorage(cliente.id);
      }
      
      setShowConfirmation(false);
      setShowSuccess(true);
      logActivity(`Cadastrou novo cliente: ${formData.nome}`, 'cliente', `Tipo: ${clienteType === 'registro' ? 'Registro' : 'Mensal'}`);
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
      moeda: undefined,
      observacao: '',
      tags: [],
      cobranca_ativa: true,
      ciclo_cobranca: 'mensal',
    });
    setUploadedFiles([]);
    setPixProof(null);
    setPaymentMethod('other');
    setCreatedClienteId(null);
    setClienteType(null);
    setShowSuccess(false);
    setCountryCode('BR');
    setDuplicateAcknowledged(false);
    dupCheck.reset();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
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
              <h2 className="text-xl font-semibold text-primary mb-2">Cliente cadastrado com sucesso!</h2>
              {clienteType === 'registro' && uploadedFiles.length > 0 && (
                <p className="text-muted-foreground text-sm mb-4">
                  {uploadedFiles.length} arquivo(s) anexado(s)
                </p>
              )}
              <div className="flex gap-4 justify-center mt-6">
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

  // Type selection screen
  if (!clienteType) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center p-4 min-h-[70vh]">
          <Card className="w-full max-w-2xl bg-card border-border shadow-xl">
            <CardHeader className="border-b border-border pb-6">
              <div className="flex items-center justify-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <UserPlus className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {t('clients.register.title')}
                </CardTitle>
              </div>
              <p className="text-center text-muted-foreground mt-2">
                {t('clients.selectClientType')}
              </p>
            </CardHeader>
            <CardContent className="pt-8 pb-8">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Mensal Option */}
                <button
                  onClick={() => setClienteType('mensal')}
                  className="group relative p-6 rounded-2xl border-2 border-border bg-secondary/30 hover:border-primary hover:bg-primary/5 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Calendar className="w-10 h-10 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t('clients.monthlyBilling')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('clients.monthlyBillingDesc')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {t('clients.automaticRenewal')}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {t('clients.billingReminders')}
                      </span>
                    </div>
                  </div>
                </button>

                {/* Registro Option */}
                <button
                  onClick={() => setClienteType('registro')}
                  className="group relative p-6 rounded-2xl border-2 border-border bg-secondary/30 hover:border-amber-500 hover:bg-amber-500/5 transition-all duration-300 text-left"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="p-4 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                      <Infinity className="w-10 h-10 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {t('clients.registrationOnly')}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {t('clients.registrationOnlyDesc')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                        {t('clients.noBilling')}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                        {t('clients.fileUpload')}
                      </span>
                    </div>
                  </div>
                </button>
              </div>

              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12 mt-8"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('clients.backToMenu')}
              </Button>
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${clienteType === 'registro' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                {clienteType === 'registro' ? (
                  <Infinity className="w-6 h-6 text-amber-500" />
                ) : (
                  <UserPlus className="w-6 h-6 text-primary" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl font-semibold text-foreground">
                  {clienteType === 'registro' ? 'Cliente Registro' : 'Cliente Mensal'}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {clienteType === 'registro' ? 'Sem cobrança recorrente' : 'Com cobrança automática'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClienteType(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              Alterar
            </Button>
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

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="numero" className="text-foreground font-medium">Número WhatsApp</Label>
                  <PhoneInputWithCountry
                    value={formData.numero}
                    countryCode={countryCode}
                    onChange={(phoneWithDDI, code) => {
                      setFormData({ ...formData, numero: phoneWithDDI });
                      setCountryCode(code);
                      dupCheck.debouncedCheck('numero', phoneWithDDI);
                    }}
                    required
                  />
                  <DuplicateClientWarning matches={dupCheck.duplicates.numero} compact />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="cpf" className="text-foreground font-medium">CPF ou CNPJ</Label>
                  <Input
                    id="cpf"
                    placeholder="000.000.000-00"
                    value={formatCPFOrCNPJ(formData.cpf)}
                    onChange={(e) => {
                      const raw = unformat(e.target.value);
                      setFormData({ ...formData, cpf: raw });
                      dupCheck.debouncedCheck('cpf', raw);
                    }}
                    className="bg-secondary border-border text-foreground h-11"
                  />
                  <DuplicateClientWarning matches={dupCheck.duplicates.cpf} compact />
                </div>

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="email" className="text-foreground font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Digite o email"
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      dupCheck.debouncedCheck('email', e.target.value);
                    }}
                    className="bg-secondary border-border text-foreground h-11"
                  />
                  <DuplicateClientWarning matches={dupCheck.duplicates.email} compact />
                </div>

                <div className={clienteType === 'registro' ? 'space-y-2 col-span-2' : 'space-y-2'}>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="produto" className="text-foreground font-medium">Produto <span className="text-destructive">*</span></Label>
                  </div>
                  <ProductSelector 
                    value={formData.produto} 
                    onChange={(value) => setFormData({ ...formData, produto: value })} 
                    placeholder="Selecione o produto..."
                    category={clienteType === 'registro' ? 'registro' : 'mensal'}
                  />
                </div>

                {clienteType === 'mensal' && (
                  <>
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
                          <SelectItem value="Individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="valor" className="text-foreground font-medium">Valor do Produto</Label>
                      <div className="flex gap-2">
                        <Input
                          id="valor"
                          placeholder={formData.moeda === 'USD' ? '$ 0.00' : formData.moeda === 'BRL' ? 'R$ 0,00' : 'Selecione a moeda'}
                          value={formData.valor ? formatCurrencyInput(Math.round(formData.valor * 100).toString(), formData.moeda || 'BRL') : ''}
                          onChange={(e) => setFormData({ ...formData, valor: parseCurrency(e.target.value) })}
                          className="bg-secondary border-border text-foreground h-11 flex-1"
                          required
                        />
                        <Select
                          value={formData.moeda || ''}
                          onValueChange={(value) => setFormData({ ...formData, moeda: value as Moeda })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground h-11 w-28">
                            <SelectValue placeholder="Moeda" />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="BRL">R$ BRL</SelectItem>
                            <SelectItem value="USD">$ USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ciclo_cobranca" className="text-foreground font-medium">Ciclo de Cobrança</Label>
                      <Select
                        value={formData.ciclo_cobranca || 'mensal'}
                        onValueChange={(value) => setFormData({ ...formData, ciclo_cobranca: value as CicloCobranca })}
                      >
                        <SelectTrigger className="bg-secondary border-border text-foreground h-11">
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
                  </>
                )}
              </div>

              {/* Meio de Pagamento */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <Label className="text-foreground font-medium">
                    Meio de Pagamento <span className="text-destructive">*</span>
                  </Label>
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Select
                      value={paymentMethod}
                      onValueChange={setPaymentMethod}
                    >
                      <SelectTrigger className={`bg-secondary border-border text-foreground h-11 ${!paymentMethod && 'border-destructive/50'}`}>
                        <SelectValue placeholder="Selecione o meio de pagamento..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="pix">📱 Pix (Análise Automática)</SelectItem>
                        <SelectItem value="other">💳 Outros / Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentMethod === 'pix' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Label className="text-xs text-amber-500 font-medium">
                        Comprovante Pix <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex flex-col gap-2">
                        <Input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => setPixProof(e.target.files?.[0] || null)}
                          className="bg-secondary border-border text-xs h-11 pt-2.5 cursor-pointer"
                          required={paymentMethod === 'pix'}
                        />
                        <p className="text-[10px] text-muted-foreground bg-amber-500/5 p-2 rounded border border-amber-500/20">
                          ⚠️ O pagamento será enviado para análise OCR e duplicidade. A aprovação deve ser feita em "Segurança de Pagamento".
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {clienteType === 'registro' && (
                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-500" />
                    <Label className="text-foreground font-medium">Valor da Venda (Opcional)</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Registre o valor pago pelo cliente para contabilização nos relatórios
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="valor-registro"
                      placeholder={formData.moeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                      value={formData.valor ? formatCurrencyInput(Math.round(formData.valor * 100).toString(), formData.moeda || 'BRL') : ''}
                      onChange={(e) => setFormData({ ...formData, valor: parseCurrency(e.target.value) })}
                      className="bg-secondary border-border text-foreground h-11 flex-1"
                    />
                    <Select
                      value={formData.moeda || 'BRL'}
                      onValueChange={(value) => setFormData({ ...formData, moeda: value as Moeda })}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground h-11 w-28">
                        <SelectValue placeholder="Moeda" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="BRL">R$ BRL</SelectItem>
                        <SelectItem value="USD">$ USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Upload de Arquivos - Apenas para Registro */}
              {clienteType === 'registro' && (
                <div className="space-y-3 mt-6">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-amber-500" />
                    <Label className="text-foreground font-medium">Arquivos e Documentos</Label>
                  </div>
                  
                  <div 
                    className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-amber-500/50 transition-colors cursor-pointer bg-secondary/30"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Clique para selecionar arquivos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Imagens, PDFs, documentos
                    </p>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {uploadedFiles.map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg border border-border"
                        >
                          {item.preview ? (
                            <img 
                              src={item.preview} 
                              alt={item.file.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                              <File className="w-6 h-6 text-amber-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.file.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(item.file.size)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFile(index)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Classificação do Cadastro */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <Label className="text-foreground font-medium">Classificação e Métricas</Label>
                </div>
                
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo" className="text-xs text-muted-foreground uppercase tracking-wider">
                      Tipo de Cadastro <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.tipo || ''}
                      onValueChange={(value) => {
                        const isExcluded = value !== 'cliente';
                        setFormData({ 
                          ...formData, 
                          tipo: value,
                          excluir_metricas: isExcluded // Cliente: desmarca | Outros: marca automaticamente
                        });
                      }}
                    >
                      <SelectTrigger id="tipo" className="bg-secondary border-border text-foreground h-11">
                        <SelectValue placeholder="Selecione o tipo..." />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="cliente">💎 Cliente</SelectItem>
                        <SelectItem value="administrativo">⚙️ Administrativo</SelectItem>
                        <SelectItem value="parceiro">🤝 Parceiro / Agência</SelectItem>
                        <SelectItem value="outros">📁 Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg border border-border">
                    <div className="space-y-0.5">
                      <Label htmlFor="excluir_metricas" className="text-sm font-medium">Ignorar em Métricas/IA</Label>
                      <p className="text-[10px] text-muted-foreground leading-tight">Não será contabilizado em faturamento e análises de IA.</p>
                    </div>
                    <Switch
                      id="excluir_metricas"
                      checked={formData.excluir_metricas}
                      disabled={true}
                      onCheckedChange={(checked) => setFormData({ ...formData, excluir_metricas: checked })}
                    />
                  </div>
                </div>
              </div>

              {/* Campo de Observações */}
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

              {/* Campo de Tags */}
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <Label htmlFor="tags" className="text-foreground font-medium">Tags</Label>
                </div>
                <TagInput
                  tags={formData.tags || []}
                  onTagsChange={(tags) => setFormData({ ...formData, tags })}
                  suggestions={existingTags}
                  onlyFromSuggestions={true}
                />
              </div>

              <Button 
                type="submit" 
                className={`btn-3d w-full h-12 font-medium mt-6 ${
                  clienteType === 'registro' 
                    ? 'bg-amber-500 text-white hover:bg-amber-600' 
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
                disabled={isLoading}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Cadastrar
              </Button>

              <Button 
                type="button"
                onClick={() => setClienteType(null)}
                variant="outline"
                className="btn-3d w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <h2 className={`text-lg font-semibold text-center ${clienteType === 'registro' ? 'text-amber-500' : 'text-primary'}`}>
                Confirme os dados abaixo:
              </h2>
              <div className={`border rounded-xl p-5 space-y-2 text-sm ${
                clienteType === 'registro' 
                  ? 'bg-amber-500/5 border-amber-500/20' 
                  : 'bg-primary/5 border-primary/20'
              }`}>
                <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border">
                  {clienteType === 'registro' ? (
                    <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
                      Registro
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                      Cobrança Mensal
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">Nome: <span className="text-foreground font-medium">{formData.nome}</span></p>
                <p className="text-muted-foreground">Número: <span className="text-foreground">+{formData.numero}</span></p>
                <p className="text-muted-foreground">Produto: <span className="text-foreground">{formData.produto}</span></p>
                <p className="text-muted-foreground">Email: <span className="text-foreground">{formData.email}</span></p>
                <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{formData.cpf}</span></p>
                
                {clienteType === 'mensal' && (
                  <>
                    <p className="text-muted-foreground">Data Renovação: <span className="text-foreground">{formData.data_renovacao}</span></p>
                    <p className="text-muted-foreground">Plano: <span className="text-foreground">{formData.plano || 'Nenhum'}</span></p>
                    <p className="text-muted-foreground">Valor: <span className="text-primary font-medium">
                      {formData.moeda === 'USD' 
                        ? `$ ${Number(formData.valor).toFixed(2)}` 
                        : `R$ ${Number(formData.valor).toFixed(2)}`}
                    </span></p>
                    <p className="text-muted-foreground">Moeda: <span className="text-foreground">{formData.moeda === 'USD' ? 'Dólar (USD)' : 'Real (BRL)'}</span></p>
                  </>
                )}
                
                {formData.observacao && (
                  <p className="text-muted-foreground mt-2">Observações: <span className="text-foreground italic">{formData.observacao}</span></p>
                )}
                {formData.tags && formData.tags.length > 0 && (
                  <p className="text-muted-foreground mt-2">Tags: <span className="text-foreground">{formData.tags.join(', ')}</span></p>
                )}
                {clienteType === 'registro' && uploadedFiles.length > 0 && (
                  <p className="text-muted-foreground mt-2">
                    Arquivos: <span className="text-amber-500 font-medium">{uploadedFiles.length} arquivo(s) para upload</span>
                  </p>
                )}
              </div>

              {dupCheck.hasAnyDuplicate && (
                <div className="space-y-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        Atenção: cliente possivelmente duplicado
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Encontramos cadastro(s) com os mesmos dados. Confira se realmente deseja criar um novo cadastro:
                      </p>
                    </div>
                  </div>
                  <DuplicateClientWarning matches={dupCheck.allMatches()} />
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={duplicateAcknowledged}
                      onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-border accent-amber-500 cursor-pointer"
                    />
                    <span className="text-foreground">
                      Estou ciente e quero criar um <strong>novo cadastro</strong> mesmo assim.
                    </span>
                  </label>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleConfirm}
                  className={`btn-3d h-11 ${
                    clienteType === 'registro' 
                      ? 'bg-amber-500 text-white hover:bg-amber-600' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  disabled={isLoading || isUploading || (dupCheck.hasAnyDuplicate && !duplicateAcknowledged)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {isLoading || isUploading ? 'Salvando...' : 'Confirmar'}
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