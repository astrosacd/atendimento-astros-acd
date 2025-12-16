import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Search, Users, Loader2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function AllParticipantsManager() {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('_all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch instances to check if any exist
  const { data: instances = [] } = useQuery({
    queryKey: ['divulgador-instances'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_instances')
        .select('id')
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch groups
  const { data: groups = [] } = useQuery({
    queryKey: ['divulgador-groups'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_groups')
        .select('id, name, whatsapp_group_id')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all participants with filter
  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['all-divulgador-participants', selectedGroupId],
    queryFn: async () => {
      let query = (supabase as any)
        .from('divulgador_participants')
        .select('*, divulgador_groups(name)')
        .order('joined_at', { ascending: false });
      
      if (selectedGroupId && selectedGroupId !== '_all') {
        query = query.eq('group_id', selectedGroupId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Sync groups from WhatsApp
  const syncGroups = async () => {
    // Check if there are instances first
    if (instances.length === 0) {
      toast.info('Configure uma instância WhatsApp primeiro');
      return;
    }
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: { action: 'fetch-groups' }
      });
      
      if (error) {
        // Check if it's a "no instance" error - don't show error toast, just info
        const errorMsg = error.message || '';
        if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('Nenhuma')) {
          toast.info('Configure uma instância WhatsApp primeiro');
          return;
        }
        throw error;
      }
      
      toast.success(`Grupos sincronizados! ${data.saved || 0} grupos, ${data.deleted || 0} removidos`);
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
    } catch (error: any) {
      // Check for instance-related errors in response body
      const errorMsg = error.message || '';
      if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('Nenhuma')) {
        toast.info('Configure uma instância WhatsApp primeiro');
      } else {
        toast.error('Erro ao sincronizar: ' + errorMsg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync participants from selected group
  const syncParticipants = async () => {
    if (selectedGroupId === '_all') {
      // Sync all groups
      setIsSyncing(true);
      try {
        let syncedCount = 0;
        for (const group of groups) {
          const { error } = await supabase.functions.invoke('divulgador-groups', {
            body: { 
              action: 'sync-participants',
              groupId: group.id,
              whatsappGroupId: group.whatsapp_group_id
            }
          });
          if (!error) syncedCount++;
        }
        toast.success(`Participantes sincronizados de ${syncedCount} grupos!`);
        queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
      } catch (error: any) {
        toast.error('Erro ao sincronizar: ' + error.message);
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Sync specific group
      const group = groups.find((g: any) => g.id === selectedGroupId);
      if (!group) return;
      
      setIsSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke('divulgador-groups', {
          body: { 
            action: 'sync-participants',
            groupId: group.id,
            whatsappGroupId: group.whatsapp_group_id
          }
        });
        
        if (error) throw error;
        
        toast.success(`Sincronizado! ${data.count || 0} participantes encontrados`);
        queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
      } catch (error: any) {
        toast.error('Erro ao sincronizar: ' + error.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Filter by search term
  const filteredParticipants = participants.filter((p: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.whatsapp_number?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.divulgador_groups?.name?.toLowerCase().includes(term)
    );
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Número', 'Nome', 'Grupo', 'Data Entrada', 'Última Mensagem', 'Admin', 'Inativo'];
    const rows = filteredParticipants.map((p: any) => [
      p.whatsapp_number || '',
      p.name || '',
      p.divulgador_groups?.name || '',
      p.joined_at ? format(new Date(p.joined_at), 'dd/MM/yyyy HH:mm') : '',
      p.last_message_at ? format(new Date(p.last_message_at), 'dd/MM/yyyy HH:mm') : '',
      p.is_admin ? 'Sim' : 'Não',
      p.is_inactive ? 'Sim' : 'Não',
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `participantes_${selectedGroupId === '_all' ? 'todos' : 'grupo'}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    link.click();
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Todos os Participantes</CardTitle>
              <CardDescription>Liste e exporte participantes de grupos específicos ou de todos</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {filteredParticipants.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sync buttons */}
        <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncGroups} 
            disabled={isSyncing || instances.length === 0}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar Grupos do WhatsApp
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={syncParticipants} 
            disabled={isSyncing || groups.length === 0 || instances.length === 0}
          >
            {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sincronizar Participantes {selectedGroupId !== '_all' ? 'do Grupo' : 'de Todos'}
          </Button>
          {instances.length === 0 ? (
            <p className="text-xs text-amber-500 self-center ml-2">
              Configure uma instância WhatsApp primeiro
            </p>
          ) : (
            <p className="text-xs text-muted-foreground self-center ml-2">
              Sincronize para buscar dados atualizados do WhatsApp
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Grupo</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">Todos os grupos</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Número, nome ou grupo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={exportToCSV} disabled={filteredParticipants.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredParticipants.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {groups.length === 0 
              ? 'Nenhum grupo encontrado. Sincronize os grupos do WhatsApp primeiro.' 
              : 'Nenhum participante encontrado. Sincronize os participantes.'}
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Última Msg</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParticipants.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm">{p.whatsapp_number}</TableCell>
                    <TableCell>{p.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.divulgador_groups?.name || '-'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.joined_at ? format(new Date(p.joined_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {p.last_message_at ? format(new Date(p.last_message_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.is_admin && <Badge variant="default" className="text-xs">Admin</Badge>}
                        {p.is_inactive && <Badge variant="destructive" className="text-xs">Inativo</Badge>}
                        {!p.is_admin && !p.is_inactive && <Badge variant="secondary" className="text-xs">Membro</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}