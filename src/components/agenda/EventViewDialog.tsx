import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Clock, User, Video, MapPin, StickyNote, CloudDownload, Mail, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type CalendarEvent } from '@/hooks/useCalendar';
import { usePermissions } from '@/hooks/usePermissions';

interface EventViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEvent | null;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  scheduled: { label: 'Agendado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  confirmed: { label: 'Confirmado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  rescheduled: { label: 'Reagendado', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

function getCleanNotes(notes: string | null): string {
  if (!notes) return '';
  return notes.split('\n').filter(l => !l.startsWith('[NOTIFICADO') && !l.startsWith('[Importado do Google Calendar]')).join('\n').trim();
}

export function EventViewDialog({ open, onOpenChange, event }: EventViewDialogProps) {
  const { hasPermission } = usePermissions();
  const canAccessMeetLinks = hasPermission('access_agenda_meet_links');

  if (!event) return null;

  const cleanNotes = getCleanNotes(event.notes);
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudDownload className="h-5 w-5 text-blue-500" />
            {event.title}
          </DialogTitle>
          <DialogDescription>
            Evento importado do Google Calendar (somente visualização)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusConfig[event.status]?.color}>
              {statusConfig[event.status]?.label || event.status}
            </Badge>
            <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-300">
              Google Calendar
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(startDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} — {format(startDate, 'HH:mm')} até {format(endDate, 'HH:mm')}
              </span>
            </div>

            {event.description && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Descrição</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
              </div>
            )}

            {event.client_name && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{event.client_name}</span>
              </div>
            )}

            {event.client_email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{event.client_email}</span>
              </div>
            )}

            {event.client_phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{event.client_phone}</span>
              </div>
            )}

            {event.meet_link && canAccessMeetLinks && (
              <a href={event.meet_link} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Video className="h-4 w-4" /> Entrar no Meet
              </a>
            )}

            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}

            {cleanNotes && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Observações</p>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{cleanNotes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
