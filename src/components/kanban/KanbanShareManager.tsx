import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Share2, Copy, Trash2, Calendar, Link as LinkIcon, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSiteUrl } from '@/hooks/useSiteUrl';

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  expires_at: string | null;
  created_at: string;
}

export function KanbanShareManager() {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pipeline_temporary_links')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar links de compartilhamento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const createLink = async () => {
    setCreating(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '');
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from('pipeline_temporary_links').insert({
        token,
        label: label.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: user?.id
      });

      if (error) throw error;
      
      toast.success('Link de compartilhamento criado com sucesso!');
      setLabel('');
      setExpiresAt('');
      loadLinks();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar link de compartilhamento');
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (id: string) => {
    try {
      const { error } = await supabase
        .from('pipeline_temporary_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Link removido');
      loadLinks();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover link');
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/public/pipeline/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado para a área de transferência!');
  };

  const openLink = (token: string) => {
    window.open(`/public/pipeline/${token}`, '_blank');
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Criar Link de Acesso Temporário
          </CardTitle>
          <CardDescription>
            Crie um link de visualização pública (apenas leitura) para o seu Pipeline. 
            Ideal para compartilhar o progresso com clientes ou parceiros.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label" className="text-xs">Identificador (ex: Nome do Cliente)</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Quadro para Cliente X"
                className="bg-secondary border-border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires" className="text-xs">Expira em (opcional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-secondary border-border"
              />
            </div>
          </div>
          <Button 
            onClick={createLink} 
            disabled={creating}
            className="w-full md:w-auto gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
            Gerar Link Seguro
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 px-1">
          Links Ativos
          <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {links.length}
          </span>
        </h3>
        
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <div className="text-center p-8 bg-secondary/20 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground">Nenhum link de compartilhamento criado ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {links.map((link) => (
              <Card key={link.id} className="bg-card border-border overflow-hidden group">
                <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg shrink-0">
                      <LinkIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-foreground">
                        {link.label || 'Link Sem Identificador'}
                      </h4>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Criado em {format(new Date(link.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </span>
                        {link.expires_at && (
                          <span className="text-[10px] text-amber-600 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Expira em {format(new Date(link.expires_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-auto md:ml-0">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1.5 text-xs bg-secondary/50 border-border hover:bg-secondary"
                      onClick={() => openLink(link.token)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Acessar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1.5 text-xs bg-secondary/50 border-border hover:bg-secondary"
                      onClick={() => copyLink(link.token)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copiar URL
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteLink(link.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
