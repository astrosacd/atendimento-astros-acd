import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Instagram, 
  History, 
  ExternalLink, 
  RefreshCw, 
  Calendar, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const InstagramHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isTempAccess = !!localStorage.getItem("temp_access_token");
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (user || isTempAccess) {
      fetchPosts();
    }
  }, [user, isTempAccess]);

  const fetchPosts = async () => {
    setLoading(true);
    const tempToken = isTempAccess && !user?.id ? localStorage.getItem("temp_access_token") : null;
    let result: { data: any[] | null; error: any };
    if (tempToken) {
      result = await supabase.rpc("temp_list_posts", { p_token: tempToken } as any) as any;
    } else {
      let query = supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (user?.id) query = query.eq("user_id", user.id);
      result = await query;
    }
    const { data, error } = result;

    if (error) {
      toast({ title: "Erro", description: "Falha ao carregar histórico.", variant: "destructive" });
    } else {
      setPosts(data || []);
    }
    setLoading(false);
  };

  const fetchLogs = async (postId: string) => {
    const tempToken = isTempAccess && !user?.id ? localStorage.getItem("temp_access_token") : null;
    const { data, error } = tempToken
      ? await supabase.rpc("temp_list_post_logs", { p_token: tempToken, p_post_id: postId } as any) as any
      : await supabase
          .from("post_logs")
          .select("*")
          .eq("post_id", postId)
          .order("created_at", { ascending: true });

    if (!error) {
      setLogs(data || []);
    }
  };

  const toggleLogs = (postId: string) => {
    if (expandedLogs === postId) {
      setExpandedLogs(null);
    } else {
      setExpandedLogs(postId);
      fetchLogs(postId);
    }
  };

  const handleRetry = async (postId: string) => {
    toast({ title: "Aguarde", description: "Tentando republicar..." });
    const { error } = await supabase.functions.invoke('publish-instagram', {
      body: { postId }
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sucesso", description: "Publicação reiniciada!" });
      fetchPosts();
    }
  };

  const handleCancel = async (postId: string) => {
    const { error } = await supabase
      .from("posts")
      .update({ status: 'cancelled' })
      .eq('id', postId);

    if (error) {
      toast({ title: "Erro", description: "Falha ao cancelar." });
    } else {
      toast({ title: "Cancelado", description: "Agendamento cancelado com sucesso." });
      fetchPosts();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Publicado</Badge>;
      case 'scheduled': return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" /> Agendado</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      case 'publishing': return <Badge className="bg-yellow-500 animate-pulse">Publicando...</Badge>;
      case 'cancelled': return <Badge variant="outline">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          Seu Histórico
        </h2>
        <Button variant="outline" onClick={fetchPosts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {loading && posts.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {posts.length === 0 && !loading && (
          <div className="text-center py-20 bg-muted/20 rounded-xl border-2 border-dashed">
            <Instagram className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <p className="text-muted-foreground">Nenhuma publicação encontrada.</p>
          </div>
        )}

        {posts.map((post) => (
          <Card key={post.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-48 h-48 bg-muted relative shrink-0">
                {post.media_urls?.[0] ? (
                  <img 
                    src={post.media_urls[0]} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    Sem mídia
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="bg-black/50 text-white backdrop-blur-sm border-none">
                    {post.type.toUpperCase()}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(post.status)}
                      <span className="text-xs text-muted-foreground">
                        Criado em {format(new Date(post.created_at), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {post.permalink && (
                      <a href={post.permalink} target="_blank" rel="noreferrer">
                        <Button variant="ghost" size="sm" className="h-8 gap-1">
                          Ver no Instagram <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    )}
                  </div>
                  <p className="text-sm line-clamp-2 italic text-muted-foreground mb-4">
                    "{post.caption || 'Sem legenda'}"
                  </p>
                  
                  {post.scheduled_for && post.status === 'scheduled' && (
                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium mb-4">
                      <Calendar className="h-4 w-4" />
                      Agendado para: {format(new Date(post.scheduled_for), "dd/MM/yyyy 'às' HH:mm")}
                    </div>
                  )}

                  {post.error_message && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-lg text-xs text-red-600 border border-red-100 dark:border-red-900/30 mb-4">
                      <strong>Erro:</strong> {post.error_message}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-muted-foreground"
                    onClick={() => toggleLogs(post.id)}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {expandedLogs === post.id ? 'Ocultar Logs' : 'Ver Logs'}
                    {expandedLogs === post.id ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                  </Button>

                  {!isTempAccess && post.status === 'failed' && (
                    <Button variant="outline" size="sm" onClick={() => handleRetry(post.id)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar Novamente
                    </Button>
                  )}

                  {!isTempAccess && post.status === 'scheduled' && (
                    <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600" onClick={() => handleCancel(post.id)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {expandedLogs === post.id && (
              <div className="bg-muted/30 p-4 border-t border-muted">
                <ScrollArea className="h-[200px] w-full">
                  <div className="space-y-2">
                    {logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum log registrado ainda.</p>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id} className="text-xs flex gap-2">
                          <span className="text-muted-foreground shrink-0">
                            [{format(new Date(log.created_at), "HH:mm:ss")}]
                          </span>
                          <span className={
                            log.level === 'error' ? 'text-red-500 font-medium' : 
                            log.level === 'success' ? 'text-green-600 font-medium' : 
                            'text-foreground'
                          }>
                            {log.message}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default InstagramHistory;
