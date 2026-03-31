import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle, XCircle, AlertTriangle, Search, Trash2, Copy, Link2, Clock, Shield, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

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

interface ValidacaoSmsTabProps {
  isPublicAccess?: boolean;
}

export function ValidacaoSmsTab({ isPublicAccess = false }: ValidacaoSmsTabProps) {
  const { user, isAdmin } = useAuth();
  const { hasPermission } = usePermissions();
  const [numeroCompra, setNumeroCompra] = useState('');
  const [numeroCompraConfirmed, setNumeroCompraConfirmed] = useState(false);
  const [numerosInput, setNumerosInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<NumberResult[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; aptos: number; bloqueados: number } | null>(null);

  // Share link state
  const [shareExpiry, setShareExpiry] = useState('4');
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const canShare = !isPublicAccess && (isAdmin || hasPermission('share_validacao_sms'));

  // Fetch recent logs (only for authenticated users)
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
    enabled: !isPublicAccess,
    staleTime: 30 * 1000,
  });

  // Fetch share token history
  const { data: shareTokens = [], refetch: refetchTokens } = useQuery({
    queryKey: ['sms-validation-share-tokens'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('sms_validation_share_tokens')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !isPublicAccess && canShare,
    staleTime: 30 * 1000,
  });

  const handleConfirmNumeroCompra = () => {
    const cleaned = numeroCompra.trim();
    if (!cleaned) {
      toast({ title: 'Informe o número de compra', variant: 'destructive' });
      return;
    }
    setNumeroCompraConfirmed(true);
  };

  const handleProcess = async () => {
    const raw = numerosInput.trim();
    if (!raw) {
      toast({ title: 'Informe pelo menos um número', variant: 'destructive' });
      return;
    }

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      if (!isPublicAccess) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast({ title: 'Sessão inválida', variant: 'destructive' });
          return;
        }
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-sms-numbers`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            numeros,
            numero_compra: numeroCompra.trim(),
            is_public: isPublicAccess,
          }),
        }
      );

      const json: ValidationResponse = await res.json();

      if (!res.ok || !json.success) {
        throw new Error((json as any).error || 'Erro ao validar números');
      }

      setResults(json.results);
      setSummary({ total: json.total, aptos: json.aptos, bloqueados: json.bloqueados });
      if (!isPublicAccess) refetchLogs();

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

  const handleResetAll = () => {
    handleClear();
    setNumeroCompra('');
    setNumeroCompraConfirmed(false);
  };

  const handleCopyResults = () => {
    if (!results) return;
    const header = 'Número | Status | Motivo';
    const separator = '─'.repeat(50);
    const lines = results.map(r => {
      const motivo = r.motivo ? ` | ${r.motivo}` : ' | -';
      return `${r.numero} | ${r.status === 'apto' ? 'Apto' : 'Bloqueado'}${motivo}`;
    });
    const text = [header, separator, ...lines].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Resultados copiados!' });
    }).catch(() => {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    });
  };

  const handleGenerateShareLink = async () => {
    setIsGeneratingLink(true);
    try {
      const hours = parseInt(shareExpiry);
      const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('sms_validation_share_tokens')
        .insert({
          created_by: user?.id,
          created_by_email: user?.email || null,
          expires_at: expiresAt,
        } as any)
        .select('token')
        .single();

      if (error) throw error;

      const baseUrl = window.location.hostname.includes('lovable.app')
        ? 'https://atendimento-astros-acd.lovable.app'
        : window.location.origin;
      const link = `${baseUrl}/validacao-sms/${data.token}`;

      await navigator.clipboard.writeText(link);
      toast({ title: '🔗 Link copiado!', description: `Válido por ${hours}h` });
      refetchTokens();
    } catch (err: any) {
      toast({ title: 'Erro ao gerar link', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingLink(false);
    }
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
      {/* Temporary Link Generator */}
      {canShare && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Acesso Temporário
            </CardTitle>
            <CardDescription>Gere um link de acesso temporário para a validação SMS</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Validade</Label>
                <Select value={shareExpiry} onValueChange={setShareExpiry}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 hora</SelectItem>
                    <SelectItem value="4">4 horas</SelectItem>
                    <SelectItem value="8">8 horas</SelectItem>
                    <SelectItem value="12">12 horas</SelectItem>
                    <SelectItem value="24">24 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleGenerateShareLink} disabled={isGeneratingLink} size="sm">
                {isGeneratingLink ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Gerar e Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Purchase Number */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Número de Compra
          </CardTitle>
          <CardDescription>
            Informe o número utilizado na compra. Formatos aceitos: 5511986461474@s.whatsapp.net ou +5511986461474
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div className="flex-1 min-w-[250px]">
              <Input
                placeholder="Ex: 5511986461474@s.whatsapp.net ou +5511986461474"
                value={numeroCompra}
                onChange={(e) => {
                  setNumeroCompra(e.target.value);
                  if (numeroCompraConfirmed) setNumeroCompraConfirmed(false);
                }}
                className="font-mono text-sm"
                disabled={numeroCompraConfirmed}
              />
            </div>
            {!numeroCompraConfirmed ? (
              <Button onClick={handleConfirmNumeroCompra} disabled={!numeroCompra.trim()}>
                Confirmar
              </Button>
            ) : (
              <Button variant="outline" onClick={handleResetAll}>
                Alterar
              </Button>
            )}
          </div>
          {numeroCompraConfirmed && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <CheckCircle className="h-4 w-4" />
              Número de compra confirmado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Numbers Input */}
      {numeroCompraConfirmed && (
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
      )}

      {/* Results */}
      {results && summary && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Resultado da Validação
                </CardTitle>
                <CardDescription className="flex gap-4 flex-wrap mt-1">
                  <span>Total: <strong>{summary.total}</strong></span>
                  <span className="text-green-500">Aptos: <strong>{summary.aptos}</strong></span>
                  <span className="text-destructive">Bloqueados: <strong>{summary.bloqueados}</strong></span>
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyResults}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Resultados
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                    {!isPublicAccess && <TableHead>Nome</TableHead>}
                    {!isPublicAccess && <TableHead>ID</TableHead>}
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
                      {!isPublicAccess && <TableCell className="text-sm">{r.nome || '-'}</TableCell>}
                      {!isPublicAccess && (
                        <TableCell className="text-sm text-muted-foreground">
                          {r.baserow_id || '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recent Logs (authenticated only) */}
      {!isPublicAccess && recentLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Histórico de Validações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
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
