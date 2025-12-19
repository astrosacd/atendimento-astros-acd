import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, ArrowLeft, Download, ChevronLeft, ChevronRight, Eye, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  numero: string;
  baserow_row_id: string | null;
  acao: string;
  origem: string;
  dados_anteriores: any;
  dados_novos: any;
  campos_alterados: string[] | null;
  usuario_email: string | null;
  ip_address: string | null;
  created_at: string;
}

export default function ConsultaNumerosHistorico() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const { data: historyResult, isLoading, refetch } = useQuery({
    queryKey: ['consulta-numeros-history', searchQuery, currentPage, pageSize],
    queryFn: async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw new Error('Sessão inválida. Faça login novamente.');
      }
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        size: pageSize.toString(),
      });
      
      if (searchQuery) params.append('numero', searchQuery);
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/historico?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
  });

  const getAcaoLabel = (acao: string) => {
    const labels: Record<string, string> = {
      'consulta': 'Consulta',
      'consulta_webhook': 'Consulta (Webhook)',
      'atualizacao': 'Atualização',
      'atualizacao_status': 'Atualização de Status',
      'atualizacao_obs': 'Atualização de Observações',
      'atualizacao_status_obs': 'Atualização de Status + Obs',
      'atualizacao_webhook': 'Atualização (Webhook)',
    };
    return labels[acao] || acao;
  };

  const getAcaoVariant = (acao: string): 'default' | 'secondary' | 'outline' => {
    if (acao.includes('consulta')) return 'secondary';
    if (acao.includes('atualizacao')) return 'default';
    return 'outline';
  };

  const getOrigemVariant = (origem: string): 'default' | 'secondary' | 'outline' => {
    if (origem === 'api') return 'default';
    if (origem === 'webhook') return 'outline';
    return 'secondary';
  };

  const handleExport = () => {
    if (!historyResult?.data) return;

    const headers = ['Data/Hora', 'Número', 'Ação', 'Origem', 'Usuário', 'IP'];
    const csvContent = [
      headers.join(','),
      ...historyResult.data.map((entry: HistoryEntry) =>
        [
          format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm:ss'),
          entry.numero,
          getAcaoLabel(entry.acao),
          entry.origem,
          entry.usuario_email || '-',
          entry.ip_address || '-',
        ].map(v => `"${v}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico_consulta_numeros_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({ title: 'Exportação concluída!' });
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => window.location.href = '/admin/consulta-numeros'}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Histórico de Ações</h1>
              <p className="text-muted-foreground">Auditoria completa do módulo Consulta de Números</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={!historyResult?.data?.length}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por número..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && refetch()}
                />
              </div>
              <Button onClick={() => { setCurrentPage(1); refetch(); }} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Auditoria</CardTitle>
            <CardDescription>
              {historyResult?.pagination?.count || 0} registros encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : historyResult?.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum registro encontrado.
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="w-[80px]">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyResult?.data?.map((entry: HistoryEntry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm">
                            {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono">{entry.numero}</TableCell>
                          <TableCell>
                            <Badge variant={getAcaoVariant(entry.acao)}>
                              {getAcaoLabel(entry.acao)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getOrigemVariant(entry.origem)}>
                              {entry.origem}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{entry.usuario_email || '-'}</TableCell>
                          <TableCell className="text-sm font-mono">{entry.ip_address || '-'}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setDetailsOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {historyResult?.pagination && historyResult.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Página {currentPage} de {historyResult.pagination.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(historyResult.pagination.totalPages, p + 1))}
                        disabled={currentPage === historyResult.pagination.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Registro</DialogTitle>
            <DialogDescription>
              {selectedEntry && format(new Date(selectedEntry.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
            </DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Número</p>
                  <p className="font-mono">{selectedEntry.numero}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">ID Baserow</p>
                  <p className="font-mono">{selectedEntry.baserow_row_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Ação</p>
                  <Badge variant={getAcaoVariant(selectedEntry.acao)}>
                    {getAcaoLabel(selectedEntry.acao)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Origem</p>
                  <Badge variant={getOrigemVariant(selectedEntry.origem)}>
                    {selectedEntry.origem}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuário</p>
                  <p>{selectedEntry.usuario_email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP</p>
                  <p className="font-mono">{selectedEntry.ip_address || '-'}</p>
                </div>
              </div>

              {selectedEntry.campos_alterados && selectedEntry.campos_alterados.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Campos Alterados</p>
                  <div className="flex gap-2">
                    {selectedEntry.campos_alterados.map((campo, i) => (
                      <Badge key={i} variant="outline">{campo}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntry.dados_anteriores && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Dados Anteriores</p>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(selectedEntry.dados_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.dados_novos && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Dados Novos</p>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto">
                    {JSON.stringify(selectedEntry.dados_novos, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
