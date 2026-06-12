import { supabase } from "@/integrations/supabase/client";

/**
 * Extrai o path do arquivo de uma URL pública do bucket payment-proofs.
 * Retorna null se a URL não for do bucket.
 */
function extractPaymentProofsPath(url: string): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/payment-proofs\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Dado um URL armazenado (público antigo ou já privado), retorna um URL acessível.
 * - Se for do bucket payment-proofs → gera signed URL (60 min).
 * - Caso contrário → retorna o URL original (pode ser externo, MP, Stripe etc.).
 */
export async function getViewableComprovanteUrl(
  url: string | null | undefined,
): Promise<string | null> {
  if (!url) return null;
  const path = extractPaymentProofsPath(url);
  if (!path) return url; // não é nosso bucket → URL externa
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error("[comprovanteUrl] signed url error:", error);
    return url; // fallback
  }
  return data.signedUrl;
}

/** Abre o comprovante numa nova aba (gerando signed URL se necessário). */
export async function openComprovante(url: string | null | undefined) {
  const finalUrl = await getViewableComprovanteUrl(url);
  if (finalUrl) window.open(finalUrl, "_blank", "noopener,noreferrer");
}
