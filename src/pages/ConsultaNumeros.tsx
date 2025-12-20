import { useState, useMemo, useEffect } from 'react';
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
import { Search, Edit, History, Download, Settings, Key, Webhook, BookOpen, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, AlertCircle, Plus, Loader2, X, Tag, Upload, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';

interface NumeroResult {
  id: number;
  [key: string]: any;
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
  const [createType, setCreateType] = useState<'interno' | 'externo' | null>(null);
  const [selectedSeguro, setSelectedSeguro] = useState<string>('');
  const [newValues, setNewValues] = useState<Record<string, string>>({});

  // Fields that should not be editable in Edit dialog
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
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  // Validation helpers
  const isValidNumber = (value: string) => /^\d*$/.test(value);
  const isValidEmail = (value: string) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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

  // Fetch Baserow fields - this determines which columns to show
  const { data: baserowFields = [], isLoading: loadingFields, error: fieldsError } = useQuery<BaserowField[]>({
    queryKey: ['consulta-numeros-campos'],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('Sessão inválida');
      }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/campos`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      if (res.status === 401) {
        await supabase.auth.signOut();
        throw new Error('Sessão expirada');
      }
      if (!res.ok) {
        throw new Error('Erro ao carregar campos');
      }
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao carregar campos');
      return json.data || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  // Determine visible columns from fields (exclude internal fields)
  const visibleFields = useMemo(() => {
    return baserowFields
      .filter(f => !['id', 'order'].includes(f.name.toLowerCase()))
      .sort((a, b) => a.order - b.order);
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

  // When changing status filters, reset pagination (query reruns automatically)
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilters]);

  // Query numbers
  const { data: queryResult, isLoading, refetch, error: queryError } = useQuery({
    queryKey: ['consulta-numeros', appliedSearchQuery, statusFilters, currentPage, pageSize],
    queryFn: async () => {
      if (!canQuery) return { data: [], pagination: { count: 0, page: 1, pageSize, totalPages: 0 } };

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        size: pageSize.toString(),
      });

      if (appliedSearchQuery) params.append('q', appliedSearchQuery);
      if (statusFilters.length > 0) params.append('status', statusFilters.join(','));

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/consultar?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
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
    enabled: canQuery && visibleFields.length > 0, // Only query when fields are loaded
    retry: 2,
    retryDelay: 1000,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Check if error is configuration-related
  const isConfigError = queryError?.message?.includes('Baserow') || queryError?.message?.includes('Configuração') || fieldsError?.message?.includes('Baserow');
  const isFieldsLoading = loadingFields && !fieldsError;

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
      toast({ title: 'Atualizado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
      setEditDialogOpen(false);
      setSelectedRow(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
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
        throw new Error('Sessão expirada. Faça login novamente.');
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
    onSuccess: () => {
      toast({ title: 'Número cadastrado com sucesso!' });
      queryClient.invalidateQueries({ queryKey: ['consulta-numeros'] });
      setCreateDialogOpen(false);
      resetCreateForm();
    },
    onError: (error: Error & { duplicate?: boolean }) => {
      if (error.duplicate) {
        toast({ 
          title: '⚠️ Número duplicado!', 
          description: error.message, 
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
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
      toast({ title: 'Número é obrigatório', variant: 'destructive' });
      return;
    }

    // Validate numero is only numbers
    if (!isValidNumber(numeroValue)) {
      toast({ title: 'Número deve conter apenas dígitos', variant: 'destructive' });
      return;
    }

    // Email é obrigatório
    const emailField = visibleFields.find(f => f.name.toLowerCase() === 'email');
    const emailValue = newValues[emailField?.name || 'email'];

    if (!emailValue?.trim()) {
      toast({ title: 'E-mail é obrigatório', variant: 'destructive' });
      return;
    }

    if (!isValidEmail(emailValue)) {
      toast({ title: 'E-mail inválido', variant: 'destructive' });
      return;
    }

    // Validação obrigatória de seguro para números internos
    if (createType === 'interno' && !selectedSeguro) {
      toast({ title: 'Selecione uma opção de seguro', description: 'É obrigatório escolher "SEM SEGURO" ou "COM SEGURO"', variant: 'destructive' });
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

    // If already on page 1 and query didn't change, force a refetch.
    if (currentPage === 1 && nextQuery === appliedSearchQuery) {
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
        toast({ title: 'Por favor, selecione uma imagem', variant: 'destructive' });
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast({ title: 'A imagem deve ter no máximo 10MB', variant: 'destructive' });
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
      toast({ title: 'Email do cliente não encontrado', variant: 'destructive' });
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
        toast({ title: 'Sessão expirada', variant: 'destructive' });
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
        toast({ title: 'Erro ao enviar email', description: result.error, variant: 'destructive' });
        return false;
      }
      
      toast({ title: 'Email enviado com sucesso!', description: `Enviado para ${email}` });
      return true;
      
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({ title: 'Erro ao enviar email', description: error.message, variant: 'destructive' });
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
      } else if (statusChanged) {
        // User did NOT add observation but changed the status
        // Auto-generate observation with: Tipo - Status - Data/Hora
        const timestamp = new Date().toLocaleString('pt-BR');
        const separator = editValues[obsField.name] ? '\n---\n' : '';
        
        // Build auto-observation: "Tipo - Status Atualizado - Data/Hora"
        const autoParts: string[] = [];
        if (tipoValue) {
          autoParts.push(tipoValue);
        }
        autoParts.push(newStatus);
        autoParts.push(timestamp);
        
        finalValues[obsField.name] = `${editValues[obsField.name] || ''}${separator}${autoParts.join(' - ')}`;
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
            
            return `"${(displayVal || '').toString().replace(/"/g, '""')}"`;
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
    
    toast({ title: 'Exportação concluída!' });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Consulta de Números</h1>
            <p className="text-muted-foreground">Consulte e gerencie números no Baserow</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canCreate && (
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Número
              </Button>
            )}
            {canViewHistory && (
              <Button variant="outline" onClick={() => window.location.href = '/admin/consulta-numeros/historico'}>
                <History className="h-4 w-4 mr-2" />
                Histórico
              </Button>
            )}
            {canManageConfig && (
              <Button variant="outline" onClick={() => window.location.href = '/admin/consulta-numeros/config'}>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            )}
          </div>
        </div>

        {/* Search Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Número
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Digite o número para buscar..."
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
                        ? "Todos os status" 
                        : statusFilters.length === 1
                          ? statusField?.select_options?.find(s => s.id.toString() === statusFilters[0])?.value || "1 status"
                          : `${statusFilters.length} status selecionados`
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
                        Limpar filtros
                      </Button>
                      <div className="border-t pt-2 space-y-1">
                        {statusField?.select_options?.map((s) => (
                          <label 
                            key={s.id} 
                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          >
                            <Checkbox
                              checked={statusFilters.includes(s.id.toString())}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setStatusFilters([...statusFilters, s.id.toString()]);
                                } else {
                                  setStatusFilters(statusFilters.filter(id => id !== s.id.toString()));
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
                Buscar
              </Button>
              {canExport && queryResult?.data?.length > 0 && (
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
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
            {isConfigError ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Configuração Necessária</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  O Baserow ainda não está configurado. Configure a conexão com o Baserow para começar a consultar números.
                </p>
                {canManageConfig && (
                  <Button onClick={() => window.location.href = '/admin/consulta-numeros/config'}>
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
                  Não foi possível carregar os campos do Baserow. Verifique a configuração.
                </p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar novamente
                </Button>
              </div>
            ) : queryResult?.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum número encontrado. Faça uma busca para ver resultados.
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[70px]">Linha</TableHead>
                        {visibleFields.map((field) => (
                          <TableHead key={field.id}>{field.name}</TableHead>
                        ))}
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queryResult?.data?.map((row: NumeroResult) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-mono text-muted-foreground">{row.id}</TableCell>
                          {visibleFields.map((field) => {
                            const cellValue = row[field.name];
                            // Handle single_select fields which come as {id, value, color} objects
                            const rawValue =
                              field.type === 'single_select' &&
                              cellValue &&
                              typeof cellValue === 'object' &&
                              'value' in cellValue
                                ? cellValue.value
                                : cellValue;

                            // Check if this field should be masked
                            const isMaskedField = maskedFieldsConfig.includes(field.name);
                            const displayValue =
                              isMaskedField && !canViewUnmasked
                                ? maskValue(rawValue?.toString(), field.name)
                                : rawValue;

                            const isObservacoes = field.name.toLowerCase() === 'observacoes';
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
                                {field.type === 'single_select' ? (
                                  <Badge variant="secondary">{displayValue || '-'}</Badge>
                                ) : field.type === 'boolean' ? (
                                  rawValue ? 'Sim' : 'Não'
                                ) : field.type === 'date' ? (
                                  rawValue ? new Date(rawValue).toLocaleDateString('pt-BR') : '-'
                                ) : showTooltip ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="cursor-help">{asText}</span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-[420px] whitespace-pre-wrap">
                                        {asText}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  displayValue?.toString() || '-'
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            {(canUpdateStatus || canUpdateObs || canUpdateBoth) && (
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(row)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
      </div>
      </div>

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
    </DashboardLayout>
  );
}
