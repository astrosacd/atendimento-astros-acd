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
 * Hook que implementa a lógica híbrida de Seguro e Hospedagem
 */
export function useInsurancePaymentStatusHybrid() {
  const { data: manualStatus = [] } = useInsurancePaymentStatus();
  
  return useQuery({
    queryKey: ["qr-scan-insurance-payment-status-hybrid", manualStatus],
    queryFn: async () => {
      const statusMap = new Map<number, { 
        status: InsurancePaymentStatus; 
        clientName?: string; 
        clientNames?: string[]; 
        method: 'manual' | 'auto';
        links?: { id: string; nome: string; produto: string | null; data_renovacao: string | null; isPaid: boolean }[];
      }>();

      const manualSet = new Map<number, InsurancePaymentStatus>();
      manualStatus.forEach(row => {
        manualSet.set(row.baserow_row_id, row.status);
      });

      // 1. Buscar clientes relevantes
      const { data: clientes, error: clientError } = await supabase
        .from("clientes")
        .select("id, nome, numero, produto, observacao, data_renovacao, plano")
        .or('produto.eq."Seguro de Numeros Aquecidos",produto.eq."Número Hospedado Conosco ( Auto-Hospedado )"');
      
      if (clientError) throw clientError;

      // 2. Buscar cache de números
      const { data: numbersCache, error: cacheError } = await supabase
        .from("consulta_numeros_cache")
        .select("baserow_row_id, row_data");
      
      if (cacheError) throw cacheError;

      const today = new Date().toISOString().split('T')[0];

      const normalize = (num: string | null | undefined) => {
        if (!num) return '';
        let n = String(num).replace(/\D/g, '');
        if (n.startsWith('55') && n.length > 11) n = n.substring(2);
        return n;
      };

      const extractNumbers = (text: string | null) => {
        if (!text) return [];
        const cleaned = text.replace(/[\s\-\(\)\.,;:\/]/g, ' ');
        const matches = cleaned.match(/\d{10,13}/g);
        return matches ? matches.map(normalize).filter(Boolean) : [];
      };

      const cacheByNumber = new Map<string, number>();
      numbersCache?.forEach(c => {
        const n = normalize((c.row_data as any)?.numero);
        if (n) cacheByNumber.set(n, c.baserow_row_id);
      });

      // 3. Processar cada contrato individualmente
      const linksByRow = new Map<number, { id: string; clientName: string; isPaid: boolean; produto: string | null; data_renovacao: string | null }[]>();

      clientes?.forEach(cliente => {
        const isMonthly = cliente.plano?.toLowerCase().includes('mensal');
        const isIndividual = cliente.plano?.toLowerCase().includes('individual');
        const isAutoHosted = cliente.produto === 'Número Hospedado Conosco ( Auto-Hospedado )';
        
        // Se for auto-hospedado, o plano deve ser Individual ou Mensal
        if (isAutoHosted && !isMonthly && !isIndividual) return;

        const isClientPaid = cliente.data_renovacao >= today;
        const numbersInObs = extractNumbers(cliente.observacao);
        const mainNumber = normalize(cliente.numero);
        const allNumbers = new Set<string>([...numbersInObs, mainNumber].filter(Boolean));

        allNumbers.forEach(num => {
          const rowId = cacheByNumber.get(num);
          if (rowId !== undefined) {
            if (!linksByRow.has(rowId)) linksByRow.set(rowId, []);
            linksByRow.get(rowId)!.push({ 
              id: cliente.id, 
              clientName: cliente.nome, 
              isPaid: isClientPaid,
              produto: cliente.produto,
              data_renovacao: cliente.data_renovacao
            });
          }
        });
      });

      // 4. Agregação Final: UM NÚMERO É PAGO SE HOUVER QUALQUER VÍNCULO PAGO NO SISTEMA
      linksByRow.forEach((links, rowId) => {
        if (manualSet.has(rowId)) return;
        
        // Verifica se há QUALQUER link de hosp. ou seguro que esteja em dia
        const anyPaidLink = links.some(l => l.isPaid);
        
        // Representante visual: prioriza o que está pago e tem a maior data de renovação
        const sortedLinks = [...links].sort((a, b) => {
          if (a.isPaid !== b.isPaid) return a.isPaid ? -1 : 1;
          return (b.data_renovacao || '').localeCompare(a.data_renovacao || '');
        });
        
        const representativeLink = sortedLinks[0];
        const uniqueNames = Array.from(new Set(links.map(l => l.clientName)));
        
        statusMap.set(rowId, {
          status: anyPaidLink ? 'pago' : 'vencido',
          clientName: representativeLink.clientName,
          clientNames: uniqueNames,
          method: 'auto',
          links: links.map(l => ({ 
            id: l.id, 
            nome: l.clientName, 
            produto: l.produto, 
            data_renovacao: l.data_renovacao, 
            isPaid: l.isPaid 
          })),
        });
      });

      // 5. Marcações manuais
      manualSet.forEach((status, rowId) => {
        const links = linksByRow.get(rowId);
        const uniqueNames = links ? Array.from(new Set(links.map(l => l.clientName))) : undefined;
        statusMap.set(rowId, {
          status,
          clientName: uniqueNames?.[0],
          clientNames: uniqueNames,
          method: 'manual',
          links: links?.map(l => ({ id: l.id, nome: l.clientName, produto: l.produto, data_renovacao: l.data_renovacao, isPaid: l.isPaid })),
        });
      });
      
      // 6. Números com "COM SEGURO"
      numbersCache?.forEach(c => {
        const obs = String((c.row_data as any)?.observacoes || (c.row_data as any)?.observacao || "").toLowerCase();
        if (obs.includes("com seguro") && !statusMap.get(c.baserow_row_id)) {
          statusMap.set(c.baserow_row_id, {
            status: "vencido",
            method: "auto",
            links: [],
          });
        }
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
