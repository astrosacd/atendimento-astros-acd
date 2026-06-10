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
 * Hook que implementa a lógica de status de Hospedagem/Seguro
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

      // 1. Buscar clientes ATIVOS que possuem os produtos de interesse
      const { data: clientes, error: clientError } = await supabase
        .from("clientes")
        .select("id, nome, numero, produto, observacao, data_renovacao, plano")
        .in('produto', [
          'Número Hospedado Conosco ( Auto-Hospedado )',
          'Seguro de Numeros Aquecidos'
        ]);
      
      if (clientError) throw clientError;

      // 2. Buscar cache de números para vincular o row_id
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
        // Remove espaços, traços, parênteses e quebras de linha para capturar números colados
        const cleaned = text.replace(/[\s\-\(\)\.,;:\/\r\n]/g, ' ');
        // Regex mais flexível para capturar sequências de números comuns em telefones
        const matches = cleaned.match(/\d{8,14}/g);
        return matches ? matches.map(normalize).filter(n => n.length >= 8) : [];
      };

      const cacheByNumber = new Map<string, number>();
      numbersCache?.forEach(c => {
        const n = normalize((c.row_data as any)?.numero);
        if (n) cacheByNumber.set(n, c.baserow_row_id);
      });

      // 3. Vincular números aos clientes
      const linksByRow = new Map<number, { id: string; clientName: string; isPaid: boolean; produto: string | null; data_renovacao: string | null }[]>();

      clientes?.forEach(cliente => {
        const isClientPaid = cliente.data_renovacao >= today;
        const numbersInObs = extractNumbers(cliente.observacao);
        const mainNumber = normalize(cliente.numero);
        
        // Se o número principal do cliente (o que está no campo 'numero') também estiver no cache, 
        // ele deve ser vinculado. Mas nos seus exemplos, o número relevante está na observação.
        const allNumbers = new Set<string>([...numbersInObs, mainNumber].filter(Boolean));

        allNumbers.forEach(num => {
          const rowId = cacheByNumber.get(num);
          if (rowId !== undefined) {
            if (!linksByRow.has(rowId)) linksByRow.set(rowId, []);
            
            // Log para debug interno (não visível ao usuário)
            // console.log(`Vinculando row ${rowId} (num ${num}) ao cliente ${cliente.nome} (${cliente.produto}) - Pago: ${isClientPaid} (${cliente.data_renovacao})`);
            
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

      const normalizeProductKey = (clientName: string | null | undefined, produto: string | null | undefined) =>
        `${String(clientName ?? '').trim().toLowerCase()}||${String(produto ?? '').trim().toLowerCase()}`;

      const clientProductLatestRenewals = new Map<string, string>();
      clientes?.forEach(c => {
        const key = normalizeProductKey(c.nome, c.produto);
        const currentMax = clientProductLatestRenewals.get(key) || '';
        if ((c.data_renovacao || '') > currentMax) {
          clientProductLatestRenewals.set(key, c.data_renovacao || '');
        }
      });

      // 4. Decidir status: Regra de prioridade pelo contrato mais recente por CLIENTE + PRODUTO
      // Primeiro, identificamos qual é o registro mais recente para CADA NÚMERO
      // e ignoramos registros antigos se houver um mais novo para aquele mesmo número.
      // Além disso, se o número NÃO estiver no registro mais recente do CLIENTE (Fernando),
      // mas estiver em um registro antigo dele, ele deve ser ignorado pois o Fernando 
      // renovou o contrato e removeu esses números.
      
      linksByRow.forEach((links, rowId) => {
        if (manualSet.has(rowId)) return;
        
        // Ordena para pegar o registro com a MAIOR data de renovação
        const sortedLinks = [...links].sort((a, b) => 
          (b.data_renovacao || '').localeCompare(a.data_renovacao || '')
        );
        
        const bestLink = sortedLinks[0]; // O link mais recente/futuro
        
        // REGRA CRUCIAL: contrato novo de Hospedagem não pode invalidar Seguro do mesmo cliente,
        // e contrato novo de Seguro não pode derrubar outros seguros que ainda têm dias válidos.
        const latestDateForThisClientProduct = clientProductLatestRenewals.get(
          normalizeProductKey(bestLink.clientName, bestLink.produto)
        );
        const bestLinkDate = bestLink.data_renovacao || '';
        const bestLinkStillValid = bestLinkDate >= today;

        if (latestDateForThisClientProduct && bestLinkDate < latestDateForThisClientProduct && !bestLinkStillValid) {
          // O número pertence a um contrato antigo já vencido e há contrato mais novo do mesmo produto.
          // Nesse caso, não gera "Vencido" e fica como não vinculado.
          return;
        }

        const isPaid = bestLinkStillValid;
        
        if (links.length > 0) {
          statusMap.set(rowId, {
            status: isPaid ? 'pago' : 'vencido',
            clientName: bestLink.clientName,
            clientNames: Array.from(new Set(links.map(l => l.clientName))),
            method: 'auto',
            links: links.map(l => ({ 
              id: l.id, 
              nome: l.clientName, 
              produto: l.produto, 
              data_renovacao: l.data_renovacao, 
              isPaid: (l.data_renovacao || '') >= today 
            })),
          });
        }
      });

      // 5. Marcações manuais
      manualSet.forEach((status, rowId) => {
        const links = linksByRow.get(rowId);
        statusMap.set(rowId, {
          status,
          clientName: links?.[0]?.clientName,
          method: 'manual',
          links: links?.map(l => ({ id: l.id, nome: l.clientName, produto: l.produto, data_renovacao: l.data_renovacao, isPaid: l.isPaid })),
        });
      });
      
      // 6. Números com "COM SEGURO" nas observações do cache
      // Agora marcamos como "vencido" APENAS se não houver NENHUM vínculo automático ou manual
      // Se não houver vínculos, o componente exibirá "Não vinculado"
      numbersCache?.forEach(c => {
        const obs = String((c.row_data as any)?.observacoes || (c.row_data as any)?.observacao || "").toLowerCase();
        if (obs.includes("com seguro") && !statusMap.has(c.baserow_row_id)) {
          // Mantemos no statusMap apenas se quisermos forçar um estado base, 
          // mas sem links o UI já mostrará "Não vinculado"
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
