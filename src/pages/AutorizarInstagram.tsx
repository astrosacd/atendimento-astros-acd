import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, XCircle, ShieldCheck, Instagram, Lock, BarChart3,
  EyeOff, Info,
} from "lucide-react";

type Phase = "loading" | "ready" | "starting" | "callback_processing" | "success" | "error" | "expired" | "used";

interface InvitePayload {
  valid: boolean;
  error?: string;
  invite_id?: string;
  expires_at?: string;
  used_at?: string;
  profile?: {
    id: string;
    username: string;
    display_name: string | null;
    profile_picture_url: string | null;
  };
}

export default function AutorizarInstagram() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [invite, setInvite] = useState<InvitePayload | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Detecta retorno do Facebook (code + state na URL)
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const fbError = searchParams.get("error_description") || searchParams.get("error");

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setErrorMsg("Token de autorização ausente.");
      return;
    }

    // Se voltou do Facebook com code, processa o callback
    if (code && state) {
      setPhase("callback_processing");
      (async () => {
        try {
          const redirectUri = `${window.location.origin}/autorizar-instagram/${token}`;
          const { data, error } = await supabase.functions.invoke("instagram-oauth-callback", {
            body: { code, state, redirect_uri: redirectUri },
          });
          if (error) {
            const msg = (error as any)?.context?.json
              ? (await (error as any).context.json())?.error
              : error.message;
            throw new Error(msg || "Erro ao processar autorização");
          }
          if ((data as any)?.error) throw new Error((data as any).error);
          setPhase("success");
        } catch (e: any) {
          setPhase("error");
          setErrorMsg(e.message);
        }
      })();
      return;
    }

    if (fbError) {
      setPhase("error");
      setErrorMsg(decodeURIComponent(fbError));
      return;
    }

    // Valida o token
    (async () => {
      try {
        const { data, error } = await supabase.rpc("validate_instagram_invite_token", { p_token: token });
        if (error) throw error;
        const payload = data as unknown as InvitePayload;
        setInvite(payload);
        if (!payload.valid) {
          if (payload.error === "expired") setPhase("expired");
          else if (payload.error === "already_used") setPhase("used");
          else {
            setPhase("error");
            setErrorMsg("Link inválido ou não encontrado.");
          }
        } else {
          setPhase("ready");
        }
      } catch (e: any) {
        setPhase("error");
        setErrorMsg(e.message);
      }
    })();
  }, [token, code, state, fbError]);

  async function startAuth() {
    if (!token) return;
    setPhase("starting");
    try {
      const returnUrl = `${window.location.origin}/autorizar-instagram/${token}`;
      const { data, error } = await supabase.functions.invoke("instagram-oauth-start", {
        body: {
          invite_token: token,
          return_url: returnUrl,
          site_url: window.location.origin,
        },
      });
      if (error) {
        const msg = (error as any)?.context?.json
          ? (await (error as any).context.json())?.error
          : error.message;
        throw new Error(msg || "Erro ao iniciar autorização");
      }
      if ((data as any)?.auth_url) {
        window.location.href = (data as any).auth_url;
      } else {
        throw new Error("URL de autorização não retornada");
      }
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-2">
            <Instagram className="h-7 w-7 text-white" />
          </div>
          <CardTitle className="text-2xl">Autorização Instagram</CardTitle>
          <CardDescription>Necessária para gerar relatórios mensais do seu perfil</CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {phase === "loading" && (
            <div className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground mt-3">Validando convite…</p>
            </div>
          )}

          {phase === "expired" && (
            <div className="py-8 text-center space-y-3">
              <XCircle className="h-12 w-12 mx-auto text-amber-500" />
              <h3 className="font-semibold text-lg">Link expirado</h3>
              <p className="text-sm text-muted-foreground">
                Este link de autorização já passou da validade. Solicite um novo link para a agência.
              </p>
            </div>
          )}

          {phase === "used" && (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
              <h3 className="font-semibold text-lg">Link já utilizado</h3>
              <p className="text-sm text-muted-foreground">
                Esta autorização já foi concluída. Se precisar reconectar, peça um novo link à agência.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="py-8 text-center space-y-3">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <h3 className="font-semibold text-lg">Não foi possível autorizar</h3>
              <p className="text-sm text-muted-foreground break-words">{errorMsg}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>
            </div>
          )}

          {phase === "success" && (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
              <h3 className="font-semibold text-xl">Autorização concluída!</h3>
              <p className="text-sm text-muted-foreground">
                A agência agora pode gerar seus relatórios mensais do Instagram automaticamente.
                Você pode fechar esta página.
              </p>
            </div>
          )}

          {phase === "callback_processing" && (
            <div className="py-12 text-center">
              <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-3">Finalizando autorização com o Facebook…</p>
            </div>
          )}

          {(phase === "ready" || phase === "starting") && invite?.profile && (
            <>
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/40 border">
                <Avatar className="h-14 w-14 ring-2 ring-purple-500/40">
                  {invite.profile.profile_picture_url && (
                    <AvatarImage src={invite.profile.profile_picture_url} alt={invite.profile.username} />
                  )}
                  <AvatarFallback>{invite.profile.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-lg truncate">@{invite.profile.username}</p>
                  {invite.profile.display_name && (
                    <p className="text-sm text-muted-foreground truncate">{invite.profile.display_name}</p>
                  )}
                  <Badge variant="outline" className="mt-1 text-[10px]">Será conectado ao sistema</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg border-2 border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">O que será acessado:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>Estatísticas públicas do perfil (seguidores, posts)</li>
                        <li>Insights privados (alcance, impressões, salvos)</li>
                        <li>Dados demográficos agregados dos seguidores</li>
                        <li>Métricas dos seus últimos posts</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border-2 border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-start gap-2">
                    <EyeOff className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">O que NUNCA será acessado:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                        <li>Sua senha (a autorização é feita pelo Facebook, não digitamos nada)</li>
                        <li>Mensagens privadas (DMs)</li>
                        <li>Capacidade de postar, curtir ou seguir em seu nome</li>
                        <li>Dados financeiros ou de pagamento</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Você será redirecionado para o <strong>Facebook oficial</strong>. Ao autorizar, o acesso pode ser
                      revogado a qualquer momento em <strong>facebook.com → Configurações → Apps</strong>.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                onClick={startAuth}
                disabled={phase === "starting"}
              >
                {phase === "starting" ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Lock className="h-5 w-5 mr-2" />
                )}
                Autorizar via Facebook
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
