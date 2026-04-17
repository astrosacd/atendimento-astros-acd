import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Settings, Plus, Loader2, RefreshCw, Check, History } from 'lucide-react';
import { useCalendarEvents, useCalendarConfig, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, type CalendarEvent } from '@/hooks/useCalendar';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { AgendaConfigPanel } from '@/components/agenda/AgendaConfigPanel';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { EventViewDialog } from '@/components/agenda/EventViewDialog';
import { ReasonDialog } from '@/components/agenda/ReasonDialog';
import { AgendaHistoryTab } from '@/components/agenda/AgendaHistoryTab';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Agenda() {
  const [activeTab, setActiveTab] = useState('calendario');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [viewingEvent, setViewingEvent] = useState<CalendarEvent | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Reason dialogs
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: events = [], isLoading } = useCalendarEvents(currentMonth);
  const { data: calendarConfig } = useCalendarConfig();
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const canCreate = hasPermission('create_agenda_events');
  const canEdit = hasPermission('edit_agenda_events');
  const canDelete = hasPermission('delete_agenda_events');
  const canConfig = hasPermission('manage_agenda_config');

  const googleEnabled = calendarConfig?.google_calendar_enabled === 'true';
  const autoSyncEnabled = calendarConfig?.auto_sync_enabled === 'true' && googleEnabled;

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
      await supabase.from('calendar_config').update({ config_value: now }).eq('config_key', 'last_sync_at');
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      toast.success(data?.message || 'Sincronização concluída!');
    } catch {
      toast.error('Erro ao sincronizar com Google Agenda');
    } finally {
      setSyncing(false);
    }
  }, [queryClient]);

  useEffect(() => {
    if (!autoSyncEnabled) return;
    const intervalMin = parseInt(calendarConfig?.sync_interval_minutes || '15');
    const last = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    const now = Date.now();
    if (now - last > intervalMin * 60 * 1000) {
      doSync();
    }
  }, [autoSyncEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordHistory = async (eventId: string, eventTitle: string, action: string, reason: string) => {
    try {
      await supabase.from('calendar_event_history').insert({
        event_id: eventId,
        event_title: eventTitle,
        action,
        reason,
        user_id: user?.id || null,
        user_email: user?.email || null,
      });
    } catch (e) {
      console.error('Error recording event history:', e);
    }
  };

  const getEventTitle = (id: string) => events.find(e => e.id === id)?.title || '';

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
      await recordHistory(editingEvent.id, data.title || editingEvent.title, 'edited', '');
      
      const googleEventId = (editingEvent as any).google_event_id;

      // Se mudou para online e ainda não tem link do Meet, tenta criar
      if (googleEnabled && data.meeting_type === 'online' && !editingEvent.meet_link && !googleEventId) {
        createMeetLink(data, editingEvent.id);
      } 
      // Se mudou para presencial mas já tinha um ID de evento do Google, remove de lá
      else if (googleEnabled && googleEventId && data.meeting_type === 'physical') {
        try {
          await supabase.functions.invoke('calendar-sync-google', {
            body: { action: 'delete', eventId: editingEvent.id },
          });
          // Limpa as referências do Google no banco local
          await updateEvent.mutateAsync({ 
            id: editingEvent.id, 
            meet_link: null, 
            google_event_id: null 
          });
        } catch (e) {
          console.error('Google sync delete error:', e);
        }
      }
      // Se já tiver um ID de evento do Google e continua sendo online, sincroniza a atualização
      else if (googleEnabled && googleEventId) {
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
      if (result?.id) {
        await recordHistory(result.id, data.title, 'created', '');
        // Só cria no Google Calendar se for do tipo Online
        if (googleEnabled && data.meeting_type === 'online') {
          createMeetLink(data, result.id);
        }
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

  const handleCompleteConfirm = async (reason: string) => {
    if (!completeId) return;
    const title = getEventTitle(completeId);
    await updateEvent.mutateAsync({ id: completeId, status: 'completed' });
    await recordHistory(completeId, title, 'completed', reason);
    setCompleteId(null);
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelId) return;
    const title = getEventTitle(cancelId);
    await updateEvent.mutateAsync({ id: cancelId, status: 'cancelled' });
    await recordHistory(cancelId, title, 'cancelled', reason);
    if (googleEnabled) {
      try {
        await supabase.functions.invoke('calendar-sync-google', {
          body: { action: 'cancel', eventId: cancelId },
        });
      } catch (e) {
        console.error('Google sync cancel error:', e);
      }
    }
    setCancelId(null);
  };

  const handleDeleteConfirm = async (reason: string) => {
    if (!deleteId) return;
    const title = getEventTitle(deleteId);
    await recordHistory(deleteId, title, 'deleted', reason);
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
                <Button variant="outline" size="sm" onClick={doSync} disabled={syncing}>
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
            <TabsTrigger value="historico" className="gap-2 data-[state=active]:bg-background">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
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
                onCancel={canEdit ? setCancelId : () => {}}
                onComplete={canEdit ? setCompleteId : () => {}}
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

          <TabsContent value="historico" className="mt-0">
            <AgendaHistoryTab />
          </TabsContent>
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

        {/* Reason dialogs */}
        <ReasonDialog
          open={!!completeId}
          onOpenChange={(open) => !open && setCompleteId(null)}
          title="Concluir Evento"
          description="Informe o motivo da conclusão deste evento."
          actionLabel="Concluir"
          actionClassName="bg-green-600 text-white hover:bg-green-700"
          onConfirm={handleCompleteConfirm}
        />

        <ReasonDialog
          open={!!cancelId}
          onOpenChange={(open) => !open && setCancelId(null)}
          title="Cancelar Evento"
          description="Informe o motivo do cancelamento deste evento."
          actionLabel="Cancelar Evento"
          actionClassName="bg-amber-600 text-white hover:bg-amber-700"
          onConfirm={handleCancelConfirm}
        />

        <ReasonDialog
          open={!!deleteId}
          onOpenChange={(open) => !open && setDeleteId(null)}
          title="Excluir Evento"
          description="Informe o motivo da exclusão deste evento. Esta ação não pode ser desfeita."
          actionLabel="Excluir"
          actionClassName="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          onConfirm={handleDeleteConfirm}
        />
      </div>
    </DashboardLayout>
  );
}
