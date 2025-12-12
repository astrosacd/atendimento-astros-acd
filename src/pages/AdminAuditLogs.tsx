import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Search, RefreshCw, Clock, Globe, Server } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  api_key_id: string | null;
  webhook_id: string | null;
  request_method: string | null;
  request_path: string | null;
  request_body: Record<string, unknown> | null;
  response_status: number | null;
  response_body: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs((data || []) as AuditLog[]);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('error') || action.includes('failed')) return 'destructive';
    if (action === 'create') return 'default';
    if (action === 'update') return 'secondary';
    if (action === 'delete') return 'destructive';
    if (action === 'list') return 'outline';
    return 'secondary';
  };

  const getStatusColor = (status: number | null) => {
    if (!status) return 'secondary';
    if (status >= 200 && status < 300) return 'default';
    if (status >= 400 && status < 500) return 'secondary';
    return 'destructive';
  };

  const filteredLogs = logs.filter(log => 
    log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.request_method?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
              <p className="text-muted-foreground">Histórico de chamadas da API e webhooks</p>
            </div>
          </div>
          <Button onClick={fetchLogs} variant="outline" size="sm" disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação, recurso, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Card className="border-border">
          <CardHeader className="border-b border-border">
            <CardTitle className="text-lg">
              {filteredLogs.length} registro(s) encontrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Carregando logs...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum log encontrado
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredLogs.map((log) => (
                    <div key={log.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={getActionColor(log.action)}>
                              {log.action.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{log.resource_type}</Badge>
                            {log.request_method && (
                              <Badge variant="secondary">{log.request_method}</Badge>
                            )}
                            {log.response_status && (
                              <Badge variant={getStatusColor(log.response_status)}>
                                {log.response_status}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {log.ip_address && (
                              <span className="flex items-center gap-1">
                                <Globe className="w-3 h-3" />
                                {log.ip_address}
                              </span>
                            )}
                            {log.resource_id && (
                              <span className="flex items-center gap-1">
                                <Server className="w-3 h-3" />
                                ID: {log.resource_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>

                          {log.request_path && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {log.request_path}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}