import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Clock, User, Video, MapPin, MoreHorizontal, Pencil, Trash2, XCircle, CheckCircle2, StickyNote, Eye, CloudDownload, AlertTriangle, MapPinned } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, startOfWeek, endOfWeek, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { type CalendarEvent } from '@/hooks/useCalendar';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

interface AgendaCalendarViewProps {
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
  onCancel: (id: string) => void;
  onComplete: (id: string) => void;
  onView?: (event: CalendarEvent) => void;
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
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

function isGoogleImported(event: CalendarEvent): boolean {
  return (event as any).source === 'google';
}

function isFinalized(event: CalendarEvent): boolean {
  return ['completed', 'cancelled'].includes(event.status);
}

export function AgendaCalendarView({ events, onEdit, onDelete, onCancel, onComplete, onView, currentMonth, onMonthChange }: AgendaCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { hasPermission } = usePermissions();
  const canAccessMeetLinks = hasPermission('access_agenda_meet_links');

  // Filter out cancelled events entirely
  const visibleEvents = events.filter(e => e.status !== 'cancelled');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getEventsForDay = (day: Date) =>
    visibleEvents.filter(e => isSameDay(new Date(e.start_time), day));

  const selectedEvents = selectedDate
    ? visibleEvents.filter(e => isSameDay(new Date(e.start_time), selectedDate))
    : [];

  // Check for past unresolved events (before today, still scheduled/confirmed/rescheduled)
  const today = startOfDay(new Date());
  const pastUnresolvedEvents = visibleEvents.filter(e => {
    const eventDate = startOfDay(new Date(e.start_time));
    return isBefore(eventDate, today) && ['scheduled', 'confirmed', 'rescheduled'].includes(e.status) && !isGoogleImported(e);
  });

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-4">
      {/* Alert for past unresolved events */}
      {pastUnresolvedEvents.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {pastUnresolvedEvents.length} evento{pastUnresolvedEvents.length !== 1 ? 's' : ''} pendente{pastUnresolvedEvents.length !== 1 ? 's' : ''} de resolução
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              Existem eventos em dias anteriores que não foram concluídos, cancelados ou excluídos. Clique no dia para ajustar.
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {pastUnresolvedEvents.slice(0, 5).map(ev => (
                <button
                  key={ev.id}
                  onClick={() => setSelectedDate(new Date(ev.start_time))}
                  className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                >
                  {format(new Date(ev.start_time), 'dd/MM')} - {ev.title}
                </button>
              ))}
              {pastUnresolvedEvents.length > 5 && (
                <span className="text-xs text-amber-600 dark:text-amber-400 px-2 py-0.5">+{pastUnresolvedEvents.length - 5} mais</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => { onMonthChange(new Date()); setSelectedDate(new Date()); }}>
                  Hoje
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onMonthChange(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {weekDays.map(day => (
                <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {days.map(day => {
                const dayEvents = getEventsForDay(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "bg-card p-1.5 min-h-[72px] text-left transition-colors hover:bg-muted/50",
                      !isCurrentMonth && "opacity-40",
                      isSelected && "ring-2 ring-primary ring-inset",
                      isToday(day) && "bg-primary/5"
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full",
                      isToday(day) && "bg-primary text-primary-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map(ev => (
                        <div
                          key={ev.id}
                          className="text-[10px] px-1 py-0.5 rounded truncate bg-primary/10 text-primary"
                        >
                          {format(new Date(ev.start_time), 'HH:mm')} {ev.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum evento neste dia</p>
            ) : (
              selectedEvents.map(ev => {
                const cleanNotes = getCleanNotes(ev.notes);
                const imported = isGoogleImported(ev);
                const finalized = isFinalized(ev);
                return (
                  <div key={ev.id} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{ev.title}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(ev.start_time), 'HH:mm')} - {format(new Date(ev.end_time), 'HH:mm')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge variant="outline" className={cn("text-[10px]", statusConfig[ev.status]?.color)}>
                          {statusConfig[ev.status]?.label || ev.status}
                        </Badge>
                        {imported ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onView?.(ev)} title="Visualizar">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!finalized && (
                                <DropdownMenuItem onClick={() => onEdit(ev)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2" /> Editar / Reagendar
                                </DropdownMenuItem>
                              )}
                              {!finalized && ['scheduled', 'confirmed', 'rescheduled'].includes(ev.status) && (
                                <DropdownMenuItem onClick={() => onComplete(ev.id)}>
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Concluir
                                </DropdownMenuItem>
                              )}
                              {!finalized && ev.status !== 'cancelled' && (
                                <DropdownMenuItem onClick={() => onCancel(ev.id)} className="text-amber-600">
                                  <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => onDelete(ev.id)} className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {imported && (
                      <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                        <CloudDownload className="h-3 w-3" /> Importado do Google Calendar
                      </div>
                    )}
                    {ev.description && (
                      <p className="text-xs text-muted-foreground">{ev.description}</p>
                    )}
                    {ev.client_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="h-3 w-3" /> {ev.client_name}
                      </div>
                    )}
                    {ev.meet_link && canAccessMeetLinks && (
                      <a href={ev.meet_link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                        <Video className="h-3 w-3" /> Entrar no Meet
                      </a>
                    )}
                    {ev.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" /> {ev.location}
                      </div>
                    )}
                    {cleanNotes && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                        <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="whitespace-pre-wrap">{cleanNotes}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
