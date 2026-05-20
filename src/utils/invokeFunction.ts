import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

/**
 * Wrapper para supabase.functions.invoke que extrai o erro REAL do corpo
 * da resposta (ao invés do genérico "Failed to send a request to the Edge Function").
 */
export async function invokeFunction<T = any>(
  name: string,
  options?: { body?: any; headers?: Record<string, string> }
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, options);

  if (error) {
    // Tenta extrair mensagem real do corpo da resposta
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json();
        const real = body?.error || body?.message;
        if (real) throw new Error(real);
      } catch (parseErr: any) {
        // Se não foi possível parsear, tenta texto puro
        try {
          const txt = await error.context.text();
          if (txt) throw new Error(txt);
        } catch {
          // ignore
        }
        if (parseErr?.message) throw parseErr;
      }
    }
    throw new Error(error.message || "Erro desconhecido ao chamar edge function");
  }

  // Algumas edge functions retornam status 200 mas com { error: "..." } no body
  if (data && typeof data === "object" && "error" in data && (data as any).error) {
    throw new Error((data as any).error);
  }

  return data as T;
}
