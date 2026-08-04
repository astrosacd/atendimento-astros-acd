import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { PhoneInputWithCountry } from '@/components/PhoneInputWithCountry';
import { Mail, MessageSquare, Loader2, UserPlus, Users, Sparkles, Languages, FileSignature, FileX2, Megaphone, Link2, Upload, FileText, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFollowups, type CreateFollowupData, type Followup, type EnvioTipo } from '@/hooks/useFollowups';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ClientOption {
  id: string;
  nome: string;
  email: string;
  numero: string;
}

interface FollowupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: Followup | null;
  initialTipo?: EnvioTipo;
}

export function FollowupFormDialog({ open, onOpenChange, editData }: FollowupFormDialogProps) {
  const { createFollowup, updateFollowup } = useFollowups();
  const isEditing = !!editData && editData.id !== '__clone__';

  const [clientSource, setClientSource] = useState<'manual' | 'existing'>('manual');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [produto, setProduto] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'both'>('whatsapp');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [isRecurring, setIsRecurring] = useState(false);
  const [intervalDays, setIntervalDays] = useState(3);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [envioTipo, setEnvioTipo] = useState<EnvioTipo>('proposta');
  const [docLink, setDocLink] = useState('');
  const [docPdfUrl, setDocPdfUrl] = useState('');
  const [docPdfName, setDocPdfName] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  const isDocumento = envioTipo === 'contrato' || envioTipo === 'distrato';

  const tipoOptions: { value: EnvioTipo; label: string; icon: React.ReactNode; hint: string }[] = [
    { value: 'proposta', label: 'Proposta', icon: <Megaphone className="h-4 w-4" />, hint: 'Mensagem comercial de follow-up' },
    { value: 'contrato', label: 'Contrato', icon: <FileSignature className="h-4 w-4" />, hint: 'Envio de contrato para assinatura' },
    { value: 'distrato', label: 'Distrato', icon: <FileX2 className="h-4 w-4" />, hint: 'Cancelamento contratual para assinatura' },
  ];

  const handlePdfUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Envie um arquivo PDF');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error('O PDF deve ter no máximo 15 MB');
      return;
    }
    setIsUploadingPdf(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${envioTipo}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from('contratos').upload(path, file, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (error) throw error;
      setDocPdfUrl(path);
      setDocPdfName(file.name);
      toast.success('PDF anexado!');
    } catch (err: any) {
      toast.error('Erro ao enviar PDF: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleRemovePdf = async () => {
    const path = docPdfUrl;
    setDocPdfUrl('');
    setDocPdfName('');
    if (path) {
      await supabase.storage.from('contratos').remove([path]).catch(() => null);
    }
  };


  const translateLanguages = [
    { code: 'pt-BR', label: '🇧🇷 Português' },
    { code: 'en', label: '🇺🇸 English' },
    { code: 'es', label: '🇪🇸 Español' },
    { code: 'fr', label: '🇫🇷 Français' },
    { code: 'it', label: '🇮🇹 Italiano' },
    { code: 'de', label: '🇩🇪 Deutsch' },
  ];

  const handleTranslateMessage = async (targetLang: string, langLabel: string) => {
    if (!customMessage.trim()) {
      toast.error('Escreva ou gere uma mensagem primeiro');
      return;
    }
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('followup-generate-message', {
        body: {
          produto: produto.trim() || 'produto',
          client_name: 'Cliente',
          translate_to: targetLang,
          original_message: customMessage,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.message) {
        setCustomMessage(data.message);
        toast.success(`Mensagem traduzida para ${langLabel}!`);
      }
    } catch (err: any) {
      toast.error('Erro ao traduzir: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsTranslating(false);
    }
  };

  // Check if AI message generation is enabled
  const { data: aiEnabled } = useQuery({
    queryKey: ['followup-ai-config'],
    queryFn: async () => {
      const { data } = await supabase
        .from('followup_config')
        .select('config_value')
        .eq('config_key', 'ai_message_enabled')
        .single();
      return data?.config_value === 'true';
    },
  });

  const handleGenerateAIMessage = async () => {
    if (!produto.trim()) {
      toast.error('Preencha o produto de interesse primeiro');
      return;
    }
    const name = clientSource === 'existing'
      ? clients.find(c => c.id === selectedClientId)?.nome || 'Cliente'
      : manualName || 'Cliente';

    setIsGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('followup-generate-message', {
        body: { produto: produto.trim(), client_name: name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.message) {
        setCustomMessage(data.message);
        toast.success('Mensagem gerada pela IA!');
      }
    } catch (err: any) {
      toast.error('Erro ao gerar mensagem: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (editData) {
        // Populate from edit data
        setClientSource(editData.cliente_id ? 'existing' : 'manual');
        setSelectedClientId(editData.cliente_id || '');
        setManualName(editData.manual_name || '');
        setManualEmail(editData.manual_email || '');
        setManualPhone(editData.manual_phone || '');
        setProduto(editData.produto);
        setCustomMessage(editData.custom_message || '');
        setChannel(editData.channel);
        const date = new Date(editData.scheduled_at);
        setScheduledDate(date.toISOString().split('T')[0]);
        setScheduledTime(date.toTimeString().slice(0, 5));
        setIsRecurring(editData.is_recurring);
        setIntervalDays(editData.recurrence_interval_days || 3);
        setMaxAttempts(editData.max_attempts || 3);
        setEnvioTipo((editData.envio_tipo as EnvioTipo) || 'proposta');
        setDocLink(editData.doc_link || '');
        setDocPdfUrl(editData.doc_pdf_url || '');
        setDocPdfName(editData.doc_pdf_name || '');
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setScheduledDate(tomorrow.toISOString().split('T')[0]);
        setClientSource('manual');
        setSelectedClientId('');
        setManualName('');
        setManualEmail('');
        setManualPhone('');
        setProduto('');
        setCustomMessage('');
        setChannel('whatsapp');
        setScheduledTime('09:00');
        setIsRecurring(false);
        setIntervalDays(3);
        setMaxAttempts(3);
        setEnvioTipo('proposta');
        setDocLink('');
        setDocPdfUrl('');
        setDocPdfName('');
      }

      // Load clients
      supabase
        .from('clientes')
        .select('id, nome, email, numero')
        .order('nome')
        .then(({ data }) => {
          if (data) setClients(data as ClientOption[]);
        });
    }
  }, [open, editData]);

  // Auto-fill message template (only for new)
  useEffect(() => {
    if (isEditing) return;
    const name = clientSource === 'existing'
      ? clients.find(c => c.id === selectedClientId)?.nome || 'Cliente'
      : manualName || 'Cliente';

    if (!produto) return;

    if (envioTipo === 'contrato') {
      setCustomMessage(`Olá ${name}! 👋\n\nSegue o *contrato* referente ao serviço de *${produto}*.\n\nPor favor, revise o documento e realize a assinatura. Qualquer dúvida sobre as cláusulas, estou à disposição.\n\nApós a assinatura, você receberá a via final do contrato.`);
    } else if (envioTipo === 'distrato') {
      setCustomMessage(`Olá ${name}!\n\nSegue o *distrato* (encerramento contratual) referente ao serviço de *${produto}*.\n\nPor favor, revise e assine o documento para formalizarmos o encerramento.\n\nAgradecemos pela parceria e seguimos à disposição para o que precisar.`);
    } else {
      setCustomMessage(`Olá ${name}! 👋\n\nNotei seu interesse em *${produto}*. Gostaria de conversar mais sobre como podemos te ajudar?\n\nEstou à disposição para tirar suas dúvidas!`);
    }
  }, [produto, manualName, selectedClientId, clientSource, clients, isEditing, envioTipo]);


  const clientOptions = clients.map(c => ({
    value: c.id,
    label: `${c.nome} - ${c.numero || c.email}`,
  }));

  const handleSubmit = () => {
    if (!produto.trim()) return;
    if (!scheduledDate) return;
    if (isDocumento && !docLink.trim() && !docPdfUrl) {
      toast.error('Informe o link de assinatura e/ou anexe o PDF do documento');
      return;
    }
    if (docLink.trim() && !/^https?:\/\//i.test(docLink.trim())) {
      toast.error('O link de assinatura deve começar com http:// ou https://');
      return;
    }

    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00-03:00`).toISOString();

    const docFields = {
      envio_tipo: envioTipo,
      doc_link: isDocumento ? (docLink.trim() || null) : null,
      doc_pdf_url: isDocumento ? (docPdfUrl || null) : null,
      doc_pdf_name: isDocumento ? (docPdfName || null) : null,
    };

    if (isEditing && editData) {
      updateFollowup.mutate({
        id: editData.id,
        produto: produto.trim(),
        custom_message: customMessage.trim() || undefined,
        channel,
        scheduled_at: scheduledAt,
        is_recurring: isRecurring,
        recurrence_interval_days: isRecurring ? intervalDays : undefined,
        max_attempts: isRecurring ? maxAttempts : undefined,
        cliente_id: clientSource === 'existing' ? selectedClientId : null,
        manual_name: clientSource === 'manual' ? manualName.trim() : undefined,
        manual_email: clientSource === 'manual' ? manualEmail.trim() : undefined,
        manual_phone: clientSource === 'manual' ? manualPhone.trim() : undefined,
        ...docFields,
      }, {
        onSuccess: () => onOpenChange(false),
      });
      return;
    }

    const data: CreateFollowupData = {
      produto: produto.trim(),
      custom_message: customMessage.trim() || undefined,
      channel,
      scheduled_at: scheduledAt,
      is_recurring: isRecurring,
      recurrence_interval_days: isRecurring ? intervalDays : undefined,
      max_attempts: isRecurring ? maxAttempts : undefined,
      ...docFields,
    };

    if (clientSource === 'existing' && selectedClientId) {
      data.cliente_id = selectedClientId;
    } else {
      data.manual_name = manualName.trim() || undefined;
      data.manual_email = manualEmail.trim() || undefined;
      data.manual_phone = manualPhone.trim() || undefined;
    }

    createFollowup.mutate(data, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const canSubmit = produto.trim() && scheduledDate && !isUploadingPdf && (
    (clientSource === 'existing' && selectedClientId) ||
    (clientSource === 'manual' && (manualName.trim() || manualEmail.trim() || manualPhone.trim()))
  ) && (!isDocumento || !!docLink.trim() || !!docPdfUrl);


  const isPending = isEditing ? updateFollowup.isPending : createFollowup.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent key={open ? (editData?.id || 'new') : 'closed'} className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Follow-up' : editData?.id === '__clone__' ? 'Duplicar Follow-up' : 'Novo Follow-up'}</DialogTitle>
          <DialogDescription>
            {isDocumento
              ? `Agende o envio do ${envioTipo} para assinatura do cliente (link e/ou PDF)`
              : isEditing ? 'Atualize os dados do follow-up agendado' : editData?.id === '__clone__' ? 'Revise e ajuste os dados antes de salvar o follow-up duplicado' : 'Agende uma mensagem de follow-up para um cliente interessado'}
          </DialogDescription>

        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de envio */}
          <div className="space-y-2">
            <Label>Tipo de envio</Label>
            <div className="grid grid-cols-3 gap-2">
              {tipoOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setEnvioTipo(opt.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs transition-colors ${
                    envioTipo === opt.value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {tipoOptions.find(o => o.value === envioTipo)?.hint}
            </p>
          </div>

          {/* Client source toggle */}
          <div className="flex gap-2">

            <Button
              type="button"
              variant={clientSource === 'manual' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setClientSource('manual')}
              className="flex-1"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Digitar dados
            </Button>
            <Button
              type="button"
              variant={clientSource === 'existing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setClientSource('existing')}
              className="flex-1"
            >
              <Users className="h-4 w-4 mr-2" />
              Cliente cadastrado
            </Button>
          </div>

          {clientSource === 'existing' ? (
            <div className="space-y-2">
              <Label>Selecionar Cliente</Label>
              <SearchableSelect
                options={clientOptions}
                value={selectedClientId}
                onValueChange={setSelectedClientId}
                placeholder="Buscar cliente..."
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input placeholder="Nome do cliente" value={manualName} onChange={e => setManualName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" placeholder="email@exemplo.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <PhoneInputWithCountry
                  value={manualPhone}
                  onChange={(phoneWithDDI) => setManualPhone(phoneWithDDI)}
                  required
                />
              </div>
            </div>
          )}

          {/* Produto */}
          <div className="space-y-2">
            <Label>
              {isDocumento ? 'Serviço / Objeto do documento' : 'Produto / Interesse'} <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder={isDocumento ? 'Ex: Gestão de Tráfego, Social Media...' : 'Ex: Plano Premium, Consultoria...'}
              value={produto}
              onChange={e => setProduto(e.target.value)}
            />
          </div>

          {/* Documento: link de assinatura + PDF */}
          {isDocumento && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {envioTipo === 'contrato' ? <FileSignature className="h-4 w-4 text-primary" /> : <FileX2 className="h-4 w-4 text-primary" />}
                Documento para assinatura
              </div>
              <p className="text-xs text-muted-foreground">
                Informe o link de assinatura, o PDF, ou os dois. Pelo menos um é obrigatório.
              </p>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Link2 className="h-3.5 w-3.5" /> Link de assinatura
                </Label>
                <Input
                  placeholder="https://app.autentique.com.br/..."
                  value={docLink}
                  onChange={e => setDocLink(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> PDF do {envioTipo}
                </Label>
                {docPdfName ? (
                  <div className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                    <span className="text-xs truncate flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      {docPdfName}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleRemovePdf}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors">
                    {isUploadingPdf ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Enviando PDF...</>
                    ) : (
                      <><Upload className="h-4 w-4" /> Clique para anexar o PDF (máx. 15 MB)</>
                    )}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={isUploadingPdf}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handlePdfUpload(file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
            </div>
          )}


          {/* Channel */}
          <div className="space-y-2">
            <Label>Enviar via</Label>
            <RadioGroup value={channel} onValueChange={v => setChannel(v as typeof channel)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="whatsapp" id="fu-whatsapp" />
                <Label htmlFor="fu-whatsapp" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="fu-email" />
                <Label htmlFor="fu-email" className="flex items-center gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" /> Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="fu-both" />
                <Label htmlFor="fu-both" className="cursor-pointer">Ambos</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Schedule */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do envio <span className="text-destructive">*</span></Label>
              <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Horário (BRT)</Label>
              <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
            </div>
          </div>

          {/* Recurrence */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Recorrente</Label>
              <p className="text-xs text-muted-foreground">Reenviar automaticamente a cada X dias</p>
            </div>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Intervalo (dias)</Label>
                <Input type="number" min={1} max={30} value={intervalDays} onChange={e => setIntervalDays(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Máximo de envios</Label>
                <Input type="number" min={1} max={10} value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))} />
              </div>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagem</Label>
              <div className="flex items-center gap-1">
                {customMessage.trim() && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isTranslating}
                        className="h-7 text-xs gap-1"
                      >
                        {isTranslating ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Languages className="h-3 w-3 text-primary" />
                        )}
                        Traduzir
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {translateLanguages.map(lang => (
                        <DropdownMenuItem
                          key={lang.code}
                          onClick={() => handleTranslateMessage(lang.code, lang.label)}
                        >
                          {lang.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {aiEnabled && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAIMessage}
                    disabled={isGeneratingAI || !produto.trim()}
                    className="h-7 text-xs gap-1"
                  >
                    {isGeneratingAI ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-primary" />
                    )}
                    Gerar com IA
                  </Button>
                )}
              </div>
            </div>
            <Textarea
              placeholder="Escreva sua mensagem de follow-up..."
              value={customMessage}
              onChange={e => setCustomMessage(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {aiEnabled
                ? 'Use o botão "Gerar com IA" para criar uma mensagem baseada no catálogo de produtos'
                : 'Personalize a mensagem que será enviada ao cliente'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar Alterações' : 'Agendar Follow-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
