import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

async function getFunctionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return body?.error || body?.message || error.message;
    } catch {
      return error.message;
    }
  }
  return error instanceof Error ? error.message : "Erro desconhecido ao conectar Instagram";
}

export default function InstagramOAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [returnUrl, setReturnUrl] = useState("/instagram");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const fbError = params.get("error_description") || params.get("error");

    if (fbError) {
      setStatus("error");
      setMessage(decodeURIComponent(fbError));
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setMessage("Parâmetros OAuth ausentes");
      return;
    }

    (async () => {
      try {
        const redirectUri = `${window.location.origin}/instagram/oauth-callback`;
        const { data, error } = await supabase.functions.invoke("instagram-oauth-callback", {
          body: { code, state, redirect_uri: redirectUri },
        });
        if (error) throw error;
        if ((data as any)?.return_url) setReturnUrl((data as any).return_url);
        setStatus("ok");
        setMessage(`Conta conectada! IG Business ID: ${(data as any).ig_business_id}`);
        toast.success("OAuth Instagram conectado!");
        setTimeout(() => {
          window.location.href = (data as any).return_url || "/instagram";
        }, 2500);
      } catch (e: any) {
        setStatus("error");
        setMessage(await getFunctionErrorMessage(e));
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Conectando Instagram</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {status === "loading" && <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />}
          {status === "ok" && <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />}
          {status === "error" && <XCircle className="h-12 w-12 mx-auto text-destructive" />}
          <p className="text-sm">{message || "Processando..."}</p>
          {status === "error" && (
            <Button onClick={() => window.location.href = returnUrl}>Voltar</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
