import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Search, ArrowLeft, Download, ChevronLeft, ChevronRight, Eye, RefreshCw, User, Globe, Key, Webhook, Pencil, FileText, Trash2, Mail } from 'lucide-react';
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
  usuario_id: string | null;
  usuario_email: string | null;
  api_key_id: string | null;
  webhook_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function ConsultaNumerosHistorico() {
  const [searchQuery, setSearchQuery] = useState('');
  const [acaoFilter, setAcaoFilter] = useState<string>('');
  const [origemFilter, setOrigemFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<HistoryEntry | null>(null);

  const { data: historyResult, isLoading, refetch } = useQuery({
    queryKey: ['consulta-numeros-history', searchQuery, acaoFilter, origemFilter, currentPage, pageSize],
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
      if (acaoFilter) params.append('acao', acaoFilter);
      if (origemFilter) params.append('origem', origemFilter);
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/historico?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (res.status === 401) {
        await supabase.auth.signOut();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
  });

  const getAcaoLabel = (acao: string) => {
    const labels: Record<string, string> = {
      'consulta': 'Consulta',
      'atualizacao': 'Edição',
      'cadastro': 'Cadastro',
      'exclusao': 'Exclusão',
      'email_desbanimento': 'Email Desbanimento',
    };
    return labels[acao] || acao;
  };

  const getAcaoIcon = (acao: string) => {
    if (acao.includes('consulta')) return <FileText className="h-3 w-3" />;
    if (acao.includes('atualizacao')) return <Pencil className="h-3 w-3" />;
    if (acao.includes('cadastro')) return <FileText className="h-3 w-3" />;
    if (acao.includes('exclusao')) return <Trash2 className="h-3 w-3" />;
    if (acao.includes('email')) return <Mail className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const getAcaoColor = (acao: string): string => {
    if (acao.includes('consulta')) return 'bg-blue-500/10 text-blue-600 border-blue-500/30';
    if (acao.includes('atualizacao')) return 'bg-amber-500/10 text-amber-600 border-amber-500/30';
    if (acao.includes('cadastro')) return 'bg-green-500/10 text-green-600 border-green-500/30';
    if (acao.includes('exclusao')) return 'bg-red-500/10 text-red-600 border-red-500/30';
    if (acao.includes('email')) return 'bg-pink-500/10 text-pink-600 border-pink-500/30';
    return 'bg-muted text-muted-foreground';
  };

  const getOrigemIcon = (origem: string) => {
    if (origem === 'api') return <Key className="h-3 w-3" />;
    if (origem === 'webhook') return <Webhook className="h-3 w-3" />;
    return <Globe className="h-3 w-3" />;
  };

  const getOrigemLabel = (origem: string) => {
    const labels: Record<string, string> = {
      'painel': 'Painel Web',
      'api': 'API REST',
      'webhook': 'Webhook',
    };
    return labels[origem] || origem;
  };

  const getOrigemColor = (origem: string): string => {
    if (origem === 'api') return 'bg-purple-500/10 text-purple-600 border-purple-500/30';
    if (origem === 'webhook') return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30';
    return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30';
  };

  const handleExport = () => {
    if (!historyResult?.data) return;

    const headers = ['Data/Hora', 'Número', 'Ação', 'Origem', 'Usuário', 'IP', 'Campos Alterados'];
    const csvContent = [
      headers.join(','),
      ...historyResult.data.map((entry: HistoryEntry) =>
        [
          format(new Date(entry.created_at), 'dd/MM/yyyy HH:mm:ss'),
          entry.numero,
          getAcaoLabel(entry.acao),
          getOrigemLabel(entry.origem),
          entry.usuario_email || (entry.api_key_id ? 'Via API Key' : '-'),
          entry.ip_address || '-',
          entry.campos_alterados?.join('; ') || '-',
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

  const handleSearch = () => {
    setCurrentPage(1);
    refetch();
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
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Buscar por número..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="w-full md:w-40">
                <Select value={acaoFilter || "__all__"} onValueChange={(val) => setAcaoFilter(val === "__all__" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas ações</SelectItem>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="atualizacao">Edição</SelectItem>
                    <SelectItem value="cadastro">Cadastro</SelectItem>
                    <SelectItem value="exclusao">Exclusão</SelectItem>
                    <SelectItem value="email_desbanimento">Email Desbanimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full md:w-40">
                <Select value={origemFilter || "__all__"} onValueChange={(val) => setOrigemFilter(val === "__all__" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar origem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas origens</SelectItem>
                    <SelectItem value="painel">Painel Web</SelectItem>
                    <SelectItem value="api">API REST</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} disabled={isLoading}>
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
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Número</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Usuário / API</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>Campos Alterados</TableHead>
                        <TableHead className="w-[80px]">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyResult?.data?.map((entry: HistoryEntry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="font-mono">{entry.numero}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getAcaoColor(entry.acao)}`}>
                              {getAcaoIcon(entry.acao)}
                              {getAcaoLabel(entry.acao)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getOrigemColor(entry.origem)}`}>
                              {getOrigemIcon(entry.origem)}
                              {getOrigemLabel(entry.origem)}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              {entry.usuario_email ? (
                                <>
                                  <User className="h-3 w-3 text-muted-foreground" />
                                  <span className="truncate max-w-[140px]">{entry.usuario_email}</span>
                                </>
                              ) : entry.api_key_id ? (
                                <>
                                  <Key className="h-3 w-3 text-purple-500" />
                                  <span className="text-purple-600">Via API Key</span>
                                </>
                              ) : entry.webhook_id ? (
                                <>
                                  <Webhook className="h-3 w-3 text-cyan-500" />
                                  <span className="text-cyan-600">Via Webhook</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-mono text-muted-foreground">{entry.ip_address || '-'}</TableCell>
                          <TableCell>
                            {entry.campos_alterados && entry.campos_alterados.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[180px]">
                                {entry.campos_alterados.slice(0, 2).map((campo, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">{campo}</Badge>
                                ))}
                                {entry.campos_alterados.length > 2 && (
                                  <Badge variant="secondary" className="text-xs">+{entry.campos_alterados.length - 2}</Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
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
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getAcaoColor(selectedEntry.acao)}`}>
                    {getAcaoIcon(selectedEntry.acao)}
                    {getAcaoLabel(selectedEntry.acao)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Origem</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${getOrigemColor(selectedEntry.origem)}`}>
                    {getOrigemIcon(selectedEntry.origem)}
                    {getOrigemLabel(selectedEntry.origem)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Usuário / Identificação</p>
                  <div className="flex items-center gap-1.5">
                    {selectedEntry.usuario_email ? (
                      <>
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{selectedEntry.usuario_email}</span>
                      </>
                    ) : selectedEntry.api_key_id ? (
                      <>
                        <Key className="h-3 w-3 text-purple-500" />
                        <span className="text-purple-600">API Key: {selectedEntry.api_key_id.slice(0, 8)}...</span>
                      </>
                    ) : selectedEntry.webhook_id ? (
                      <>
                        <Webhook className="h-3 w-3 text-cyan-500" />
                        <span className="text-cyan-600">Webhook: {selectedEntry.webhook_id.slice(0, 8)}...</span>
                      </>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">IP</p>
                  <p className="font-mono">{selectedEntry.ip_address || '-'}</p>
                </div>
              </div>

              {selectedEntry.user_agent && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">User Agent</p>
                  <p className="text-sm text-muted-foreground font-mono bg-muted px-2 py-1 rounded truncate">{selectedEntry.user_agent}</p>
                </div>
              )}

              {selectedEntry.campos_alterados && selectedEntry.campos_alterados.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Campos Alterados</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.campos_alterados.map((campo, i) => (
                      <Badge key={i} variant="outline">{campo}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedEntry.dados_anteriores && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Dados Anteriores</p>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEntry.dados_anteriores, null, 2)}
                  </pre>
                </div>
              )}

              {selectedEntry.dados_novos && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Dados Novos</p>
                  <pre className="bg-muted p-3 rounded-md text-sm overflow-x-auto max-h-48">
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
