import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useClientTasks, ClientTask } from '@/hooks/useClientTasks';
import { formatCPFOrCNPJ } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  CheckCircle2, Clock, AlertTriangle, Circle, Trash2, Edit, Calendar, CalendarIcon,
  Plus, Filter, RefreshCw, ListTodo, User, Search, History, Eye
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { TaskHistoryDialog } from '@/components/TaskHistoryDialog';
import { cn } from '@/lib/utils';

export default function Tarefas() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isLoading, fetchTasksWithClients, createTask, updateTask, deleteTask, getTaskStats } = useClientTasks();
  const { fetchClientes } = useClientes();
  
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [stats, setStats] = useState({ total: 0, pendentes: 0, em_andamento: 0, concluidas: 0, atrasadas: 0 });
  
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    search: '',
  });
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteReason, setBulkDeleteReason] = useState('');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    cliente_id: '' as string | null,
    title: '',
    description: '',
    due_date: '' as string | null,
    priority: '' as '' | 'baixa' | 'media' | 'alta' | 'urgente',
  });

  const [formErrors, setFormErrors] = useState({
    title: false,
    description: false,
    due_date: false,
    due_date_past: false,
    priority: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTasks();
  }, [filters.status, filters.priority]);

  const loadData = async () => {
    const [clientesData, statsData] = await Promise.all([
      fetchClientes(),
      getTaskStats(),
    ]);
    setClientes(clientesData);
    setStats(statsData);
    loadTasks();
  };

  const loadTasks = async () => {
    const data = await fetchTasksWithClients({
      status: filters.status,
      priority: filters.priority,
    });
    setTasks(data);
  };

  const resetForm = () => {
    setFormData({
      cliente_id: null,
      title: '',
      description: '',
      due_date: null,
      priority: '',
    });
    setFormErrors({
      title: false,
      description: false,
      due_date: false,
      due_date_past: false,
      priority: false,
    });
    setEditingTask(null);
  };

  const handleOpenDialog = (task?: ClientTask) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        cliente_id: task.cliente_id,
        title: task.title,
        description: task.description || '',
        due_date: task.due_date?.split('T')[0] || null,
        priority: task.priority,
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const validateForm = () => {
    const today = startOfDay(new Date());
    let isDatePast = false;
    
    if (formData.due_date) {
      const selectedDate = startOfDay(new Date(formData.due_date + 'T12:00:00'));
      isDatePast = selectedDate < today;
    }
    
    const errors = {
      title: !formData.title.trim(),
      description: !formData.description.trim(),
      due_date: !formData.due_date,
      due_date_past: isDatePast,
      priority: !formData.priority,
    };
    setFormErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (editingTask) {
      const success = await updateTask(editingTask.id, {
        cliente_id: formData.cliente_id || null,
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date ? `${formData.due_date}T12:00:00Z` : null,
        priority: formData.priority as 'baixa' | 'media' | 'alta' | 'urgente',
      });
      if (success) {
        setIsDialogOpen(false);
        resetForm();
        loadData();
      }
    } else {
      const task = await createTask({
        cliente_id: formData.cliente_id || null,
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date ? `${formData.due_date}T12:00:00Z` : null,
        priority: formData.priority as 'baixa' | 'media' | 'alta' | 'urgente',
      });
      if (task) {
        setIsDialogOpen(false);
        resetForm();
        loadData();
      }
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: ClientTask['status']) => {
    const success = await updateTask(taskId, { status: newStatus });
    if (success) {
      loadData();
    }
  };

  const handleDelete = async () => {
    if (deleteTaskId) {
      const success = await deleteTask(deleteTaskId, deleteReason || undefined);
      if (success) {
        setDeleteTaskId(null);
        setDeleteReason('');
        loadData();
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0 || !bulkDeleteReason.trim()) return;
    setBulkDeleting(true);
    let successCount = 0;
    for (const taskId of selectedTasks) {
      const success = await deleteTask(taskId, bulkDeleteReason);
      if (success) successCount++;
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setBulkDeleteReason('');
    setSelectedTasks(new Set());
    loadData();
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'baixa': return 'bg-muted text-muted-foreground';
      case 'media': return 'bg-info/20 text-info';
      case 'alta': return 'bg-warning/20 text-warning';
      case 'urgente': return 'bg-destructive/20 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'baixa': return t('tasks.low');
      case 'media': return t('tasks.medium');
      case 'alta': return t('tasks.high');
      case 'urgente': return t('tasks.urgent');
      default: return priority;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Circle className="h-5 w-5 text-muted-foreground" />;
      case 'em_andamento': return <Clock className="h-5 w-5 text-info" />;
      case 'concluida': return <CheckCircle2 className="h-5 w-5 text-primary" />;
      case 'cancelada': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default: return <Circle className="h-5 w-5" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pendente': return t('tasks.pending');
      case 'em_andamento': return t('tasks.inProgress');
      case 'concluida': return t('tasks.completed');
      case 'cancelada': return t('tasks.cancelled');
      default: return status;
    }
  };

  const isOverdue = (task: ClientTask) => {
    if (!task.due_date || task.status === 'concluida' || task.status === 'cancelada') return false;
    return new Date(task.due_date) < new Date();
  };

  const filteredTasks = tasks.filter(task => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (!task.title.toLowerCase().includes(search) && 
          !task.cliente_nome?.toLowerCase().includes(search) &&
          !task.codigo?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <ListTodo className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display text-foreground">{t('tasks.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('tasks.manageClientTasks')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setIsHistoryOpen(true)}
              className="border-border"
            >
              <History className="h-4 w-4 mr-2" />
              {t('tasks.history.title', 'Histórico')}
            </Button>
            <Button 
              className="bg-primary text-primary-foreground"
              onClick={() => handleOpenDialog()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('tasks.newTask')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.pendentes}</p>
                  <p className="text-xs text-muted-foreground">Pendentes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-info/10">
                  <Clock className="h-4 w-4 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-info">{stats.em_andamento}</p>
                  <p className="text-xs text-muted-foreground">Em Andamento</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-destructive">{stats.atrasadas}</p>
                  <p className="text-xs text-muted-foreground">Atrasadas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{stats.concluidas}</p>
                  <p className="text-xs text-muted-foreground">Concluídas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por título ou cliente..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 bg-secondary border-border text-foreground"
                  />
                </div>
              </div>
              <Select
                value={filters.status}
                onValueChange={(value) => setFilters({ ...filters, status: value })}
              >
                <SelectTrigger className="w-[180px] bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={filters.priority}
                onValueChange={(value) => setFilters({ ...filters, priority: value })}
              >
                <SelectTrigger className="w-[180px] bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="all">Todas Prioridades</SelectItem>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={loadData}
                className="border-border"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions Bar */}
        {selectedTasks.size > 0 && (
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {selectedTasks.size} tarefa{selectedTasks.size > 1 ? 's' : ''} selecionada{selectedTasks.size > 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedTasks(new Set())} className="border-border">
                  Limpar seleção
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir selecionadas
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task List */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="p-8 text-center">
                <ListTodo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground">Nenhuma tarefa encontrada</p>
                <p className="text-sm text-muted-foreground">Crie uma nova tarefa para começar.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Select All Header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
                  <Checkbox
                    checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-xs text-muted-foreground">Selecionar todas</span>
                </div>
                {filteredTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`group flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors ${isOverdue(task) ? 'bg-destructive/5' : ''} ${selectedTasks.has(task.id) ? 'bg-primary/5' : ''}`}
                  >
                    {/* Checkbox: visible on hover or when any task is selected */}
                    <div className={cn(
                      "mt-0.5 transition-all duration-150",
                      selectedTasks.size > 0 ? "opacity-100 w-5" : "opacity-0 w-0 group-hover:opacity-100 group-hover:w-5"
                    )}>
                      <Checkbox
                        checked={selectedTasks.has(task.id)}
                        onCheckedChange={() => toggleSelectTask(task.id)}
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (task.status === 'pendente') handleStatusChange(task.id, 'em_andamento');
                        else if (task.status === 'em_andamento') handleStatusChange(task.id, 'concluida');
                      }}
                      className="mt-0.5 hover:opacity-80 transition-opacity shrink-0"
                      title={task.status === 'pendente' ? 'Iniciar' : task.status === 'em_andamento' ? 'Concluir' : ''}
                      disabled={task.status === 'concluida' || task.status === 'cancelada'}
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.codigo && (
                          <Badge variant="secondary" className="text-xs font-mono bg-muted text-muted-foreground">
                            {task.codigo}
                          </Badge>
                        )}
                        <span className={`font-medium text-foreground ${task.status === 'concluida' ? 'line-through opacity-60' : ''}`}>
                          {task.title}
                        </span>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                        {isOverdue(task) && (
                          <Badge variant="destructive" className="text-xs">Atrasada</Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {task.cliente_nome && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.cliente_nome}
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                        )}
                        <span className="text-muted-foreground/60">
                          {getStatusLabel(task.status)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground/60">
                        <span>
                          {t('tasks.createdAt', 'Criado em')}: {format(new Date(task.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </span>
                        {(task.created_by_name || task.created_by_email) && (
                          <span>
                            {t('tasks.createdBy', 'por')}: {task.created_by_name || task.created_by_email}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-1">
                      {task.status === 'concluida' ? (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingTask(task);
                            setFormData({
                              cliente_id: task.cliente_id,
                              title: task.title,
                              description: task.description || '',
                              due_date: task.due_date?.split('T')[0] || null,
                              priority: task.priority,
                            });
                            setIsDialogOpen(true);
                          }}
                          title="Visualizar tarefa"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleOpenDialog(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteTaskId(task.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editingTask?.status === 'concluida' ? 'Visualizar Tarefa' : editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTask?.status === 'concluida' ? 'Detalhes da tarefa concluída.' : editingTask ? 'Atualize os detalhes da tarefa.' : 'Crie uma nova tarefa.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <fieldset disabled={editingTask?.status === 'concluida'}>
            <div className="space-y-2">
              <Label className="text-foreground">Cliente (opcional)</Label>
              <Select
                value={formData.cliente_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, cliente_id: value === 'none' ? null : value })}
              >
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border max-h-60">
                  <SelectItem value="none">Nenhum cliente</SelectItem>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome} - {formatCPFOrCNPJ(cliente.cpf)} - {cliente.produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground">Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => {
                  setFormData({ ...formData, title: e.target.value });
                  if (e.target.value.trim()) setFormErrors({ ...formErrors, title: false });
                }}
                placeholder="Ex: Ligar sobre renovação"
                className={`bg-secondary border-border text-foreground ${formErrors.title ? 'border-destructive' : ''}`}
              />
              {formErrors.title && (
                <p className="text-xs text-destructive">Título é obrigatório</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-foreground">Descrição *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (e.target.value.trim()) setFormErrors({ ...formErrors, description: false });
                }}
                placeholder="Detalhes da tarefa..."
                className={`bg-secondary border-border text-foreground ${formErrors.description ? 'border-destructive' : ''}`}
                rows={3}
              />
              {formErrors.description && (
                <p className="text-xs text-destructive">Descrição é obrigatória</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">Data Limite *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border text-foreground",
                        !formData.due_date && "text-muted-foreground",
                        formErrors.due_date && "border-destructive"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(new Date(formData.due_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }) : <span>Selecione...</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formData.due_date ? new Date(formData.due_date + 'T12:00:00') : undefined}
                      onSelect={(date) => {
                        if (date) {
                          setFormData({ ...formData, due_date: format(date, 'yyyy-MM-dd') });
                          setFormErrors({ ...formErrors, due_date: false });
                        }
                      }}
                      disabled={(date) => startOfDay(date) < startOfDay(new Date())}
                      initialFocus
                      locale={ptBR}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                {formErrors.due_date && (
                  <p className="text-xs text-destructive">Data limite é obrigatória</p>
                )}
                {formErrors.due_date_past && (
                  <p className="text-xs text-destructive">Data limite não pode ser anterior a hoje</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-foreground">Prioridade *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, priority: value });
                    if (value) setFormErrors({ ...formErrors, priority: false });
                  }}
                >
                  <SelectTrigger className={`bg-secondary border-border text-foreground ${formErrors.priority ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
                {formErrors.priority && (
                  <p className="text-xs text-destructive">Prioridade é obrigatória</p>
                )}
              </div>
            </div>
            </fieldset>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                className="border-border"
              >
                {editingTask?.status === 'concluida' ? 'Fechar' : 'Cancelar'}
              </Button>
              {editingTask?.status !== 'concluida' && (
                <Button type="submit" className="bg-primary text-primary-foreground" disabled={isLoading}>
                  {editingTask ? 'Salvar' : 'Criar Tarefa'}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">{t('tasks.deleteTask', 'Excluir Tarefa')}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {t('tasks.deleteConfirmation', 'Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-reason" className="text-foreground">
              {t('tasks.deletionReason', 'Motivo da exclusão')} *
            </Label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder={t('tasks.deletionReasonPlaceholder', 'Informe o motivo da exclusão...')}
              className="mt-2 bg-secondary border-border text-foreground"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-border"
              onClick={() => { setDeleteTaskId(null); setDeleteReason(''); }}
            >
              {t('common.cancel', 'Cancelar')}
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={!deleteReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {t('common.delete', 'Excluir')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir {selectedTasks.size} Tarefa{selectedTasks.size > 1 ? 's' : ''}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir {selectedTasks.size} tarefa{selectedTasks.size > 1 ? 's' : ''} selecionada{selectedTasks.size > 1 ? 's' : ''}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="bulk-delete-reason" className="text-foreground">
              Motivo da exclusão *
            </Label>
            <Textarea
              id="bulk-delete-reason"
              value={bulkDeleteReason}
              onChange={(e) => setBulkDeleteReason(e.target.value)}
              placeholder="Informe o motivo da exclusão em lote..."
              className="mt-2 bg-secondary border-border text-foreground"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel 
              className="border-border"
              onClick={() => { setBulkDeleteOpen(false); setBulkDeleteReason(''); }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDelete}
              disabled={!bulkDeleteReason.trim() || bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {bulkDeleting ? 'Excluindo...' : `Excluir ${selectedTasks.size} tarefa${selectedTasks.size > 1 ? 's' : ''}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TaskHistoryDialog 
        open={isHistoryOpen} 
        onOpenChange={setIsHistoryOpen} 
      />
    </DashboardLayout>
  );
}
