import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QrScanInsuranceUsage } from "./useQrScan";

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
    },
  });
}
