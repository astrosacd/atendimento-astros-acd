import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  Download, 
  Filter,
  Activity,
  UserPlus,
  Edit,
  Trash2,
  Clock,
  User,
  RefreshCw,
  Eye,
  UserSearch,
  ArrowRight,
  Mail,
  Phone,
  CreditCard,
  Calendar,
  Tag,
  FileText,
  RotateCcw,
  FileDown
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActivityLog {
  id: string;
  action: string;
  cliente_id: string | null;
  changed_by: string | null;
  changed_by_email: string | null;
  changed_fields: string[] | null;
  previous_data: any;
  new_data: any;
  created_at: string;
}

const AdminActivityLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [clientNameFilter, setClientNameFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [logToRestore, setLogToRestore] = useState<ActivityLog | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [dateFilter]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('client_history')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply date filter
      const now = new Date();
      let startDate: Date;
      
      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      }

      query = query.gte('created_at', startDate.toISOString());

      const { data, error } = await query.limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar logs',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.changed_by_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.new_data)?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by client name
    const clientName = log.new_data?.nome || log.previous_data?.nome || '';
    const matchesClientName = !clientNameFilter || 
      clientName.toLowerCase().includes(clientNameFilter.toLowerCase());
    
    const actionLower = log.action.toLowerCase();
    const filterLower = actionFilter.toLowerCase();
    const matchesAction = actionFilter === 'all' || 
      actionLower === filterLower || 
      (filterLower === 'create' && actionLower === 'created') ||
      (filterLower === 'update' && actionLower === 'updated') ||
      (filterLower === 'delete' && actionLower === 'deleted');
    
    return matchesSearch && matchesAction && matchesClientName;
  });

  const exportToCSV = () => {
    const headers = ['Data/Hora', 'Ação', 'Usuário', 'Campos Alterados', 'Detalhes'];
    const rows = filteredLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss'),
      log.action,
      log.changed_by_email || 'Sistema',
      log.changed_fields?.join(', ') || '-',
      log.new_data?.nome || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `logs-atividade-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Exportação concluída',
      description: `${filteredLogs.length} registros exportados.`,
    });
  };

  const getActionLabel = (action: string): string => {
    const actionLower = action.toLowerCase();
    if (actionLower === 'restored') return 'Restaurado';
    if (actionLower === 'create' || actionLower === 'created') return 'Criação';
    if (actionLower === 'update' || actionLower === 'updated') return 'Atualização';
    if (actionLower === 'delete' || actionLower === 'deleted') return 'Exclusão';
    return action;
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Logs de Atividade', 14, 18);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 28);
    
    // Stats summary
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo', 14, 48);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const statsText = `Total: ${stats.total} | Criações: ${stats.creates} | Atualizações: ${stats.updates} | Exclusões: ${stats.deletes}`;
    doc.text(statsText, 14, 56);
    
    // Table data
    const tableData = filteredLogs.map(log => [
      format(new Date(log.created_at), 'dd/MM/yyyy HH:mm'),
      getActionLabel(log.action),
      log.changed_by_email || 'Sistema',
      log.new_data?.nome || log.previous_data?.nome || '-',
      log.changed_fields?.slice(0, 3).join(', ') || '-'
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Data/Hora', 'Ação', 'Usuário', 'Cliente', 'Campos Alterados']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [124, 58, 237],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [245, 245, 250]
      },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 28 },
        2: { cellWidth: 45 },
        3: { cellWidth: 40 },
        4: { cellWidth: 'auto' }
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer
        const pageCount = doc.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Página ${data.pageNumber} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }
    });
    
    doc.save(`logs-atividade-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
    toast({
      title: 'PDF gerado com sucesso',
      description: `${filteredLogs.length} registros exportados.`,
    });
  };

  const isRestoredClient = (log: ActivityLog): boolean => {
    return log.action.toLowerCase() === 'restored';
  };

  const getActionIcon = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower === 'restored') {
      return <RotateCcw className="h-4 w-4 text-amber-400" />;
    }
    if (actionLower === 'create' || actionLower === 'created') {
      return <UserPlus className="h-4 w-4 text-emerald-400" />;
    } else if (actionLower === 'update' || actionLower === 'updated') {
      return <Edit className="h-4 w-4 text-blue-400" />;
    } else if (actionLower === 'delete' || actionLower === 'deleted') {
      return <Trash2 className="h-4 w-4 text-red-400" />;
    }
    return <Activity className="h-4 w-4 text-muted-foreground" />;
  };

  const getActionBadge = (action: string, log?: ActivityLog) => {
    const actionLower = action.toLowerCase();
    
    const variants: Record<string, { bg: string; text: string; label: string }> = {
      restored: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Restaurado' },
      create: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Criação' },
      created: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Criação' },
      update: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Atualização' },
      updated: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Atualização' },
      delete: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Exclusão' },
      deleted: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Exclusão' },
    };
    
    const variant = variants[actionLower] || { bg: 'bg-muted', text: 'text-muted-foreground', label: action };
    
    return (
      <Badge className={`${variant.bg} ${variant.text} border-none gap-1`}>
        {getActionIcon(action)}
        {variant.label}
      </Badge>
    );
  };

  const openLogDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setIsDetailDialogOpen(true);
  };

  const openRestoreConfirm = (log: ActivityLog) => {
    setLogToRestore(log);
    setIsRestoreConfirmOpen(true);
  };

  const restoreDeletedClient = async () => {
    if (!logToRestore?.previous_data) {
      toast({
        title: 'Erro',
        description: 'Dados do cliente não encontrados para restauração.',
        variant: 'destructive',
      });
      return;
    }

    setIsRestoring(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || 'Sistema';
      
      const clientData = logToRestore.previous_data;
      
      // Always update restoration note with current date/time
      const existingObs = clientData.observacao ? String(clientData.observacao) : '';
      // Remove any existing restoration notes
      const cleanedObs = existingObs.replace(/\[Cliente restaurado em [^\]]+\]/g, '').trim();
      const restorationNote = `[Cliente restaurado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}]`;
      const finalObservacao = cleanedObs ? `${cleanedObs}\n${restorationNote}` : restorationNote;
      
      const { data: insertedClient, error } = await supabase
        .from('clientes')
        .insert({
          nome: clientData.nome,
          email: clientData.email,
          numero: clientData.numero,
          cpf: clientData.cpf,
          produto: clientData.produto,
          plano: clientData.plano,
          valor: clientData.valor,
          data_renovacao: clientData.data_renovacao,
          observacao: finalObservacao,
          tags: clientData.tags || [],
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Register restoration in activity logs
      await supabase.from('client_history').insert({
        action: 'restored',
        cliente_id: insertedClient.id,
        changed_by: user?.id,
        changed_by_email: userEmail,
        previous_data: clientData,
        new_data: insertedClient,
        changed_fields: ['restored_from_deletion'],
      });

      toast({
        title: 'Cliente restaurado!',
        description: `${clientData.nome} foi restaurado com sucesso.`,
      });

      setIsRestoreConfirmOpen(false);
      setIsDetailDialogOpen(false);
      setLogToRestore(null);
      loadLogs();
    } catch (error: any) {
      toast({
        title: 'Erro ao restaurar cliente',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsRestoring(false);
      setIsRestoreConfirmOpen(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    if (Array.isArray(value)) return value.join(', ') || '-';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getFieldLabel = (field: string): string => {
    const labels: Record<string, string> = {
      nome: 'Nome',
      email: 'Email',
      numero: 'Telefone',
      cpf: 'CPF/CNPJ',
      produto: 'Produto',
      plano: 'Plano',
      valor: 'Valor',
      data_renovacao: 'Data de Renovação',
      observacao: 'Observação',
      tags: 'Tags',
      created_at: 'Criado em',
      updated_at: 'Atualizado em',
      data_d_menos_3: 'D-3',
      data_d_mais_1: 'D+1',
      data_d_mais_2: 'D+2',
      data_d_mais_15: 'D+15',
      data_d_mais_30: 'D+30',
    };
    return labels[field] || field;
  };

  const getFieldIcon = (field: string) => {
    const icons: Record<string, any> = {
      nome: User,
      email: Mail,
      numero: Phone,
      cpf: CreditCard,
      data_renovacao: Calendar,
      tags: Tag,
      observacao: FileText,
    };
    const Icon = icons[field] || FileText;
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  };

  const clearAllLogs = async () => {
    setIsClearing(true);
    try {
      const { error } = await supabase
        .from('client_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      toast({
        title: 'Histórico limpo',
        description: 'Todos os logs de atividade foram excluídos.',
      });

      setIsClearConfirmOpen(false);
      setLogs([]);
    } catch (error: any) {
      toast({
        title: 'Erro ao limpar histórico',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const stats = {
    total: filteredLogs.length,
    creates: filteredLogs.filter(l => l.action.toLowerCase() === 'create' || l.action.toLowerCase() === 'created').length,
    updates: filteredLogs.filter(l => l.action.toLowerCase() === 'update' || l.action.toLowerCase() === 'updated').length,
    deletes: filteredLogs.filter(l => l.action.toLowerCase() === 'delete' || l.action.toLowerCase() === 'deleted').length,
    restores: filteredLogs.filter(l => l.action.toLowerCase() === 'restored').length,
  };

  const renderLogDetailsContent = () => {
    if (!selectedLog) return null;

    const isDeleted = selectedLog.action.toLowerCase() === 'deleted' || selectedLog.action.toLowerCase() === 'delete';
    const isCreated = selectedLog.action.toLowerCase() === 'created' || selectedLog.action.toLowerCase() === 'create';
    const isUpdated = selectedLog.action.toLowerCase() === 'updated' || selectedLog.action.toLowerCase() === 'update';

    const clientData = isDeleted ? selectedLog.previous_data : selectedLog.new_data;
    const displayFields = ['nome', 'email', 'numero', 'cpf', 'produto', 'plano', 'valor', 'data_renovacao', 'observacao', 'tags'];

    return (
      <div className="space-y-4">
        {/* Action and Time Info */}
        <div className="flex items-center justify-between">
          {getActionBadge(selectedLog.action)}
          <span className="text-sm text-muted-foreground">
            {format(new Date(selectedLog.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
          </span>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
          <User className="w-5 h-5 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Responsável pela ação</p>
            <p className="font-medium">{selectedLog.changed_by_email || 'Sistema'}</p>
          </div>
        </div>

        <Separator />

        {/* Client Data - For Deletion */}
        {isDeleted && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Dados do Cliente Excluído
              </h3>
              <Button
                onClick={() => openRestoreConfirm(selectedLog)}
                disabled={isRestoring}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                size="sm"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Restaurar Cliente
              </Button>
            </div>
            <div className="grid gap-3">
              {displayFields.map((field) => {
                const value = clientData?.[field];
                if (value === undefined || value === null || value === '') return null;
                return (
                  <div key={field} className="flex items-start gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    {getFieldIcon(field)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{getFieldLabel(field)}</p>
                      <p className="font-medium break-words">
                        {field === 'valor' ? `R$ ${Number(value).toFixed(2)}` : formatValue(value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Client Data - For Creation */}
        {isCreated && (
          <div className="space-y-3">
            <h3 className="font-semibold text-emerald-400 flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Dados do Cliente Cadastrado
            </h3>
            <div className="grid gap-3">
              {displayFields.map((field) => {
                const value = clientData?.[field];
                if (value === undefined || value === null || value === '') return null;
                return (
                  <div key={field} className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    {getFieldIcon(field)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{getFieldLabel(field)}</p>
                      <p className="font-medium break-words">
                        {field === 'valor' ? `R$ ${Number(value).toFixed(2)}` : formatValue(value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Client Data - For Update */}
        {isUpdated && selectedLog.changed_fields && selectedLog.changed_fields.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-blue-400 flex items-center gap-2">
              <Edit className="w-4 h-4" />
              Campos Alterados
            </h3>
            <div className="space-y-2">
              {selectedLog.changed_fields.map((field) => (
                <div key={field} className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    {getFieldIcon(field)}
                    <span className="text-sm font-medium text-blue-400">{getFieldLabel(field)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex-1 p-2 rounded bg-red-500/10 border border-red-500/20">
                      <span className="text-xs text-muted-foreground">Antes:</span>
                      <p className="font-mono break-words">
                        {field === 'valor' && selectedLog.previous_data?.[field] 
                          ? `R$ ${Number(selectedLog.previous_data[field]).toFixed(2)}` 
                          : formatValue(selectedLog.previous_data?.[field])}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 p-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-xs text-muted-foreground">Depois:</span>
                      <p className="font-mono break-words">
                        {field === 'valor' && selectedLog.new_data?.[field] 
                          ? `R$ ${Number(selectedLog.new_data[field]).toFixed(2)}` 
                          : formatValue(selectedLog.new_data?.[field])}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                Logs de Atividade
              </h1>
              <p className="text-muted-foreground text-sm">
                Histórico completo de todas as ações no sistema
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={loadLogs} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button onClick={exportToPDF} className="bg-gradient-to-r from-purple-500 to-violet-600">
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsClearConfirmOpen(true)} 
              className="border-destructive/50 text-destructive hover:bg-destructive/10"
              disabled={logs.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-card to-card/50 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Criações</p>
                  <p className="text-2xl font-bold text-emerald-400">{stats.creates}</p>
                </div>
                <UserPlus className="w-8 h-8 text-emerald-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atualizações</p>
                  <p className="text-2xl font-bold text-blue-400">{stats.updates}</p>
                </div>
                <Edit className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exclusões</p>
                  <p className="text-2xl font-bold text-red-400">{stats.deletes}</p>
                </div>
                <Trash2 className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Restaurações</p>
                  <p className="text-2xl font-bold text-amber-400">{stats.restores}</p>
                </div>
                <RotateCcw className="w-8 h-8 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por usuário, ação ou dados..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex-1 relative">
                <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar por nome do cliente..."
                  value={clientNameFilter}
                  onChange={(e) => setClientNameFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="create">Criação</SelectItem>
                    <SelectItem value="update">Atualização</SelectItem>
                    <SelectItem value="delete">Exclusão</SelectItem>
                    <SelectItem value="restored">Restaurado</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Clock className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoje</SelectItem>
                    <SelectItem value="7days">Últimos 7 dias</SelectItem>
                    <SelectItem value="30days">Últimos 30 dias</SelectItem>
                    <SelectItem value="90days">Últimos 90 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-purple-400" />
              Histórico de Atividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[180px]">Data/Hora</TableHead>
                    <TableHead className="w-[120px]">Ação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Campos Alterados</TableHead>
                    <TableHead className="w-[80px] text-center">Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {getActionBadge(log.action, log)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.changed_by_email?.startsWith('API REST') ? (
                              <>
                                <Badge variant="secondary" className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                                  API
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {log.changed_by_email.replace('API REST (', '').replace(')', '')}
                                </span>
                              </>
                            ) : (
                              <>
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm">
                                  {log.changed_by_email || 'Sistema'}
                                </span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {log.new_data?.nome || log.previous_data?.nome || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {log.changed_fields?.slice(0, 3).map((field, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {getFieldLabel(field)}
                              </Badge>
                            ))}
                            {log.changed_fields && log.changed_fields.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{log.changed_fields.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openLogDetails(log)}
                            className="h-8 w-8"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Log Details Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Detalhes da Atividade
              </DialogTitle>
              <DialogDescription>
                Informações completas sobre esta ação no sistema
              </DialogDescription>
            </DialogHeader>
            {renderLogDetailsContent()}
          </DialogContent>
        </Dialog>

        {/* Restore Confirmation Dialog */}
        <AlertDialog open={isRestoreConfirmOpen} onOpenChange={setIsRestoreConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                Confirmar Restauração
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Você está prestes a restaurar o cliente <strong className="text-foreground">{logToRestore?.previous_data?.nome}</strong>.
                </p>
                <p>
                  Um novo registro será criado com os dados salvos no momento da exclusão.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRestoring}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={restoreDeletedClient}
                disabled={isRestoring}
                className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
              >
                {isRestoring ? (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                    Restaurando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Confirmar Restauração
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear History Confirm */}
        <AlertDialog open={isClearConfirmOpen} onOpenChange={setIsClearConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Limpar Histórico de Atividades
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá excluir permanentemente <strong>todos os {logs.length} registros</strong> do histórico de atividades. 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={clearAllLogs}
                disabled={isClearing}
                className="bg-destructive hover:bg-destructive/90"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Limpar Tudo
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default AdminActivityLogs;
