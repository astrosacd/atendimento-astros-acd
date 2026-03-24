import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar, Settings, Plus, Loader2 } from 'lucide-react';
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, type CalendarEvent } from '@/hooks/useCalendar';
import { AgendaCalendarView } from '@/components/agenda/AgendaCalendarView';
import { AgendaConfigPanel } from '@/components/agenda/AgendaConfigPanel';
import { EventFormDialog } from '@/components/agenda/EventFormDialog';
import { usePermissions } from '@/hooks/usePermissions';
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

  const { data: events = [], isLoading } = useCalendarEvents(currentMonth);
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const { hasPermission } = usePermissions();

  const canCreate = hasPermission('create_agenda_events');
  const canEdit = hasPermission('edit_agenda_events');
  const canDelete = hasPermission('delete_agenda_events');
  const canConfig = hasPermission('manage_agenda_config');

  const handleSave = async (data: any) => {
    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, ...data });
    } else {
      await createEvent.mutateAsync(data);
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
          {canCreate && (
            <Button onClick={() => { setEditingEvent(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Agendamento
            </Button>
          )}
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
