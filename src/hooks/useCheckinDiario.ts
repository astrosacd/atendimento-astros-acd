import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useQrScanConfig } from "@/hooks/useQrScan";

export type TipoSlot = "normal" | "business" | "clone";
export type StatusConexao = "conectado" | "desconectado" | "desconectado_cliente";

export interface Checkin {
  id: string;
  numero: string;
  baserow_row_id: number | null;
  cliente_nome: string | null;
  aparelho_id: string | null;
  modelo_id: string | null;
  modelo_snapshot: string | null;
  tipo_slot: TipoSlot;
  status_conexao: StatusConexao;
  status_geral: string | null;
  data_checkin: string;
  observacao: string | null;
  created_by: string | null;
  created_at: string;
}

const DEFAULT_ACTIVE_WINDOW_DAYS = 7;

export function useCheckins(filter?: { since?: string; numero?: string }) {
  return useQuery({
    queryKey: ["qr-scan-checkins", filter],
    queryFn: async () => {
      let q = supabase
        .from("qr_scan_checkins_diarios" as any)
        .select("*")
        .order("data_checkin", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(2000);
      if (filter?.since) q = q.gte("data_checkin", filter.since);
      if (filter?.numero) q = q.eq("numero", filter.numero);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Checkin[];
    },
  });
}

export function useLatestCheckinByNumero() {
  const { data: all = [] } = useCheckins();
  return useMemo(() => {
    const map = new Map<string, Checkin>();
    for (const c of all) {
      if (!map.has(c.numero)) map.set(c.numero, c);
    }
    return map;
  }, [all]);
}

export function useCreateCheckin() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      numero: string;
      baserow_row_id?: number | null;
      cliente_nome?: string | null;
      aparelho_id?: string | null;
      modelo_id: string | null;
      modelo_snapshot: string | null;
      tipo_slot: TipoSlot;
      status_conexao: StatusConexao;
      status_geral?: string | null;
      observacao?: string | null;
    }) => {
      const { error } = await supabase
        .from("qr_scan_checkins_diarios" as any)
        .insert({ ...payload, created_by: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qr-scan-checkins"] });
    },
  });
}

/**
 * Calcula slots ocupados por MODELO a partir dos check-ins ativos
 * (janela configurável em dias, status_conexao = conectado, último por numero+modelo).
 * Usado para descontar slots no CapacityBanner.
 */
export function useActiveCheckinsByModelo() {
  const { data: config } = useQrScanConfig();
  const windowDays = config?.checkin_ativo_dias ?? DEFAULT_ACTIVE_WINDOW_DAYS;
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString().slice(0, 10);
  }, [windowDays]);
  const { data: checkins = [] } = useCheckins({ since });

  return useMemo(() => {
    const seen = new Set<string>();
    const ocupados = new Map<string, { total: number; normal: number; business: number; clone: number }>();

    for (const c of checkins) {
      if (!c.modelo_id || c.status_conexao !== "conectado") continue;
      const key = `${c.modelo_id}|${c.numero}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const cur = ocupados.get(c.modelo_id) ?? { total: 0, normal: 0, business: 0, clone: 0 };
      cur.total += 1;
      cur[c.tipo_slot] += 1;
      ocupados.set(c.modelo_id, cur);
    }
    return ocupados;
  }, [checkins]);
}
