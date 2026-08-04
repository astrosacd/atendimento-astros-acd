import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FollowupsChart } from '@/components/followups/FollowupsChart';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus, Search, Trash2, XCircle, Clock, CheckCircle, Send,
  Mail, MessageSquare, RefreshCcw, AlertCircle, CalendarClock, Settings,
  Eye, Edit, Copy, ThumbsUp, ThumbsDown, Star, Hash, ChevronLeft, ChevronRight, ShieldCheck, History, Loader2,
  FileSignature, FileX2, Megaphone, Link2, FileText, ChevronDown, ExternalLink, Download
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFollowups, type Followup, type EnvioTipo } from '@/hooks/useFollowups';
import { FollowupFormDialog } from '@/components/followups/FollowupFormDialog';
import { FollowupConfigPanel } from '@/components/followups/FollowupConfigPanel';
import { ContactHistoryDialog } from '@/components/followups/ContactHistoryDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Agendado', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
  resolved: { label: 'Resolvido', color: 'bg-slate-100 text-slate-700', icon: <ShieldCheck className="h-3 w-3" /> },
};

const RESOLVE_REASONS = [
  'Número inválido / não existe',
  'Email inválido / não existe',
  'Contato bloqueou',
  'Cliente não encontrado',
  'Erro de configuração',
  'Outro',
];

const conversionMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  converted: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700', icon: <ThumbsUp className="h-3 w-3" /> },
  not_converted: { label: 'Não convertido', color: 'bg-rose-100 text-rose-700', icon: <ThumbsDown className="h-3 w-3" /> },
};

const tipoMap: Record<EnvioTipo, { label: string; color: string; icon: React.ReactNode }> = {
  proposta: { label: 'Proposta', color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: <Megaphone className="h-3 w-3" /> },
  contrato: { label: 'Contrato', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300', icon: <FileSignature className="h-3 w-3" /> },
  distrato: { label: 'Distrato', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300', icon: <FileX2 className="h-3 w-3" /> },
};

const PAGE_SIZE = 15;

export default function Followups() {
  const { followups, isLoading, cancelFollowup, deleteFollowup, cloneFollowup, markConversion, retryFollowup, resolveFollowup } = useFollowups();
  const { canManageFollowupConfig } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conversionFilter, setConversionFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewFollowup, setPreviewFollowup] = useState<Followup | null>(null);
  const [editFollowup, setEditFollowup] = useState<Followup | null>(null);
  const [conversionDialog, setConversionDialog] = useState<{ followup: Followup; status: 'converted' | 'not_converted' } | null>(null);
  const [conversionNote, setConversionNote] = useState('');
  const [page, setPage] = useState(0);
  const [resolveDialog, setResolveDialog] = useState<Followup | null>(null);
  const [resolveReason, setResolveReason] = useState('');
  const [resolveNote, setResolveNote] = useState('');
  const [historyContact, setHistoryContact] = useState<{ phone: string; email: string; name: string } | null>(null);
  const [tipoFilter, setTipoFilter] = useState<string>('all');
  const [formTipo, setFormTipo] = useState<EnvioTipo>('proposta');

  const openPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from('contratos').createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast.error('Não foi possível abrir o PDF');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  // Count sends per contact (phone or email)
  const sendCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const f of followups) {
      if (f.status === 'sent' || f.status === 'completed' || f.status === 'failed') {
        const phone = f.manual_phone || f.clientes?.numero || '';
        const email = f.manual_email || f.clientes?.email || '';
        if (phone) map[phone] = (map[phone] || 0) + 1;
        if (email) map[email] = (map[email] || 0) + 1;
      }
    }
    return map;
  }, [followups]);

  const filtered = followups.filter(f => {
    const term = search.toLowerCase();
    const name = f.manual_name || f.clientes?.nome || '';
    const phone = f.manual_phone || f.clientes?.numero || '';
    const matchSearch = name.toLowerCase().includes(term) || f.produto.toLowerCase().includes(term) || phone.includes(term);
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    const matchConversion = conversionFilter === 'all'
      || (conversionFilter === 'converted' && f.conversion_status === 'converted')
      || (conversionFilter === 'not_converted' && f.conversion_status === 'not_converted')
      || (conversionFilter === 'pending_conversion' && !f.conversion_status && (f.status === 'sent' || f.status === 'completed'));
    const matchTipo = tipoFilter === 'all' || (f.envio_tipo || 'proposta') === tipoFilter;
    return matchSearch && matchStatus && matchConversion && matchTipo;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const stats = {
    total: followups.length,
    pending: followups.filter(f => f.status === 'pending').length,
    sent: followups.filter(f => f.status === 'sent' || f.status === 'completed').length,
    converted: followups.filter(f => f.conversion_status === 'converted').length,
    not_converted: followups.filter(f => f.conversion_status === 'not_converted').length,
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteFollowup.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleConversionConfirm = async () => {
    if (!conversionDialog) return;
    await markConversion.mutateAsync({
      id: conversionDialog.followup.id,
      conversion_status: conversionDialog.status,
      conversion_note: conversionNote,
    });
    setConversionDialog(null);
    setConversionNote('');
  };

  const handleResolveConfirm = async () => {
    if (!resolveDialog || !resolveReason) return;
    await resolveFollowup.mutateAsync({
      id: resolveDialog.id,
      reason: resolveReason,
      note: resolveNote,
    });
    setResolveDialog(null);
    setResolveReason('');
    setResolveNote('');
  };

  const getContactSendCount = (f: Followup) => {
    const phone = f.manual_phone || f.clientes?.numero || '';
    const email = f.manual_email || f.clientes?.email || '';
    return Math.max(sendCountMap[phone] || 0, sendCountMap[email] || 0);
  };

  const handleClone = (f: Followup) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setEditFollowup({
      ...f,
      id: '__clone__',
      scheduled_at: tomorrow.toISOString(),
      status: 'pending',
      current_attempt: 0,
      conversion_status: null,
      conversion_note: null,
      converted_at: null,
      manual_name: f.manual_name || f.clientes?.nome || null,
      manual_email: f.manual_email || f.clientes?.email || null,
      manual_phone: f.manual_phone || f.clientes?.numero || null,
    } as Followup);
    setShowForm(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Follow-ups</h1>
            <p className="text-muted-foreground">
              Agende mensagens de follow-up para clientes interessados
            </p>
          </div>
          <div className="flex gap-2">
            {canManageFollowupConfig() && (
              <Button variant="outline" onClick={() => setShowConfig(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            )}
            <div className="flex">
              <Button
                className="rounded-r-none"
                onClick={() => { setEditFollowup(null); setFormTipo('proposta'); setShowForm(true); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Follow-up
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="rounded-l-none border-l border-primary-foreground/20 px-2">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setEditFollowup(null); setFormTipo('contrato'); setShowForm(true); }}>
                    <FileSignature className="h-4 w-4 mr-2 text-sky-600" />
                    Enviar Contrato
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setEditFollowup(null); setFormTipo('distrato'); setShowForm(true); }}>
                    <FileX2 className="h-4 w-4 mr-2 text-orange-600" />
                    Enviar Distrato
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Agendados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.pending}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Enviados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.sent}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Convertidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">{stats.converted}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        {followups.length > 0 && (
          <FollowupsChart stats={stats} />
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, produto ou número..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Agendado</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
            </SelectContent>
          </Select>
          <Select value={conversionFilter} onValueChange={v => { setConversionFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Conversão" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas conversões</SelectItem>
              <SelectItem value="converted">Convertidos</SelectItem>
              <SelectItem value="not_converted">Não convertidos</SelectItem>
              <SelectItem value="pending_conversion">Sem marcação</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tipoFilter} onValueChange={v => { setTipoFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="proposta">Proposta</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="distrato">Distrato</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum follow-up encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {search || statusFilter !== 'all' || conversionFilter !== 'all' ? 'Tente ajustar seus filtros' : 'Crie seu primeiro follow-up'}
              </p>
              {!search && statusFilter === 'all' && conversionFilter === 'all' && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Follow-up
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <TooltipProvider delayDuration={200}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[140px]">Contato</TableHead>
                        <TableHead className="min-w-[100px]">Tipo</TableHead>
                        <TableHead className="min-w-[100px]">Produto</TableHead>
                        <TableHead className="min-w-[80px]">Canal</TableHead>
                        <TableHead className="min-w-[130px]">Agendado</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[60px] text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center justify-center gap-1 cursor-help">
                                <Hash className="h-3 w-3" /> Envios
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Total de follow-ups enviados para este contato</TooltipContent>
                          </Tooltip>
                        </TableHead>
                        <TableHead className="text-right min-w-[120px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map(f => {
                        const status = statusMap[f.status] || statusMap.pending;
                        const clientName = f.manual_name || f.clientes?.nome || 'Sem nome';
                        const phone = f.manual_phone || f.clientes?.numero || '';
                        const email = f.manual_email || f.clientes?.email || '';
                        const conversion = f.conversion_status ? conversionMap[f.conversion_status] : null;
                        const sendCount = getContactSendCount(f);
                        const canEdit = f.status === 'pending';
                        const canClone = f.status === 'sent' || f.status === 'completed' || f.status === 'failed';
                        const canMarkConversion = (f.status === 'sent' || f.status === 'completed') && f.conversion_status !== 'converted';

                        return (
                          <TableRow key={f.id} className="group">
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm truncate max-w-[180px]">{clientName}</span>
                                {phone && (
                                  <span className="text-xs text-muted-foreground">{phone}</span>
                                )}
                                {email && !phone && (
                                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">{email}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const t = tipoMap[(f.envio_tipo || 'proposta') as EnvioTipo] || tipoMap.proposta;
                                return (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className={`${t.color} gap-1 text-[10px] px-1.5 py-0 w-fit`}>
                                      {t.icon}
                                      {t.label}
                                    </Badge>
                                    {f.doc_link && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <a href={f.doc_link} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                                            <Link2 className="h-3.5 w-3.5" />
                                          </a>
                                        </TooltipTrigger>
                                        <TooltipContent>Abrir link de assinatura</TooltipContent>
                                      </Tooltip>
                                    )}
                                    {f.doc_pdf_url && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button type="button" onClick={() => openPdf(f.doc_pdf_url!)} className="text-muted-foreground hover:text-primary">
                                            <FileText className="h-3.5 w-3.5" />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent>Abrir PDF</TooltipContent>
                                      </Tooltip>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm truncate max-w-[120px] block">{f.produto}</span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                {f.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : f.channel === 'whatsapp' ? <MessageSquare className="h-3.5 w-3.5" /> : <><Mail className="h-3.5 w-3.5" /><MessageSquare className="h-3.5 w-3.5" /></>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-xs whitespace-nowrap">
                                {format(new Date(f.scheduled_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant="secondary" className={`${status.color} gap-1 text-[10px] px-1.5 py-0 w-fit`}>
                                  {status.icon}
                                  {status.label}
                                </Badge>
                                {conversion && (
                                  <Badge variant="secondary" className={`${conversion.color} gap-1 text-[10px] px-1.5 py-0 w-fit`}>
                                    {conversion.icon}
                                    {conversion.label}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {sendCount > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 cursor-help ${
                                        sendCount >= 5 ? 'border-red-300 text-red-600 bg-red-50' :
                                        sendCount >= 3 ? 'border-amber-300 text-amber-600 bg-amber-50' :
                                        'border-muted text-muted-foreground'
                                      }`}
                                    >
                                      {sendCount}×
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {sendCount} follow-up(s) enviado(s) para este contato
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-end gap-0.5">
                                {canMarkConversion && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => { setConversionDialog({ followup: f, status: 'converted' }); setConversionNote(''); }}>
                                          <ThumbsUp className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Convertido</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-400 hover:text-rose-500 hover:bg-rose-50" onClick={() => { setConversionDialog({ followup: f, status: 'not_converted' }); setConversionNote(''); }}>
                                          <ThumbsDown className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Não convertido</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setHistoryContact({ phone, email, name: clientName })}>
                                      <History className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Histórico do contato</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setPreviewFollowup(f)}>
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver mensagem</TooltipContent>
                                </Tooltip>
                                {canEdit && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => { setEditFollowup(f); setShowForm(true); }}>
                                        <Edit className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Editar</TooltipContent>
                                  </Tooltip>
                                )}
                                {f.status === 'failed' && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-60"
                                          onClick={() => retryFollowup.mutate(f.id)}
                                          disabled={retryFollowup.isPending && retryFollowup.variables === f.id}
                                        >
                                          {retryFollowup.isPending && retryFollowup.variables === f.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <RefreshCcw className="h-3.5 w-3.5" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {retryFollowup.isPending && retryFollowup.variables === f.id ? 'Processando...' : 'Reenviar'}
                                      </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-slate-600 hover:bg-slate-100" onClick={() => { setResolveDialog(f); setResolveReason(''); setResolveNote(''); }}>
                                          <ShieldCheck className="h-3.5 w-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Resolver / Marcar motivo</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}
                                {canClone && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleClone(f)}>
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Reaproveitar</TooltipContent>
                                  </Tooltip>
                                )}
                                {f.status === 'pending' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50" onClick={() => cancelFollowup.mutate(f.id)}>
                                        <XCircle className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Cancelar</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteId(f.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <span className="text-xs text-muted-foreground">
                    {filtered.length} registro(s) — Página {currentPage + 1} de {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Dialog */}
        <FollowupFormDialog open={showForm} onOpenChange={setShowForm} editData={editFollowup} initialTipo={formTipo} />
        <FollowupConfigPanel open={showConfig} onOpenChange={setShowConfig} />

        {/* Preview Dialog */}
        <Dialog open={!!previewFollowup} onOpenChange={() => setPreviewFollowup(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Mensagem do Follow-up
              </DialogTitle>
            </DialogHeader>
            {previewFollowup && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Destinatário</p>
                  <p className="font-semibold">{previewFollowup.manual_name || previewFollowup.clientes?.nome || 'Sem nome'}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Tipo de envio</p>
                  <Badge variant="secondary" className={`${(tipoMap[(previewFollowup.envio_tipo || 'proposta') as EnvioTipo] || tipoMap.proposta).color} gap-1 w-fit`}>
                    {(tipoMap[(previewFollowup.envio_tipo || 'proposta') as EnvioTipo] || tipoMap.proposta).icon}
                    {(tipoMap[(previewFollowup.envio_tipo || 'proposta') as EnvioTipo] || tipoMap.proposta).label}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Produto / Serviço</p>
                  <p>{previewFollowup.produto}</p>
                </div>
                {(previewFollowup.doc_link || previewFollowup.doc_pdf_url) && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Documento</p>
                    <div className="flex flex-col gap-2">
                      {previewFollowup.doc_link && (
                        <a
                          href={previewFollowup.doc_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted transition-colors"
                        >
                          <ExternalLink className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{previewFollowup.doc_link}</span>
                        </a>
                      )}
                      {previewFollowup.doc_pdf_url && (
                        <button
                          type="button"
                          onClick={() => openPdf(previewFollowup.doc_pdf_url!)}
                          className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted transition-colors text-left"
                        >
                          <Download className="h-4 w-4 text-primary shrink-0" />
                          <span className="truncate">{previewFollowup.doc_pdf_name || 'Documento PDF'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Mensagem</p>
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                    {previewFollowup.custom_message || previewFollowup.message_template || 'Mensagem padrão será utilizada'}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Agendado para</p>
                  <p>{format(new Date(previewFollowup.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
                {previewFollowup.conversion_status && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Conversão</p>
                    <Badge className={conversionMap[previewFollowup.conversion_status]?.color + ' gap-1'}>
                      {conversionMap[previewFollowup.conversion_status]?.icon}
                      {conversionMap[previewFollowup.conversion_status]?.label}
                    </Badge>
                    {previewFollowup.conversion_note && (
                      <p className="text-sm text-muted-foreground mt-1">{previewFollowup.conversion_note}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Conversion Dialog */}
        <Dialog open={!!conversionDialog} onOpenChange={() => setConversionDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {conversionDialog?.status === 'converted' ? (
                  <><ThumbsUp className="h-5 w-5 text-emerald-500" /> Marcar como Convertido</>
                ) : (
                  <><ThumbsDown className="h-5 w-5 text-rose-500" /> Marcar como Não Convertido</>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Cliente</p>
                <p className="font-medium">{conversionDialog?.followup.manual_name || conversionDialog?.followup.clientes?.nome || 'Sem nome'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Observação (opcional)</p>
                <Textarea
                  placeholder={conversionDialog?.status === 'converted' ? 'Ex: Comprou o produto X, fechou o plano mensal...' : 'Ex: Não respondeu, disse que não tem interesse...'}
                  value={conversionNote}
                  onChange={e => setConversionNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConversionDialog(null)}>Cancelar</Button>
              <Button
                onClick={handleConversionConfirm}
                disabled={markConversion.isPending}
                className={conversionDialog?.status === 'converted' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
              >
                {markConversion.isPending ? 'Salvando...' : 'Confirmar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolve failed follow-up dialog */}
        <Dialog open={!!resolveDialog} onOpenChange={() => setResolveDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                Resolver Follow-up com Falha
              </DialogTitle>
            </DialogHeader>
            {resolveDialog && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Contato</p>
                  <p className="font-medium">{resolveDialog.manual_name || resolveDialog.clientes?.nome || 'Sem nome'}</p>
                  <p className="text-xs text-muted-foreground">{resolveDialog.manual_phone || resolveDialog.clientes?.numero || resolveDialog.manual_email || ''}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Motivo da resolução</p>
                  <Select value={resolveReason} onValueChange={setResolveReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o motivo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RESOLVE_REASONS.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Observação (opcional)</p>
                  <Textarea
                    placeholder="Ex: Número não existe no WhatsApp, tentei ligar e não atende..."
                    value={resolveNote}
                    onChange={e => setResolveNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialog(null)}>Cancelar</Button>
              <Button
                onClick={handleResolveConfirm}
                disabled={!resolveReason || resolveFollowup.isPending}
              >
                {resolveFollowup.isPending ? 'Salvando...' : 'Resolver'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir follow-up?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Contact History Dialog */}
        <ContactHistoryDialog
          open={!!historyContact}
          onOpenChange={() => setHistoryContact(null)}
          contactPhone={historyContact?.phone || ''}
          contactEmail={historyContact?.email || ''}
          contactName={historyContact?.name || ''}
        />
      </div>
    </DashboardLayout>
  );
}
