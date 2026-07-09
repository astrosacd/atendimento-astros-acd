import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertTriangle, MessageCircle, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  log: {
    id: string;
    cliente_id: string | null;
    cliente_nome: string;
    cliente_produto: string | null;
    channel: string;
    message_type: string;
    sent_at: string;
    message_body?: string | null;
  } | null;
}

// Fallback A: reconstruct message using current billing_config template + client data
async function reconstructMessage(log: NonNullable<Props["log"]>): Promise<{ body: string; isFallback: true }> {
  const templateKeyMap: Record<string, string> = {
    d_menos_3: "message_d_menos_3",
    d_zero: "message_d_zero",
    d_mais_1: "message_d_mais_1",
    d_mais_2: "message_d_mais_2",
    d_mais_15: "message_d_mais_15",
    d_mais_30: "message_d_mais_30",
    recibo: "message_recibo",
  };
  const key = templateKeyMap[log.message_type];

  const [configRes, clienteRes] = await Promise.all([
    key
      ? supabase.from("billing_config").select("config_key,config_value").eq("config_key", key).maybeSingle()
      : Promise.resolve({ data: null } as any),
    log.cliente_id
      ? supabase.from("clientes").select("nome,valor,produto,data_renovacao,plano,email,cpf,numero").eq("id", log.cliente_id).maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);

  const template: string = (configRes?.data as any)?.config_value || "(Template não encontrado)";
  const cli: any = clienteRes?.data || {};

  const formattedDate = cli.data_renovacao
    ? new Date(cli.data_renovacao + "T00:00:00").toLocaleDateString("pt-BR")
    : "";
  const formattedValue = cli.valor != null
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cli.valor))
    : "";

  const vars: Record<string, string> = {
    nome: cli.nome || log.cliente_nome || "",
    valor: formattedValue,
    produto: cli.produto || log.cliente_produto || "",
    data_renovacao: formattedDate,
    plano: cli.plano || "",
    email: cli.email || "",
    cpf: cli.cpf || "",
    link_pagamento: "(link gerado no momento do envio)",
  };

  const body = template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
  return { body, isFallback: true };
}

export function MessagePreviewDialog({ open, onOpenChange, log }: Props) {
  const [content, setContent] = useState<{ body: string; isFallback: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !log) {
      setContent(null);
      return;
    }
    if (log.message_body && log.message_body.trim()) {
      setContent({ body: log.message_body, isFallback: false });
      return;
    }
    setLoading(true);
    reconstructMessage(log)
      .then(setContent)
      .finally(() => setLoading(false));
  }, [open, log]);

  const isEmail = log?.channel === "email";
  const isHtml = isEmail && content?.body && /<[a-z][\s\S]*>/i.test(content.body);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Prévia da mensagem enviada
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={`text-[10px] h-5 gap-1 ${isEmail ? 'text-blue-500 border-blue-500/30' : 'text-emerald-500 border-emerald-500/30'}`}>
              {isEmail ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
              {isEmail ? "Email" : "WhatsApp"}
            </Badge>
            <span className="text-xs">{log?.cliente_nome}</span>
            {log?.sent_at && (
              <span className="text-xs text-muted-foreground">
                • {new Date(log.sent_at).toLocaleString("pt-BR")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {content?.isFallback && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-500">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Prévia reconstruída com o template atual — a mensagem original não foi salva no envio.
              Mensagens novas mostrarão o texto real enviado.
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto rounded-lg border bg-muted/30 p-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
              Carregando prévia...
            </div>
          ) : !content ? (
            <p className="text-sm text-muted-foreground italic">Sem conteúdo disponível.</p>
          ) : isHtml ? (
            <iframe
              srcDoc={content.body}
              title="Prévia do email"
              sandbox=""
              className="w-full min-h-[400px] rounded bg-white"
            />
          ) : (
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {content.body}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
