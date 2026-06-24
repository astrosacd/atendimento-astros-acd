import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";
import { useQrScanConfig, useAutoHospedadoNumbers } from "@/hooks/useQrScan";

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
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["qr-scan-checkins"], refetchType: "all" });
      qc.invalidateQueries({ queryKey: ["quick-number-search"] });
    },
  });
}

/**
 * Calcula slots ocupados por MODELO a partir dos check-ins ativos
 * (janela configurável em dias, último por número).
 *
 * Regra de ocupação:
 *  - Check-in com status_conexao = "conectado" sempre ocupa.
 *  - Auto-hospedados (lista QR Scans) ocupam independente do status de conexão,
 *    pois o aparelho físico continua alocado àquele número.
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
  const { data: autoHosp = [] } = useAutoHospedadoNumbers();

  return useMemo(() => {
    const autoHospNumeros = new Set<string>();
    for (const a of autoHosp as any[]) {
      const n = String(a?.row_data?.numero ?? a?.numero ?? "");
      if (n) autoHospNumeros.add(n);
    }

    const seenNumero = new Set<string>();
    const ocupados = new Map<string, { total: number; normal: number; business: number; clone: number; numbers: Set<string> }>();

    for (const c of checkins) {
      if (seenNumero.has(c.numero)) continue;
      seenNumero.add(c.numero);
      if (!c.modelo_id) continue;
      const isAutoHosp = autoHospNumeros.has(c.numero);
      const conectado = c.status_conexao === "conectado";
      if (!conectado && !isAutoHosp) continue;
      const cur = ocupados.get(c.modelo_id) ?? { total: 0, normal: 0, business: 0, clone: 0, numbers: new Set<string>() };
      cur.total += 1;
      cur[c.tipo_slot] += 1;
      cur.numbers.add(c.numero);
      ocupados.set(c.modelo_id, cur);
    }
    return ocupados;
  }, [checkins, autoHosp]);
}
