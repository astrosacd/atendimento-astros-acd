import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Smartphone, 
  QrCode, 
  Send, 
  History, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  MessageSquare
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

export function RCSTab() {
  const [activeTab, setActiveTab] = useState("conexao");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          Beta
        </Badge>
        <span className="text-sm text-muted-foreground italic">
          Envio gratuito usando seu próprio chip Android
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="conexao">
            <QrCode className="h-4 w-4 mr-2" />
            Conexão
          </TabsTrigger>
          <TabsTrigger value="enviar">
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </TabsTrigger>
          <TabsTrigger value="historico">
            <History className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao">
          <RCSConnection />
        </TabsContent>
        <TabsContent value="enviar">
          <RCSSend />
        </TabsContent>
        <TabsContent value="historico">
          <RCSHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RCSConnection() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("rcs_sessions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error loading RCS session:", error);
    } else {
      setSession(data);
    }
    setLoading(false);
  };

  const createSession = async () => {
    setRefreshing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Simulate generating a QR Code token
    const mockQrToken = `rcs-pair-${Math.random().toString(36).substring(7)}`;
    
    if (session) {
      await supabase
        .from("rcs_sessions")
        .update({ qr_code: mockQrToken, status: "pairing", updated_at: new Date().toISOString() })
        .eq("id", session.id);
    } else {
      await supabase
        .from("rcs_sessions")
        .insert({
          name: "Meu Android",
          status: "pairing",
          qr_code: mockQrToken,
          user_id: user.id
        });
    }
    
    await loadSession();
    setRefreshing(false);
    toast.success("Novo QR Code gerado!");
  };

  useEffect(() => {
    loadSession();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-muted-foreground">Verificando conexão...</p>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-600" />
              Status do Dispositivo
            </h3>
            <p className="text-sm text-muted-foreground">
              Conecte seu celular Android para habilitar o envio de RCS.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${session?.status === 'connected' ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  {session?.status === 'connected' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm">
                    {session?.status === 'connected' ? 'Dispositivo Conectado' : 'Aguardando Conexão'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session?.name || "Nenhum aparelho pareado"}
                  </p>
                </div>
              </div>
              <Badge variant={session?.status === 'connected' ? 'default' : 'secondary'} className={session?.status === 'connected' ? 'bg-emerald-500' : ''}>
                {session?.status === 'connected' ? 'Online' : 'Offline'}
              </Badge>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold uppercase tracking-wider">Como conectar:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Instale o App <strong>Gateway RCS</strong> no seu Android.</li>
                    <li>Abra o App e clique em "Escanear QR Code".</li>
                    <li>Aponte a câmera para o código ao lado.</li>
                    <li>Mantenha o celular conectado à internet.</li>
                  </ol>
                </div>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full" 
              onClick={createSession}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Gerar Novo QR Code / Atualizar
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border-2 border-dashed border-muted shadow-inner min-h-[300px]">
          {session?.qr_code ? (
            <>
              <div className="p-4 bg-white rounded-lg shadow-md mb-4 border border-slate-100">
                <QRCodeSVG value={session.qr_code} size={200} />
              </div>
              <p className="text-[10px] text-muted-foreground font-mono">
                Token: {session.qr_code}
              </p>
              <p className="text-xs mt-2 text-center text-muted-foreground italic">
                Aponte o app do gateway para este código
              </p>
            </>
          ) : (
            <div className="text-center space-y-3">
              <QrCode className="h-16 w-16 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">Clique no botão para gerar o QR Code</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RCSSend() {
  const [numero, setNumero] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [sending, setSending] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("rcs_sessions").select("*").eq("user_id", user.id).maybeSingle();
      setSession(data);
    };
    checkSession();
  }, []);

  const handleSend = async () => {
    if (!numero || !mensagem) return toast.error("Preencha todos os campos");
    if (!session || session.status !== 'connected') {
      return toast.error("Seu celular Android não está conectado.");
    }

    setSending(true);
    
    try {
      // Create message in history first
      const { data: msgData, error: msgError } = await supabase
        .from("rcs_messages")
        .insert({
          session_id: session.id,
          numero_destino: numero,
          conteudo: mensagem,
          status: 'pendente',
          user_id: session.user_id
        })
        .select()
        .single();

      if (msgError) throw msgError;

      // In a real scenario, this would call an Edge Function
      // For now we simulate success after 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await supabase
        .from("rcs_messages")
        .update({ status: 'enviado' })
        .eq("id", msgData.id);

      toast.success("Ordem de envio enviada para o seu celular!");
      setMensagem("");
      setNumero("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-6 max-w-xl mx-auto">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-blue-700 bg-blue-50 p-3 rounded-lg text-sm border border-blue-100">
          <MessageSquare className="h-4 w-4" />
          <span>O envio será feito via RCS pelo chip do seu celular conectado.</span>
        </div>

        <div className="space-y-1">
          <Label>Número do Celular (com DDD)</Label>
          <Input 
            value={numero} 
            onChange={e => setNumero(e.target.value)} 
            placeholder="5511999999999" 
            className="font-mono"
          />
        </div>

        <div className="space-y-1">
          <Label>Mensagem</Label>
          <Textarea 
            value={mensagem} 
            onChange={e => setMensagem(e.target.value)} 
            placeholder="Escreva sua mensagem RCS..."
            rows={4}
          />
        </div>

        <Button 
          className="w-full h-12 bg-blue-600 hover:bg-blue-700" 
          onClick={handleSend}
          disabled={sending || !session || session.status !== 'connected'}
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {session?.status === 'connected' ? 'Enviar via RCS' : 'Conecte um Celular Primeiro'}
        </Button>
      </div>
    </Card>
  );
}

function RCSHistory() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("rcs_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setMessages(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'enviado': return <Badge className="bg-emerald-500">Enviado</Badge>;
      case 'erro': return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="secondary" className="animate-pulse">Pendente</Badge>;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Histórico RCS</h2>
        <Button size="sm" variant="outline" onClick={loadHistory}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-3">
        {loading && messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Carregando histórico...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">Nenhuma mensagem RCS enviada ainda.</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-3 rounded-lg border bg-card flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getStatusBadge(m.status)}
                  <span className="font-medium text-sm">{m.numero_destino}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(m.created_at), "dd/MM HH:mm")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">"{m.conteudo}"</p>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
