import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DuplicateField = 'cpf' | 'email' | 'numero';

export interface DuplicateMatch {
  id: string;
  nome: string;
  produto: string;
  data_renovacao: string;
  email: string | null;
  cpf: string | null;
  numero: string;
  matchedField: DuplicateField;
  matchedValue: string;
}

interface DuplicateState {
  cpf: DuplicateMatch[];
  email: DuplicateMatch[];
  numero: DuplicateMatch[];
}

const EMPTY: DuplicateState = { cpf: [], email: [], numero: [] };

const normalize = (v: string) => v.trim().toLowerCase();
const onlyDigits = (v: string) => v.replace(/\D/g, '');

export const useDuplicateCheck = () => {
  const [duplicates, setDuplicates] = useState<DuplicateState>(EMPTY);
  const [isChecking, setIsChecking] = useState(false);
  const debounceRef = useRef<Record<DuplicateField, ReturnType<typeof setTimeout> | null>>({
    cpf: null,
    email: null,
    numero: null,
  });

  const checkField = useCallback(async (field: DuplicateField, rawValue: string) => {
    const value = (rawValue ?? '').toString().trim();

    // Minimum thresholds to avoid noisy queries
    const minLen: Record<DuplicateField, number> = { cpf: 11, email: 5, numero: 8 };
    const cleaned = field === 'cpf' || field === 'numero' ? onlyDigits(value) : normalize(value);

    if (!cleaned || cleaned.length < minLen[field]) {
      setDuplicates((prev) => ({ ...prev, [field]: [] }));
      return;
    }

    setIsChecking(true);
    try {
      let query = supabase
        .from('clientes')
        .select('id, nome, produto, data_renovacao, email, cpf, numero')
        .limit(5);

      if (field === 'cpf') {
        query = query.eq('cpf', cleaned);
      } else if (field === 'email') {
        query = query.ilike('email', cleaned);
      } else if (field === 'numero') {
        // Match suffix to avoid country-code mismatches
        query = query.ilike('numero', `%${cleaned}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const matches: DuplicateMatch[] = (data || []).map((c: any) => ({
        id: c.id,
        nome: c.nome,
        produto: c.produto,
        data_renovacao: c.data_renovacao,
        email: c.email,
        cpf: c.cpf,
        numero: c.numero,
        matchedField: field,
        matchedValue: cleaned,
      }));

      setDuplicates((prev) => ({ ...prev, [field]: matches }));
    } catch (e) {
      console.error('Erro ao verificar duplicatas:', e);
      setDuplicates((prev) => ({ ...prev, [field]: [] }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  const debouncedCheck = useCallback((field: DuplicateField, value: string) => {
    if (debounceRef.current[field]) {
      clearTimeout(debounceRef.current[field]!);
    }
    debounceRef.current[field] = setTimeout(() => {
      checkField(field, value);
    }, 500);
  }, [checkField]);

  const reset = useCallback(() => {
    setDuplicates(EMPTY);
  }, []);

  const hasAnyDuplicate = duplicates.cpf.length > 0 || duplicates.email.length > 0 || duplicates.numero.length > 0;

  const allMatches = (): DuplicateMatch[] => {
    const seen = new Set<string>();
    const out: DuplicateMatch[] = [];
    [...duplicates.cpf, ...duplicates.email, ...duplicates.numero].forEach((m) => {
      const key = `${m.id}-${m.matchedField}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(m);
      }
    });
    return out;
  };

  return {
    duplicates,
    isChecking,
    hasAnyDuplicate,
    allMatches,
    checkField,
    debouncedCheck,
    reset,
  };
};
