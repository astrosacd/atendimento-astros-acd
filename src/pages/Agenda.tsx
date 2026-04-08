import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

import { Calendar, Settings, Plus, Loader2, RefreshCw, Check } from 'lucide-react';
import { useCalendarEvents, useCalendarConfig, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, type CalendarEvent } from '@/hooks/useCalendar';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { AgendaConfigPanel } from '@/components/agenda/AgendaConfigPanel';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { EventViewDialog } from '@/components/agenda/EventViewDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Agenda() {
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  const { data: events = [], isLoading } = useCalendarEvents(currentMonth);
  const { data: calendarConfig } = useCalendarConfig();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();

  const canCreate = hasPermission('create_agenda_events');
  const canEdit = hasPermission('edit_agenda_events');
  const canDelete = hasPermission('delete_agenda_events');
  const canConfig = hasPermission('manage_agenda_config');

  const googleEnabled = calendarConfig?.google_calendar_enabled === 'true';
  const autoSyncEnabled = calendarConfig?.auto_sync_enabled === 'true' && googleEnabled;

  // Load last sync time
  useEffect(() => {
    if (calendarConfig?.last_sync_at) {
      setLastSyncAt(calendarConfig.last_sync_at);
    }
  }, [calendarConfig]);

  const doSync = useCallback(async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync-google');
      if (error) throw error;
      const now = new Date().toISOString();
      setLastSyncAt(now);
      // Save last_sync_at
      await supabase.from('calendar_config').update({ config_value: now }).eq('config_key', 'last_sync_at');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success(data?.message || 'Sincronização concluída!');
    } catch {
      toast.error('Erro ao sincronizar com Google Agenda');
    } finally {
      setSyncing(false);
    }
  }, [queryClient]);

  // Auto-sync on mount if enabled
  useEffect(() => {
    if (!autoSyncEnabled) return;
    // Check if should auto-sync (last sync > interval ago)
    const intervalMin = parseInt(calendarConfig?.sync_interval_minutes || '15');
    const last = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    const now = Date.now();
    if (now - last > intervalMin * 60 * 1000) {
      doSync();
    }
  }, [autoSyncEnabled]); // only on mount/config change

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
        queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
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
      // Sync update to Google if the event has a google_event_id
      if (googleEnabled && (editingEvent as any).google_event_id) {
        try {
          await supabase.functions.invoke('calendar-sync-google', {
            body: { action: 'update', eventId: editingEvent.id },
          });
        } catch (e) {
          console.error('Google sync update error:', e);
        }
      }
    } else {
      const result = await createEvent.mutateAsync(data);
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

  const handleView = (event: CalendarEvent) => {
    setViewingEvent(event);
    setViewOpen(true);
  };

  const handleCancel = async (id: string) => {
    await updateEvent.mutateAsync({ id, status: 'cancelled' });
    // Sync cancellation to Google
    if (googleEnabled) {
      try {
        await supabase.functions.invoke('calendar-sync-google', {
          body: { action: 'cancel', eventId: id },
        });
      } catch (e) {
        console.error('Google sync cancel error:', e);
      }
    }
  };

  const handleComplete = (id: string) => {
    updateEvent.mutate({ id, status: 'completed' });
  };

  const handleConfirmDelete = async () => {
    if (deleteId) {
      // Sync deletion to Google before deleting locally
      if (googleEnabled) {
        try {
          await supabase.functions.invoke('calendar-sync-google', {
            body: { action: 'delete', eventId: deleteId },
          });
        } catch (e) {
          console.error('Google sync delete error:', e);
        }
      }
      deleteEvent.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const lastSyncFormatted = lastSyncAt
    ? format(new Date(lastSyncAt), "dd/MM 'às' HH:mm", { locale: ptBR })
    : null;

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
          <div className="flex items-center gap-2">
            {googleEnabled && (
              <div className="flex items-center gap-2">
                {lastSyncFormatted && (
                  <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    Atualizado {lastSyncFormatted}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={doSync}
                  disabled={syncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar'}
                </Button>
              </div>
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
                onView={handleView}
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

        <EventViewDialog
          open={viewOpen}
          onOpenChange={(open) => { setViewOpen(open); if (!open) setViewingEvent(null); }}
          event={viewingEvent}
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
