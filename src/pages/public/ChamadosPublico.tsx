import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Ticket, 
  Search, 
  Plus, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  Send,
  HelpCircle,
  ShieldCheck,
  ChevronRight,
  History,
  Info,
  ExternalLink,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Chamado {
  id: string;
  codigo: string;
  nome: string;
  email: string;
  motivo: string;
  contato: string;
  status: string;
  prioridade: string;
  created_at: string;
  updated_at: string;
  hash_acesso?: string;
  chamados_comentarios?: Comentario[];
}

interface Comentario {
  id: string;
  conteudo: string;
  autor_nome: string;
  tipo: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  aberto: { label: "Aberto", color: "text-blue-400", bg: "bg-blue-500/10", icon: AlertCircle },
  em_andamento: { label: "Em Atendimento", color: "text-amber-400", bg: "bg-amber-500/10", icon: Clock },
  aguardando_cliente: { label: "Aguardando Você", color: "text-purple-400", bg: "bg-purple-500/10", icon: User },
  resolvido: { label: "Resolvido", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
  fechado: { label: "Fechado", color: "text-slate-400", bg: "bg-slate-500/10", icon: ShieldCheck },
};

export default function ChamadosPublico() {
  const [searchParams] = useSearchParams();
  const hashFromUrl = searchParams.get("hash");

  const [activeTab, setActiveTab] = useState(hashFromUrl ? "consultar" : "abrir");
  const [loading, setLoading] = useState(false);

  // Form states - Abertura
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [motivo, setMotivo] = useState("");
  const [contato, setContato] = useState("");
  const [codigoVerificacaoAbertura, setCodigoVerificacaoAbertura] = useState("");
  const [aberturaAguardandoCodigo, setAberturaAguardandoCodigo] = useState(false);
  const [aberturaEmailVerificado, setAberturaEmailVerificado] = useState(false);

  // Form states - Consulta
  const [codigoBusca, setCodigoBusca] = useState("");
  const [emailBusca, setEmailBusca] = useState("");
  const [codigoVerificacao, setCodigoVerificacao] = useState("");
  const [hashBusca, setHashBusca] = useState(hashFromUrl || "");
  const [aguardandoCodigo, setAguardandoCodigo] = useState(false);

  // Resultado
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [chamadosDoEmail, setChamadosDoEmail] = useState<Chamado[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  const extractInvokeError = async (error: any, fallback: string) => {
    let msg = error?.message || fallback;
    try {
      const ctx = error?.context;
      if (ctx && typeof ctx.json === "function") {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* ignore */ }
    return msg;
  };

  const criarChamado = async () => {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("api-chamados", {
        method: "POST",
        body: { nome, email, motivo, contato },
      });

      if (error) throw new Error(await extractInvokeError(error, "Erro ao criar chamado"));
      if (data?.error) throw new Error(data.error);

      const chamadoData = data?.chamado || data;
      toast.success(`Chamado criado com sucesso! Código: ${chamadoData.codigo}`);

      const { data: chamadoCompleto, error: errCompleto } = await supabase.functions.invoke("api-chamados", {
        method: "POST",
        body: { action: "buscar_por_hash", hash: chamadoData.hash_acesso },
      });

      if (errCompleto) throw new Error(await extractInvokeError(errCompleto, "Erro ao buscar chamado"));

      setChamado(chamadoCompleto);
      setHashBusca(chamadoData.hash_acesso);
      setComentarios(chamadoCompleto?.chamados_comentarios || []);

      setNome("");
      setEmail("");
      setMotivo("");
      setContato("");
      setCodigoVerificacaoAbertura("");
      setAberturaAguardandoCodigo(false);
      setAberturaEmailVerificado(false);
      setActiveTab("consultar");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar chamado");
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aberturaEmailVerificado) {
      if (!email) {
        toast.error("Informe o email");
        return;
      }
      if (!aberturaAguardandoCodigo) {
        await handleEnviarCodigoVerificacaoAbertura();
      } else {
        toast.error("Digite o código enviado ao seu email para continuar");
      }
      return;
    }
    await criarChamado();
  };

  const handleBuscarPorCodigo = async () => {
    const codigoLimpo = codigoBusca.trim().toUpperCase();
    if (!codigoLimpo) {
      toast.error("Informe o código do chamado");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-chamados", {
        method: "POST",
        body: { action: "buscar_por_codigo", codigo: codigoLimpo },
      });

      if (error) {
        setChamado(null);
        toast.error(await extractInvokeError(error, "Erro ao buscar chamado"));
        return;
      }
      if (!data || data.error) {
        setChamado(null);
        toast.error(data?.error || "Chamado não encontrado");
        return;
      }

      setChamadosDoEmail([]);
      setChamado(data);
      setHashBusca(data.hash_acesso || "");
      setComentarios(data.chamados_comentarios || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar chamado");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarCodigoVerificacao = async () => {
    if (!emailBusca) {
      toast.error("Informe o email");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chamados-verificacao", {
        method: "POST",
        body: { action: "send", email: emailBusca, tipo: "consulta" },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Nenhum chamado encontrado para este email");
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Código enviado com sucesso");
      setAguardandoCodigo(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarCodigo = async () => {
    if (!codigoVerificacao) {
      toast.error("Informe o código de verificação");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chamados-verificacao", {
        method: "POST",
        body: { action: "verify", email: emailBusca, codigo: codigoVerificacao },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Código inválido ou expirado");
      if (data?.error) throw new Error(data.error);

      if (data?.chamados && data.chamados.length > 0) {
        setChamadosDoEmail(data.chamados);
        setChamado(data.chamados[0]);
        setHashBusca(data.chamados[0].hash_acesso || "");
        setComentarios(data.chamados[0].chamados_comentarios || []);
        toast.success(`Encontramos ${data.chamados.length} chamado(s).`);
      } else {
        setChamadosDoEmail([]);
        toast.success("Email confirmado com sucesso");
      }
    } catch (error: any) {
      toast.error(error.message || "Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarCodigoVerificacaoAbertura = async () => {
    if (!email) {
      toast.error("Informe o email");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chamados-verificacao", {
        method: "POST",
        body: { action: "send", email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(data?.message || "Código enviado com sucesso");
      setAberturaAguardandoCodigo(true);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar código");
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarCodigoAbertura = async () => {
    if (!codigoVerificacaoAbertura) {
      toast.error("Informe o código");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chamados-verificacao", {
        method: "POST",
        body: { action: "verify", email, codigo: codigoVerificacaoAbertura },
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Código inválido ou expirado");
      if (data?.error) throw new Error(data.error);

      setAberturaEmailVerificado(true);
      toast.success("Email confirmado.");
      await criarChamado();
    } catch (error: any) {
      toast.error(error.message || "Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarPorHash = async () => {
    if (!hashBusca) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-chamados", {
        method: "POST",
        body: { action: "buscar_por_hash", hash: hashBusca },
      });
      if (error) throw error;
      if (!data) {
        toast.error("Chamado não encontrado");
        return;
      }
      setChamadosDoEmail([]);
      setChamado(data);
      setComentarios(data.chamados_comentarios || []);
    } catch (error: any) {
      toast.error(error.message || "Erro ao buscar chamado");
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarComentario = async () => {
    if (!novoComentario.trim() || !chamado) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("chamados-comentario", {
        method: "POST",
        body: {
          chamado_id: chamado.id,
          hash_acesso: hashBusca || chamado.hash_acesso,
          conteudo: novoComentario,
          autor_nome: chamado.nome,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Comentário enviado");
      setNovoComentario("");
      if (data?.comentario) {
        setComentarios(prev => [...prev, data.comentario]);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar comentário");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hashFromUrl) {
      handleBuscarPorHash();
    }
  }, [hashFromUrl]);

  const [searchMethod, setSearchMethod] = useState<"codigo" | "email">("codigo");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.05),transparent)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(var(--primary),0.05),transparent)] pointer-events-none" />
      <div className="relative overflow-hidden bg-primary/10 border-b border-white/5 py-16 text-foreground md:py-24">
        <div className="absolute inset-0 z-0 opacity-10">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 100 C 20 0 50 0 100 100" stroke="currentColor" strokeWidth="0.5" />
            <path d="M0 0 C 30 100 70 100 100 0" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
            <div className="mb-6 rounded-3xl bg-primary/20 p-5 backdrop-blur-xl border border-primary/30 shadow-2xl shadow-primary/20">
              <Ticket className="h-10 w-10 md:h-12 md:w-12" />
            </div>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight md:text-6xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Central de Suporte</h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl font-medium">Estamos aqui para ajudar com suas dúvidas e solicitações.</p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto -mt-8 px-4 pb-20 md:-mt-12">
        <div className="mx-auto max-w-4xl">
          {!chamado ? (
            <Card className="border-white/10 bg-card/40 shadow-2xl shadow-black/50 backdrop-blur-3xl border-2">
              <CardHeader className="pb-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-white/5 p-1 border border-white/5">
                    <TabsTrigger value="abrir" className="flex items-center gap-2 rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Plus className="h-4 w-4" />
                      <span className="font-semibold">Abrir Chamado</span>
                    </TabsTrigger>
                    <TabsTrigger value="consultar" className="flex items-center gap-2 rounded-xl transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Search className="h-4 w-4" />
                      <span className="font-semibold">Consultar</span>
                    </TabsTrigger>
                  </TabsList>
                  <div className="mt-8 pb-8">
                    <AnimatePresence mode="wait">
                      {activeTab === "abrir" && (
                        <motion.div key="abrir" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                          <form onSubmit={handleAbrirChamado} className="space-y-6">
                            {!aberturaAguardandoCodigo ? (
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <Label className="text-sm font-bold text-foreground/80">Nome Completo</Label>
                                    <div className="relative">
                                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                      <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: João da Silva" className="pl-10 h-11 bg-white/5 border-white/10" required />
                                    </div>
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-sm font-bold text-foreground/80">Email</Label>
                                    <div className="relative">
                                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                      <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="pl-10 h-11 bg-white/5 border-white/10" required />
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-bold text-foreground/80">WhatsApp / Telefone</Label>
                                  <div className="relative">
                                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(00) 00000-0000" className="pl-10 h-11 bg-white/5 border-white/10" required />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-sm font-bold text-foreground/80">Sua Mensagem</Label>
                                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva sua solicitação..." className="min-h-[150px] resize-none bg-white/5 border-white/10" required />
                                </div>
                                <Button type="submit" className="w-full h-14 text-lg font-bold shadow-xl shadow-primary/20" disabled={loading}>
                                  {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <><Plus className="mr-2 h-5 w-5" /> Abrir Chamado Agora</>}
                                </Button>
                              </>
                            ) : (
                              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6 space-y-4 backdrop-blur-xl">
                                <div className="flex items-start gap-4">
                                  <div className="rounded-full bg-primary/20 p-2 border border-primary/30"><Mail className="h-6 w-6 text-primary" /></div>
                                  <div>
                                    <h3 className="text-lg font-bold text-foreground">Verifique seu Email</h3>
                                    <p className="text-sm text-muted-foreground">Código enviado para <span className="font-bold text-primary">{email}</span>.</p>
                                  </div>
                                </div>
                                <div className="flex gap-3">
                                  <Input value={codigoVerificacaoAbertura} onChange={(e) => setCodigoVerificacaoAbertura(e.target.value)} placeholder="000000" maxLength={6} className="flex-1 h-12 text-center text-xl font-bold tracking-widest bg-white/5 border-white/10" />
                                  <Button type="button" onClick={handleVerificarCodigoAbertura} disabled={loading} className="h-12 px-6">Verificar</Button>
                                </div>
                                <Button type="button" variant="ghost" className="w-full" onClick={() => setAberturaAguardandoCodigo(false)} disabled={loading}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
                              </div>
                            )}
                          </form>
                        </motion.div>
                      )}
                      {activeTab === "consultar" && (
                        <motion.div key="consultar" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }} className="space-y-6">
                          <Tabs value={searchMethod} onValueChange={(v) => setSearchMethod(v as any)} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/5 border border-white/5">
                              <TabsTrigger value="codigo" className="text-xs font-semibold uppercase">Pelo Código</TabsTrigger>
                              <TabsTrigger value="email" className="text-xs font-semibold uppercase">Pelo Email</TabsTrigger>
                            </TabsList>
                            <TabsContent value="codigo" className="space-y-4 pt-2">
                              <Label className="text-sm font-bold text-foreground/80">Código do Chamado</Label>
                              <div className="flex gap-2">
                                <Input value={codigoBusca} onChange={(e) => setCodigoBusca(e.target.value)} placeholder="Ex: ACD-123456" className="h-12 bg-white/5 border-white/10" />
                                <Button onClick={handleBuscarPorCodigo} disabled={loading} className="h-12 w-12 p-0"><Search className="h-5 w-5" /></Button>
                              </div>
                            </TabsContent>
                            <TabsContent value="email" className="space-y-4 pt-2">
                              {!aguardandoCodigo ? (
                                <>
                                  <Label className="text-sm font-bold text-foreground/80">Email Cadastrado</Label>
                                  <div className="flex gap-2">
                                    <Input value={emailBusca} onChange={(e) => setEmailBusca(e.target.value)} placeholder="seu@email.com" className="h-12 bg-white/5 border-white/10" />
                                    <Button onClick={handleEnviarCodigoVerificacao} disabled={loading} className="h-12">Enviar Código</Button>
                                  </div>
                                </>
                              ) : (
                                <div className="space-y-4">
                                  <div className="rounded-lg bg-white/5 p-4 border border-white/10">
                                    <p className="text-sm text-muted-foreground font-medium">Digite o código enviado para <span className="text-primary font-bold">{emailBusca}</span></p>
                                  </div>
                                  <div className="flex gap-2">
                                    <Input value={codigoVerificacao} onChange={(e) => setCodigoVerificacao(e.target.value)} placeholder="000000" maxLength={6} className="flex-1 h-12 text-center text-xl font-bold tracking-widest bg-white/5 border-white/10" />
                                    <Button onClick={handleVerificarCodigo} disabled={loading} className="h-12">Verificar</Button>
                                    <Button variant="outline" onClick={() => setAguardandoCodigo(false)} className="h-12">Voltar</Button>
                                  </div>
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </Tabs>
              </CardHeader>
            </Card>
          ) : (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <Card className="border-white/10 bg-card/60 shadow-2xl backdrop-blur-3xl border-2">
                <CardHeader className="border-b border-white/5 bg-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-2xl bg-primary/20 p-2.5 shadow-lg border border-primary/30"><Ticket className="h-6 w-6 text-primary" /></div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-bold tracking-tight text-foreground">{chamado.codigo}</h2>
                          <Badge className={`${statusConfig[chamado.status].bg} ${statusConfig[chamado.status].color} border-none font-bold uppercase text-[10px]`}>
                            {statusConfig[chamado.status].label}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Aberto em {format(new Date(chamado.created_at), "PPP 'às' p", { locale: ptBR })}</p>
                      </div>
                    </div>
                    <Button variant="outline" onClick={() => { setChamado(null); setChamadosDoEmail([]); setComentarios([]); setAguardandoCodigo(false); }} className="gap-2 font-semibold">
                      <ArrowLeft className="h-4 w-4" /> Voltar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-8">
                  {chamadosDoEmail.length > 1 && (
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 shadow-inner">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Seus Chamados Ativos</p>
                      <div className="flex flex-wrap gap-2">
                        {chamadosDoEmail.map(c => (
                          <Button key={c.id} size="sm" variant={c.id === chamado.id ? "default" : "outline"} onClick={() => { setChamado(c); setComentarios(c.chamados_comentarios || []); }} className="rounded-full h-8 px-4 font-bold text-xs">
                            {c.codigo}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
                    <div className="space-y-6 flex flex-col">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1 p-3 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Responsável</p>
                          <p className="font-bold text-foreground truncate">{chamado.nome}</p>
                        </div>
                        <div className="space-y-1 p-3 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contato</p>
                          <p className="font-bold text-foreground truncate">{chamado.contato}</p>
                        </div>
                        <div className="sm:col-span-2 space-y-1 p-3 rounded-xl bg-white/5 border border-white/5">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prioridade</p>
                          <Badge variant="outline" className="font-bold capitalize border-white/10">{chamado.prioridade}</Badge>
                        </div>
                      </div>

                      <div className="flex-1 rounded-2xl border border-white/5 p-6 bg-white/5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Descrição da Solicitação</p>
                        <p className="text-foreground/90 leading-relaxed font-medium whitespace-pre-wrap text-sm">{chamado.motivo}</p>
                      </div>
                    </div>

                    <div className="space-y-4 flex flex-col min-h-[500px]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          <h3 className="font-bold text-foreground">Conversa</h3>
                        </div>
                        <Badge variant="secondary" className="font-bold text-[10px] uppercase">{comentarios.length} Interações</Badge>
                      </div>

                      <div className="flex-1 space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                        {comentarios.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center py-12 border-2 border-dashed border-white/10 rounded-2xl bg-white/5">
                            <HelpCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-sm text-muted-foreground font-medium">Aguardando resposta técnica...</p>
                          </div>
                        ) : (
                          comentarios.map((c) => {
                            const isTech = c.tipo !== "cliente";
                            return (
                              <div key={c.id} className={`flex flex-col ${isTech ? "items-start" : "items-end"}`}>
                                <div className={`max-w-[90%] rounded-2xl p-4 shadow-xl border ${isTech ? "bg-card border-white/5 rounded-tl-none" : "bg-primary text-primary-foreground rounded-tr-none"}`}>
                                  <div className="flex items-center justify-between gap-8 mb-2">
                                    <span className={`text-[10px] font-extrabold uppercase tracking-widest ${isTech ? "text-primary" : "text-primary-foreground/80"}`}>{isTech ? "Suporte" : "Você"}</span>
                                    <span className={`text-[10px] font-medium opacity-60`}>{format(new Date(c.created_at), "HH:mm")}</span>
                                  </div>
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.conteudo}</p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {chamado.status !== "fechado" && chamado.status !== "resolvido" ? (
                        <div className="relative pt-2">
                          <Textarea 
                            value={novoComentario} 
                            onChange={(e) => setNovoComentario(e.target.value)} 
                            placeholder="Sua resposta..." 
                            className="min-h-[100px] p-4 pr-14 rounded-2xl border-white/10 bg-white/5 focus:ring-primary/20 focus:border-primary transition-all resize-none shadow-inner text-sm" 
                          />
                          <Button 
                            onClick={handleEnviarComentario} 
                            disabled={loading || !novoComentario.trim()} 
                            className="absolute bottom-4 right-4 h-10 w-10 p-0 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all"
                          >
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-white/5 p-4 text-center border border-dashed border-white/10">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chamado encerrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
