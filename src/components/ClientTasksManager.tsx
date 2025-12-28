import { useState, useEffect } from 'react';
import { useClientTasks, ClientTask, CreateTaskInput } from '@/hooks/useClientTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, CheckCircle2, Clock, AlertTriangle, Circle, Trash2, Edit, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientTasksManagerProps {
  clienteId: string;
  clienteName?: string;
}

export function ClientTasksManager({ clienteId, clienteName }: ClientTasksManagerProps) {
  const { isLoading, fetchTasks, createTask, updateTask, deleteTask } = useClientTasks();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ClientTask | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<CreateTaskInput>({
    cliente_id: clienteId,
    title: '',
    description: '',
    due_date: null,
    priority: 'media',
  });

  useEffect(() => {
    loadTasks();
  }, [clienteId]);

  const loadTasks = async () => {
    const data = await fetchTasks({ cliente_id: clienteId });
    setTasks(data);
  };

  const resetForm = () => {
    setFormData({
      cliente_id: clienteId,
      title: '',
      description: '',
      due_date: null,
      priority: 'media',
    });
    setEditingTask(null);
  };

  const handleOpenDialog = (task?: ClientTask) => {
    if (task) {
      setEditingTask(task);
      setFormData({
        cliente_id: task.cliente_id || clienteId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingTask) {
      const success = await updateTask(editingTask.id, {
        title: formData.title,
        description: formData.description,
        due_date: formData.due_date ? `${formData.due_date}T12:00:00Z` : null,
        priority: formData.priority,
      });
      if (success) {
        setIsDialogOpen(false);
        resetForm();
        loadTasks();
      }
    } else {
      const task = await createTask({
        ...formData,
        due_date: formData.due_date ? `${formData.due_date}T12:00:00Z` : null,
      });
      if (task) {
        setIsDialogOpen(false);
        resetForm();
        loadTasks();
      }
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: ClientTask['status']) => {
    const success = await updateTask(taskId, { status: newStatus });
    if (success) {
      loadTasks();
    }
  };

  const handleDelete = async () => {
    if (deleteTaskId) {
      const success = await deleteTask(deleteTaskId);
      if (success) {
        setDeleteTaskId(null);
        loadTasks();
      }
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
      case 'baixa': return 'Baixa';
      case 'media': return 'Média';
      case 'alta': return 'Alta';
      case 'urgente': return 'Urgente';
      default: return priority;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pendente': return <Circle className="h-4 w-4 text-muted-foreground" />;
      case 'em_andamento': return <Clock className="h-4 w-4 text-info" />;
      case 'concluida': return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'cancelada': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default: return <Circle className="h-4 w-4" />;
    }
  };

  const isOverdue = (task: ClientTask) => {
    if (!task.due_date || task.status === 'concluida' || task.status === 'cancelada') return false;
    return new Date(task.due_date) < new Date();
  };

  const pendingTasks = tasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento');
  const completedTasks = tasks.filter(t => t.status === 'concluida' || t.status === 'cancelada');

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Tarefas {clienteName && `- ${clienteName}`}
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-1" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingTask ? 'Atualize os detalhes da tarefa.' : 'Crie uma nova tarefa para este cliente.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Ligar sobre renovação"
                    required
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-foreground">Descrição</Label>
                  <Textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Detalhes da tarefa..."
                    className="bg-secondary border-border text-foreground"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-foreground">Data Limite</Label>
                    <Input
                      type="date"
                      value={formData.due_date || ''}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value || null })}
                      className="bg-secondary border-border text-foreground"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-foreground">Prioridade</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value: any) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger className="bg-secondary border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="media">Média</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    className="border-border"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-primary text-primary-foreground" disabled={isLoading}>
                    {editingTask ? 'Salvar' : 'Criar Tarefa'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma tarefa cadastrada para este cliente.
          </p>
        ) : (
          <>
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border ${isOverdue(task) ? 'border-destructive/50' : 'border-border'}`}
                  >
                    <button
                      onClick={() => handleStatusChange(task.id, task.status === 'pendente' ? 'em_andamento' : 'concluida')}
                      className="mt-0.5 hover:opacity-80 transition-opacity"
                      title={task.status === 'pendente' ? 'Iniciar' : 'Concluir'}
                    >
                      {getStatusIcon(task.status)}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{task.title}</span>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {getPriorityLabel(task.priority)}
                        </Badge>
                        {isOverdue(task) && (
                          <Badge variant="destructive" className="text-xs">Atrasada</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
                      )}
                      {task.due_date && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenDialog(task)}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTaskId(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Concluídas</p>
                {completedTasks.slice(0, 3).map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground line-through flex-1 truncate">{task.title}</span>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTaskId(task.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {completedTasks.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">
                    + {completedTasks.length - 3} tarefas concluídas
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={() => setDeleteTaskId(null)}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Tarefa</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
