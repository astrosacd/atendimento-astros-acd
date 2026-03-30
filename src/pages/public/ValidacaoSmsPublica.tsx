import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldX, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ValidacaoSmsTab } from '@/components/consulta-numeros/ValidacaoSmsTab';

export default function ValidacaoSmsPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('validate_sms_share_token', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        const result = data as any;
        if (!result?.valid) {
          setError('Link inválido ou expirado');
        } else {
          setExpiresAt(result.expires_at);
        }
      } catch {
        setError('Link inválido ou expirado');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

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
              Este link de acesso à validação SMS não é mais válido. Solicite um novo link ao administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Validação SMS</h1>
          </div>
          {expiresAt && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Expira em {format(new Date(expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </div>

        <ValidacaoSmsTab isPublicAccess />
      </div>
    </div>
  );
}
