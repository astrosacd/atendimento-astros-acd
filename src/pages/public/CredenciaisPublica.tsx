import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye, EyeOff, Lock, ShieldX, Clock, Download, Image, Copy, Check,
  Bot, Workflow, Server, Cog, Database, Cloud, Globe, Settings,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getClientCredentialPlatform, parseCredentialNotes } from '@/utils/clientCredentials';
import { copyToClipboard } from '@/utils/clipboard';
import { toast } from 'sonner';

interface Credential {
  id: string;
  platform: string;
  login: string;
  encrypted_password: string;
  notes: string | null;
}

interface ToolType {
  value: string;
  label: string;
  icon: string;
}

interface Logo {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Bot, Workflow, Server, Cog, Database, Cloud, Globe, Settings,
};

export default function CredenciaisPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [toolTypes, setToolTypes] = useState<ToolType[]>([]);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_credentials_by_share_token', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        const result = data as any;
        if (result?.error) {
          setError(result.error);
        } else {
          setClientName(result.client_name);
          setCredentials(result.credentials || []);
          setToolTypes(result.tool_types || []);
          setLogos(result.logos || []);
          setExpiresAt(result.expires_at);
        }
      } catch (e: any) {
        setError('Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const toolTypeMap = useMemo(() => {
    const map = new Map<string, ToolType>();
    toolTypes.forEach(t => map.set(t.value, t));
    return map;
  }, [toolTypes]);

  // Returns label/icon/color. Tool types take precedence over hardcoded social platforms.
  const getPlatformInfo = (value: string) => {
    const tool = toolTypeMap.get(value);
    if (tool) {
      const Icon = ICON_MAP[tool.icon] || Server;
      return { label: tool.label, Icon, color: 'text-primary' };
    }
    const social = getClientCredentialPlatform(value);
    return { label: social.label, Icon: social.icon, color: social.color };
  };

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleCopy = async (key: string, value: string, label: string) => {
    if (!value) return;
    try {
      await copyToClipboard(value);
      setCopiedKey(key);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1500);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const getLogoPublicUrl = (filePath: string) => {
    const { data } = supabase.storage.from('client-logos').getPublicUrl(filePath);
    return data?.publicUrl || '';
  };

  const handleDownloadLogo = async (logo: Logo) => {
    const url = getLogoPublicUrl(logo.file_path);
    const a = document.createElement('a');
    a.href = url;
    a.download = logo.file_name;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="p-8 space-y-4">
            <Skeleton className="h-8 w-3/4 mx-auto" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="py-12 text-center space-y-4">
            <ShieldX className="h-12 w-12 mx-auto text-destructive opacity-70" />
            <h2 className="text-xl font-semibold text-destructive">Link Inválido ou Expirado</h2>
            <p className="text-muted-foreground text-sm">
              Este link de acesso às credenciais não é mais válido. Solicite um novo link ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Credenciais do Cliente — {clientName}
          </CardTitle>
          {expiresAt && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              Expira em {format(new Date(expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Credentials */}
          {credentials.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Nenhuma credencial cadastrada</p>
          ) : (
            credentials.map(cred => {
              const platform = getPlatformInfo(cred.platform);
              const Icon = platform.Icon;
              const isVisible = visiblePasswords.has(cred.id);
              const { url, notes } = parseCredentialNotes(cred.notes);
              const accessUrl = url
                ? (/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`)
                : '';

              return (
                <Card key={cred.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${platform.color}`} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="font-medium text-sm">{platform.label}</span>

                        {/* Login row */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground shrink-0">Login:</span>
                          <span className="text-xs truncate flex-1">{cred.login}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleCopy(`login-${cred.id}`, cred.login, 'Login')}
                            title="Copiar login"
                          >
                            {copiedKey === `login-${cred.id}`
                              ? <Check className="h-3 w-3 text-primary" />
                              : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>

                        {/* URL row */}
                        {url && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground shrink-0">URL:</span>
                            <a
                              href={accessUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-primary underline underline-offset-2 truncate flex-1"
                            >
                              {url}
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 shrink-0"
                              onClick={() => handleCopy(`url-${cred.id}`, url, 'URL')}
                              title="Copiar URL"
                            >
                              {copiedKey === `url-${cred.id}`
                                ? <Check className="h-3 w-3 text-primary" />
                                : <Copy className="h-3 w-3" />}
                            </Button>
                          </div>
                        )}

                        {/* Password row */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground shrink-0">Senha:</span>
                          <span className="text-xs font-mono flex-1 truncate">
                            {isVisible ? cred.encrypted_password : '••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => togglePassword(cred.id)}
                            title={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0"
                            onClick={() => handleCopy(`pwd-${cred.id}`, cred.encrypted_password, 'Senha')}
                            title="Copiar senha"
                          >
                            {copiedKey === `pwd-${cred.id}`
                              ? <Check className="h-3 w-3 text-primary" />
                              : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>

                        {notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">📝 {notes}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* Logos section */}
          {logos.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <Image className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Logos</span>
                <Badge variant="secondary" className="text-xs">{logos.length}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {logos.map(logo => (
                  <Card key={logo.id} className="border overflow-hidden">
                    <div className="aspect-square bg-muted/30 flex items-center justify-center p-2">
                      <img
                        src={getLogoPublicUrl(logo.file_path)}
                        alt={logo.file_name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <CardContent className="p-2">
                      <p className="text-xs truncate font-medium">{logo.description || logo.file_name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1.5 h-7 text-xs gap-1"
                        onClick={() => handleDownloadLogo(logo)}
                      >
                        <Download className="h-3 w-3" />
                        Baixar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
