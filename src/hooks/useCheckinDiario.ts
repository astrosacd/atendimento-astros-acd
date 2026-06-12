import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAparelhos } from "@/hooks/useAparelhos";
import { useMemo } from "react";

export type TipoSlot = "normal" | "business" | "clone";
export type StatusConexao = "conectado" | "desconectado";

export interface Checkin {
  id: string;
  numero: string;
  baserow_row_id: number | null;
  cliente_nome: string | null;
  aparelho_id: string | null;
  modelo_snapshot: string | null;
  tipo_slot: TipoSlot;
  status_conexao: StatusConexao;
  status_geral: string | null;
  data_checkin: string;
  observacao: string | null;
  created_at: string;
}

const ACTIVE_WINDOW_DAYS = 7;

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
      aparelho_id: string | null;
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
 * Calcula slots ocupados por MODELO de aparelho a partir dos check-ins ativos
 * (últimos 7 dias, status_conexao = conectado, último por numero+aparelho).
 * Usado para descontar slots no CapacityBanner.
 */
export function useActiveCheckinsByModelo() {
  const { data: aparelhos = [] } = useAparelhos();
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - ACTIVE_WINDOW_DAYS);
    return d.toISOString().slice(0, 10);
  }, []);
  const { data: checkins = [] } = useCheckins({ since });

  return useMemo(() => {
    const aparelhoToModelo = new Map<string, string | null>();
    aparelhos.forEach((a) => aparelhoToModelo.set(a.id, a.modelo_id));

    // Pega o check-in mais recente por (numero+aparelho)
    const seen = new Set<string>();
    const ocupados = new Map<string, { total: number; normal: number; business: number; clone: number }>();

    for (const c of checkins) {
      if (!c.aparelho_id || c.status_conexao !== "conectado") continue;
      const key = `${c.aparelho_id}|${c.numero}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const modeloId = aparelhoToModelo.get(c.aparelho_id);
      if (!modeloId) continue;
      const cur = ocupados.get(modeloId) ?? { total: 0, normal: 0, business: 0, clone: 0 };
      cur.total += 1;
      cur[c.tipo_slot] += 1;
      ocupados.set(modeloId, cur);
    }
    return ocupados;
  }, [aparelhos, checkins]);
}
