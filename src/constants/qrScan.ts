// Fonte única dos labels de método de pagamento usados no módulo QR Scans.
// Consumido por:
//  - src/components/consulta-numeros/QrScansTab.tsx
//  - src/components/dashboard/RegisterScanQuickDialog.tsx
// As CHAVES devem permanecer alinhadas com a edge function `qr-scan-register`
// (link_mp, link_stripe, manual_pix, manual_saldo, manual_outro).
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  link_mp: "🔗 Link Mercado Pago",
  link_stripe: "🔗 Link Stripe",
  manual_pix: "💰 PIX (manual)",
  manual_saldo: "💼 Saldo do cliente",
  manual_outro: "📝 Outro (manual)",
};

export type QrScanPaymentMethod = keyof typeof PAYMENT_METHOD_LABELS;
