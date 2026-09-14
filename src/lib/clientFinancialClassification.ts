export const RECURRING_BILLING_CYCLES = ['mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] as const;

type FinancialClient = {
  status_cliente?: string | null;
  cobranca_ativa?: boolean | null;
  ciclo_cobranca?: string | null;
  excluir_metricas?: boolean | null;
};

export type ClientFinancialType = 'agendado' | 'recorrente' | 'registro' | 'inconsistente';

export function hasRecurringCycle(ciclo?: string | null) {
  return RECURRING_BILLING_CYCLES.includes((ciclo || '').trim().toLowerCase() as typeof RECURRING_BILLING_CYCLES[number]);
}

export function classifyClientFinancialType(client: FinancialClient): ClientFinancialType {
  if (client.status_cliente === 'agendado') return 'agendado';
  if (hasRecurringCycle(client.ciclo_cobranca)) return 'recorrente';
  if (client.cobranca_ativa === false && (!client.ciclo_cobranca?.trim() || client.ciclo_cobranca === 'vitalicio')) return 'registro';
  return 'inconsistente';
}

export function isEligibleForFinancialMetrics(client: FinancialClient) {
  return !client.excluir_metricas && client.status_cliente !== 'agendado';
}

export function isActiveRecurringClient(client: FinancialClient) {
  return isEligibleForFinancialMetrics(client) && client.cobranca_ativa === true && hasRecurringCycle(client.ciclo_cobranca);
}

export function isSingleSaleClient(client: FinancialClient) {
  return isEligibleForFinancialMetrics(client) && classifyClientFinancialType(client) === 'registro';
}