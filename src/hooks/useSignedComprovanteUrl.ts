import { useEffect, useState } from "react";
import { getViewableComprovanteUrl } from "@/utils/comprovanteUrl";

/**
 * Hook React: dado um URL público (potencialmente do bucket privado payment-proofs),
 * devolve um URL utilizável para <img src> ou <a href> — gera signed URL on-demand.
 */
export function useSignedComprovanteUrl(url: string | null | undefined) {
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setSigned(null);
      return;
    }
    getViewableComprovanteUrl(url).then((u) => {
      if (!cancelled) setSigned(u);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return signed;
}
