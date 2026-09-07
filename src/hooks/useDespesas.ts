import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSystemActivities } from '@/hooks/useSystemActivities';

export interface DespesaCategoria {
  id: string;
  nome: string;
  cor: string | null;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Despesa {
  id: string;
  descricao: string;
  valor: number;
  moeda: string;
  categoria_id: string | null;
  data_vencimento: string;
  data_pagamento: string | null;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  tipo: 'fixa' | 'avulsa';
  recorrencia: 'mensal' | 'trimestral' | 'semestral' | 'anual' | null;
  observacao: string | null;
  comprovante_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  categoria?: DespesaCategoria | null;
}

export interface DespesaFormData {
  descricao: string;
  valor: number;
  moeda: string;
  categoria_id: string | null;
  data_vencimento: string;
  data_pagamento?: string | null;
  status?: string;
  tipo: 'fixa' | 'avulsa';
  recorrencia?: string | null;
  observacao?: string | null;
}

export interface DespesaStats {
  totalDespesasMes: number;
  totalDespesasMesUsd: number;
  despesasPagas: number;
  despesasPendentes: number;
  despesasAtrasadas: number;
}

export function useDespesas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { logActivity } = useSystemActivities();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [categorias, setCategorias] = useState<DespesaCategoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<DespesaStats>({
    totalDespesasMes: 0,
    totalDespesasMesUsd: 0,
    despesasPagas: 0,
    despesasPendentes: 0,
    despesasAtrasadas: 0,
  });

  const fetchCategorias = async () => {
    const { data, error } = await supabase
      .from('despesa_categorias')
      .select('*')
      .order('nome');
    
    if (error) {
      console.error('Error fetching categorias:', error);
      return;
    }
    
    setCategorias(data || []);
  };

  const fetchDespesas = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('despesas')
      .select('*, categoria:despesa_categorias(*)')
      .order('data_vencimento', { ascending: false });
    
    if (error) {
      console.error('Error fetching despesas:', error);
      setIsLoading(false);
      return;
    }
    
    // Update status for overdue expenses
    // Only mark as "atrasado" if the due date is strictly BEFORE yesterday
    // (i.e., more than 1 day past due) to give a small tolerance grace period.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updatedData = (data || []).map(d => {
      const status = d.status as Despesa['status'];
      if (status === 'pendente') {
        // Parse YYYY-MM-DD as local date (avoid UTC timezone shift)
        const [y, m, day] = (d.data_vencimento as string).split('-').map(Number);
        const vencimento = new Date(y, (m || 1) - 1, day || 1);
        vencimento.setHours(0, 0, 0, 0);
        // Diff in days: positive means past due
        const diffDays = Math.floor((today.getTime() - vencimento.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) {
          return { ...d, status: 'atrasado' as const } as Despesa;
        }
      }
      return d as Despesa;
    });
    
    setDespesas(updatedData);
    calculateStats(updatedData);
    setIsLoading(false);
  };

  const calculateStats = (despesasList: Despesa[]) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Filter for current month (parse YYYY-MM-DD as local date to avoid UTC month shift)
    const despesasDoMes = despesasList.filter(d => {
      const [y, m] = (d.data_vencimento as string).split('-').map(Number);
      return (m || 0) - 1 === currentMonth && 
             (y || 0) === currentYear &&
             d.status !== 'cancelado';
    });

    const totalDespesasMes = despesasDoMes
      .filter(d => (d.moeda || 'BRL') === 'BRL')
      .reduce((acc, d) => acc + (d.valor || 0), 0);

    const totalDespesasMesUsd = despesasDoMes
      .filter(d => d.moeda === 'USD')
      .reduce((acc, d) => acc + (d.valor || 0), 0);

    const despesasPagas = despesasDoMes.filter(d => d.status === 'pago').length;
    const despesasPendentes = despesasDoMes.filter(d => d.status === 'pendente').length;
    const despesasAtrasadas = despesasDoMes.filter(d => d.status === 'atrasado').length;

    setStats({
      totalDespesasMes,
      totalDespesasMesUsd,
      despesasPagas,
      despesasPendentes,
      despesasAtrasadas,
    });
  };

  const createDespesa = async (data: DespesaFormData): Promise<boolean> => {
    const { error } = await supabase
      .from('despesas')
      .insert({
        ...data,
        created_by: user?.id,
      });
    
    if (error) {
      console.error('Error creating despesa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a despesa.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Despesa criada com sucesso!',
    });
    
    logActivity(`Criou nova despesa: ${data.descricao}`, 'despesa', `Valor: ${data.valor} ${data.moeda}`);
    
    await fetchDespesas();
    return true;
  };

  const updateDespesa = async (id: string, data: Partial<DespesaFormData>): Promise<boolean> => {
    const { error } = await supabase
      .from('despesas')
      .update(data)
      .eq('id', id);
    
    if (error) {
      console.error('Error updating despesa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a despesa.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Despesa atualizada com sucesso!',
    });
    
    if (data.descricao) {
      logActivity(`Atualizou despesa: ${data.descricao}`, 'despesa');
    }
    
    await fetchDespesas();
    return true;
  };

  const deleteDespesa = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('despesas')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting despesa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a despesa.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Despesa excluída com sucesso!',
    });
    
    logActivity(`Excluiu uma despesa`, 'despesa');
    
    await fetchDespesas();
    return true;
  };

  const markAsPaid = async (id: string): Promise<boolean> => {
    return updateDespesa(id, { 
      status: 'pago', 
      data_pagamento: new Date().toISOString().split('T')[0] 
    });
  };

  const createCategoria = async (nome: string, cor?: string, descricao?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('despesa_categorias')
      .insert({ nome, cor, descricao });
    
    if (error) {
      console.error('Error creating categoria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a categoria.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Categoria criada com sucesso!',
    });
    
    logActivity(`Criou categoria de despesa: ${nome}`, 'config');
    
    await fetchCategorias();
    return true;
  };

  const updateCategoria = async (id: string, nome: string, cor?: string, descricao?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('despesa_categorias')
      .update({ nome, cor, descricao })
      .eq('id', id);
    
    if (error) {
      console.error('Error updating categoria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar a categoria.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Categoria atualizada com sucesso!',
    });
    
    await fetchCategorias();
    return true;
  };

  const deleteCategoria = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('despesa_categorias')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting categoria:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a categoria.',
        variant: 'destructive',
      });
      return false;
    }
    
    toast({
      title: 'Sucesso',
      description: 'Categoria excluída com sucesso!',
    });
    
    await fetchCategorias();
    return true;
  };

  // Generate recurring expenses for a month
  // Rules:
  // - Use only ONE template per recurring "group" (e.g., "Água") to avoid duplicates
  // - Skip generation when an expense with the same group key already exists in target month
  // - Keep day-of-month from the chosen template (clamped to last day of month)
  const generateRecurringExpenses = async (targetMonth: Date): Promise<boolean> => {
    const fixedExpenses = despesas.filter((d) => d.tipo === 'fixa' && d.status !== 'cancelado');

    if (fixedExpenses.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Não há despesas fixas para gerar.',
      });
      return false;
    }

    const targetYear = targetMonth.getFullYear();
    const targetMonthNum = targetMonth.getMonth();

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

    const getRecurringKey = (d: Despesa) =>
      [normalize(d.descricao), d.categoria_id ?? 'no-category', d.moeda ?? 'BRL', d.recorrencia ?? 'mensal'].join('::');

    // Build one template per key (pick the most recent by due date)
    const templatesByKey = new Map<string, Despesa>();
    for (const d of fixedExpenses) {
      const key = getRecurringKey(d);
      const existing = templatesByKey.get(key);
      if (!existing) {
        templatesByKey.set(key, d);
        continue;
      }
      const existingDate = new Date(existing.data_vencimento).getTime();
      const currentDate = new Date(d.data_vencimento).getTime();
      if (currentDate > existingDate) templatesByKey.set(key, d);
    }

    // Existing expenses in the target month (used to prevent duplicates)
    const existingKeysInTargetMonth = new Set<string>();
    for (const d of despesas) {
      const venc = new Date(d.data_vencimento);
      if (venc.getMonth() === targetMonthNum && venc.getFullYear() === targetYear && d.status !== 'cancelado') {
        existingKeysInTargetMonth.add(getRecurringKey(d));
      }
    }

    const lastDayOfTargetMonth = new Date(targetYear, targetMonthNum + 1, 0).getDate();

    const templates = Array.from(templatesByKey.values());
    const toCreate = templates
      .filter((tpl) => !existingKeysInTargetMonth.has(getRecurringKey(tpl)))
      .map((tpl) => {
        const originalDate = new Date(tpl.data_vencimento);
        const day = Math.min(originalDate.getDate(), lastDayOfTargetMonth);
        const newDate = new Date(targetYear, targetMonthNum, day);

        return {
          descricao: tpl.descricao,
          valor: tpl.valor,
          moeda: tpl.moeda,
          categoria_id: tpl.categoria_id,
          data_vencimento: newDate.toISOString().split('T')[0],
          status: 'pendente',
          tipo: 'fixa' as const,
          recorrencia: tpl.recorrencia,
          observacao: tpl.observacao,
          created_by: user?.id,
        };
      });

    if (toCreate.length === 0) {
      toast({
        title: 'Aviso',
        description: 'Nada para gerar: as recorrentes deste mês já existem.',
      });
      return false;
    }

    const { error } = await supabase.from('despesas').insert(toCreate);

    if (error) {
      console.error('Error generating recurring expenses:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar as despesas recorrentes.',
        variant: 'destructive',
      });
      return false;
    }

    const skipped = templates.length - toCreate.length;

    toast({
      title: 'Sucesso',
      description:
        skipped > 0
          ? `${toCreate.length} despesas geradas (e ${skipped} já existiam no mês).`
          : `${toCreate.length} despesas geradas para o mês selecionado.`,
    });

    await fetchDespesas();
    return true;
  };

  useEffect(() => {
    if (user) {
      fetchCategorias();
      fetchDespesas();
    }
  }, [user]);

  return {
    despesas,
    categorias,
    isLoading,
    stats,
    fetchDespesas,
    fetchCategorias,
    createDespesa,
    updateDespesa,
    deleteDespesa,
    markAsPaid,
    createCategoria,
    updateCategoria,
    deleteCategoria,
    generateRecurringExpenses,
  };
}
