import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Edit, History, Download, Settings, Key, Webhook, BookOpen, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertCircle, Plus, Loader2, X, Tag, Mail, Eye, MessageSquare, QrCode, Shield, ShieldCheck, ShieldAlert, ShieldOff, CheckCircle2 } from 'lucide-react';
import { ValidacaoSmsTab } from '@/components/consulta-numeros/ValidacaoSmsTab';
import { MonitoredStatusDisplay } from '@/components/consulta-numeros/MonitoredStatusDisplay';
import { QrScansTab } from '@/components/consulta-numeros/QrScansTab';
import { useInsurancePaymentStatusHybrid } from '@/hooks/useInsurance';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useSystemActivities } from '@/hooks/useSystemActivities';

interface NumeroResult {
  id: number;
  [key: string]: any;
}

interface LastStatusInfo {
  [numberId: number]: string | null;
}

interface BaserowField {
  id: number;
  name: string;
  type: string;
  order: number;
  primary: boolean;
  select_options?: { id: number; value: string; color: string }[];
}

interface StatusOption {
  id: number;
  value: string;
  color: string;
}

export default function ConsultaNumeros() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useTranslation();
  const { logActivity } = useSystemActivities();
  
  const [inputSearchQuery, setInputSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<NumeroResult | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedObsTags, setSelectedObsTags] = useState<string[]>([]);
  const [newObservacao, setNewObservacao] = useState('');
  
  // Desbanimento OK - email with image
  const [desbanimentoImage, setDesbanimentoImage] = useState<File | null>(null);
  const [desbanimentoImagePreview, setDesbanimentoImagePreview] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Create number state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createTypeDialogOpen, setCreateTypeDialogOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalData, setSuccessModalData] = useState<{ numero: string; rowId: string } | null>(null);
  const [createType, setCreateType] = useState<'interno' | 'externo' | null>(null);
  const [selectedSeguro, setSelectedSeguro] = useState<string>('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});

  // Expanded rows and quick view modal state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [quickViewRow, setQuickViewRow] = useState<NumeroResult | null>(null);

  // Insurance status (hybrid: manual + auto-detected) — used in quick view dialog
  const { data: insurancePayStatusMap } = useInsurancePaymentStatusHybrid();

  // Sync status
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastStatusCache, setLastStatusCache] = useState<LastStatusInfo>({});
  const [lastStatusRefreshKey, setLastStatusRefreshKey] = useState(0);
  const autoSyncTriggeredRef = useRef(false);

  const nonEditableFields = useMemo(() => {
    return new Set(['nome', 'numero', 'email', 'data_cadastro', 'data_da_ultima_consulta']);
  }, []);

  // Fields to hide in Create dialog
  const hiddenCreateFields = useMemo(() => {
    return new Set(['data_cadastro', 'data_da_ultima_consulta', 'excluido_da_base']);
  }, []);

  // Auto-generate data_cadastro when opening create dialog
  const generateDataCadastro = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Fortaleza',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;
    
    return `${getPart('day')}/${getPart('month')}/${getPart('year')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')}`;
  };

  // Validation helpers
  const isValidNumber = (value: string) => /^\d*$/.test(value);
  const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // Helper to format date and time from Baserow
  const formatBaserowDate = (value: any, fieldName?: string) => {
    if (!value) return '-';
    try {
      const valueStr = value.toString();
      
      // If it already looks like Brazilian format (DD/MM/YYYY), return it as is
      if (/^\d{2}\/\d{2}\/\d{4}/.test(valueStr)) return valueStr;

      const date = new Date(value);
      if (isNaN(date.getTime())) return valueStr;
      
      const fieldLower = fieldName?.toLowerCase() || '';
      // We want time if:
      // 1. Field name suggests it (data_, _em, horario, ultima_consulta)
      // 2. Value itself contains 'T' (ISO) or ':' (time)
      const hasTime = (
        fieldLower.includes('data_') || 
        fieldLower.includes('_em') || 
        fieldLower.includes('horario') ||
        fieldLower.includes('consulta') ||
        valueStr.includes('T') ||
        (valueStr.includes(':') && valueStr.length > 5)
      );
      
      if (hasTime) {
        return date.toLocaleString('pt-BR', {
          timeZone: 'America/Fortaleza',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      }
      return date.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
    } catch (e) {
      return value?.toString() || '-';
    }
  };

  // Trigger sync from Baserow to local cache (full sync including deletions)
  const handleSyncFromBaserow = async () => {
    setIsSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão inválida');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-consulta-numeros`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'Erro ao sincronizar');
      }

      const deletedCount = json.rows_deleted || 0;
      const syncedCount = json.total_in_cache || json.rows_synced || 0;
      
      toast({
        title: 'Sincronização concluída!',
        description: deletedCount > 0 
          ? `${syncedCount} registros sincronizados, ${deletedCount} removidos.`
          : `${syncedCount} registros sincronizados.`,
      });

      // Refresh queries after sync
      await queryClient.invalidateQueries({ queryKey: ['consulta-numeros-campos'] });
      await queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
      await queryClient.invalidateQueries({ queryKey: ['sync-status'] });

      // Recarrega “Último Status” baseado no histórico após sincronizar
      setLastStatusCache({});
      setLastStatusRefreshKey((k) => k + 1);
    } catch (e: any) {
      console.error('Sync failed:', e);
      toast({
        title: 'Erro ao sincronizar',
        description: e.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Permissions
  const canQuery = isAdmin || hasPermission('query_consulta_numeros');
  const canCreate = isAdmin || hasPermission('update_both_consulta_numeros');
  const canUpdateStatus = isAdmin || hasPermission('update_status_consulta_numeros');
  const canUpdateObs = isAdmin || hasPermission('update_obs_consulta_numeros');
  const canUpdateBoth = isAdmin || hasPermission('update_both_consulta_numeros');
  const canViewHistory = isAdmin || hasPermission('view_history_consulta_numeros');
  const canExport = isAdmin || hasPermission('export_consulta_numeros');
  const canManageConfig = isAdmin || hasPermission('manage_config_consulta_numeros');
  const canManageWebhooks = isAdmin || hasPermission('manage_webhooks_consulta_numeros');
  const canManageApi = isAdmin || hasPermission('api_consulta_numeros');
  const canViewUnmasked = isAdmin || hasPermission('view_unmasked_consulta_numeros');

  // Fetch masked fields configuration
  const { data: maskedFieldsConfig = [] } = useQuery({
    queryKey: ['consulta-numeros-masked-fields'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_masked_fields')
        .select('*')
        .eq('is_masked', true);
      if (error) throw error;
      return data?.map(f => f.field_name) || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch observation tags for quick selection
  const { data: obsTags = [] } = useQuery({
    queryKey: ['consulta-numeros-obs-tags'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_obs_tags')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch observation presets (atalhos configuráveis) — only active, ordered
  const { data: obsPresets = [] } = useQuery({
    queryKey: ['consulta-numeros-obs-presets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_obs_presets')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('label', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; label: string; texto_observacao: string; status_padrao: string | null; cor: string | null; icone: string | null }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Helper function to mask sensitive data
  const maskValue = (value: string | null | undefined, fieldName: string): string => {
    if (!value) return '-';
    if (canViewUnmasked) return value;
    if (!maskedFieldsConfig.includes(fieldName)) return value;
    
    // Apply blur/mask effect
    const str = value.toString();
    if (str.length <= 3) return '***';
    return str.substring(0, 2) + '•'.repeat(Math.min(str.length - 2, 8)) + str.substring(str.length - 1);
  };

  // Fetch sync status
  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_sync_status')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 30 * 1000,
  });

  // Fetch fields from local cache (fast!)
  const { data: baserowFields = [], isLoading: loadingFields, error: fieldsError } = useQuery<BaserowField[]>({
    queryKey: ['consulta-numeros-campos'],
    queryFn: async () => {
      // First try local cache
      const { data: cacheData, error: cacheError } = await supabase
        .from('consulta_numeros_fields_cache')
        .select('fields_data')
        .order('synced_at', { ascending: false })
        .limit(1)
        .single();

      if (!cacheError && cacheData?.fields_data) {
        return cacheData.fields_data as unknown as BaserowField[];
      }

      // Fallback: try edge function (will also populate cache)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Sessão inválida');
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/campos`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        // If no cache and API fails, return empty
        return [];
      }

      const json = await res.json();
      return json.data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  // Determine visible columns from fields (exclude internal fields)
  const visibleFields = useMemo(() => {
    const fromBaserow = baserowFields
      .filter((f) => !['id', 'order'].includes(f.name.toLowerCase()))
      .sort((a, b) => a.order - b.order);

    return fromBaserow;
  }, [baserowFields]);

  // Find Status field (prefer exact name match)
  const statusField = useMemo(() => {
    const byName = baserowFields.find(
      (f) => f.type === 'single_select' && f.select_options?.length && f.name?.toLowerCase() === 'status'
    );
    if (byName) return byName;

    return (
      baserowFields.find(
        (f) => f.type === 'single_select' && f.select_options?.length && f.name?.toLowerCase() === 'excluido_da_base'
      ) || baserowFields.find((f) => f.type === 'single_select' && f.select_options?.length)
    );
  }, [baserowFields]);

  // Determina se o número é Interno (IN) ou Externo (EX) baseado nas observações
  const getNumeroTipo = useCallback((row: NumeroResult): 'IN' | 'EX' => {
    const obs = row?.observacoes ?? row?.observacao ?? '';
    if (typeof obs !== 'string') return 'EX';
    
    const obsLower = obs.toLowerCase();
    
    // Critérios para INTERNO:
    // - "SIM não aprovisionado"
    // - "✅ COM SEGURO" ou "com seguro"
    // - "🚫 SEM SEGURO" ou "sem seguro"
    if (
      obsLower.includes('sim não aprovisionado') ||
      obsLower.includes('sim nao aprovisionado') ||
      obs.includes('✅ COM SEGURO') ||
      obsLower.includes('com seguro') ||
      obs.includes('🚫 SEM SEGURO') ||
      obsLower.includes('sem seguro')
    ) {
      return 'IN';
    }
    
    return 'EX';
  }, []);

  const resolveLastStatus = useCallback(
    (row: NumeroResult): string | null | undefined => {
      // Check for pre-loaded status from MonitoredStatusDisplay first
      const preloaded = (row as any)._preloadedLastStatus;
      if (preloaded !== undefined) {
        return preloaded;
      }
      // Sem fallback: "Último Status" vem exclusivamente do histórico.
      // undefined = ainda carregando; null = não existe histórico.
      return lastStatusCache[row.id];
    },
    [lastStatusCache]
  );

  // When changing status filters, reset pagination (query reruns automatically)
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilters]);

  // Query numbers from local cache (fast, no external API calls!)
  const { data: queryResult, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ['consulta-numeros', appliedSearchQuery, statusFilters, currentPage, pageSize, canQuery],
    queryFn: async () => {
      if (!canQuery) {
        return { success: true, data: [], pagination: { count: 0, page: 1, pageSize, totalPages: 0 } };
      }

      // Fetch all data from local cache
      const { data: cacheData, error: cacheError, count } = await supabase
        .from('consulta_numeros_cache')
        .select('baserow_row_id, row_data', { count: 'exact' });

      if (cacheError) {
        console.error('Cache query error:', cacheError);
        throw cacheError;
      }

      // Transform cache data to expected format and sort by baserow_row_id (numeric order)
      let results = (cacheData || [])
        .map((row: any) => ({
          id: row.baserow_row_id,
          ...row.row_data,
        }))
        .sort((a: any, b: any) => a.id - b.id);

      // Client-side search filter
      if (appliedSearchQuery) {
        const searchLower = appliedSearchQuery.toLowerCase();
        results = results.filter((row: any) => {
          return Object.values(row).some((val) => {
            if (!val) return false;
            if (typeof val === 'object' && 'value' in val) {
              return String(val.value).toLowerCase().includes(searchLower);
            }
            return String(val).toLowerCase().includes(searchLower);
          });
        });
      }

      // Client-side status filter
      if (statusFilters.length > 0) {
        results = results.filter((row: any) => {
          const statusVal =
            row['excluido_da_base']?.value ||
            row['excluido_da_base'] ||
            row['Excluido_Da_Base']?.value ||
            row['Excluido_Da_Base'] ||
            row['status']?.value ||
            row['status'] ||
            '';
          const normalizedStatus = typeof statusVal === 'string' ? statusVal.trim() : '';
          return statusFilters.some((f) => f.toLowerCase() === normalizedStatus.toLowerCase());
        });
      }

      // Client-side pagination
      const totalCount = results.length;
      const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;
      const from = (currentPage - 1) * pageSize;
      const paginatedResults = results.slice(from, from + pageSize);

      return {
        success: true,
        data: paginatedResults,
        pagination: { count: totalCount, page: currentPage, pageSize, totalPages },
      };
    },
    enabled: true,
    retry: 1,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });
  const hasCachedRows = (queryResult?.pagination?.count ?? 0) > 0;

  // Only block the UI when we truly have no cached data.
  // If there is cached data, we show it even if the last sync failed/has no timestamp.
  const needsSync =
    !hasCachedRows && (syncStatus?.last_sync_status === 'pending' || !syncStatus?.last_sync_at);

  const isConfigError = Boolean((fieldsError as any)?.message?.includes('configuração'));
  const isFieldsLoading = loadingFields && !fieldsError;

  // Auto-sync on module open (no click) when cache is empty
  useEffect(() => {
    if (autoSyncTriggeredRef.current) return;
    if (!isAdmin) return;
    if (!canQuery) return;
    if (hasCachedRows) return;
    if (!syncStatus) return;

    const shouldAutoSync =
      syncStatus.last_sync_status === 'error' ||
      syncStatus.last_sync_status === 'pending' ||
      !syncStatus.last_sync_at;

    if (!shouldAutoSync) return;

    autoSyncTriggeredRef.current = true;
    void handleSyncFromBaserow();
  }, [isAdmin, canQuery, hasCachedRows, syncStatus]);

  // Fetch last active status for each row from history (by Baserow row id)
  useEffect(() => {
    const fetchLastStatuses = async () => {
      if (!queryResult?.data?.length) return;

      const rowsToFetch = queryResult.data.filter((row: NumeroResult) => {
        const cached = lastStatusCache[row.id];
        return cached === undefined || cached === null;
      });
      if (rowsToFetch.length === 0) return;

      try {
        const rowIds = rowsToFetch.map((row: NumeroResult) => row.id.toString());

        // Query history by baserow_row_id (unique per row)
        const { data: historyData } = await supabase
          .from('consulta_numeros_history')
          .select('baserow_row_id, dados_anteriores, created_at')
          .in('baserow_row_id', rowIds)
          .in('acao', ['atualizacao_obs', 'atualizacao_status', 'atualizacao_status_obs', 'atualizacao'])
          .order('created_at', { ascending: false });

        const newCache: LastStatusInfo = {};
        rowsToFetch.forEach((row: NumeroResult) => {
          newCache[row.id] = null;
        });

        const rowIdToCurrentStatus = new Map<number, string | null>();
        rowsToFetch.forEach((row: NumeroResult) => {
          rowIdToCurrentStatus.set(row.id, row.excluido_da_base?.value || null);
        });

        if (historyData && historyData.length > 0) {
          const processedRowIds = new Set<number>();

          for (const entry of historyData) {
            const rowId = entry.baserow_row_id ? parseInt(entry.baserow_row_id) : NaN;
            if (!Number.isFinite(rowId)) continue;
            if (!(rowId in newCache)) continue;
            if (processedRowIds.has(rowId)) continue;

            // "Último status" = status ANTERIOR à última alteração
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
        console.error('Error fetching history for rows:', error);
      }
    };

    fetchLastStatuses();
  }, [queryResult?.data, lastStatusRefreshKey]);


  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ rowId, data }: { rowId: number; data: Record<string, any> }) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            row_id: rowId.toString(),
            ...data,
          }),
        }
      );

      if (res.status === 401) {
        await supabase.auth.signOut();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: () => {
      toast({ title: t('numberQuery.updatedSuccess') });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
      setEditDialogOpen(false);
      setSelectedRow(null);
    },
    onError: (error: Error) => {
      toast({ title: t('numberQuery.errorUpdating'), description: error.message, variant: 'destructive' });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error(t('numberQuery.invalidSession'));
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/cadastrar`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      );

      if (res.status === 401) {
        await supabase.auth.signOut();
        throw new Error(t('numberQuery.invalidSession'));
      }
      
      const json = await res.json();
      
      // Check specifically for duplicate error
      if (res.status === 409 && json.duplicate) {
        const error = new Error(json.error) as Error & { duplicate?: boolean };
        error.duplicate = true;
        throw error;
      }
      
      if (!json.success) throw new Error(json.error);
      return json;
    },
    onSuccess: (json) => {
      const rowId = json?.data?.id;
      const numero = json?.data?.numero || json?.data?.Numero || '';
      if (createType === 'interno' && rowId) {
        setSuccessModalData({ numero, rowId: String(rowId) });
        setSuccessModalOpen(true);
      } else {
        toast({ title: t('numberQuery.registeredSuccess') });
      }
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
      setCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error: Error & { duplicate?: boolean }) => {
      if (error.duplicate) {
        toast({ 
          title: '⚠️ ' + t('numberQuery.duplicateNumber'), 
          description: error.message, 
          variant: 'destructive',
        });
      } else {
        toast({ title: t('numberQuery.errorRegistering'), description: error.message, variant: 'destructive' });
      }
    },
  });

  const resetCreateForm = () => {
    setNewValues({ data_cadastro: generateDataCadastro() });
    setCreateType(null);
    setSelectedSeguro('');
  };

  const openCreateDialog = () => {
    // Abre o modal de seleção de tipo primeiro
    setCreateTypeDialogOpen(true);
  };

  const handleSelectCreateType = (type: 'interno' | 'externo') => {
    setCreateType(type);
    setCreateTypeDialogOpen(false);
    
    const initialValues: Record<string, string> = { data_cadastro: generateDataCadastro() };
    
    if (type === 'externo') {
      // Para número externo, observações já vem preenchido
      initialValues['observacoes'] = 'Numero Externo';
      // Para número externo, excluido_da_base vai com "EM ANÁLISE PELA META" por padrão
      initialValues['excluido_da_base'] = 'EM ANÁLISE PELA META';
    }
    
    setNewValues(initialValues);
    setSelectedSeguro('');
    setCreateDialogOpen(true);
  };

  const handleCreate = () => {
    // Find the primary/numero field
    const numeroField = visibleFields.find(f => f.name.toLowerCase().includes('numero'));
    const numeroValue = newValues[numeroField?.name || 'numero'];
    
    if (!numeroValue?.trim()) {
      toast({ title: t('numberQuery.numberRequired'), variant: 'destructive' });
      return;
    }

    // Validate numero is only numbers
    if (!isValidNumber(numeroValue)) {
      toast({ title: t('numberQuery.numberOnlyDigits'), variant: 'destructive' });
      return;
    }

    // Email é obrigatório
    const emailField = visibleFields.find(f => f.name.toLowerCase() === 'email');
    const emailValue = newValues[emailField?.name || 'email'];

    if (!emailValue?.trim()) {
      toast({ title: t('numberQuery.emailRequired'), variant: 'destructive' });
      return;
    }

    if (!isValidEmail(emailValue)) {
      toast({ title: t('numberQuery.invalidEmail'), variant: 'destructive' });
      return;
    }

    // Validação obrigatória de seguro para números internos
    if (createType === 'interno' && !selectedSeguro) {
      toast({ title: t('numberQuery.selectInsurance'), description: t('numberQuery.selectInsuranceDesc'), variant: 'destructive' });
      return;
    }

    // Montar os dados finais
    const finalData = { ...newValues };
    
    // Para número interno, definir observações com a opção de seguro
    if (createType === 'interno') {
      finalData['observacoes'] = selectedSeguro;
    }
    
    createMutation.mutate(finalData);
  };

  // Apply filters/search
  const handleSearch = () => {
    const nextQuery = inputSearchQuery.trim();

    // Apply the typed query and reset to first page.
    setAppliedSearchQuery(nextQuery);
    if (nextQuery) {
      logActivity(`Consultou o número: ${nextQuery}`, 'consulta');
    }

    // If already on page 1 and query didn't change, force a refetch.
    if (currentPage === 1 && nextQuery === appliedSearchQuery) {
      // Também força reconsulta do “Último Status” (histórico), sem fallback.
      setLastStatusCache({});
      setLastStatusRefreshKey((k) => k + 1);
      refetch();
      return;
    }

    setCurrentPage(1);
  };

  const handleEdit = (row: NumeroResult) => {
    setSelectedRow(row);
    // Initialize edit values with current row values
    const values: Record<string, string> = {};
    visibleFields.forEach(f => {
      const val = row[f.name];
      // Handle single_select fields which come as {id, value, color} objects
      if (f.type === 'single_select' && val && typeof val === 'object' && 'value' in val) {
        values[f.name] = val.value || '';
      } else {
        values[f.name] = val?.toString() || '';
      }
    });
    setEditValues(values);
    setNewObservacao('');
    setSelectedObsTags([]);
    setDesbanimentoImage(null);
    setDesbanimentoImagePreview(null);
    setEditDialogOpen(true);
  };

  // Handle image upload for Desbanimento OK
  const handleDesbanimentoImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: t('numberQuery.selectImage'), variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ title: t('numberQuery.imageTooLarge'), variant: 'destructive' });
        return;
      }
      setDesbanimentoImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setDesbanimentoImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Check if current status is "Desbanimento OK"
  const isDesbanimentoOK = useMemo(() => {
    // Check excluido_da_base field (the field shown in screenshot)
    const excluido = editValues['excluido_da_base'] || editValues['Excluido_Da_Base'] || '';
    if (excluido.toLowerCase().includes('desbanimento ok')) return true;
    
    // Also check status field as fallback
    const currentStatus = editValues['status'] || editValues['Status'] || '';
    return currentStatus.toLowerCase().includes('desbanimento ok');
  }, [editValues]);

  // Send desbanimento email
  const sendDesbanimentoEmail = async (): Promise<boolean> => {
    if (!selectedRow || !desbanimentoImage) return true; // No image, skip email
    
    const emailField = visibleFields.find(f => f.name.toLowerCase() === 'email');
    const nomeField = visibleFields.find(f => f.name.toLowerCase() === 'nome');
    const numeroField = visibleFields.find(f => f.name.toLowerCase().includes('numero'));
    
    const email = selectedRow[emailField?.name || 'email'];
    const nome = selectedRow[nomeField?.name || 'nome'] || '';
    const numero = selectedRow[numeroField?.name || 'numero'] || '';
    
    if (!email) {
      toast({ title: t('numberQuery.emailNotFound'), variant: 'destructive' });
      return false;
    }
    
    try {
      setSendingEmail(true);
      
      // Convert image to base64
      const reader = new FileReader();
      const imageBase64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]; // Remove data:image/...;base64, prefix
          resolve(base64);
        };
        reader.readAsDataURL(desbanimentoImage);
      });
      
      const imageBase64 = await imageBase64Promise;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: t('numberQuery.sessionExpired'), variant: 'destructive' });
        return false;
      }
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-desbanimento-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            nome,
            numero,
            imageBase64,
            imageType: desbanimentoImage.type,
          }),
        }
      );
      
      const result = await res.json();
      
      if (!result.success) {
        toast({ title: t('numberQuery.errorSendingEmail'), description: result.error, variant: 'destructive' });
        return false;
      }
      
      toast({ title: t('numberQuery.emailSentSuccess'), description: t('numberQuery.sentTo', { email }) });
      return true;
      
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({ title: t('numberQuery.errorSendingEmail'), description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setSendingEmail(false);
    }
  };

  const handleAddObsTag = (tagName: string) => {
    if (!selectedObsTags.includes(tagName)) {
      setSelectedObsTags(prev => [...prev, tagName]);
    }
  };

  const handleRemoveObsTag = (tagName: string) => {
    setSelectedObsTags(prev => prev.filter(t => t !== tagName));
  };

  const handleSaveEdit = async () => {
    if (!selectedRow) return;

    // Check if desbanimento OK is selected - image is REQUIRED
    if (isDesbanimentoOK) {
      if (!desbanimentoImage) {
        toast({ 
          title: 'Imagem obrigatória', 
          description: 'É obrigatório anexar uma imagem quando o status é "DESBANIMENTO OK"', 
          variant: 'destructive' 
        });
        return;
      }
      
      // Send email with image
      const emailSent = await sendDesbanimentoEmail();
      if (!emailSent) {
        // Email failed, don't proceed with save
        return;
      }
    }

    // Merge nova observação e tags com as anteriores (se houver)
    const finalValues = { ...editValues };
    const obsField = visibleFields.find(f => f.name.toLowerCase() === 'observacoes');
    
    // Get status field value (excluido_da_base or status)
    const statusFieldName = 'excluido_da_base';
    const newStatus = editValues[statusFieldName] || editValues['Excluido_Da_Base'] || editValues['status'] || editValues['Status'] || '';
    
    // Get original status from selectedRow
    const getOriginalStatus = () => {
      const statusVal = selectedRow[statusFieldName] || selectedRow['Excluido_Da_Base'] || selectedRow['status'] || selectedRow['Status'];
      if (statusVal && typeof statusVal === 'object' && 'value' in statusVal) {
        return statusVal.value || '';
      }
      return statusVal?.toString() || '';
    };
    const originalStatus = getOriginalStatus();
    
    // Check if status was changed
    const statusChanged = newStatus && originalStatus !== newStatus;
    
    // Get "tipo" field value (ex: "Numero Externo")
    const tipoFieldName = visibleFields.find(f => 
      f.name.toLowerCase().includes('tipo') || 
      f.name.toLowerCase().includes('escrito') ||
      f.name.toLowerCase().includes('escrito_da_base')
    )?.name || 'escrito_da_base';
    
    const getTipoValue = () => {
      const tipoVal = selectedRow[tipoFieldName] || selectedRow['escrito_da_base'] || selectedRow['Escrito_Da_Base'] || selectedRow['tipo'] || selectedRow['Tipo'];
      if (tipoVal && typeof tipoVal === 'object' && 'value' in tipoVal) {
        return tipoVal.value || '';
      }
      return tipoVal?.toString() || '';
    };
    const tipoValue = getTipoValue();
    
    if (obsField) {
      const hasNewObs = newObservacao.trim();
      const hasTags = selectedObsTags.length > 0;
      
      if (hasNewObs || hasTags) {
        // User added observation manually
        const timestamp = new Date().toLocaleString('pt-BR');
        const separator = editValues[obsField.name] ? '\n---\n' : '';
        
        // Build the new observation entry
        const parts: string[] = [];
        if (hasTags) {
          parts.push(`[TAGS: ${selectedObsTags.join(', ')}]`);
        }
        if (hasNewObs) {
          parts.push(newObservacao.trim());
        }
        
        finalValues[obsField.name] = `${editValues[obsField.name] || ''}${separator}[${timestamp}] ${parts.join(' - ')}`;
      } else if (statusChanged && newStatus) {
        // User did NOT add observation manually but changed the status
        // Automatically add the status change to observations
        const existingObs = editValues[obsField.name] || '';
        const timestamp = new Date().toLocaleString('pt-BR');
        const separator = existingObs ? '\n---\n' : '';
        
        // Check if new status is "EXCLUÍDO" (case insensitive)
        const isExcluido = newStatus.toLowerCase().includes('excluído') || newStatus.toLowerCase().includes('excluido');
        
        // Special case for EXCLUÍDO - add "Numero Externo - Banido Permanentemente - data"
        if (isExcluido && 
            (existingObs.toLowerCase().includes('numero externo') || 
             (tipoValue && tipoValue.toLowerCase().includes('numero externo')))) {
          // Format as: Numero Externo - Banido Permanentemente - data/hora
          finalValues[obsField.name] = `${existingObs}${separator}Numero Externo - Banido Permanentemente - ${timestamp}`;
        } else if (isDesbanimentoOK && 
            (existingObs.toLowerCase().includes('numero externo') || 
             (tipoValue && tipoValue.toLowerCase().includes('numero externo')))) {
          // Format as: Numero Externo - DESBANIMENTO OK - data/hora
          finalValues[obsField.name] = `Numero Externo - DESBANIMENTO OK - ${timestamp}`;
        } else {
          // For any other status change, append: [timestamp] Status: <new_status>
          finalValues[obsField.name] = `${existingObs}${separator}[${timestamp}] Status: ${newStatus}`;
        }
      }
    }

    updateMutation.mutate({ rowId: selectedRow.id, data: finalValues });
  };

  const handleExport = async () => {
    if (!queryResult?.data) return;

    const headers = ['Linha', ...visibleFields.map(f => f.name)];
    const csvContent = [
      headers.join(','),
      ...queryResult.data.map((row: NumeroResult) =>
        [
          `"${row.id}"`,
          ...visibleFields.map((field) => {
            const val = row[field.name];
            // Handle single_select objects
            let displayVal = field?.type === 'single_select' && val && typeof val === 'object' && 'value' in val
              ? val.value
              : val;
            
            // Apply masking if needed
            if (maskedFieldsConfig.includes(field.name) && !canViewUnmasked) {
              displayVal = maskValue(displayVal?.toString(), field.name);
            }
            
            // Format date fields
            const formattedVal = formatBaserowDate(displayVal, field.name);
            
            return `"${(formattedVal || '').toString().replace(/"/g, '""')}"`;
          })
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `consulta_numeros_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: t('numberQuery.exportComplete') });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 w-full min-w-0">
        <div className="space-y-6 w-full min-w-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{t('numberQuery.title')}</h1>
            <p className="text-muted-foreground">{t('numberQuery.subtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreate && (
              <Button onClick={openCreateDialog} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                {t('numberQuery.create')} {t('numberQuery.number')}
              </Button>
            )}
            {canViewHistory && (
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/admin/consulta-numeros/historico')}
                className="shrink-0"
              >
                <History className="h-4 w-4 mr-2" />
                {t('numberQuery.history')}
              </Button>
            )}

            {/* Menu dropdown para configurações e outras opções */}
            {(canManageConfig || canManageApi || canManageWebhooks) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative shrink-0"
                    aria-label={t('numberQuery.config')}
                    title={t('numberQuery.config')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-popover border border-border shadow-lg z-50"
                >
                  <DropdownMenuLabel>{t('numberQuery.config')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canManageConfig && (
                    <DropdownMenuItem
                      onClick={() => (window.location.href = '/admin/consulta-numeros/config')}
                      className="cursor-pointer"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      {t('numberQuery.config')}
                    </DropdownMenuItem>
                  )}
                  {canManageApi && (
                    <DropdownMenuItem
                      onClick={() => (window.location.href = '/admin/consulta-numeros/api')}
                      className="cursor-pointer"
                    >
                      <Key className="h-4 w-4 mr-2" />
                      {t('numberQuery.apiKeys.title')}
                    </DropdownMenuItem>
                  )}
                  {canManageWebhooks && (
                    <DropdownMenuItem
                      onClick={() => (window.location.href = '/admin/consulta-numeros/webhooks')}
                      className="cursor-pointer"
                    >
                      <Webhook className="h-4 w-4 mr-2" />
                      {t('numberQuery.webhooks')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => (window.location.href = '/admin/consulta-numeros/guia')}
                    className="cursor-pointer"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    {t('numberQuery.guide')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Module Tabs */}
        <Tabs defaultValue="consulta" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="consulta">
              <Search className="h-4 w-4 mr-2" />
              Consulta
            </TabsTrigger>
            <TabsTrigger value="validacao-sms">
              <MessageSquare className="h-4 w-4 mr-2" />
              Validação & SMS
            </TabsTrigger>
            <TabsTrigger value="qr-scans">
              <QrCode className="h-4 w-4 mr-2" />
              QR Scans
            </TabsTrigger>
          </TabsList>

          <TabsContent value="validacao-sms">
            <ValidacaoSmsTab />
          </TabsContent>

          <TabsContent value="qr-scans">
            <QrScansTab />
          </TabsContent>


          <TabsContent value="consulta" className="space-y-6">

        {/* Monitored Status Display Card */}
        {isAdmin && (
          <MonitoredStatusDisplay
            baserowFields={baserowFields}
            onEditRow={handleEdit}
            onViewRow={(row) => setQuickViewRow(row)}
          />
        )}

        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {t('numberQuery.search')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder={t('numberQuery.searchPlaceholder')}
                  value={inputSearchQuery}
                  onChange={(e) => setInputSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="w-full md:w-64">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      {statusFilters.length === 0
                        ? t('numberQuery.clearFilters')
                        : statusFilters.length === 1
                          ? statusFilters[0]
                          : `${statusFilters.length} ${t('common.status')} ${t('common.selected', { defaultValue: 'selected' } as any)}`
                      }
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-muted-foreground"
                        onClick={() => setStatusFilters([])}
                      >
                        {t('numberQuery.clearFilters')}
                      </Button>
                    <div className="border-t pt-2 space-y-1">
                        {statusField?.select_options?.map((s) => (
                          <label
                            key={s.id}
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={statusFilters.includes(s.value)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setStatusFilters([...statusFilters, s.value]);
                                } else {
                                  setStatusFilters(statusFilters.filter(v => v !== s.value));
                                }
                              }}
                            />
                            <span className="text-sm">{s.value}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {t('numberQuery.search')}
              </Button>
              {canExport && queryResult?.data?.length > 0 && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('numberQuery.export')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
            <CardDescription>
              {queryResult?.pagination?.count || 0} números encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Sync status banner */}
            {syncStatus && (
              <div className="mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    {syncStatus.last_sync_at ? (
                      <>
                        <span className="text-muted-foreground">Última sincronização: </span>
                        <span className="font-medium">
                          {new Date(syncStatus.last_sync_at).toLocaleString('pt-BR')}
                        </span>
                      </>
                    ) : hasCachedRows ? (
                      <span className="text-muted-foreground">
                        Dados carregados automaticamente ({queryResult?.pagination?.count || 0} números). Última sincronização não registrada.
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium">Nenhuma sincronização realizada ainda</span>
                    )}
                  </div>
                  {isAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSyncFromBaserow}
                      disabled={isSyncing}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {isSyncing ? 'Sincronizando...' : 'Sincronizar com Baserow'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {!canQuery ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sem permissão para consultar</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Seu usuário não tem permissão para visualizar os resultados da Consulta de Números.
                </p>
              </div>
            ) : needsSync ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sincronização Necessária</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Os dados do Baserow ainda não foram sincronizados. Clique no botão acima para sincronizar.
                </p>
                {isAdmin && (
                  <Button onClick={handleSyncFromBaserow} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                  </Button>
                )}
              </div>
            ) : isConfigError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Configuração Necessária</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  O Baserow ainda não está configurado. Configure a conexão com o Baserow para começar a consultar números.
                </p>
                {canManageConfig && (
                  <Button onClick={() => (window.location.href = '/admin/consulta-numeros/config')}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Baserow
                  </Button>
                )}
              </div>
            ) : isFieldsLoading || isLoading ? (
              <div className="flex flex-col items-center justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">
                  {isFieldsLoading ? 'Carregando campos...' : 'Carregando dados...'}
                </p>
              </div>
            ) : visibleFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum campo disponível</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Sincronize os dados do Baserow primeiro.
                </p>
                {isAdmin && (
                  <Button onClick={handleSyncFromBaserow} disabled={isSyncing}>
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                )}
              </div>
            ) : queryResult?.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum número encontrado. Faça uma busca para ver resultados.
              </div>
            ) : (
              <>
                <div className="w-full max-w-full rounded-md border overflow-x-auto relative">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {/* Coluna fixa à esquerda - Visualização/Expandir */}
                        <TableHead className="w-[90px] sticky left-0 bg-card z-20 border-r border-border/50">
                          <span className="sr-only">Ações rápidas</span>
                        </TableHead>
                        <TableHead className="w-[70px]">Linha</TableHead>
                        {/* Coluna Tipo (IN/EX) - logo após Linha */}
                        <TableHead className="w-[60px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Tipo
                              </TooltipTrigger>
                              <TooltipContent className="z-50 max-w-[200px]">
                                IN = Interno (com/sem seguro, SIM não aprovisionado)<br/>
                                EX = Externo
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        {visibleFields.map((field) => (
                          <TableHead key={field.id}>{field.name}</TableHead>
                        ))}
                        {/* Coluna Último Status Ativo */}
                        <TableHead className="min-w-[140px]">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                                Último Status
                                <History className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent className="z-50 max-w-[200px]">
                                Status anterior a uma alteração (consultado do histórico)
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableHead>
                        {/* Coluna fixa à direita - Ações */}
                        <TableHead className="w-[80px] sticky right-0 bg-card z-20 border-l border-border/50 text-center">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryResult?.data?.map((row: NumeroResult) => {
                        const isExpanded = expandedRows.has(row.id);
                        return (
                          <>
                            <TableRow key={row.id} className="group">
                              {/* Coluna fixa à esquerda - Visualização/Expandir */}
                              <TableCell className="sticky left-0 bg-card z-10 border-r border-border/50">
                                <div className="flex items-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => setQuickViewRow(row)}
                                        >
                                          <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-50">Ver detalhes</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 w-7 p-0"
                                          onClick={() => {
                                            setExpandedRows(prev => {
                                              const next = new Set(prev);
                                              if (next.has(row.id)) {
                                                next.delete(row.id);
                                              } else {
                                                next.add(row.id);
                                              }
                                              return next;
                                            });
                                          }}
                                        >
                                          {isExpanded ? (
                                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                          ) : (
                                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-50">{isExpanded ? 'Recolher' : 'Expandir'}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </TableCell>

                              <TableCell className="font-mono text-muted-foreground">{row.id}</TableCell>
                              
                              {/* Coluna Tipo (IN/EX) - logo após Linha */}
                              <TableCell className="w-[60px]">
                                {(() => {
                                  const tipo = getNumeroTipo(row);
                                  return (
                                    <Badge 
                                      variant={tipo === 'IN' ? 'default' : 'secondary'}
                                      className={tipo === 'IN' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                                    >
                                      {tipo}
                                    </Badge>
                                  );
                                })()}
                              </TableCell>

                              {visibleFields.map((field) => {
                                const cellValue = row[field.name];
                                const rawValue =
                                  field.type === 'single_select' &&
                                  cellValue &&
                                  typeof cellValue === 'object' &&
                                  'value' in cellValue
                                    ? cellValue.value
                                    : cellValue;

                                const isMaskedField = maskedFieldsConfig.includes(field.name);
                                const displayValue =
                                  isMaskedField && !canViewUnmasked
                                    ? maskValue(rawValue?.toString(), field.name)
                                    : rawValue;

                                 const isObservacoes = field.name.toLowerCase() === 'observacoes';
                                 const isNumero = field.name.toLowerCase() === 'numero';
                                const asText = (displayValue?.toString() || '').trim();
                                const showTooltip =
                                  isObservacoes &&
                                  !!asText &&
                                  asText.length > 32 &&
                                  (!isMaskedField || canViewUnmasked);

                                return (
                                  <TableCell
                                    key={field.id}
                                    className={`max-w-[200px] truncate ${isMaskedField && !canViewUnmasked ? 'blur-[3px] select-none' : ''}`}
                                    onCopy={(e) => isMaskedField && !canViewUnmasked && e.preventDefault()}
                                    onCut={(e) => isMaskedField && !canViewUnmasked && e.preventDefault()}
                                    onContextMenu={(e) => isMaskedField && !canViewUnmasked && e.preventDefault()}
                                   >
                                     <div className="flex items-center gap-2">
                                       {isNumero && (
                                         (() => {
                                           const tipo = getNumeroTipo(row);
                                           return (
                                             <Badge 
                                               variant={tipo === 'IN' ? 'default' : 'secondary'}
                                               className={`text-[10px] px-1 py-0 h-4 min-w-[24px] justify-center shrink-0 ${tipo === 'IN' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                                             >
                                               {tipo}
                                             </Badge>
                                           );
                                         })()
                                       )}
                                       <div className={isNumero ? 'font-mono' : 'truncate'}>
                                         {field.type === 'single_select' ? (
                                           <Badge variant="secondary">{displayValue || '-'}</Badge>
                                         ) : field.type === 'boolean' ? (
                                           rawValue ? 'Sim' : 'Não'
                                         ) : field.type === 'date' ? (
                                           formatBaserowDate(rawValue, field.name)
                                         ) : showTooltip ? (
                                           <TooltipProvider>
                                             <Tooltip>
                                               <TooltipTrigger asChild>
                                                 <span className="cursor-help">{asText}</span>
                                               </TooltipTrigger>
                                               <TooltipContent className="z-50 max-w-[420px] whitespace-pre-wrap">
                                                 {asText}
                                               </TooltipContent>
                                             </Tooltip>
                                           </TooltipProvider>
                                         ) : (
                                           formatBaserowDate(displayValue || rawValue, field.name)
                                         )}
                                       </div>
                                     </div>
                                   </TableCell>
                                );
                              })}

                              {/* Coluna Último Status Ativo */}
                              <TableCell className="min-w-[140px]">
                                {(() => {
                                  const resolved = resolveLastStatus(row);
                                  if (resolved === undefined) {
                                    return <span className="text-muted-foreground text-xs animate-pulse">...</span>;
                                  }
                                  if (resolved) {
                                    return (
                                      <Badge variant="outline" className="text-xs">
                                        {resolved}
                                      </Badge>
                                    );
                                  }
                                  return <span className="text-muted-foreground text-xs">-</span>;
                                })()}
                              </TableCell>

                              {/* Coluna fixa à direita - Ações */}
                              <TableCell className="sticky right-0 bg-card z-10 border-l border-border/50 text-center">
                                {(canUpdateStatus || canUpdateObs || canUpdateBoth) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(row)}>
                                          <Edit className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="z-50">Editar</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </TableCell>
                            </TableRow>

                            {/* Linha expandida com todos os detalhes */}
                            {isExpanded && (
                              <TableRow key={`${row.id}-expanded`} className="bg-muted/30">
                                <TableCell colSpan={visibleFields.length + 5} className="p-4">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {visibleFields.map((field) => {
                                      const cellValue = row[field.name];
                                      const rawValue =
                                        field.type === 'single_select' &&
                                        cellValue &&
                                        typeof cellValue === 'object' &&
                                        'value' in cellValue
                                          ? cellValue.value
                                          : cellValue;
                                      const isMaskedField = maskedFieldsConfig.includes(field.name);
                                      const displayValue =
                                        isMaskedField && !canViewUnmasked
                                          ? maskValue(rawValue?.toString(), field.name)
                                          : rawValue;

                                      return (
                                        <div key={field.id} className="space-y-1">
                                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                            {field.name}
                                          </p>
                                          <p className={`text-sm break-words ${isMaskedField && !canViewUnmasked ? 'blur-[3px] select-none' : ''}`}>
                                            {field.type === 'single_select' ? (
                                              <Badge variant="secondary">{displayValue || '-'}</Badge>
                                            ) : field.type === 'boolean' ? (
                                              rawValue ? 'Sim' : 'Não'
                                            ) : field.type === 'date' ? (
                                              formatBaserowDate(rawValue, field.name)
                                            ) : (
                                              formatBaserowDate(displayValue || rawValue, field.name)
                                            )}
                                          </p>
                                        </div>
                                      );
                                    })}
                                    
                                    {/* Tipo (IN/EX) na seção expandida */}
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                        Tipo
                                      </p>
                                      <p className="text-sm">
                                        {(() => {
                                          const tipo = getNumeroTipo(row);
                                          return (
                                            <Badge 
                                              variant={tipo === 'IN' ? 'default' : 'secondary'}
                                              className={tipo === 'IN' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                                            >
                                              {tipo === 'IN' ? 'Interno' : 'Externo'}
                                            </Badge>
                                          );
                                        })()}
                                      </p>
                                    </div>
                                    
                                    {/* Último Status Ativo na seção expandida */}
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                        <History className="h-3 w-3" />
                                        Último Status
                                      </p>
                                      <p className="text-sm">
                                        {(() => {
                                          const resolved = resolveLastStatus(row);
                                          if (resolved === undefined) {
                                            return <span className="text-muted-foreground animate-pulse">Carregando...</span>;
                                          }
                                          if (resolved) {
                                            return <Badge variant="outline">{resolved}</Badge>;
                                          }
                                          return <span className="text-muted-foreground">Sem histórico</span>;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {queryResult?.pagination && queryResult.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {queryResult.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(queryResult.pagination.totalPages, p + 1))}
                        disabled={currentPage === queryResult.pagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {canViewHistory && (
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/consulta-numeros/historico'}>
              <CardContent className="flex items-center gap-3 p-4">
                <History className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="font-medium">Histórico</p>
                  <p className="text-sm text-muted-foreground">Ver auditoria</p>
                </div>
              </CardContent>
            </Card>
          )}
          {canManageApi && (
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/consulta-numeros/api'}>
              <CardContent className="flex items-center gap-3 p-4">
                <Key className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="font-medium">API Keys</p>
                  <p className="text-sm text-muted-foreground">Gerenciar chaves</p>
                </div>
              </CardContent>
            </Card>
          )}
          {canManageWebhooks && (
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/consulta-numeros/webhooks'}>
              <CardContent className="flex items-center gap-3 p-4">
                <Webhook className="h-8 w-8 text-cyan-500" />
                <div>
                  <p className="font-medium">Webhooks</p>
                  <p className="text-sm text-muted-foreground">Configurar hooks</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => window.location.href = '/admin/consulta-numeros/guia'}>
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-green-500" />
              <div>
                <p className="font-medium">Guia</p>
                <p className="text-sm text-muted-foreground">Documentação</p>
              </div>
            </CardContent>
          </Card>
        </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>

      <Dialog open={!!quickViewRow} onOpenChange={(open) => !open && setQuickViewRow(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Visualização Rápida
            </DialogTitle>
            <DialogDescription>
              Detalhes do registro #{quickViewRow?.id}
            </DialogDescription>
          </DialogHeader>
          {quickViewRow && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {visibleFields.map((field) => {
                const cellValue = quickViewRow[field.name];
                const rawValue =
                  field.type === 'single_select' &&
                  cellValue &&
                  typeof cellValue === 'object' &&
                  'value' in cellValue
                    ? cellValue.value
                    : cellValue;
                const isMaskedField = maskedFieldsConfig.includes(field.name);
                const displayValue =
                  isMaskedField && !canViewUnmasked
                    ? maskValue(rawValue?.toString(), field.name)
                    : rawValue;

                return (
                  <div key={field.id} className="space-y-1 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {field.name}
                    </p>
                    <p className={`text-sm break-words ${isMaskedField && !canViewUnmasked ? 'blur-[3px] select-none' : ''}`}>
                      {field.type === 'single_select' ? (
                        <Badge variant="secondary">{displayValue || '-'}</Badge>
                      ) : field.type === 'boolean' ? (
                        rawValue ? 'Sim' : 'Não'
                      ) : field.type === 'date' ? (
                        formatBaserowDate(rawValue, field.name)
                      ) : (
                        formatBaserowDate(displayValue || rawValue, field.name)
                      )}
                    </p>
                  </div>
                );
              })}
              
              {/* Último Status Ativo */}
              <div className="space-y-1 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Último Status Ativo
                </p>
                <p className="text-sm">
                  {(() => {
                    const resolved = resolveLastStatus(quickViewRow);
                    if (resolved === undefined) {
                      return <span className="text-muted-foreground animate-pulse">Carregando...</span>;
                    }
                    if (resolved) {
                      return (
                        <Badge variant="outline" className="border-primary/50">
                          {resolved}
                        </Badge>
                      );
                    }
                    return <span className="text-muted-foreground">Sem histórico de alterações</span>;
                  })()}
                </p>
              </div>

              {/* Status do Seguro de Números Aquecidos */}
              {(() => {
                const insData = insurancePayStatusMap?.get(quickViewRow.id);
                const isPago = insData?.status === 'pago';
                const isVencido = insData?.status === 'vencido';
                const semSeguro = !insData;

                const containerClasses = semSeguro
                  ? 'bg-muted/40 border-border'
                  : isPago
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-destructive/10 border-destructive/30';

                return (
                  <div className={`space-y-2 p-3 rounded-lg border ${containerClasses} sm:col-span-2`}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Seguro de Números Aquecidos
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {semSeguro ? (
                        <Badge variant="outline" className="gap-1 opacity-70">
                          <ShieldOff className="h-3 w-3" /> Sem Seguro
                        </Badge>
                      ) : isPago ? (
                        <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">
                          <ShieldCheck className="h-3 w-3" /> Em Dia
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <ShieldAlert className="h-3 w-3" /> Vencido / Não pago
                        </Badge>
                      )}
                      {insData && (
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                          {insData.method === 'manual' ? '✍️ Marcação Manual' : '🤖 Detecção Automática'}
                        </span>
                      )}
                    </div>

                    {insData?.clientNames && insData.clientNames.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Vínculo: <span className="text-foreground">{insData.clientNames.join(' + ')}</span>
                      </p>
                    )}

                    {insData?.links && insData.links.length > 0 && (
                      <div className="mt-2 border rounded-md overflow-hidden bg-background/60">
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted/50 border-b">
                          Vínculos ({insData.links.length})
                        </div>
                        <div className="max-h-[160px] overflow-y-auto divide-y">
                          {insData.links.map((link) => (
                            <div key={link.id} className="px-2 py-1.5 flex items-center justify-between gap-2 text-[11px]">
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{link.nome}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{link.produto || '—'}</span>
                              </div>
                              <Badge
                                variant={link.isPaid ? 'default' : 'destructive'}
                                className={`text-[9px] h-4 px-1.5 shrink-0 ${link.isPaid ? 'bg-emerald-600 hover:bg-emerald-700 border-transparent' : ''}`}
                              >
                                {link.isPaid && <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />}
                                {link.data_renovacao
                                  ? new Date(link.data_renovacao).toLocaleDateString('pt-BR')
                                  : '—'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <DialogFooter className="mt-4">
            {(canUpdateStatus || canUpdateObs || canUpdateBoth) && quickViewRow && (
              <Button variant="outline" onClick={() => { setQuickViewRow(null); handleEdit(quickViewRow); }}>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            <Button onClick={() => setQuickViewRow(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
            <DialogDescription>
              Edite os campos abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Info Box: Último Status Ativo */}
            {selectedRow && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1 mb-1">
                  <History className="h-3 w-3" />
                  Último Status Ativo
                </p>
                <p className="text-sm">
                  {(() => {
                    const resolved = resolveLastStatus(selectedRow);
                    if (resolved === undefined) {
                      return <span className="text-muted-foreground animate-pulse">Carregando...</span>;
                    }
                    if (resolved) {
                      return <Badge variant="outline" className="border-primary/50">{resolved}</Badge>;
                    }
                    return <span className="text-muted-foreground">Sem histórico de alterações anteriores</span>;
                  })()}
                </p>
              </div>
            )}
            {visibleFields.map((field) => {
              // Ocultar campo data_da_ultima_consulta no modal de edição
              if (field.name.toLowerCase() === 'data_da_ultima_consulta') {
                return null;
              }
              
              const isNonEditable = nonEditableFields.has(field.name.toLowerCase());
              const isMaskedField = maskedFieldsConfig.includes(field.name);
              const isObservacoes = field.name.toLowerCase() === 'observacoes';
              
              // If field is masked and user cannot view unmasked, show as readonly
              const shouldMask = isMaskedField && !canViewUnmasked;

              return (
                <div key={field.id} className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {field.name}
                    {isMaskedField && <Badge variant="outline" className="text-xs">Mascarado</Badge>}
                  </Label>
                  
                  {/* For masked fields, show a non-copyable placeholder instead of the real value */}
                  {shouldMask ? (
                    <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed select-none">
                      <span className="blur-[4px] pointer-events-none">
                        {'••••••••••••••••'}
                      </span>
                    </div>
                  ) : field.type === 'single_select' && field.select_options ? (
                    <Select
                      value={editValues[field.name] || '__empty__'}
                      onValueChange={(val) => !isNonEditable && setEditValues(prev => ({ ...prev, [field.name]: val === '__empty__' ? '' : val }))}
                      disabled={isNonEditable}
                    >
                      <SelectTrigger disabled={isNonEditable}>
                        <SelectValue placeholder={`Selecione ${field.name}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__empty__">
                          <span className="text-muted-foreground">Nenhum</span>
                        </SelectItem>
                        {field.select_options.map((opt) => (
                          <SelectItem key={opt.id} value={opt.value}>{opt.value}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'long_text' || isObservacoes ? (
                    <div className="space-y-3">
                      {isObservacoes && editValues[field.name] && (
                        <div className="border rounded-md p-3 bg-muted/30 max-h-32 overflow-y-auto">
                          <p className="text-xs text-muted-foreground mb-1">Observações anteriores:</p>
                          <pre className="text-sm whitespace-pre-wrap font-sans">{editValues[field.name]}</pre>
                        </div>
                      )}
                      
                      {/* Tag selection for observacoes */}
                      {isObservacoes && obsTags.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            Selecione tags rápidas:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {obsTags.map((tag) => {
                              const isSelected = selectedObsTags.includes(tag.nome);
                              return (
                                <Badge
                                  key={tag.id}
                                  variant={isSelected ? "default" : "outline"}
                                  className="cursor-pointer transition-all hover:scale-105"
                                  style={{
                                    backgroundColor: isSelected ? tag.cor : 'transparent',
                                    borderColor: tag.cor,
                                    color: isSelected ? '#fff' : tag.cor,
                                  }}
                                  onClick={() => isSelected ? handleRemoveObsTag(tag.nome) : handleAddObsTag(tag.nome)}
                                >
                                  {tag.nome}
                                  {isSelected && <X className="h-3 w-3 ml-1" />}
                                </Badge>
                              );
                            })}
                          </div>
                          
                          {/* Selected tags preview */}
                          {selectedObsTags.length > 0 && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>Tags selecionadas:</span>
                              <span className="font-medium text-foreground">{selectedObsTags.join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Presets configuráveis — só aparecem para números do tipo IN */}
                      {isObservacoes && selectedRow && getNumeroTipo(selectedRow) === 'IN' && obsPresets.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {obsPresets.map((preset) => (
                            <Button
                              key={preset.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isNonEditable}
                              onClick={() => {
                                setNewObservacao(preset.texto_observacao);
                                if (preset.status_padrao) {
                                  setEditValues(prev => ({ ...prev, excluido_da_base: preset.status_padrao! }));
                                  toast({ title: 'Preset aplicado', description: `Status marcado como ${preset.status_padrao}` });
                                } else {
                                  toast({ title: 'Preset aplicado', description: preset.label });
                                }
                              }}
                              className="gap-1"
                            >
                              <Tag className="h-3 w-3" />
                              {preset.label}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      
                      <Textarea
                        value={isObservacoes ? newObservacao : (editValues[field.name] || '')}
                        onChange={(e) => {
                          if (!isNonEditable) {
                            if (isObservacoes) {
                              setNewObservacao(e.target.value);
                            } else {
                              setEditValues(prev => ({ ...prev, [field.name]: e.target.value }));
                            }
                          }
                        }}
                        placeholder={isObservacoes ? 'Adicione uma nova observação (opcional)...' : (isNonEditable ? '' : `Digite ${field.name}...`)}
                        rows={isObservacoes ? 2 : 3}
                        disabled={isNonEditable}
                        readOnly={isNonEditable}
                      />
                    </div>
                  ) : field.type === 'boolean' ? (
                    <Select
                      value={editValues[field.name] || ''}
                      onValueChange={(val) => !isNonEditable && setEditValues(prev => ({ ...prev, [field.name]: val }))}
                      disabled={isNonEditable}
                    >
                      <SelectTrigger disabled={isNonEditable}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Sim</SelectItem>
                        <SelectItem value="false">Não</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={editValues[field.name] || ''}
                      onChange={(e) => !isNonEditable && setEditValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={isNonEditable ? '' : `Digite ${field.name}...`}
                      disabled={isNonEditable}
                      readOnly={isNonEditable}
                    />
                  )}
                </div>
              );
            })}
            
            {/* Desbanimento OK - Upload de Imagem */}
            {isDesbanimentoOK && (
              <div className="space-y-3 p-4 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5">
                <Label className="flex items-center gap-2 text-primary font-medium">
                  <Mail className="h-4 w-4" />
                  Enviar Email de Desbanimento
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ao salvar com status "Desbanimento OK", um email será enviado para o cliente com a imagem anexada.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="desbanimento-image">Imagem do Desbanimento</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="desbanimento-image"
                      type="file"
                      accept="image/*"
                      onChange={handleDesbanimentoImageChange}
                      className="cursor-pointer"
                    />
                  </div>
                </div>
                
                {desbanimentoImagePreview && (
                  <div className="relative">
                    <img 
                      src={desbanimentoImagePreview} 
                      alt="Preview" 
                      className="max-h-48 rounded-lg border object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => {
                        setDesbanimentoImage(null);
                        setDesbanimentoImagePreview(null);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {!desbanimentoImage && (
                  <p className="text-sm text-destructive font-medium">
                    ⚠️ OBRIGATÓRIO: Anexe uma imagem para continuar com o desbanimento
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              disabled={updateMutation.isPending || sendingEmail}
            >
              {sendingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando email...
                </>
              ) : updateMutation.isPending ? (
                'Salvando...'
              ) : isDesbanimentoOK && desbanimentoImage ? (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Salvar e Enviar Email
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Type Selection Dialog */}
      <Dialog open={createTypeDialogOpen} onOpenChange={setCreateTypeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tipo de Cadastro</DialogTitle>
            <DialogDescription>
              Selecione o tipo de número que deseja cadastrar
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-primary/10 hover:border-primary"
              onClick={() => handleSelectCreateType('interno')}
            >
              <span className="text-2xl">📱</span>
              <span className="font-semibold">Número Interno</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col gap-2 hover:bg-primary/10 hover:border-primary"
              onClick={() => handleSelectCreateType('externo')}
            >
              <span className="text-2xl">🌐</span>
              <span className="font-semibold">Número Externo</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) resetCreateForm(); setCreateDialogOpen(open); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Cadastrar {createType === 'interno' ? 'Número Interno' : 'Número Externo'}
            </DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {visibleFields
              .filter((field) => !hiddenCreateFields.has(field.name.toLowerCase()))
              .map((field) => {
                const isNumeroField = field.name.toLowerCase().includes('numero');
                const isEmailField = field.name.toLowerCase() === 'email';
                const isDataCadastro = field.name.toLowerCase() === 'data_cadastro';
                const isObservacoes = field.name.toLowerCase() === 'observacoes';

                // Para o campo observações, tratamento especial baseado no tipo
                if (isObservacoes) {
                  if (createType === 'externo') {
                    // Número externo: mostra "Numero Externo" como readonly
                    return (
                      <div key={field.id} className="space-y-2">
                        <Label>{field.name}</Label>
                        <Input
                          value="Numero Externo"
                          readOnly
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    );
                  } else if (createType === 'interno') {
                    // Número interno: mostra opções de seguro obrigatórias
                    return (
                      <div key={field.id} className="space-y-2">
                        <Label className="flex items-center gap-1">
                          {field.name} <span className="text-destructive">*</span>
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant={selectedSeguro === '🚫 SEM SEGURO' ? 'default' : 'outline'}
                            className={`h-16 flex flex-col gap-1 ${selectedSeguro === '🚫 SEM SEGURO' ? 'ring-2 ring-destructive' : ''}`}
                            onClick={() => setSelectedSeguro('🚫 SEM SEGURO')}
                          >
                            <span className="text-xl">🚫</span>
                            <span className="text-sm font-medium">SEM SEGURO</span>
                          </Button>
                          <Button
                            type="button"
                            variant={selectedSeguro === '✅ COM SEGURO' ? 'default' : 'outline'}
                            className={`h-16 flex flex-col gap-1 ${selectedSeguro === '✅ COM SEGURO' ? 'ring-2 ring-green-500' : ''}`}
                            onClick={() => setSelectedSeguro('✅ COM SEGURO')}
                          >
                            <span className="text-xl">✅</span>
                            <span className="text-sm font-medium">COM SEGURO</span>
                          </Button>
                        </div>
                        {!selectedSeguro && (
                          <p className="text-xs text-muted-foreground">
                            Selecione uma opção acima (obrigatório)
                          </p>
                        )}
                      </div>
                    );
                  }
                }

                return (
                  <div key={field.id} className="space-y-2">
                    <Label>{field.name} {field.primary && '*'}</Label>
                    {field.type === 'single_select' && field.select_options ? (
                      <Select 
                        value={newValues[field.name] || ''} 
                        onValueChange={(val) => setNewValues(prev => ({ ...prev, [field.name]: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Selecione ${field.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {field.select_options.map((opt) => (
                            <SelectItem key={opt.id} value={opt.value}>{opt.value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : field.type === 'long_text' ? (
                      <Textarea
                        value={newValues[field.name] || ''}
                        onChange={(e) => setNewValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={`Digite ${field.name}...`}
                        rows={3}
                      />
                    ) : field.type === 'boolean' ? (
                      <Select 
                        value={newValues[field.name] || ''} 
                        onValueChange={(val) => setNewValues(prev => ({ ...prev, [field.name]: val }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Sim</SelectItem>
                          <SelectItem value="false">Não</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : isDataCadastro ? (
                      <Input
                        value={newValues[field.name] || ''}
                        readOnly
                        disabled
                        className="bg-muted"
                      />
                    ) : isNumeroField ? (
                      <Input
                        value={newValues[field.name] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (isValidNumber(val)) {
                            setNewValues(prev => ({ ...prev, [field.name]: val }));
                          }
                        }}
                        placeholder="Digite apenas números..."
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    ) : isEmailField ? (
                      <Input
                        type="email"
                        value={newValues[field.name] || ''}
                        onChange={(e) => setNewValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder="Digite o e-mail..."
                      />
                    ) : (
                      <Input
                        value={newValues[field.name] || ''}
                        onChange={(e) => setNewValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={`Digite ${field.name}...`}
                      />
                    )}
                  </div>
                );
              })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetCreateForm(); setCreateDialogOpen(false); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal - Código do número cadastrado */}
      <Dialog open={successModalOpen} onOpenChange={setSuccessModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">✅ Número cadastrado com sucesso!</DialogTitle>
            <DialogDescription className="text-center pt-2">
              O número foi registrado no sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-muted rounded-lg p-4 w-full text-center space-y-2">
              <p className="text-sm text-muted-foreground">Número</p>
              <p className="text-lg font-semibold font-mono">{successModalData?.numero}</p>
            </div>
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 w-full text-center space-y-2">
              <p className="text-sm text-muted-foreground">ID do número</p>
              <p className="text-2xl font-bold font-mono text-primary">{successModalData?.rowId}</p>
            </div>
          </div>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => setSuccessModalOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
