import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarPlus, Loader2, Save, AlertTriangle } from 'lucide-react';
import { type CalendarEvent } from '@/hooks/useCalendar';

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent | null;
  onSave: (data: any) => void;
  isSaving: boolean;
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const newH = (h + 1) % 24;
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isEndBeforeMinimum(start: string, end: string): boolean {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  return endMin < startMin + 60;
}

export function EventFormDialog({ open, onOpenChange, event, onSave, isSaving }: EventFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [meetLink, setMeetLink] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState('scheduled');
  const [meetingType, setMeetingType] = useState<'online' | 'physical' | ''>('');
  const [referencePoint, setReferencePoint] = useState('');
  const [notes, setNotes] = useState('');
  const [consultantPhones, setConsultantPhones] = useState('');

  useEffect(() => {
    if (open && event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setClientName(event.client_name || '');
      setClientEmail(event.client_email || '');
      setClientPhone(event.client_phone || '');
      const start = new Date(event.start_time);
      const end = new Date(event.end_time);
      setStartDate(start.toISOString().split('T')[0]);
      setStartTime(start.toTimeString().slice(0, 5));
      setEndTime(end.toTimeString().slice(0, 5));
      setMeetLink(event.meet_link || '');
      setLocation(event.location || '');
      setStatus(event.status);
      setMeetingType(event.meeting_type || 'online');
      setReferencePoint(event.reference_point || '');
      const cleanNotes = (event.notes || '').split('\n').filter(l => !l.startsWith('[NOTIFICADO')).join('\n').trim();
      setNotes(cleanNotes);
      setConsultantPhones(((event as any).consultant_phones || []).join(', '));
    } else if (open && !event) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setTitle('');
      setDescription('');
      setClientName('');
      setClientEmail('');
      setClientPhone('');
      setStartDate(tomorrow.toISOString().split('T')[0]);
      setStartTime('10:00');
      setEndTime('11:00');
      setMeetLink('');
      setLocation('');
      setStatus('scheduled');
      setMeetingType('online');
      setReferencePoint('');
      setNotes('');
      setConsultantPhones('');
    }
  }, [open, event]);

  const handleStartTimeChange = (newStart: string) => {
    const oldEnd = endTime;
    const oldExpectedEnd = addOneHour(startTime);
    setStartTime(newStart);
    
    if (oldEnd === oldExpectedEnd || isEndBeforeMinimum(newStart, oldEnd)) {
      setEndTime(addOneHour(newStart));
    }
  };

  const endTimeWarning = isEndBeforeMinimum(startTime, endTime);

  const handleSubmit = () => {
    if (!title.trim() || !startDate || !startTime || !endTime) return;

    const startDateTime = new Date(`${startDate}T${startTime}:00-03:00`).toISOString();
    const endDateTime = new Date(`${startDate}T${endTime}:00-03:00`).toISOString();

    const consultantPhonesArray = consultantPhones.split(',').map(p => p.trim()).filter(Boolean);

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      client_name: clientName.trim() || null,
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      start_time: startDateTime,
      end_time: endDateTime,
      meet_link: event ? (meetLink.trim() || null) : null,
      location: location.trim() || null,
      meeting_type: meetingType,
      reference_point: meetingType === 'physical' ? referencePoint.trim() : null,
      status,
      notes: notes.trim() || null,
      consultant_phones: consultantPhonesArray.length > 0 ? consultantPhonesArray : [],
    });
  };

  const consultantPhonesArray = consultantPhones.split(',').map(p => p.trim()).filter(Boolean);
  const isValid = title.trim() && description.trim() && startDate && startTime && endTime && !endTimeWarning && clientName.trim() && clientEmail.trim() && clientPhone.trim() && notes.trim() && consultantPhonesArray.length > 0 && (meetingType === 'online' || location.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            {event ? 'Editar Evento' : 'Novo Agendamento'}
          </DialogTitle>
          <DialogDescription>
            {event ? 'Atualize os dados do evento' : 'Preencha os dados para agendar uma reunião'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Ex: Reunião com cliente"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Descrição <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Detalhes do agendamento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Início *</Label>
              <Input type="time" value={startTime} onChange={(e) => handleStartTimeChange(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim *</Label>
              <Input 
                type="time" 
                value={endTime} 
                onChange={(e) => setEndTime(e.target.value)}
                className={endTimeWarning ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
            </div>
          </div>
          
          {endTimeWarning && (
            <div className="flex items-center gap-2 text-destructive text-xs p-2 bg-destructive/10 rounded-md">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>O horário de fim deve ser pelo menos 1 hora após o início ({addOneHour(startTime)} ou mais)</span>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Dados do Cliente</p>
            <div className="space-y-2">
              <Label>Nome do Cliente <span className="text-destructive">*</span></Label>
              <Input placeholder="Nome" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" placeholder="email@exemplo.com" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp <span className="text-destructive">*</span></Label>
                <Input placeholder="5511999999999" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="space-y-2">
              <Label>Tipo de Reunião</Label>
              <Select value={meetingType} onValueChange={(val: 'online' | 'physical') => setMeetingType(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online (Google Meet)</SelectItem>
                  <SelectItem value="physical">Presencial (Visita ao Cliente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {meetingType === 'online' && event?.meet_link && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <Label className="text-green-700 dark:text-green-400 text-xs font-medium">Link do Google Meet (gerado automaticamente)</Label>
                <a href={event.meet_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline block mt-1">
                  {event.meet_link}
                </a>
              </div>
            )}
            
            <div className="space-y-2">
              <Label>{meetingType === 'physical' ? 'Endereço da Visita *' : 'Local / Link'}</Label>
              <Input 
                placeholder={meetingType === 'physical' ? "Endereço completo do estabelecimento" : "Local da reunião (opcional)"} 
                value={location} 
                onChange={(e) => setLocation(e.target.value)} 
              />
            </div>

            {meetingType === 'physical' && (
              <div className="space-y-2">
                <Label>Ponto de Referência</Label>
                <Input 
                  placeholder="Próximo a..." 
                  value={referencePoint} 
                  onChange={(e) => setReferencePoint(e.target.value)} 
                />
              </div>
            )}
          </div>

          {event && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="rescheduled">Reagendado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Observações internas <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Motivo do agendamento, observações internas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">Estas observações ficam visíveis na visualização do evento no calendário.</p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label>Consultores (WhatsApp) <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Ex: 5511999999999, 5511888888888"
              value={consultantPhones}
              onChange={(e) => setConsultantPhones(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Números dos consultores que receberão as notificações. Separe com vírgula.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {event ? 'Salvar Alterações' : 'Criar Evento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
