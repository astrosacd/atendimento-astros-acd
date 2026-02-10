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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageSquare, Loader2, AlertCircle, Lock, Info, Clock, X, CalendarClock } from 'lucide-react';
import { useProposalSendConfig } from '@/hooks/useProposalSending';
import { useScheduledSends, type ScheduledSend } from '@/hooks/useScheduledProposals';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScheduleProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
}

export function ScheduleProposalDialog({
  open,
  onOpenChange,
  proposalId,
  clientName,
  clientEmail,
  clientPhone,
}: ScheduleProposalDialogProps) {
  const { config, isLoading: isLoadingConfig } = useProposalSendConfig();
  const { scheduledSends, createScheduledSend, cancelScheduledSend } = useScheduledSends(proposalId);

  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('both');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [enablePasswordProtection, setEnablePasswordProtection] = useState(false);

  useEffect(() => {
    if (open) {
      setRecipientName(clientName || '');
      setRecipientEmail(clientEmail || '');
      setRecipientPhone(clientPhone || '');

      // Default: tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setScheduledDate(format(tomorrow, 'yyyy-MM-dd'));
      setScheduledTime('09:00');

      if (clientEmail && clientPhone && config?.email_enabled && config?.whatsapp_enabled) {
        setChannel('both');
      } else if (clientEmail && config?.email_enabled) {
        setChannel('email');
      } else if (clientPhone && config?.whatsapp_enabled) {
        setChannel('whatsapp');
      }
    }
  }, [open, clientName, clientEmail, clientPhone, config]);

  const canSendEmail = config?.email_enabled && recipientEmail.trim();
  const canSendWhatsapp = config?.whatsapp_enabled && recipientPhone.trim();
  const canSend = scheduledDate && scheduledTime && (
    (channel === 'email' && canSendEmail) ||
    (channel === 'whatsapp' && canSendWhatsapp) ||
    (channel === 'both' && (canSendEmail || canSendWhatsapp))
  );

  const pendingSends = scheduledSends.filter(s => s.status === 'pending');

  const handleSchedule = async () => {
    if (!canSend) return;

    // Combine date and time into ISO string (assume BRT = UTC-3)
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00-03:00`).toISOString();

    // Validate future date
    if (new Date(scheduledAt) <= new Date()) {
      return;
    }

    try {
      await createScheduledSend.mutateAsync({
        proposalId,
        scheduledAt,
        channel,
        recipientName: recipientName.trim() || undefined,
        recipientEmail: recipientEmail.trim() || undefined,
        recipientPhone: recipientPhone.trim() || undefined,
        enablePasswordProtection,
      });
    } catch {
      // handled by hook
    }
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Aguardando', color: 'bg-amber-100 text-amber-700' },
    sent: { label: 'Enviado', color: 'bg-green-100 text-green-700' },
    error: { label: 'Erro', color: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-700' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Agendar Envio de Proposta
          </DialogTitle>
          <DialogDescription>
            {clientName ? (
              <>Agendar envio para <strong>{clientName}</strong></>
            ) : (
              'Configure a data e hora do envio'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data do envio</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>
            <div className="space-y-2">
              <Label>Horário (BRT)</Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          {/* Dados do destinatário */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome do Cliente</Label>
              <Input
                placeholder="Nome do cliente"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                placeholder="5511999999999"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Canal de envio */}
          <div className="space-y-2">
            <Label>Enviar via</Label>
            <RadioGroup value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="email" id="sched-email" disabled={!config?.email_enabled} />
                <Label htmlFor="sched-email" className="flex items-center gap-2 cursor-pointer">
                  <Mail className="h-4 w-4" /> Email
                  {!config?.email_enabled && <span className="text-xs text-muted-foreground">(não configurado)</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="whatsapp" id="sched-whatsapp" disabled={!config?.whatsapp_enabled} />
                <Label htmlFor="sched-whatsapp" className="flex items-center gap-2 cursor-pointer">
                  <MessageSquare className="h-4 w-4" /> WhatsApp
                  {!config?.whatsapp_enabled && <span className="text-xs text-muted-foreground">(não configurado)</span>}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="sched-both" disabled={!config?.email_enabled || !config?.whatsapp_enabled} />
                <Label htmlFor="sched-both" className="cursor-pointer">Ambos</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Proteção por Senha */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="sched-password">Proteção por Senha</Label>
            </div>
            <Switch
              id="sched-password"
              checked={enablePasswordProtection}
              onCheckedChange={setEnablePasswordProtection}
            />
          </div>

          {/* Agendamentos existentes */}
          {scheduledSends.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Agendamentos</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scheduledSends.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{format(new Date(s.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                      <Badge variant="outline" className={`text-xs ${statusLabels[s.status]?.color || ''}`}>
                        {statusLabels[s.status]?.label || s.status}
                      </Badge>
                    </div>
                    {s.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => cancelScheduledSend.mutate(s.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="w-full flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={createScheduledSend.isPending || !canSend || isLoadingConfig}
            >
              {createScheduledSend.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4 mr-2" />
              )}
              Agendar Envio
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
