import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Eye, EyeOff, Lock, ShieldX, Clock, Download, Image,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getClientCredentialPlatform, parseCredentialNotes } from '@/utils/clientCredentials';

interface Credential {
  id: string;
  platform: string;
  login: string;
  encrypted_password: string;
  notes: string | null;
}

interface Logo {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  description: string | null;
}

export default function CredenciaisPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [logos, setLogos] = useState<Logo[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

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

  const getPlatformInfo = (value: string) => getClientCredentialPlatform(value);

  const togglePassword = (id: string) => {
    setVisiblePasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
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
              const Icon = platform.icon;
              const isVisible = visiblePasswords.has(cred.id);
              const { url, notes } = parseCredentialNotes(cred.notes);

              return (
                <Card key={cred.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 shrink-0 ${platform.color}`} />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-sm">{platform.label}</span>
                        <p className="text-xs text-muted-foreground truncate">Login: {cred.login}</p>
                        {url && (
                          <p className="text-xs text-muted-foreground truncate">
                            URL: <a href={url.startsWith('http') ? url : `https://${url}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">{url}</a>
                          </p>
                        )}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-xs text-muted-foreground">Senha:</span>
                          <span className="text-xs font-mono">
                            {isVisible ? cred.encrypted_password : '••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => togglePassword(cred.id)}
                          >
                            {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
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
