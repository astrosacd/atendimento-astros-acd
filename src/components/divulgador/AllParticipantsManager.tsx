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
import { Download, Search, Users, Loader2, RefreshCw, Info } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function AllParticipantsManager() {
  const { t, i18n } = useTranslation();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('_all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'en': return enUS;
      case 'es': return es;
      default: return ptBR;
    }
  };

  // Fetch instances (status only)
  const { data: instances = [] } = useQuery({
    queryKey: ['divulgador-instances-status'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('divulgador_instances')
        .select('id, is_connected')
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
    if (instances.length === 0) {
      toast.info(t('broadcaster.configureInstanceFirst'));
      return;
    }

    const hasConnected = instances.some((i: any) => i.is_connected);
    if (!hasConnected) {
      toast.info(t('broadcaster.connectInstanceFirst'));
      return;
    }
    
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('divulgador-groups', {
        body: { action: 'fetch-groups' }
      });
      
      if (error) {
        const errorMsg = error.message || '';
        if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('Nenhuma') || errorMsg.includes('conectada') || errorMsg.includes('desativada')) {
          toast.info(errorMsg.replace('Error, ', '').replace(/[{}"]/g, ''));
          return;
        }
        throw error;
      }
      
      toast.success(`${t('broadcaster.groupsSynced')} ${data.saved || 0} grupos, ${data.deleted || 0} removidos`);
      queryClient.invalidateQueries({ queryKey: ['divulgador-groups'] });
      queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
    } catch (error: any) {
      const errorMsg = error.message || '';
      if (errorMsg.includes('instância') || errorMsg.includes('instance') || errorMsg.includes('Nenhuma') || errorMsg.includes('conectada') || errorMsg.includes('desativada')) {
        toast.info(errorMsg.replace('Error, ', '').replace(/[{}"]/g, ''));
      } else {
        toast.error(t('common.error') + ': ' + errorMsg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Sync participants from selected group
  const syncParticipants = async () => {
    if (selectedGroupId === '_all') {
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
        toast.success(`${t('broadcaster.participantsSynced')} ${syncedCount} ${t('broadcaster.groups').toLowerCase()}!`);
        queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
      } catch (error: any) {
        toast.error(t('common.error') + ': ' + error.message);
      } finally {
        setIsSyncing(false);
      }
    } else {
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
        
        toast.success(`${t('broadcaster.participantsSynced')} ${data.count || 0} ${t('broadcaster.participantsFound')}`);
        queryClient.invalidateQueries({ queryKey: ['all-divulgador-participants'] });
      } catch (error: any) {
        toast.error(t('common.error') + ': ' + error.message);
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
    const headers = [t('broadcaster.number'), t('broadcaster.name'), t('broadcaster.group'), t('broadcaster.entry'), t('broadcaster.lastMessage'), t('broadcaster.admin'), t('broadcaster.inactive')];
    const rows = filteredParticipants.map((p: any) => [
      p.whatsapp_number || '',
      p.name || '',
      p.divulgador_groups?.name || '',
      p.joined_at ? format(new Date(p.joined_at), 'dd/MM/yyyy HH:mm') : '',
      p.last_message_at ? format(new Date(p.last_message_at), 'dd/MM/yyyy HH:mm') : '',
      p.is_admin ? t('common.yes') : t('common.no'),
      p.is_inactive ? t('common.yes') : t('common.no'),
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
              <CardTitle>{t('broadcaster.allParticipants')}</CardTitle>
              <CardDescription>{t('broadcaster.allParticipantsDesc')}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {filteredParticipants.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Instructions and sync workflow */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div className="text-sm space-y-1">
              <p className="font-medium">{t('broadcaster.syncWorkflow')}</p>
              <ol className="list-decimal list-inside text-muted-foreground space-y-0.5 text-xs">
                <li><strong>{t('broadcaster.syncStep1').split(':')[0]}:</strong>{t('broadcaster.syncStep1').split(':')[1]}</li>
                <li><strong>{t('broadcaster.syncStep2').split(':')[0]}:</strong>{t('broadcaster.syncStep2').split(':')[1]}</li>
              </ol>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={syncGroups} 
              disabled={isSyncing || instances.length === 0 || !instances.some((i: any) => i.is_connected)}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              1. {t('broadcaster.syncGroups')}
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={syncParticipants} 
              disabled={isSyncing || groups.length === 0}
            >
              {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
              2. {t('broadcaster.syncParticipants')} {selectedGroupId !== '_all' ? '' : ''}
            </Button>
          </div>
          
          {instances.length === 0 ? (
            <p className="text-xs text-amber-500">
              ⚠️ {t('broadcaster.configureInstanceFirst')}
            </p>
          ) : !instances.some((i: any) => i.is_connected) ? (
            <p className="text-xs text-amber-500">
              ⚠️ {t('broadcaster.connectInstanceFirst')}
            </p>
          ) : groups.length === 0 ? (
            <p className="text-xs text-amber-500">
              ⚠️ {t('broadcaster.syncGroupsFirst')}
            </p>
          ) : null}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>{t('broadcaster.group')}</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder={t('broadcaster.selectGroup')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">{t('broadcaster.allGroups')}</SelectItem>
                {groups.map((g: any) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[200px] space-y-2">
            <Label>{t('common.search')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={t('broadcaster.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={exportToCSV} disabled={filteredParticipants.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              {t('broadcaster.exportCsv')}
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
              ? t('broadcaster.noGroupsFound')
              : t('broadcaster.noParticipantsFound')}
          </p>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="overflow-x-auto -mx-2 px-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('broadcaster.number')}</TableHead>
                    <TableHead>{t('broadcaster.name')}</TableHead>
                    <TableHead>{t('broadcaster.group')}</TableHead>
                    <TableHead>{t('broadcaster.entry')}</TableHead>
                    <TableHead>{t('broadcaster.lastMsg')}</TableHead>
                    <TableHead>{t('broadcaster.status')}</TableHead>
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
                        {p.joined_at ? format(new Date(p.joined_at), 'dd/MM/yy HH:mm', { locale: getDateLocale() }) : '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {p.last_message_at ? format(new Date(p.last_message_at), 'dd/MM/yy HH:mm', { locale: getDateLocale() }) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {p.is_admin && <Badge variant="default" className="text-xs">{t('broadcaster.admin')}</Badge>}
                          {p.is_inactive && <Badge variant="destructive" className="text-xs">{t('broadcaster.inactive')}</Badge>}
                          {!p.is_admin && !p.is_inactive && <Badge variant="secondary" className="text-xs">{t('broadcaster.member')}</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}