import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useClientTasks, TaskHistoryEntry } from '@/hooks/useClientTasks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, Plus, Pencil, Trash2, ArrowRightLeft, User, Calendar, Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TaskHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId?: string;
}

export function TaskHistoryDialog({ open, onOpenChange, taskId }: TaskHistoryDialogProps) {
  const { t } = useTranslation();
  const { fetchTaskHistory } = useClientTasks();
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open, taskId]);

  const loadHistory = async () => {
    setIsLoading(true);
    const data = await fetchTaskHistory(taskId);
    setHistory(data);
    setIsLoading(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Plus className="h-4 w-4 text-primary" />;
      case 'updated':
        return <Pencil className="h-4 w-4 text-info" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-destructive" />;
      case 'status_changed':
        return <ArrowRightLeft className="h-4 w-4 text-warning" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return t('tasks.history.created', 'Criou tarefa');
      case 'updated':
        return t('tasks.history.updated', 'Editou tarefa');
      case 'deleted':
        return t('tasks.history.deleted', 'Excluiu tarefa');
      case 'status_changed':
        return t('tasks.history.statusChanged', 'Alterou status');
      default:
        return action;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-primary/20 text-primary';
      case 'updated':
        return 'bg-info/20 text-info';
      case 'deleted':
        return 'bg-destructive/20 text-destructive';
      case 'status_changed':
        return 'bg-warning/20 text-warning';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      title: t('tasks.taskTitle', 'Título'),
      description: t('tasks.description', 'Descrição'),
      due_date: t('tasks.dueDate', 'Data de vencimento'),
      priority: t('tasks.priority', 'Prioridade'),
      status: 'Status',
      cliente_id: t('tasks.client', 'Cliente'),
      assigned_to: t('tasks.assignedTo', 'Responsável'),
      completed_at: t('tasks.completedAt', 'Concluída em'),
    };
    return labels[field] || field;
  };

  const formatValue = (field: string, value: any) => {
    if (value === null || value === undefined) return '-';
    
    if (field === 'priority') {
      const labels: Record<string, string> = {
        baixa: t('tasks.low', 'Baixa'),
        media: t('tasks.medium', 'Média'),
        alta: t('tasks.high', 'Alta'),
        urgente: t('tasks.urgent', 'Urgente'),
      };
      return labels[value] || value;
    }
    
    if (field === 'status') {
      const labels: Record<string, string> = {
        pendente: t('tasks.pending', 'Pendente'),
        em_andamento: t('tasks.inProgress', 'Em Andamento'),
        concluida: t('tasks.completed', 'Concluída'),
        cancelada: t('tasks.cancelled', 'Cancelada'),
      };
      return labels[value] || value;
    }
    
    if (field === 'due_date' || field === 'completed_at') {
      try {
        return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
      } catch {
        return value;
      }
    }
    
    return String(value);
  };

  const renderChanges = (entry: TaskHistoryEntry) => {
    if (entry.action === 'created' && entry.new_data) {
      return (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">{t('tasks.history.taskCreated', 'Tarefa criada')}: </span>
          {entry.new_data.title}
        </div>
      );
    }

    if (entry.action === 'deleted' && entry.previous_data) {
      return (
        <div className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium">{t('tasks.history.taskDeleted', 'Tarefa excluída')}: </span>
          {entry.previous_data.title}
        </div>
      );
    }

    if ((entry.action === 'updated' || entry.action === 'status_changed') && entry.changed_fields && entry.changed_fields.length > 0) {
      return (
        <div className="mt-2 space-y-1">
          {entry.changed_fields.map((field) => {
            const previousValue = entry.previous_data?.[field];
            const newValue = entry.new_data?.[field];
            
            return (
              <div key={field} className="text-xs">
                <span className="font-medium text-muted-foreground">{getFieldLabel(field)}:</span>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-destructive/80 line-through">{formatValue(field, previousValue)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-primary">{formatValue(field, newValue)}</span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            {t('tasks.history.title', 'Histórico de Tarefas')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">{t('tasks.history.noHistory', 'Nenhum histórico encontrado')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => (
                <div 
                  key={entry.id} 
                  className="relative pl-8 pb-4 border-l-2 border-border last:border-l-0"
                >
                  <div className="absolute left-[-9px] top-0 p-1 bg-card rounded-full border border-border">
                    {getActionIcon(entry.action)}
                  </div>
                  
                  <div className="bg-secondary/30 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge className={`text-xs ${getActionBadgeVariant(entry.action)}`}>
                          {getActionLabel(entry.action)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(entry.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2 text-sm">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{entry.user_name || t('tasks.history.unknownUser', 'Usuário desconhecido')}</span>
                      {entry.user_email && (
                        <span className="text-muted-foreground text-xs">({entry.user_email})</span>
                      )}
                    </div>
                    
                    {renderChanges(entry)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
