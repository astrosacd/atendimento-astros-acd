import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/utils/invokeFunction";

export interface QrScanConfig {
  id: string;
  qtd_gratis_por_mes: number;
  qtd_por_dia: number;
  valor_excedente: number;
  payment_provider_default: "mercadopago" | "stripe";
  ativo: boolean;
}

export interface QrScanHistoryRow {
  id: string;
  baserow_row_id: number;
  numero: string;
  cliente_nome: string | null;
  scan_date: string;
  tipo: "gratis" | "pago";
  valor_cobrado: number | null;
  payment_status: "nao_aplica" | "pendente" | "pago" | "cancelado";
  payment_method: string | null;
  payment_link_id: string | null;
  payment_manual_observacao: string | null;
  payment_comprovante_url: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  operador_user_id: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrScanInsuranceUsage {
  id: string;
  baserow_row_id: number;
  numero: string;
  cliente_nome: string | null;
  used_at: string;
  operador_id: string | null;
  observacao: string | null;
  created_at: string;
}

export interface AutoHospedadoNumber {
  baserow_row_id: number;
  row_data: any;
  auto_hospedado: boolean;
  auto_hospedado_observacao: string | null;
  auto_hospedado_marcado_em: string | null;
}

export function useQrScanConfig() {
  return useQuery({
    queryKey: ["qr-scan-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qr_scan_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as QrScanConfig | null;
    },
  });
}

export function useUpdateQrScanConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<QrScanConfig> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase
        .from("qr_scan_config")
        .update(rest)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-scan-config"] }),
  });
}

export function useAutoHospedadoNumbers() {
  return useQuery({
    queryKey: ["qr-scan-auto-hospedados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consulta_numeros_cache")
        .select(
          "baserow_row_id, row_data, auto_hospedado, auto_hospedado_observacao, auto_hospedado_marcado_em",
        )
        .eq("auto_hospedado", true)
        .order("baserow_row_id");
      if (error) throw error;
      return (data ?? []) as AutoHospedadoNumber[];
    },
  });
}

export function useQrScanHistory(filters?: {
  status?: string;
  numero?: string;
}) {
  return useQuery({
    queryKey: ["qr-scan-history", filters],
    queryFn: async () => {
      let q = supabase
        .from("qr_scan_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters?.status) q = q.eq("payment_status", filters.status);
      if (filters?.numero) q = q.ilike("numero", `%${filters.numero}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as QrScanHistoryRow[];
    },
  });
}

export function useMonthlyCounters() {
  return useQuery({
    queryKey: ["qr-scan-monthly-counters"],
    queryFn: async () => {
      const now = new Date();
      const ano = now.getFullYear();
      const mes = now.getMonth() + 1;
      const { data, error } = await supabase
        .from("qr_scan_monthly_counter")
        .select("*")
        .eq("ano", ano)
        .eq("mes", mes);
      if (error) throw error;
      const map = new Map<
        number,
        { qtd_gratis_usados: number; qtd_pagos: number }
      >();
      (data ?? []).forEach((r: any) =>
        map.set(r.baserow_row_id, {
          qtd_gratis_usados: r.qtd_gratis_usados,
          qtd_pagos: r.qtd_pagos,
        }),
      );
      return map;
    },
  });
}

export function useToggleAutoHospedado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      baserowRowId,
      value,
      observacao,
    }: {
      baserowRowId: number;
      value: boolean;
      observacao?: string;
    }) => {
      return await invokeFunction<AutoHospedadoNumber>(
        "qr-scan-toggle-auto-hospedado",
        {
          body: { baserow_row_id: baserowRowId, value, observacao },
        },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-auto-hospedados"] });
      qc.invalidateQueries({ queryKey: ["qr-scan-search-numbers"] });
    },
  });
}

export function useRegisterScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      baserow_row_id: number;
      payment_method?: string;
      payment_link_id?: string;
      observacao?: string;
      payment_manual_observacao?: string;
      payment_comprovante_url?: string;
    }) => {
      return await invokeFunction<any>("qr-scan-register", { body: input });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-history"] });
      qc.invalidateQueries({ queryKey: ["qr-scan-monthly-counters"] });
    },
  });
}

export function useConfirmScanPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      qr_scan_id: string;
      action?: "confirm" | "cancel";
      comprovante_url?: string;
      observacao?: string;
    }) => {
      return await invokeFunction<any>("qr-scan-confirm-payment", {
        body: input,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-history"] });
      qc.invalidateQueries({ queryKey: ["qr-scan-monthly-counters"] });
    },
  });
}

// Search any cache row to flag as auto-hospedado
export function useSearchNumbers(query: string) {
  return useQuery({
    queryKey: ["qr-scan-search-numbers", query],
    enabled: query.trim().length >= 2,
    queryFn: async () => {
      const q = query.trim().replace(/[(),]/g, "");
      const like = `*${q}*`;
      const { data, error } = await supabase
        .from("consulta_numeros_cache")
        .select(
          "baserow_row_id, row_data, auto_hospedado, auto_hospedado_observacao",
        )
        .or(
          `row_data->>numero.ilike.${like},row_data->>nome.ilike.${like},row_data->>email.ilike.${like},row_data->>numero_de_compra.ilike.${like}`,
        )
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}
