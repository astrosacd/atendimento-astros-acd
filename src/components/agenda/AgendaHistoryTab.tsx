import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, History, CalendarPlus, Pencil, CheckCircle, XCircle, Trash2, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  created: { label: 'Criado', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CalendarPlus className="h-3.5 w-3.5" /> },
  edited: { label: 'Editado', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: <Pencil className="h-3.5 w-3.5" /> },
  completed: { label: 'Concluído', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'Cancelado', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: <XCircle className="h-3.5 w-3.5" /> },
  deleted: { label: 'Excluído', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: <Trash2 className="h-3.5 w-3.5" /> },
  rescheduled: { label: 'Reagendado', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: <RotateCcw className="h-3.5 w-3.5" /> },
};

export function AgendaHistoryTab() {
  const [search, setSearch] = useState('');

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['calendar-event-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_event_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const filtered = search.trim()
    ? history.filter(h =>
        (h.event_title || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.user_email || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.reason || '').toLowerCase().includes(search.toLowerCase()) ||
        (h.action || '').toLowerCase().includes(search.toLowerCase())
      )
    : history;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-primary" />
          Histórico de Movimentações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por evento, usuário ou motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const actionInfo = ACTION_MAP[item.action] || { label: item.action, color: 'bg-muted text-muted-foreground', icon: null };
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`gap-1 ${actionInfo.color} border-0`}>
                          {actionInfo.icon}
                          {actionInfo.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {item.event_title || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate">
                        {item.user_email || '—'}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">
                        {item.reason || '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
