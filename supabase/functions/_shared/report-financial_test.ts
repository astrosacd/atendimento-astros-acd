import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyReportClient, confirmedPaymentTotals, isConfirmedPaymentStatus } from "./report-financial.ts";

Deno.test("classifica mensal, registro e agendado sem misturar", () => {
  assertEquals(classifyReportClient({ status_cliente: "agendado", cobranca_ativa: false, ciclo_cobranca: "" }), "agendado");
  assertEquals(classifyReportClient({ status_cliente: "ativo", cobranca_ativa: true, ciclo_cobranca: "mensal" }), "mensal");
  assertEquals(classifyReportClient({ status_cliente: "ativo", cobranca_ativa: false, ciclo_cobranca: "mensal" }), "mensal");
  assertEquals(classifyReportClient({ status_cliente: "ativo", cobranca_ativa: false, ciclo_cobranca: "" }), "registro");
  assertEquals(classifyReportClient({ status_cliente: "ativo", cobranca_ativa: true, ciclo_cobranca: "" }), "inconsistente");
});

Deno.test("somente status confirmados representam faturamento", () => {
  assertEquals(isConfirmedPaymentStatus("paid"), true);
  assertEquals(isConfirmedPaymentStatus("approved"), true);
  assertEquals(isConfirmedPaymentStatus("pending"), false);
  assertEquals(isConfirmedPaymentStatus("cancelled"), false);
});

Deno.test("totais usam pagamentos uma única vez e separam moedas", () => {
  assertEquals(confirmedPaymentTotals([
    { amount: 450, moeda: "BRL" },
    { amount: 999, moeda: "BRL" },
    { amount: 10, moeda: "USD" },
  ]), { brl: 1449, usd: 10 });
});