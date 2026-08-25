import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronUp, Edit, Eye, RefreshCw, Loader2, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useConsultaNumerosCacheRows } from '@/hooks/useConsultaNumerosCacheRows';

interface LastStatusCache {
  [rowId: number]: string | null;
}

interface MonitoredStatusDisplayProps {
  baserowFields: Array<{
    id: number;
    name: string;
    type: string;
    select_options?: { id: number; value: string; color: string }[];
  }>;
  onEditRow: (row: any) => void;
  onViewRow: (row: any) => void;
}

// Get status display value from row
const getStatusValue = (row: any) => {
  const val = row['excluido_da_base'] || row['Excluido_Da_Base'] || row['status'] || row['Status'];
  if (val && typeof val === 'object' && 'value' in val) {
    return val.value || '-';
  }
  return val?.toString() || '-';
};


export function MonitoredStatusDisplay({ baserowFields, onEditRow, onViewRow }: MonitoredStatusDisplayProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastStatusCache, setLastStatusCache] = useState<LastStatusCache>({});

  // Fetch reminder config to get monitored statuses
  const { data: reminderConfig } = useQuery({
    queryKey: ['reminder-config-display'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_reminder_config')
        .select('status_to_monitor, is_active')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  const monitoredStatuses = reminderConfig?.status_to_monitor || [];
  const isReminderActive = reminderConfig?.is_active || false;

  // Numbers with monitored statuses, derived from the shared local cache query
  const { data: cacheData = [], isLoading, refetch } = useConsultaNumerosCacheRows(
    isOpen && monitoredStatuses.length > 0
  );

  const monitoredNumbers = useMemo(() => {
    if (!monitoredStatuses.length) return [] as any[];
    return (cacheData || [])
      .map((row: any) => ({
        id: row.baserow_row_id,
        ...row.row_data,
      }))
      .filter((row: any) => {
        const statusVal =
          row['excluido_da_base']?.value ||
          row['excluido_da_base'] ||
          row['Excluido_Da_Base']?.value ||
          row['Excluido_Da_Base'] ||
          row['status']?.value ||
          row['status'] ||
          row['Status']?.value ||
          row['Status'] ||
          '';
        const normalizedStatus = typeof statusVal === 'string' ? statusVal.trim() : '';
        return monitoredStatuses.some((s: string) => s.toLowerCase() === normalizedStatus.toLowerCase());
      })
      .map((row: any) => ({ ...row, _monitoredStatus: getStatusValue(row) }));
  }, [cacheData, monitoredStatuses]);


  // Pre-fetch last status for monitored numbers when they're loaded
  useEffect(() => {
    const fetchLastStatuses = async () => {
      if (!monitoredNumbers.length) return;

      const rowsToFetch = monitoredNumbers.filter((row: any) => {
        return lastStatusCache[row.id] === undefined;
      });
      
      if (rowsToFetch.length === 0) return;

      try {
        const rowIds = rowsToFetch.map((row: any) => row.id.toString());

        // Query history by baserow_row_id
        const { data: historyData } = await supabase
          .from('consulta_numeros_history')
          .select('baserow_row_id, dados_anteriores, created_at')
          .in('baserow_row_id', rowIds)
          .in('acao', ['atualizacao_obs', 'atualizacao_status', 'atualizacao_status_obs', 'atualizacao'])
          .order('created_at', { ascending: false });

        const newCache: LastStatusCache = {};
        rowsToFetch.forEach((row: any) => {
          newCache[row.id] = null;
        });

        const rowIdToCurrentStatus = new Map<number, string | null>();
        rowsToFetch.forEach((row: any) => {
          const statusVal =
            row['excluido_da_base']?.value ||
            row['excluido_da_base'] ||
            row['Excluido_Da_Base']?.value ||
            row['Excluido_Da_Base'] ||
            row['status']?.value ||
            row['status'] ||
            null;
          rowIdToCurrentStatus.set(row.id, statusVal);
        });

        if (historyData && historyData.length > 0) {
          const processedRowIds = new Set<number>();

          for (const entry of historyData) {
            const rowId = entry.baserow_row_id ? parseInt(entry.baserow_row_id) : NaN;
            if (!Number.isFinite(rowId)) continue;
            if (!(rowId in newCache)) continue;
            if (processedRowIds.has(rowId)) continue;

            const dadosAnteriores = entry.dados_anteriores as Record<string, any> | null;
            if (!dadosAnteriores) continue;

            const previousStatus =
              dadosAnteriores['excluido_da_base']?.value ||
              dadosAnteriores['excluido_da_base'] ||
              dadosAnteriores['Excluido_Da_Base']?.value ||
              dadosAnteriores['Excluido_Da_Base'] ||
              dadosAnteriores['status']?.value ||
              dadosAnteriores['status'] ||
              dadosAnteriores['Status']?.value ||
              dadosAnteriores['Status'];

            if (!previousStatus || typeof previousStatus !== 'string' || !previousStatus.trim()) continue;

            const currentStatus = rowIdToCurrentStatus.get(rowId) ?? null;
            if (currentStatus && previousStatus === currentStatus) continue;

            newCache[rowId] = previousStatus;
            processedRowIds.add(rowId);
          }
        }

        setLastStatusCache((prev) => ({ ...prev, ...newCache }));
      } catch (error) {
        console.error('Error fetching history for monitored rows:', error);
      }
    };

    fetchLastStatuses();
  }, [monitoredNumbers]);

  // Enhanced handlers that include pre-loaded last status
  const handleViewRow = (row: any) => {
    // Inject the pre-loaded last status into the row
    const enrichedRow = {
      ...row,
      _preloadedLastStatus: lastStatusCache[row.id],
    };
    onViewRow(enrichedRow);
  };

  const handleEditRow = (row: any) => {
    // Inject the pre-loaded last status into the row
    const enrichedRow = {
      ...row,
      _preloadedLastStatus: lastStatusCache[row.id],
    };
    onEditRow(enrichedRow);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast({ title: 'Lista atualizada!' });
  };

  // Find the status field
  const statusField = baserowFields.find(f => 
    f.type === 'single_select' && 
    (f.name.toLowerCase() === 'excluido_da_base' || f.name.toLowerCase() === 'status')
  );

  // (getStatusValue está definido no escopo do módulo, acima do componente)


  // Get numero value from row
  const getNumeroValue = (row: any) => {
    return row['numero'] || row['Numero'] || row['telefone'] || row['Telefone'] || '-';
  };

  // Get nome value from row
  const getNomeValue = (row: any) => {
    return row['nome'] || row['Nome'] || '-';
  };

  // Get status color
  const getStatusColor = (statusValue: string) => {
    if (!statusField?.select_options) return 'gray';
    const option = statusField.select_options.find(o => o.value === statusValue);
    return option?.color || 'gray';
  };

  if (!monitoredStatuses.length) {
    return null;
  }

  const totalCount = monitoredNumbers.length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <Bell className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Display de Status Monitorados
                    {isReminderActive && (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                        Ativo
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {totalCount} número(s) com status monitorado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-wrap gap-1 max-w-md">
                  {monitoredStatuses.slice(0, 3).map((status: string) => (
                    <Badge key={status} variant="secondary" className="text-xs">
                      {status}
                    </Badge>
                  ))}
                  {monitoredStatuses.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{monitoredStatuses.length - 3}
                    </Badge>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Números que possuem os status configurados nos Lembretes
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isLoading}
              >
                {isRefreshing || isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-2">Atualizar</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Carregando números...</span>
              </div>
            ) : monitoredNumbers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Nenhum número encontrado com os status monitorados</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto -mx-2 px-2">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monitoredNumbers.map((row: any) => {
                        const statusValue = getStatusValue(row);
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-mono">{getNumeroValue(row)}</TableCell>
                            <TableCell>{getNomeValue(row)}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline"
                                style={{ 
                                  borderColor: `var(--${getStatusColor(statusValue)}-500, #888)`,
                                  backgroundColor: `var(--${getStatusColor(statusValue)}-500, #888)20`
                                }}
                              >
                                {statusValue}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleViewRow(row)}
                                  title="Visualizar"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditRow(row)}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {monitoredNumbers.length > 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Esses números são enviados automaticamente pelos Lembretes via WhatsApp/Email
              </p>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
