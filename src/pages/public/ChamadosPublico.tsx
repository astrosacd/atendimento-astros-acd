import { useState } from "react";
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
import { Ticket, Search, Plus, MessageSquare, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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
}

interface Comentario {
  id: string;
  conteudo: string;
  autor_nome: string;
  tipo: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  aberto: "bg-blue-500",
  em_andamento: "bg-yellow-500",
  aguardando_cliente: "bg-orange-500",
  resolvido: "bg-green-500",
  fechado: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  aberto: "Aberto",
  em_andamento: "Em Andamento",
  aguardando_cliente: "Aguardando Cliente",
  resolvido: "Resolvido",
  fechado: "Fechado",
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

  // Form states - Consulta
  const [codigoBusca, setCodigoBusca] = useState("");
  const [emailBusca, setEmailBusca] = useState("");
  const [codigoVerificacao, setCodigoVerificacao] = useState("");
  const [hashBusca, setHashBusca] = useState(hashFromUrl || "");
  const [aguardandoCodigo, setAguardandoCodigo] = useState(false);

  // Resultado
  const [chamado, setChamado] = useState<Chamado | null>(null);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState("");

  const handleAbrirChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("api-chamados", {
        method: "POST",
        body: { nome, email, motivo, contato },
      });

      if (error) throw error;

      // A API retorna { success, chamado: {...} }
      const chamadoData = data?.chamado || data;
      
      toast.success(`Chamado criado com sucesso! Código: ${chamadoData.codigo}`);
      
      // Buscar os dados completos do chamado para exibição correta
      const { data: chamadoCompleto } = await supabase
        .from("chamados")
        .select("*")
        .eq("id", chamadoData.id)
        .single();
      
      setChamado(chamadoCompleto || chamadoData);
      setNome("");
      setEmail("");
      setMotivo("");
      setContato("");
      setActiveTab("consultar");
      setHashBusca(chamadoData.hash_acesso);
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar chamado");
    } finally {
      setLoading(false);
    }
  };

  const handleBuscarPorCodigo = async () => {
    if (!codigoBusca) {
      toast.error("Informe o código do chamado");
      return;
    }

    setLoading(true);
    try {
      // Buscar diretamente no banco pelo código
      const { data, error } = await supabase
        .from("chamados")
        .select(`
          id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at,
          chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
        `)
        .eq("codigo", codigoBusca.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Chamado não encontrado");
        return;
      }

      setChamado(data);
      setHashBusca(data.hash_acesso || "");
      // Filtrar apenas comentários públicos
      const comentariosPublicos = data.chamados_comentarios?.filter((c: any) => c.tipo === 'publico') || [];
      setComentarios(comentariosPublicos);
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
        body: { action: "send", email: emailBusca },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Código de verificação enviado para seu email");
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
      if (data?.error) throw new Error(data.error);

      if (data.chamados && data.chamados.length > 0) {
        setChamado(data.chamados[0]);
        setHashBusca(data.chamados[0].hash_acesso || "");
        // Filtrar apenas comentários públicos
        const comentariosPublicos = data.chamados[0].chamados_comentarios?.filter((c: any) => c.tipo === 'publico') || [];
        setComentarios(comentariosPublicos);
      } else {
        toast.info("Nenhum chamado encontrado para este email");
      }
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
      // Buscar diretamente no banco pelo hash
      const { data, error } = await supabase
        .from("chamados")
        .select(`
          id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at,
          chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
        `)
        .eq("hash_acesso", hashBusca.trim())
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast.error("Chamado não encontrado");
        return;
      }

      setChamado(data);
      // Filtrar apenas comentários públicos
      const comentariosPublicos = data.chamados_comentarios?.filter((c: any) => c.tipo === 'publico') || [];
      setComentarios(comentariosPublicos);
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
      const { error } = await supabase.functions.invoke("chamados-comentario", {
        method: "POST",
        body: {
          chamado_id: chamado.id,
          hash: hashBusca || chamado.hash_acesso,
          conteudo: novoComentario,
          autor_nome: chamado.nome,
          autor_email: chamado.email,
        },
      });

      if (error) throw error;

      toast.success("Comentário enviado");
      setNovoComentario("");
      await carregarComentarios(chamado.id);
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar comentário");
    } finally {
      setLoading(false);
    }
  };

  // Auto-buscar por hash na URL
  useState(() => {
    if (hashFromUrl) {
      handleBuscarPorHash();
    }
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Ticket className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Central de Chamados</h1>
          </div>
          <p className="text-muted-foreground">
            Abra ou consulte seus chamados de suporte
          </p>
        </div>

        {!chamado ? (
          <Card>
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="abrir" className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Abrir Chamado
                  </TabsTrigger>
                  <TabsTrigger value="consultar" className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Consultar Chamado
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="abrir" className="mt-6">
                  <form onSubmit={handleAbrirChamado} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome Completo *</Label>
                        <Input
                          id="nome"
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Seu nome completo"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contato">Telefone/WhatsApp *</Label>
                      <Input
                        id="contato"
                        value={contato}
                        onChange={(e) => setContato(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="motivo">Descrição do Problema *</Label>
                      <Textarea
                        id="motivo"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Descreva detalhadamente o problema ou solicitação..."
                        rows={5}
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Abrir Chamado
                        </>
                      )}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="consultar" className="mt-6 space-y-6">
                  {/* Busca por código */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Buscar por Código do Chamado</h3>
                    <div className="flex gap-2">
                      <Input
                        value={codigoBusca}
                        onChange={(e) => setCodigoBusca(e.target.value)}
                        placeholder="ACD-20251222153045"
                        className="flex-1"
                      />
                      <Button onClick={handleBuscarPorCodigo} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Busca por email */}
                  <div className="space-y-4">
                    <h3 className="font-medium">Buscar por Email</h3>
                    {!aguardandoCodigo ? (
                      <div className="flex gap-2">
                        <Input
                          type="email"
                          value={emailBusca}
                          onChange={(e) => setEmailBusca(e.target.value)}
                          placeholder="seu@email.com"
                          className="flex-1"
                        />
                        <Button onClick={handleEnviarCodigoVerificacao} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Código"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          Digite o código de 6 dígitos enviado para {emailBusca}
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

                  {hashBusca && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <h3 className="font-medium">Acesso via Link Seguro</h3>
                        <Button onClick={handleBuscarPorHash} disabled={loading} className="w-full">
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Acessar Chamado
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
                  <Badge className={statusColors[chamado.status]}>
                    {statusLabels[chamado.status]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <p className="font-medium">
                      {new Date(chamado.updated_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Descrição do Problema</Label>
                  <p className="mt-1 whitespace-pre-wrap">{chamado.motivo}</p>
                </div>

                <Button variant="outline" onClick={() => setChamado(null)} className="w-full">
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

                {chamado.status !== "fechado" && (
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
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
