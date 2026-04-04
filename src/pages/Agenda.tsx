import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Settings, Plus, Loader2, RefreshCw } from 'lucide-react';
import { useCalendarEvents, useCalendarConfig, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, type CalendarEvent } from '@/hooks/useCalendar';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { AgendaConfigPanel } from '@/components/agenda/AgendaConfigPanel';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Agenda() {
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const { data: events = [], isLoading } = useCalendarEvents(currentMonth);
  const { data: calendarConfig } = useCalendarConfig();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('create_agenda_events');
  const canEdit = hasPermission('edit_agenda_events');
  const canDelete = hasPermission('delete_agenda_events');
  const canConfig = hasPermission('manage_agenda_config');

  const googleEnabled = calendarConfig?.google_calendar_enabled === 'true';

  const createMeetLink = async (eventData: any, calendarEventId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-create-meet`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: eventData.title,
            description: eventData.description,
            start_time: eventData.start_time,
            end_time: eventData.end_time,
            attendee_email: eventData.client_email,
            calendar_event_id: calendarEventId,
          }),
        }
      );

      const json = await res.json();
      if (json.success && json.meet_link) {
        toast.success(`Link do Meet criado: ${json.meet_link}`);
      } else if (json.error) {
        toast.error(`Erro ao criar Meet: ${json.error}`);
      }
    } catch (e: any) {
      console.error('Meet creation error:', e);
      toast.error('Erro ao criar link do Meet automaticamente');
    }
  };

  const handleSave = async (data: any) => {
    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, ...data });
    } else {
      const result = await createEvent.mutateAsync(data);
      // Auto-create Meet link if Google Calendar is enabled
      if (googleEnabled && result?.id) {
        createMeetLink(data, result.id);
      }
    }
    setFormOpen(false);
    setEditingEvent(null);
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleCancel = (id: string) => {
    updateEvent.mutate({ id, status: 'cancelled' });
  };

  const handleComplete = (id: string) => {
    updateEvent.mutate({ id, status: 'completed' });
  };

  const handleConfirmDelete = () => {
    if (deleteId) {
      deleteEvent.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              Agenda
            </h1>
            <p className="text-muted-foreground">Gerencie seus agendamentos e reuniões</p>
          </div>
          <div className="flex gap-2">
            {googleEnabled && (
              <Button
                variant="outline"
                onClick={async () => {
                  setSyncing(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('calendar-sync-google');
                    if (error) throw error;
                    toast.success(data?.message || 'Sincronização concluída!');
                  } catch {
                    toast.error('Erro ao sincronizar com Google Agenda');
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Google'}
              </Button>
            )}
            {canCreate && (
              <Button onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Agendamento
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="h-auto p-1 bg-muted/50">
            <TabsTrigger value="calendario" className="gap-2 data-[state=active]:bg-background">
              <Calendar className="h-4 w-4" />
              Calendário
            </TabsTrigger>
            {canConfig && (
              <TabsTrigger value="configuracoes" className="gap-2 data-[state=active]:bg-background">
                <Settings className="h-4 w-4" />
                Configurações
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="calendario" className="mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AgendaCalendarView
                events={events}
                onEdit={canEdit ? handleEdit : () => {}}
                onDelete={canDelete ? setDeleteId : () => {}}
                onCancel={canEdit ? handleCancel : () => {}}
                onComplete={canEdit ? handleComplete : () => {}}
                currentMonth={currentMonth}
                onMonthChange={setCurrentMonth}
              />
            )}
          </TabsContent>

          {canConfig && (
            <TabsContent value="configuracoes" className="mt-0">
              <AgendaConfigPanel />
            </TabsContent>
          )}
        </Tabs>

        <EventFormDialog
          open={formOpen}
          onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingEvent(null); }}
          event={editingEvent}
          onSave={handleSave}
          isSaving={createEvent.isPending || updateEvent.isPending}
        />

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Evento</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
