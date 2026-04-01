import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldX, Clock, CheckCircle, XCircle, MessageSquare, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NumberResult {
  numero: string;
  status: 'apto' | 'bloqueado';
  motivo?: string;
}

export default function ResultadoSmsPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<NumberResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_sms_result_share', {
          p_token: token,
        });
        if (rpcError) throw rpcError;
        const result = data as any;
        if (!result?.valid) {
          setError('Link inválido ou expirado');
        } else {
          setResults(result.results || []);
          setMessage(result.message || null);
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
              Este link de resultados não é mais válido. Os resultados expiram automaticamente após 5 minutos.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const aptos = results.filter(r => r.status === 'apto').length;
  const bloqueados = results.filter(r => r.status === 'bloqueado').length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Resultado da Validação SMS</h1>
          </div>
          {expiresAt && (
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Expira em {format(new Date(expiresAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          )}
        </div>

        {/* Instructions message */}
        {message && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm whitespace-pre-line">{message}</div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Badge variant="outline" className="text-sm px-4 py-1.5">
            Total: <strong className="ml-1">{results.length}</strong>
          </Badge>
          <Badge className="bg-green-500/10 text-green-500 border-green-500/30 text-sm px-4 py-1.5">
            Aptos: <strong className="ml-1">{aptos}</strong>
          </Badge>
          <Badge variant="destructive" className="text-sm px-4 py-1.5">
            Bloqueados: <strong className="ml-1">{bloqueados}</strong>
          </Badge>
        </div>

        {/* Results Table */}
        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={idx} className={r.status === 'bloqueado' ? 'opacity-70' : ''}>
                      <TableCell>
                        {r.status === 'apto'
                          ? <CheckCircle className="h-4 w-4 text-green-500" />
                          : <XCircle className="h-4 w-4 text-destructive" />
                        }
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.numero}</TableCell>
                      <TableCell>
                        {r.status === 'apto' ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Apto</Badge>
                        ) : (
                          <Badge variant="destructive">Bloqueado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px]">
                        {r.motivo || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
