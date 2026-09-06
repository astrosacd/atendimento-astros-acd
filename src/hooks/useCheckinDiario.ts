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
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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
 *  - "conectado" ocupa vaga (ativo no aparelho e no cliente).
 *  - "desconectado_cliente" TAMBÉM ocupa vaga: o chip continua ativo no
 *    aparelho, apenas não está vinculado ao cliente.
 *  - "desconectado" (banido/removido) libera a vaga.
 *
 * Filtros obrigatórios (evitam vaga ocupada "fantasma"):
 *  - Só contam números marcados como AUTO-HOSPEDADOS no cache de Consulta
 *    Números. Número hospedado pelo próprio cliente não ocupa aparelho nosso.
 *  - Números que já estão no estoque (Status de Números, exceto "Vendido")
 *    são ignorados aqui, pois já são contados pela própria lista de estoque.
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
  const { data: cacheRows = [] } = useConsultaNumerosCacheRows();
  const { data: numerosEstoque = [] } = useNumerosAquecimento();
  const { data: statusList = [] } = useNumerosStatus();

  const autoHospedados = useMemo(() => {
    const set = new Set<string>();
    for (const r of cacheRows) {
      if (!r.auto_hospedado) continue;
      const num = onlyDigits(String(r.row_data?.numero ?? ''));
      if (num) set.add(num);
    }
    return set;
  }, [cacheRows]);

  const noEstoque = useMemo(() => {
    const vendidoId = statusList.find((s) => s.nome === 'Vendido')?.id;
    const set = new Set<string>();
    for (const n of numerosEstoque) {
      if (vendidoId && n.status_id === vendidoId) continue;
      const num = onlyDigits(String(n.numero ?? ''));
      if (num) set.add(num);
    }
    return set;
  }, [numerosEstoque, statusList]);

  return useMemo(() => {
    const seenNumero = new Set<string>();
    const ocupados = new Map<string, { total: number; normal: number; business: number; clone: number; numbers: Set<string> }>();

    for (const c of checkins) {
      if (seenNumero.has(c.numero)) continue;
      seenNumero.add(c.numero);
      if (!c.modelo_id) continue;
      const ocupaSlot =
        c.status_conexao === "conectado" || c.status_conexao === "desconectado_cliente";
      if (!ocupaSlot) continue;

      const num = onlyDigits(c.numero);
      // Não é auto-hospedado → não ocupa aparelho nosso
      if (!autoHospedados.has(num)) continue;
      // Já contabilizado pelo estoque → evita contagem em dobro
      if (noEstoque.has(num)) continue;

      const cur = ocupados.get(c.modelo_id) ?? { total: 0, normal: 0, business: 0, clone: 0, numbers: new Set<string>() };
      cur.total += 1;
      cur[c.tipo_slot] += 1;
      cur.numbers.add(c.numero);
      ocupados.set(c.modelo_id, cur);
    }
    return ocupados;
  }, [checkins, autoHospedados, noEstoque]);
}

