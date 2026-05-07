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
  Info
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
  aberto: { label: "Aberto", color: "text-blue-600", bg: "bg-blue-50", icon: AlertCircle },
  em_andamento: { label: "Em Atendimento", color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
  aguardando_cliente: { label: "Aguardando Você", color: "text-purple-600", bg: "bg-purple-50", icon: User },
  resolvido: { label: "Resolvido", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
  fechado: { label: "Fechado", color: "text-gray-600", bg: "bg-gray-100", icon: ShieldCheck },
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

      // A API retorna { success, chamado: {...} }
      const chamadoData = data?.chamado || data;

      toast.success(`Chamado criado com sucesso! Código: ${chamadoData.codigo}`);

      // Buscar dados completos pelo hash (via backend), para garantir datas/relacionamentos
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

    // Primeiro clique em "Abrir Chamado" = envia o código e mostra o campo para validar
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

    // Depois de verificado, cria o chamado
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
        const ctx = (error as any)?.context;
        let msg = error.message || "Erro ao buscar chamado";
        try {
          if (ctx && typeof ctx.json === "function") {
            const j = await ctx.json();
            if (j?.error) msg = j.error;
          }
        } catch { /* ignore */ }
        toast.error(msg);
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

      toast.success(data?.message || "Código de verificação processado");
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
        const comentariosPublicos = data.chamados[0].chamados_comentarios || [];
        setComentarios(comentariosPublicos);
        toast.success(`Encontramos ${data.chamados.length} chamado(s) para este email.`);
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

      toast.success(data?.message || "Código de verificação processado");
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
      toast.success("Email confirmado. Enviando o chamado...");
      await criarChamado();
    } catch (error: any) {
      toast.error(error.message || "Código inválido ou expirado");
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarPorHash = async () => {
    if (!hashBusca) {
      toast.error("Hash de acesso não informado");
      return;
    }

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

  const carregarComentarios = async (chamadoId: string) => {
    try {
      const { data, error } = await supabase
        .from("chamados_comentarios")
        .select("*")
        .eq("chamado_id", chamadoId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComentarios(data || []);
    } catch (error) {
      console.error("Erro ao carregar comentários:", error);
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
      
      // Adicionar o comentário retornado diretamente ao estado local
      if (data?.comentario) {
        setComentarios(prev => [...prev, data.comentario]);
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar comentário");
    } finally {
      setLoading(false);
    }
  };

  // Auto-buscar por hash na URL
  useState(() => {
    if (hashFromUrl) {
      setChamadosDoEmail([]);
      handleBuscarPorHash();
    }
  });

  const [searchMethod, setSearchMethod] = useState<"codigo" | "email">("codigo");

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Professional Hero Section */}
      <div className="relative overflow-hidden bg-primary py-16 text-primary-foreground md:py-24">
        <div className="absolute inset-0 z-0 opacity-20">
          <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 100 C 20 0 50 0 100 100" stroke="currentColor" strokeWidth="0.5" />
            <path d="M0 0 C 30 100 70 100 100 0" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center"
          >
            <div className="mb-6 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <Ticket className="h-10 w-10 md:h-12 md:w-12" />
            </div>
            <h1 className="mb-4 text-3xl font-extrabold tracking-tight md:text-5xl">
              Central de Atendimento
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
              Estamos aqui para ajudar. Abra um novo chamado ou acompanhe o progresso de suas solicitações existentes.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto -mt-8 px-4 pb-20 md:-mt-12">
        <div className="mx-auto max-w-4xl">


        {!chamado ? (
          <Card className="border-none bg-white/70 shadow-xl shadow-slate-200/50 backdrop-blur-xl">
            <CardHeader className="pb-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1">
                  <TabsTrigger 
                    value="abrir" 
                    className="flex items-center gap-2 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="font-semibold">Abrir Chamado</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="consultar" 
                    className="flex items-center gap-2 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm"
                  >
                    <Search className="h-4 w-4" />
                    <span className="font-semibold">Consultar</span>
                  </TabsTrigger>
                </TabsList>


                <div className="mt-8 pb-8">
                  <AnimatePresence mode="wait">
                    {activeTab === "abrir" && (
                      <motion.div
                        key="abrir-tab"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <form onSubmit={handleAbrirChamado} className="space-y-6">
                          {!aberturaAguardandoCodigo ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                  <Label htmlFor="nome" className="text-sm font-bold text-slate-700">Seu Nome Completo</Label>
                                  <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                      id="nome"
                                      value={nome}
                                      onChange={(e) => setNome(e.target.value)}
                                      placeholder="Ex: João da Silva"
                                      className="pl-10 h-11 border-slate-200 focus:border-primary focus:ring-primary/20"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="email" className="text-sm font-bold text-slate-700">Seu Melhor Email</Label>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                      id="email"
                                      type="email"
                                      value={email}
                                      onChange={(e) => {
                                        setEmail(e.target.value);
                                        setAberturaEmailVerificado(false);
                                        setAberturaAguardandoCodigo(false);
                                        setCodigoVerificacaoAbertura("");
                                      }}
                                      placeholder="contato@empresa.com"
                                      className="pl-10 h-11 border-slate-200 focus:border-primary focus:ring-primary/20"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="contato" className="text-sm font-bold text-slate-700">WhatsApp / Telefone</Label>
                                <div className="relative">
                                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                  <Input
                                    id="contato"
                                    value={contato}
                                    onChange={(e) => setContato(e.target.value)}
                                    placeholder="(00) 00000-0000"
                                    className="pl-10 h-11 border-slate-200 focus:border-primary focus:ring-primary/20"
                                    required
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="motivo" className="text-sm font-bold text-slate-700">O que está acontecendo?</Label>
                                <Textarea
                                  id="motivo"
                                  value={motivo}
                                  onChange={(e) => setMotivo(e.target.value)}
                                  placeholder="Descreva detalhadamente sua dúvida ou problema para que possamos ajudar da melhor forma..."
                                  className="min-h-[150px] border-slate-200 focus:border-primary focus:ring-primary/20 resize-none"
                                  required
                                />
                              </div>

                              <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={loading}>
                                {loading ? (
                                  <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processando...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="mr-2 h-5 w-5" />
                                    Abrir Chamado Agora
                                  </>
                                )}
                              </Button>

                              <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-4 text-xs text-slate-500 border border-slate-100">
                                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                                <p>
                                  Sua segurança é prioridade. Ao clicar em abrir chamado, enviaremos um código de verificação para o seu email para garantir que você tenha acesso exclusivo à sua solicitação.
                                </p>
                              </div>
                            </>
                          ) : (
                            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-4">
                              <div className="flex items-start gap-4">
                                <div className="rounded-full bg-primary/10 p-2">
                                  <Mail className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                  <h3 className="text-lg font-bold text-slate-900">Verifique seu Email</h3>
                                  <p className="text-sm text-slate-600">
                                    Enviamos um código de 6 dígitos para <span className="font-bold text-primary">{email}</span>. Insira-o abaixo para confirmar.
                                  </p>
                                </div>
                              </div>

                              <div className="flex gap-3">
                                <Input
                                  value={codigoVerificacaoAbertura}
                                  onChange={(e) => setCodigoVerificacaoAbertura(e.target.value)}
                                  placeholder="000 000"
                                  maxLength={6}
                                  className="flex-1 h-12 text-center text-xl font-bold tracking-[0.5em] border-primary/30 focus:border-primary focus:ring-primary/20"
                                />
                                <Button type="button" onClick={handleVerificarCodigoAbertura} disabled={loading} className="h-12 px-6">
                                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirmar"}
                                </Button>
                              </div>

                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full text-slate-500 hover:text-primary"
                                onClick={() => {
                                  setAberturaAguardandoCodigo(false);
                                  setCodigoVerificacaoAbertura("");
                                }}
                                disabled={loading}
                              >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar para editar email
                              </Button>
                            </div>
                          )}
                        </form>
                      </motion.div>
                    )}

                    {activeTab === "consultar" && (
                      <motion.div
                        key="consultar-tab"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                      >

                  <div className="flex flex-col gap-4">
                    <Label className="text-sm font-medium">Método de Consulta</Label>
                    <Tabs value={searchMethod} onValueChange={(v) => setSearchMethod(v as "codigo" | "email")} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="codigo" className="text-xs">Código do Chamado</TabsTrigger>
                        <TabsTrigger value="email" className="text-xs">Email do Cliente</TabsTrigger>
                      </TabsList>

                      <TabsContent value="codigo" className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="codigoBusca">Código do Chamado</Label>
                          <div className="flex gap-2">
                            <Input
                              id="codigoBusca"
                              value={codigoBusca}
                              onChange={(e) => {
                                setCodigoBusca(e.target.value);
                                setEmailBusca("");
                                setAguardandoCodigo(false);
                              }}
                              placeholder="ACD-20251222153045"
                              className="flex-1"
                              disabled={aguardandoCodigo}
                            />
                            <Button
                              onClick={handleBuscarPorCodigo}
                              disabled={loading || !codigoBusca.trim()}
                            >
                              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="email" className="space-y-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="emailBusca">Email cadastrado</Label>
                          {!aguardandoCodigo ? (
                            <div className="flex gap-2">
                              <Input
                                id="emailBusca"
                                type="email"
                                value={emailBusca}
                                onChange={(e) => {
                                  setEmailBusca(e.target.value);
                                  setCodigoBusca("");
                                }}
                                placeholder="seu@email.com"
                                className="flex-1"
                              />
                              <Button
                                onClick={handleEnviarCodigoVerificacao}
                                disabled={loading || !emailBusca.trim()}
                              >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Código"}
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                                Digite o código de 6 dígitos enviado para <span className="font-semibold text-foreground">{emailBusca}</span>
                              </p>
                              <div className="flex gap-2">
                                <Input
                                  value={codigoVerificacao}
                                  onChange={(e) => setCodigoVerificacao(e.target.value)}
                                  placeholder="000000"
                                  maxLength={6}
                                  className="flex-1"
                                />
                                <Button onClick={handleVerificarCodigo} disabled={loading}>
                                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                                </Button>
                                <Button variant="outline" onClick={() => setAguardandoCodigo(false)}>
                                  Voltar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  {hashBusca && !chamado && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                          <AlertCircle className="h-4 w-4" />
                          <h3 className="font-medium">Link de acesso rápido detectado</h3>
                        </div>
                        <Button onClick={handleBuscarPorHash} disabled={loading} className="w-full" variant="secondary">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Abrir chamado pendente
                        </Button>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      {chamado.codigo}
                    </CardTitle>
                    <CardDescription>
                      Aberto em {new Date(chamado.created_at).toLocaleString("pt-BR")}
                    </CardDescription>
                  </div>
                  <Badge className={`px-3 py-1 ${statusConfig[chamado.status].bg} ${statusConfig[chamado.status].color}`}>
                    <span className="flex items-center gap-1.5">
                      {(() => { const Icon = statusConfig[chamado.status].icon; return <Icon className="h-3.5 w-3.5" />; })()}
                      {statusConfig[chamado.status].label}
                    </span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {chamadosDoEmail.length > 1 && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <Label className="text-muted-foreground">Seus chamados ({chamadosDoEmail.length})</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {chamadosDoEmail.map((c) => (
                        <Button
                          key={c.id}
                          type="button"
                          size="sm"
                          variant={c.id === chamado.id ? "default" : "outline"}
                          onClick={() => {
                            setChamado(c);
                            setHashBusca(c.hash_acesso || "");
                            setComentarios(c.chamados_comentarios || []);
                          }}
                        >
                          {c.codigo}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Nome</Label>
                    <p className="font-medium">{chamado.nome}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Email</Label>
                    <p className="font-medium">{chamado.email}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Contato</Label>
                    <p className="font-medium">{chamado.contato}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Última Atualização</Label>
                    <p className="font-medium">{new Date(chamado.updated_at).toLocaleString("pt-BR")}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Descrição do Problema</Label>
                  <p className="mt-1 whitespace-pre-wrap">{chamado.motivo}</p>
                </div>

                <Button
                  variant="outline"
                  onClick={() => {
                    setChamado(null);
                    setChamadosDoEmail([]);
                    setComentarios([]);
                    setCodigoBusca("");
                    setEmailBusca("");
                    setCodigoVerificacao("");
                    setAguardandoCodigo(false);
                  }}
                  className="w-full"
                >
                  Voltar
                </Button>
              </CardContent>
            </Card>

            {/* Comentários */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comentários
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {comentarios.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum comentário ainda
                  </p>
                ) : (
                  <div className="space-y-4">
                    {comentarios.map((c) => (
                      <div
                        key={c.id}
                        className={`p-4 rounded-lg ${
                          c.tipo === "cliente" ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{c.autor_nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.created_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{c.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}

                {chamado.status !== "fechado" && chamado.status !== "resolvido" ? (
                  <div className="space-y-2 pt-4 border-t">
                    <Textarea
                      value={novoComentario}
                      onChange={(e) => setNovoComentario(e.target.value)}
                      placeholder="Digite seu comentário..."
                      rows={3}
                    />
                    <Button onClick={handleEnviarComentario} disabled={loading || !novoComentario.trim()}>
                      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Enviar Comentário
                    </Button>
                  </div>
                ) : (
                  <div className="pt-4 border-t">
                    <p className="text-center text-muted-foreground py-4 bg-muted/50 rounded-lg">
                      {chamado.status === "resolvido" 
                        ? "Este chamado foi resolvido. Não é possível adicionar novos comentários."
                        : "Este chamado está fechado. Não é possível adicionar novos comentários."}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  </div>
);
}
