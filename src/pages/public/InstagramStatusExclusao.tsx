import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Row = {
  confirmation_code: string;
  status: "pending" | "completed" | "failed";
  requested_at: string;
  completed_at: string | null;
  error_message: string | null;
};

export default function InstagramStatusExclusao() {
  const { code } = useParams<{ code: string }>();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      if (!code) return;
      const { data, error } = await supabase
        .from("instagram_data_deletion_requests")
        .select("confirmation_code, status, requested_at, completed_at, error_message")
        .eq("confirmation_code", code)
        .maybeSingle();
      if (error || !data) setNotFound(true);
      else setRow(data as Row);
      setLoading(false);
    })();
  }, [code]);

  const statusMap = {
    pending: { icon: Clock, label: "Em processamento", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
    completed: { icon: CheckCircle2, label: "Concluído", color: "bg-green-500/10 text-green-600 border-green-500/30" },
    failed: { icon: XCircle, label: "Falhou", color: "bg-red-500/10 text-red-600 border-red-500/30" },
  } as const;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Status da Exclusão de Dados — Instagram</CardTitle>
              <CardDescription>Consulta pública via código de confirmação (LGPD/GDPR)</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <p className="text-muted-foreground">Carregando…</p>}
          {!loading && notFound && (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Código <code className="font-mono">{code}</code> não encontrado. Verifique o código fornecido pelo Facebook/Instagram após a solicitação de exclusão.
            </div>
          )}
          {!loading && row && (() => {
            const info = statusMap[row.status];
            const Icon = info.icon;
            return (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5" />
                    <div>
                      <p className="font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{row.confirmation_code}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={info.color}>{info.label}</Badge>
                </div>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p><strong>Solicitado em:</strong> {format(new Date(row.requested_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  {row.completed_at && (
                    <p><strong>Concluído em:</strong> {format(new Date(row.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                  )}
                  {row.error_message && (
                    <p className="text-red-600"><strong>Erro:</strong> {row.error_message}</p>
                  )}
                </div>
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                  Quando a exclusão é concluída, removemos: credenciais de acesso, regras de auto-reply, histórico de comentários/mensagens, dados de concorrentes monitorados e publicações agendadas vinculadas à conta Instagram indicada. Alguns registros podem permanecer por obrigações legais (auditoria, cobranças) e são anonimizados.
                </div>
              </>
            );
          })()}
          <div className="pt-2 text-xs text-muted-foreground">
            <Link to="/instagram/privacidade" className="underline">Política de Privacidade</Link>
            {" · "}
            <Link to="/instagram/termos" className="underline">Termos de Uso</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
