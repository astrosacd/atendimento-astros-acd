import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, ClienteInput, CicloCobranca, Moeda } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Check, X, UserPlus, FileText, Tag, Repeat, Calendar, Infinity, Upload, File, Trash2, Image } from 'lucide-react';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { DashboardLayout } from '@/components/DashboardLayout';
import { formatCPFOrCNPJ, formatCurrencyInput, formatPhone, parseCurrency, unformat } from '@/utils/formatters';
import { TagInput } from '@/components/TagInput';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

const clienteVitalicioSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  numero: z.string().min(10, 'Número deve ter pelo menos 10 dígitos'),
  produto: z.string().min(2, 'Produto é obrigatório'),
  email: z.string().email('Email inválido'),
  cpf: z.string().min(11, 'CPF/CNPJ deve ter pelo menos 11 dígitos'),
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
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [clienteType, setClienteType] = useState<ClienteType>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState<ClienteInput>({
    nome: '',
    numero: '',
    produto: '',
    data_renovacao: '',
    email: '',
    cpf: '',
    plano: '',
    valor: 0,
    moeda: 'BRL',
    observacao: '',
    tags: [],
    cobranca_ativa: true,
    ciclo_cobranca: 'mensal',
  });
  
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdClienteId, setCreatedClienteId] = useState<string | null>(null);
  const [existingTags, setExistingTags] = useState<string[]>([]);

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

  useEffect(() => {
    if (clienteType === 'mensal') {
      setFormData(prev => ({ ...prev, cobranca_ativa: true }));
    } else if (clienteType === 'registro') {
      setFormData(prev => ({ 
        ...prev, 
        cobranca_ativa: false,
        data_renovacao: new Date().toISOString().split('T')[0],
        valor: 0,
        plano: 'Nenhum'
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const schema = clienteType === 'registro' ? clienteVitalicioSchema : clienteSchema;
    
    const dataToValidate = clienteType === 'registro'
      ? {
          nome: formData.nome,
          numero: formData.numero,
          produto: formData.produto,
          email: formData.email,
          cpf: formData.cpf,
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
    
    setShowConfirmation(true);
  };

  const handleConfirm = async () => {
    const cliente = await createCliente({
      ...formData,
      valor: Number(formData.valor),
    });
    
    if (cliente) {
      setCreatedClienteId(cliente.id);
      
      if (clienteType === 'registro' && uploadedFiles.length > 0) {
        await uploadFilesToStorage(cliente.id);
      }
      
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
      tags: [],
      cobranca_ativa: true,
    });
    setUploadedFiles([]);
    setCreatedClienteId(null);
    setClienteType(null);
    setShowSuccess(false);
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
                  Cadastro de Cliente
                </CardTitle>
              </div>
              <p className="text-center text-muted-foreground mt-2">
                Selecione o tipo de cadastro
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
                        Cobrança Mensal
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Cliente com renovação periódica e cobrança automática recorrente
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        Renovação automática
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        Lembretes de cobrança
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
                        Registro
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Cliente sem cobrança recorrente, apenas para armazenar informações e arquivos
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                        Sem cobrança
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-500">
                        Upload de arquivos
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
                Voltar ao Menu
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

                <div className={clienteType === 'registro' ? 'space-y-2 col-span-2' : 'space-y-2'}>
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
                          <SelectItem value="Nenhum">Nenhum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="valor" className="text-foreground font-medium">Valor do Produto</Label>
                      <div className="flex gap-2">
                        <Input
                          id="valor"
                          placeholder={formData.moeda === 'USD' ? '$ 0.00' : 'R$ 0,00'}
                          value={formData.valor ? formatCurrencyInput(Math.round(formData.valor * 100).toString()) : ''}
                          onChange={(e) => setFormData({ ...formData, valor: parseCurrency(e.target.value) })}
                          className="bg-secondary border-border text-foreground h-11 flex-1"
                          required
                        />
                        <Select
                          value={formData.moeda || 'BRL'}
                          onValueChange={(value) => setFormData({ ...formData, moeda: value as Moeda })}
                        >
                          <SelectTrigger className="bg-secondary border-border text-foreground h-11 w-24">
                            <SelectValue />
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
                <p className="text-muted-foreground">Número: <span className="text-foreground">{formData.numero}</span></p>
                <p className="text-muted-foreground">Produto: <span className="text-foreground">{formData.produto}</span></p>
                <p className="text-muted-foreground">Email: <span className="text-foreground">{formData.email}</span></p>
                <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{formData.cpf}</span></p>
                
                {clienteType === 'mensal' && (
                  <>
                    <p className="text-muted-foreground">Data Renovação: <span className="text-foreground">{formData.data_renovacao}</span></p>
                    <p className="text-muted-foreground">Plano: <span className="text-foreground">{formData.plano || 'Nenhum'}</span></p>
                    <p className="text-muted-foreground">Valor: <span className="text-primary font-medium">R$ {Number(formData.valor).toFixed(2)}</span></p>
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
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleConfirm}
                  className={`btn-3d h-11 ${
                    clienteType === 'registro' 
                      ? 'bg-amber-500 text-white hover:bg-amber-600' 
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                  disabled={isLoading || isUploading}
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