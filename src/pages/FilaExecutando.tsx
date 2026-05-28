import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PhoneCall, ExternalLink, Loader2 } from "lucide-react";
import { FilaLigacoesTab } from "@/components/ligacoes-ia/FilaLigacoesTab";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";

/**
 * Página dedicada (abre em NOVA GUIA) que executa a fila de ligações IA.
 * Enquanto esta guia estiver viva, a aba "Fila do dia" no CRM principal
 * fica bloqueada (via flag em localStorage) para evitar ligação dupla.
 *
 * F5/fechar = mata o loop. O beforeunload abaixo avisa o usuário.
 */
function FilaExecutandoInner() {
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      // Só avisa se a fila estiver de fato rodando (FilaLigacoesTab seta a flag)
      const flag = localStorage.getItem("ligacoes_fila_executando");
      if (flag) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto max-w-7xl flex items-center justify-between px-6 py-3 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600">
              <PhoneCall className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">Fila de Ligações IA — Execução</h1>
              <p className="text-[11px] text-muted-foreground">
                Não feche esta guia até a fila terminar. Você pode navegar no CRM normalmente em outra guia.
              </p>
            </div>
          </div>
          <Link
            to="/ligacoes-ia?tab=fila"
            target="_blank"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Abrir CRM
          </Link>
        </div>
      </div>

      <div className="container max-w-7xl py-6">
        <FilaLigacoesTab mode="standalone" />
      </div>
    </div>
  );
}

export default function FilaExecutando() {
  const [handoffLoading, setHandoffLoading] = useState(() => new URLSearchParams(window.location.search).get("handoff") === "1");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("handoff") !== "1") return;

    let done = false;
    const finish = () => {
      done = true;
      params.delete("handoff");
      const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
      setHandoffLoading(false);
    };

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "LIGACOES_IA_AUTH_HANDOFF_RESPONSE") return;

      const session = event.data.session;
      if (session?.access_token && session?.refresh_token) {
        await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      }
      finish();
    };

    window.addEventListener("message", onMessage);
    window.opener?.postMessage({ type: "LIGACOES_IA_AUTH_HANDOFF_REQUEST" }, window.location.origin);
    const timeout = window.setTimeout(() => { if (!done) finish(); }, 5000);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timeout);
    };
  }, []);

  if (handoffLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <ProtectedRoute permission="execute_ligacoes_fila">
      <FilaExecutandoInner />
    </ProtectedRoute>
  );
}
