export type ReportClientType = "mensal" | "registro" | "agendado" | "inconsistente";

export const RECURRING_CYCLES = ["mensal", "bimestral", "trimestral", "semestral", "anual"] as const;

export function classifyReportClient(client: Record<string, unknown> | null | undefined): ReportClientType {
  if (!client) return "inconsistente";
  if (client.status_cliente === "agendado") return "agendado";

  const cycle = String(client.ciclo_cobranca || "").trim().toLowerCase();
  if (RECURRING_CYCLES.includes(cycle as typeof RECURRING_CYCLES[number])) return "mensal";
  if (client.cobranca_ativa === false && (!cycle || cycle === "vitalicio")) return "registro";
  return "inconsistente";
}

export function isConfirmedPaymentStatus(status: unknown) {
  return ["paid", "approved", "success", "completed"].includes(String(status || "").toLowerCase());
}

export function confirmedPaymentTotals<T extends { amount: number; moeda: string }>(payments: T[]) {
  return {
    brl: payments.filter((payment) => (payment.moeda || "BRL") === "BRL").reduce((sum, payment) => sum + payment.amount, 0),
    usd: payments.filter((payment) => payment.moeda === "USD").reduce((sum, payment) => sum + payment.amount, 0),
  };
}