import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrScanInsuranceUsage } from "./useQrScan";

export type InsurancePaymentStatus = "pago" | "vencido";

export interface InsurancePaymentStatusRow {
  id: string;
  baserow_row_id: number;
  ano: number;
  mes: number;
  status: InsurancePaymentStatus;
  observacao: string | null;
  marcado_por: string | null;
  marcado_em: string;
}

export function useInsurancePaymentStatus() {
  return useQuery({
    queryKey: ["qr-scan-insurance-payment-status"],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("qr_scan_insurance_payment_status")
        .select("*")
        .eq("ano", now.getFullYear())
        .eq("mes", now.getMonth() + 1);
      if (error) throw error;
      return (data ?? []) as InsurancePaymentStatusRow[];
    },
  });
}

export function useSetInsurancePaymentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      baserow_row_id: number;
      status: InsurancePaymentStatus;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date();
      const ano = now.getFullYear();
      const mes = now.getMonth() + 1;
      const { data, error } = await supabase
        .from("qr_scan_insurance_payment_status")
        .upsert(
          {
            baserow_row_id: payload.baserow_row_id,
            ano,
            mes,
            status: payload.status,
            observacao: payload.observacao ?? null,
            marcado_por: user?.id ?? null,
            marcado_em: new Date().toISOString(),
          },
          { onConflict: "baserow_row_id,ano,mes" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as InsurancePaymentStatusRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-insurance-payment-status"] });
    },
  });
}

/**
 * Hook que implementa a lógica híbrida:
 * 1. Pega marcações manuais do mês corrente
 * 2. Busca clientes que possuem "Seguro" no produto ou observação
 * 3. Extrai números da observação desses clientes
 * 4. Define o status como 'pago' se o cliente estiver em dia (data_renovacao >= hoje)
 * 5. Marcações manuais sempre prevalecem sobre a detecção automática
 */
export function useInsurancePaymentStatusHybrid() {
  const { data: manualStatus = [] } = useInsurancePaymentStatus();
  
  return useQuery({
    queryKey: ["qr-scan-insurance-payment-status-hybrid", manualStatus],
    queryFn: async () => {
      // 1. Criar mapa de status manuais
      const statusMap = new Map<number, { status: InsurancePaymentStatus; clientName?: string; method: 'manual' | 'auto' }>();
      manualStatus.forEach(row => {
        statusMap.set(row.baserow_row_id, {
          status: row.status,
          method: 'manual'
        });
      });

      // 2. Buscar clientes com Seguro
      const { data: clientes, error: clientError } = await supabase
        .from("clientes")
        .select("id, nome, numero, produto, observacao, data_renovacao")
        .or("produto.ilike.%seguro%,observacao.ilike.%seguro%");
      
      if (clientError) throw clientError;

      // 3. Buscar cache de números para vincular baserow_row_id
      const { data: numbersCache, error: cacheError } = await supabase
        .from("consulta_numeros_cache")
        .select("baserow_row_id, row_data");
      
      if (cacheError) throw cacheError;

      const today = new Date().toISOString().split('T')[0];

      // Função para extrair números puros de uma string
      const extractNumbers = (text: string | null) => {
        if (!text) return [];
        // Busca sequências que parecem números (pelo menos 10 dígitos, permitindo separadores comuns)
        const regex = /(?:\d[ \-\(\)\.]*){10,14}/g;
        const matches = text.match(regex);
        if (!matches) return [];
        
        return matches
          .map(m => m.replace(/\D/g, ''))
          .filter(digits => digits.length >= 10 && digits.length <= 14);
      };

      const normalize = (num: string) => {
        let n = num.replace(/\D/g, '');
        // Se tem 55 e é um número longo (mais que 10 dígitos), remove o 55
        if (n.startsWith('55') && n.length > 10) {
          n = n.substring(2);
        }
        return n;
      };

      // Processar cada cliente para encontrar números vinculados
      clientes?.forEach(cliente => {
        const isClientPaid = cliente.data_renovacao >= today;
        const status = isClientPaid ? 'pago' : 'vencido';

        // Números na observação (um por linha geralmente)
        const numbersInObs = extractNumbers(cliente.observacao);
        // O próprio número principal do cliente também pode ter seguro
        const mainNumber = cliente.numero ? normalize(cliente.numero) : null;
        
        const allClientNumbers = new Set([
          ...numbersInObs.map(normalize),
          mainNumber
        ].filter(Boolean));

        allClientNumbers.forEach(num => {
          // Tentar encontrar esse número no cache para pegar o baserow_row_id
          const cacheEntry = numbersCache?.find(c => {
            const rawNum = (c.row_data as any)?.numero;
            if (!rawNum) return false;
            return normalize(rawNum) === num;
          });

          if (cacheEntry) {
            const rowId = cacheEntry.baserow_row_id;
            // Só aplica automático se não houver marcação manual
            if (!statusMap.has(rowId)) {
              statusMap.set(rowId, status);
            }
          }
        });
      });

      return statusMap;
    },
  });
}

export interface InsuranceNumber {
  baserow_row_id: number;
  numero: string;
  cliente_nome: string | null;
  observacoes: string | null;
  auto_hospedado: boolean;
}

export function useInsuranceNumbers() {
  return useQuery({
    queryKey: ["qr-scan-insurance-numbers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consulta_numeros_cache")
        .select("baserow_row_id, row_data, auto_hospedado")
        .or("row_data->>observacoes.ilike.%COM SEGURO%,row_data->>observacao.ilike.%COM SEGURO%")
        .limit(500);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        baserow_row_id: r.baserow_row_id,
        numero: r.row_data?.numero ?? "",
        cliente_nome: r.row_data?.nome ?? r.row_data?.cliente ?? null,
        observacoes: r.row_data?.observacoes ?? r.row_data?.observacao ?? null,
        auto_hospedado: !!r.auto_hospedado,
      })) as InsuranceNumber[];
    },
  });
}

export function useInsuranceHistory() {
  return useQuery({
    queryKey: ["qr-scan-insurance-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_scan_insurance_usage")
        .select("*")
        .order("used_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QrScanInsuranceUsage[];
    },
  });
}

export function useRegisterInsuranceUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      baserow_row_id: number;
      numero: string;
      cliente_nome?: string;
      observacao?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("qr_scan_insurance_usage")
        .insert({
          ...payload,
          operador_id: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as QrScanInsuranceUsage;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-insurance-history"] });
      qc.invalidateQueries({ queryKey: ["qr-scan-insurance-numbers"] });
    },
  });
}
