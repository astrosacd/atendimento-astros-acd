import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NumberResult {
  numero: string;
  status: 'apto' | 'bloqueado';
  motivo?: string;
  baserow_id?: number;
  nome?: string;
  observacoes?: string;
  data_cadastro?: string;
}

interface ValidationResponse {
  success: boolean;
  results: NumberResult[];
  total: number;
  aptos: number;
  bloqueados: number;
}

export function ValidacaoSmsTab() {
  const [numerosInput, setNumerosInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<NumberResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; aptos: number; bloqueados: number } | null>(null);

  // Fetch recent logs
  const { data: recentLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['sms-validation-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sms_validation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const handleProcess = async () => {
    const raw = numerosInput.trim();
    if (!raw) {
      toast({ title: 'Informe pelo menos um número', variant: 'destructive' });
      return;
    }

    // Split by comma, newline, or space
    const numeros = raw
      .split(/[,\n\s]+/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (numeros.length === 0) {
      toast({ title: 'Nenhum número válido informado', variant: 'destructive' });
      return;
    }

    if (numeros.length > 20) {
      toast({ title: 'Máximo de 20 números por vez', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    setResults(null);
    setSummary(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast({ title: 'Sessão inválida', variant: 'destructive' });
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-sms-numbers`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ numeros }),
        }
      );

      const json: ValidationResponse = await res.json();

      if (!res.ok || !json.success) {
        throw new Error((json as any).error || 'Erro ao validar números');
      }

      setResults(json.results);
      setSummary({ total: json.total, aptos: json.aptos, bloqueados: json.bloqueados });
      refetchLogs();

      if (json.aptos > 0) {
        toast({ title: `✅ ${json.aptos} número(s) apto(s) para SMS` });
      }
      if (json.bloqueados > 0) {
        toast({ title: `⛔ ${json.bloqueados} número(s) bloqueado(s)`, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro ao processar', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClear = () => {
    setNumerosInput('');
    setResults(null);
    setSummary(null);
  };

  const getStatusIcon = (status: string) => {
    if (status === 'apto') return <CheckCircle className="h-4 w-4 text-green-500" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'apto') {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Apto</Badge>;
    }
    return <Badge variant="destructive">Bloqueado</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Input Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Validação de Números para SMS
          </CardTitle>
          <CardDescription>
            Cole os números separados por vírgula, espaço ou um por linha. Máximo 20 números por vez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Ex: 5511999999999, 5511888888888, 5511777777777"
            value={numerosInput}
            onChange={(e) => setNumerosInput(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleProcess} disabled={isProcessing || !numerosInput.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Processar Números
                </>
              )}
            </Button>
            {(results || numerosInput) && (
              <Button variant="outline" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Resultado da Validação
            </CardTitle>
            <CardDescription className="flex gap-4 flex-wrap">
              <span>Total: <strong>{summary.total}</strong></span>
              <span className="text-green-500">Aptos: <strong>{summary.aptos}</strong></span>
              <span className="text-destructive">Bloqueados: <strong>{summary.bloqueados}</strong></span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, idx) => (
                    <TableRow key={idx} className={r.status === 'bloqueado' ? 'opacity-70' : ''}>
                      <TableCell>{getStatusIcon(r.status)}</TableCell>
                      <TableCell className="font-mono text-sm">{r.numero}</TableCell>
                      <TableCell>{getStatusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {r.motivo || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{r.nome || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.baserow_id || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Histórico de Validações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">{log.numero}</TableCell>
                      <TableCell>
                        {log.resultado === 'apto' ? (
                          <Badge className="bg-green-500/10 text-green-500 border-green-500/30">Apto</Badge>
                        ) : (
                          <Badge variant="destructive">Bloqueado</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">
                        {log.motivo || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{log.user_email || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
