import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, CheckCircle, XCircle, Info, Send } from 'lucide-react';
import { useLeadHunterLogs } from '@/hooks/useLeadHunter';
import { format } from 'date-fns';

export default function LeadHunterHistorico() {
  const { data: logs = [], isLoading } = useLeadHunterLogs();

  const tipoBadge = (tipo: string) => {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      envio: { variant: 'default', label: 'Envio' },
      erro: { variant: 'destructive', label: 'Erro' },
      busca: { variant: 'secondary', label: 'Busca' },
      baserow: { variant: 'outline', label: 'Baserow' },
      ia: { variant: 'outline', label: 'IA' },
    };
    const s = map[tipo] || { variant: 'secondary' as const, label: tipo };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const resultIcon = (resultado: string | null) => {
    if (!resultado) return null;
    if (resultado === 'success') return <CheckCircle className="h-4 w-4 text-primary" />;
    if (resultado === 'error') return <XCircle className="h-4 w-4 text-destructive" />;
    return <Info className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card className="border-border/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Execuções ({logs.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Send className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum registro ainda</p>
            <p className="text-sm">Os logs aparecerão aqui após os disparos</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss')}
                    </TableCell>
                    <TableCell>{tipoBadge(log.tipo)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {resultIcon(log.resultado)}
                        <span className="text-sm">{log.resultado || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[400px] truncate text-sm text-muted-foreground" title={log.mensagem || ''}>
                      {log.mensagem || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
