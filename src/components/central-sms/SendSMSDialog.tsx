import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SendSMSDialogProps {
  clienteId: string;
  clienteNome: string;
  clienteNumero: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendSMSDialog({
  clienteId,
  clienteNome,
  clienteNumero,
  open,
  onOpenChange,
}: SendSMSDialogProps) {
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [configStatus, setConfigStatus] = useState<{ twilio: boolean } | null>(null);

  useEffect(() => {
    if (open) {
      loadTemplates();
      checkTwilioConfig();
      setMensagem("");
    }
  }, [open]);

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("sms_templates")
      .select("id, nome, conteudo")
      .eq("ativo", true)
      .order("nome");
    setTemplates(data ?? []);
  };

  const checkTwilioConfig = async () => {
    const { data } = await supabase
      .from("ligacoes_ia_config")
      .select("config_key, config_value")
      .in("config_key", ["twilio_account_sid", "twilio_auth_token", "twilio_phone_number"]);
    
    const map: Record<string, string> = {};
    (data ?? []).forEach((r: any) => map[r.config_key] = r.config_value ?? "");
    
    setConfigStatus({
      twilio: !!(map.twilio_account_sid && map.twilio_auth_token && map.twilio_phone_number),
    });
  };

  const handleSend = async () => {
    if (!mensagem.trim()) {
      toast.error("Digite uma mensagem antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ 
          cliente_id: clienteId,
          to: clienteNumero.replace(/\D/g, ""), 
          body: mensagem,
          source: 'perfil_cliente'
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar SMS");
      }
      
      toast.success(`SMS enviado para ${clienteNome}!`);
      onOpenChange(false);
    } catch (error: any) {
      console.error("SMS Error:", error);
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            Enviar SMS
          </DialogTitle>
          <DialogDescription>
            Envio rápido de SMS para <strong>{clienteNome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {configStatus && !configStatus.twilio && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              Configuração do Twilio incompleta nas Ligações IA.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="template">Template (Opcional)</Label>
              <Sparkles className="h-3 w-3 text-amber-500 animate-pulse" />
            </div>
            <Select onValueChange={(v) => {
              const t = templates.find(x => x.id === v);
              if (t) setMensagem(t.conteudo);
            }}>
              <SelectTrigger id="template" className="h-9">
                <SelectValue placeholder="Escolha um modelo" />
              </SelectTrigger>
              <SelectContent>
                {templates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mensagem">Mensagem</Label>
              <span className="text-[10px] text-muted-foreground">{mensagem.length}/160</span>
            </div>
            <Textarea
              id="mensagem"
              placeholder="Olá, {nome}! Como podemos ajudar?"
              className="min-h-[100px] resize-none"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              maxLength={160}
            />
            <p className="text-[10px] text-muted-foreground italic">
              Dica: Use {"{nome}"} para personalizar automaticamente.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            className="bg-blue-600 hover:bg-blue-700" 
            onClick={handleSend}
            disabled={sending || !configStatus?.twilio}
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar Agora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
