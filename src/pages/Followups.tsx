import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  Plus, Search, Trash2, XCircle, Clock, CheckCircle, Send,
  Mail, MessageSquare, RefreshCcw, AlertCircle, CalendarClock, Settings
} from 'lucide-react';
import { useFollowups, type Followup } from '@/hooks/useFollowups';
import { FollowupFormDialog } from '@/components/followups/FollowupFormDialog';
import { FollowupConfigPanel } from '@/components/followups/FollowupConfigPanel';
import { usePermissions } from '@/hooks/usePermissions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Agendado', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  sent: { label: 'Enviado', color: 'bg-blue-100 text-blue-700', icon: <Send className="h-3 w-3" /> },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelado', color: 'bg-gray-100 text-gray-500', icon: <XCircle className="h-3 w-3" /> },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-700', icon: <AlertCircle className="h-3 w-3" /> },
};

export default function Followups() {
  const { followups, isLoading, cancelFollowup, deleteFollowup } = useFollowups();
  const { canManageFollowupConfig } = usePermissions();
  const [showForm, setShowForm] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = followups.filter(f => {
    const term = search.toLowerCase();
    const name = f.manual_name || f.clientes?.nome || '';
    return (
      name.toLowerCase().includes(term) ||
      f.produto.toLowerCase().includes(term)
    );
  });

  const stats = {
    total: followups.length,
    pending: followups.filter(f => f.status === 'pending').length,
    sent: followups.filter(f => f.status === 'sent' || f.status === 'completed').length,
    failed: followups.filter(f => f.status === 'failed').length,
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteFollowup.mutateAsync(deleteId);
      setDeleteId(null);
    }
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
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Follow-up
            </Button>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Falharam</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-500" />
                <span className="text-2xl font-bold">{stats.failed}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar follow-ups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum follow-up encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {search ? 'Tente ajustar sua busca' : 'Crie seu primeiro follow-up'}
              </p>
              {!search && (
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Follow-up
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map(f => (
              <FollowupCard
                key={f.id}
                followup={f}
                onCancel={() => cancelFollowup.mutate(f.id)}
                onDelete={() => setDeleteId(f.id)}
              />
            ))}
          </div>
        )}

        {/* Form Dialog */}
        <FollowupFormDialog open={showForm} onOpenChange={setShowForm} />
        <FollowupConfigPanel open={showConfig} onOpenChange={setShowConfig} />

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
      </div>
    </DashboardLayout>
  );
}

function FollowupCard({ followup, onCancel, onDelete }: { followup: Followup; onCancel: () => void; onDelete: () => void }) {
  const status = statusMap[followup.status] || statusMap.pending;
  const clientName = followup.manual_name || followup.clientes?.nome || 'Sem nome';

  const channelIcon = followup.channel === 'email'
    ? <Mail className="h-3 w-3" />
    : followup.channel === 'whatsapp'
      ? <MessageSquare className="h-3 w-3" />
      : <><Mail className="h-3 w-3" /><MessageSquare className="h-3 w-3" /></>;

  const channelLabel = followup.channel === 'email' ? 'Email' : followup.channel === 'whatsapp' ? 'WhatsApp' : 'Ambos';

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-semibold truncate">{clientName}</h3>
              <Badge variant="secondary" className={`${status.color} gap-1`}>
                {status.icon}
                {status.label}
              </Badge>
              {followup.is_recurring && (
                <Badge variant="outline" className="gap-1">
                  <RefreshCcw className="h-3 w-3" />
                  {followup.current_attempt}/{followup.max_attempts}
                </Badge>
              )}
            </div>
            <div className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{followup.produto}</span>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(followup.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
                <span className="flex items-center gap-1">
                  {channelIcon}
                  {channelLabel}
                </span>
                {followup.is_recurring && followup.next_dispatch_at && followup.status === 'pending' && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3 w-3" />
                    Próximo: {format(new Date(followup.next_dispatch_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {followup.status === 'pending' && (
              <Button variant="ghost" size="icon" onClick={onCancel} title="Cancelar" className="text-amber-500 hover:text-amber-600 hover:bg-amber-50">
                <XCircle className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
