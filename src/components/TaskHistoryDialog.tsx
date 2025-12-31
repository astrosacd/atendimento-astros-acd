import { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  History,
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  User,
  Calendar,
  Clock,
  Search,
  X,
} from 'lucide-react';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
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
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

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

  const clearDateFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
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
        return format(new Date(value), 'dd/MM/yyyy HH:mm', { locale: ptBR });
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
          {entry.new_data.codigo && (
            <span className="ml-2 font-mono text-muted-foreground/60">({entry.new_data.codigo})</span>
          )}
        </div>
      );
    }

    if (entry.action === 'deleted' && entry.previous_data) {
      return (
        <div className="mt-2 text-xs space-y-1">
          <div className="text-muted-foreground">
            <span className="font-medium">{t('tasks.history.taskDeleted', 'Tarefa excluída')}: </span>
            {entry.previous_data.title}
            {entry.previous_data.codigo && (
              <span className="ml-2 font-mono text-muted-foreground/60">({entry.previous_data.codigo})</span>
            )}
          </div>
          {entry.deletion_reason && (
            <div className="text-warning bg-warning/10 rounded px-2 py-1">
              <span className="font-medium">{t('tasks.history.deletionReason', 'Motivo')}: </span>
              {entry.deletion_reason}
            </div>
          )}
        </div>
      );
    }

    if (
      (entry.action === 'updated' || entry.action === 'status_changed') &&
      entry.changed_fields &&
      entry.changed_fields.length > 0
    ) {
      return (
        <div className="mt-2 space-y-1">
          {entry.changed_fields.map((field) => {
            const previousValue = entry.previous_data?.[field];
            const newValue = entry.new_data?.[field];

            return (
              <div key={field} className="text-xs">
                <span className="font-medium text-muted-foreground">{getFieldLabel(field)}:</span>
                <div className="flex items-center gap-2 ml-2 flex-wrap">
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

  const filteredHistory = useMemo(() => {
    let filtered = history;

    // Date range filter
    if (startDate || endDate) {
      filtered = filtered.filter((entry) => {
        const entryDate = new Date(entry.created_at);
        
        if (startDate && endDate) {
          return isWithinInterval(entryDate, {
            start: startOfDay(startDate),
            end: endOfDay(endDate),
          });
        } else if (startDate) {
          return entryDate >= startOfDay(startDate);
        } else if (endDate) {
          return entryDate <= endOfDay(endDate);
        }
        return true;
      });
    }

    // Text search filter
    const q = search.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((entry) => {
        const action = getActionLabel(entry.action).toLowerCase();
        const user = `${entry.user_name || ''} ${entry.user_email || ''}`.toLowerCase();

        const titleFromNew = (entry.new_data?.title || '').toLowerCase();
        const titleFromPrev = (entry.previous_data?.title || '').toLowerCase();
        const codeFromNew = (entry.new_data?.codigo || '').toLowerCase();
        const codeFromPrev = (entry.previous_data?.codigo || '').toLowerCase();
        const reason = (entry.deletion_reason || '').toLowerCase();

        return (
          action.includes(q) ||
          user.includes(q) ||
          titleFromNew.includes(q) ||
          titleFromPrev.includes(q) ||
          codeFromNew.includes(q) ||
          codeFromPrev.includes(q) ||
          reason.includes(q)
        );
      });
    }

    return filtered;
  }, [history, search, startDate, endDate, t]);

  const hasActiveFilters = search.trim() || startDate || endDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <History className="h-5 w-5" />
            {t('tasks.history.title', 'Histórico de Tarefas')}
          </DialogTitle>
        </DialogHeader>

        {/* Search and Date Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tasks.history.searchPlaceholder', 'Pesquisar no histórico (título, código, usuário...)')}
              className="pl-10 bg-secondary border-border text-foreground"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'justify-start text-left font-normal border-border',
                    !startDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy', { locale: ptBR }) : t('tasks.history.startDate', 'Data início')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                <CalendarComponent
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    'justify-start text-left font-normal border-border',
                    !endDate && 'text-muted-foreground'
                  )}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy', { locale: ptBR }) : t('tasks.history.endDate', 'Data fim')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                <CalendarComponent
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>

            {/* Clear filters button */}
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                {t('tasks.history.clearDates', 'Limpar datas')}
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[55vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {hasActiveFilters
                  ? t('tasks.history.noResults', 'Nenhum resultado para a pesquisa')
                  : t('tasks.history.noHistory', 'Nenhum histórico encontrado')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHistory.map((entry, idx) => (
                <div key={entry.id} className="flex gap-3">
                  {/* Timeline column */}
                  <div className="relative flex flex-col items-center w-8 flex-shrink-0">
                    <div className="p-1.5 bg-card rounded-full border border-border">
                      {getActionIcon(entry.action)}
                    </div>
                    {idx !== filteredHistory.length - 1 && (
                      <div className="w-px flex-1 bg-border mt-2" />
                    )}
                  </div>

                  <div className="bg-secondary/30 rounded-lg p-3 flex-1 min-w-0">
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

                    <div className="flex items-center gap-2 mt-2 text-sm min-w-0">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium text-foreground truncate">
                        {entry.user_name || t('tasks.history.unknownUser', 'Usuário desconhecido')}
                      </span>
                      {entry.user_email && (
                        <span className="text-muted-foreground text-xs truncate">({entry.user_email})</span>
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

