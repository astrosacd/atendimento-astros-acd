import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, Search, RefreshCw, Clock, Globe, Server, 
  Filter, Calendar, AlertTriangle, CheckCircle2, XCircle,
  Activity, TrendingUp, TrendingDown, Mail, Bell, Save, Loader2, Send
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

type ActionFilter = 'all' | 'create' | 'update' | 'delete' | 'list' | 'error';
type DateFilter = 'today' | 'week' | 'month' | 'all';

export default function AdminAuditLogs() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('week');
  
  // Notification settings
  const [notifyErrors, setNotifyErrors] = useState(false);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPassword, setGmailAppPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [passwordLoaded, setPasswordLoaded] = useState(false);

  // Fetch notification config
  const { data: notifConfig } = useQuery({
    queryKey: ['notification-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recovery_config')
        .select('config_key, config_value')
        .in('config_key', ['notify_api_errors', 'notification_email', 'gmail_user', 'gmail_app_password']);
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (notifConfig && !passwordLoaded) {
      const config = notifConfig.reduce((acc, item) => {
        acc[item.config_key] = item.config_value;
        return acc;
      }, {} as Record<string, string>);
      
      setNotifyErrors(config.notify_api_errors === 'true');
      setNotificationEmail(config.notification_email || '');
      setGmailUser(config.gmail_user || '');
      if (config.gmail_app_password) {
        setGmailAppPassword('••••••••');
        setPasswordLoaded(true);
      }
    }
  }, [notifConfig, passwordLoaded]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Apply date filter
      if (dateFilter !== 'all') {
        const now = new Date();
        let startDate: Date;
        
        switch (dateFilter) {
          case 'today':
            startDate = startOfDay(now);
            break;
          case 'week':
            startDate = subDays(now, 7);
            break;
          case 'month':
            startDate = subDays(now, 30);
            break;
          default:
            startDate = subDays(now, 7);
        }
        
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data, error } = await query;

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
  }, [dateFilter]);

  const saveNotificationConfig = async () => {
    setIsSaving(true);
    try {
      const configs = [
        { config_key: 'notify_api_errors', config_value: String(notifyErrors) },
        { config_key: 'notification_email', config_value: notificationEmail },
      ];

      // Only update gmail password if user entered a new one (not the masked one)
      if (gmailAppPassword && !gmailAppPassword.includes('•')) {
        configs.push({ config_key: 'gmail_app_password', config_value: gmailAppPassword });
      }

      for (const config of configs) {
        const { error } = await supabase
          .from('recovery_config')
          .upsert(config, { onConflict: 'config_key' });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['notification-config'] });
      toast({
        title: "Configurações salvas!",
        description: "As notificações foram configuradas com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getActionColor = (action: string): "default" | "secondary" | "destructive" | "outline" => {
    if (action.includes('error') || action.includes('failed')) return 'destructive';
    if (action === 'create') return 'default';
    if (action === 'update') return 'secondary';
    if (action === 'delete') return 'destructive';
    if (action === 'list') return 'outline';
    return 'secondary';
  };

  const getStatusColor = (status: number | null): "default" | "secondary" | "destructive" | "outline" => {
    if (!status) return 'secondary';
    if (status >= 200 && status < 300) return 'default';
    if (status >= 400 && status < 500) return 'secondary';
    return 'destructive';
  };

  const getActionIcon = (action: string) => {
    if (action.includes('error') || action.includes('failed')) return <XCircle className="w-4 h-4" />;
    if (action === 'create') return <CheckCircle2 className="w-4 h-4" />;
    if (action === 'delete') return <XCircle className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  // Apply filters
  const filteredLogs = logs.filter(log => {
    // Search filter
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.ip_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.request_method?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Action filter
    let matchesAction = true;
    if (actionFilter !== 'all') {
      if (actionFilter === 'error') {
        matchesAction = log.action.includes('error') || log.action.includes('failed') || (log.response_status && log.response_status >= 400);
      } else {
        matchesAction = log.action === actionFilter;
      }
    }
    
    return matchesSearch && matchesAction;
  });

  // Calculate stats
  const stats = {
    total: filteredLogs.length,
    success: filteredLogs.filter(l => l.response_status && l.response_status >= 200 && l.response_status < 300).length,
    errors: filteredLogs.filter(l => l.action.includes('error') || l.action.includes('failed') || (l.response_status && l.response_status >= 400)).length,
    creates: filteredLogs.filter(l => l.action === 'create').length,
    updates: filteredLogs.filter(l => l.action === 'update').length,
    deletes: filteredLogs.filter(l => l.action === 'delete').length,
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Logs de Auditoria</h1>
              <p className="text-muted-foreground">Monitoramento completo de chamadas da API</p>
            </div>
          </div>
          <Button onClick={fetchLogs} variant="outline" disabled={isLoading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-gradient-to-br from-card to-green-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.success}</p>
                  <p className="text-xs text-muted-foreground">Sucesso</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-gradient-to-br from-card to-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.errors}</p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-gradient-to-br from-card to-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.creates}</p>
                  <p className="text-xs text-muted-foreground">Criados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-gradient-to-br from-card to-update/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-update/10">
                  <RefreshCw className="w-4 h-4 text-update" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.updates}</p>
                  <p className="text-xs text-muted-foreground">Atualizados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-border/50 bg-gradient-to-br from-card to-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendingDown className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.deletes}</p>
                  <p className="text-xs text-muted-foreground">Excluídos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notification Settings */}
        <Card className="border-border/50 bg-gradient-to-br from-card to-amber-500/5">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Bell className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Notificações de Erros</CardTitle>
                <CardDescription>Receba alertas por email quando ocorrerem erros na API</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Notificar erros por email</p>
                  <p className="text-sm text-muted-foreground">Enviar email quando houver falhas na API</p>
                </div>
              </div>
              <Switch
                checked={notifyErrors}
                onCheckedChange={setNotifyErrors}
              />
            </div>
            
            {notifyErrors && (
              <div className="grid md:grid-cols-2 gap-4 p-4 rounded-lg bg-muted/20 border border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="notif-email">Email para notificações</Label>
                  <Input
                    id="notif-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gmail-user">Conta Gmail (remetente)</Label>
                  <Input
                    id="gmail-user"
                    type="email"
                    placeholder="conta@gmail.com"
                    value={gmailUser}
                    onChange={(e) => setGmailUser(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="gmail-pass">Senha de App do Gmail</Label>
                  <Input
                    id="gmail-pass"
                    type="password"
                    placeholder="Sua senha de app do Gmail"
                    value={gmailAppPassword}
                    onFocus={() => {
                      if (gmailAppPassword === '••••••••') {
                        setGmailAppPassword('');
                      }
                    }}
                    onChange={(e) => setGmailAppPassword(e.target.value)}
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Crie uma senha de app em: myaccount.google.com → Segurança → Verificação em duas etapas → Senhas de app
                  </p>
                </div>
                <div className="md:col-span-2 flex gap-3">
                  <Button onClick={saveNotificationConfig} disabled={isSaving} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Configurações
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      if (!notificationEmail || !gmailUser || (!gmailAppPassword || gmailAppPassword.includes('•'))) {
                        toast({
                          title: "Dados incompletos",
                          description: "Preencha todos os campos e salve antes de testar. Se já salvou, insira novamente a senha do App.",
                          variant: "destructive"
                        });
                        return;
                      }
                      
                      setIsTesting(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('send-test-email-notification', {
                          body: {
                            to: notificationEmail,
                            gmailUser: gmailUser,
                            gmailAppPassword: gmailAppPassword
                          }
                        });
                        
                        if (error) throw error;
                        
                        toast({
                          title: "Email de teste enviado!",
                          description: `Um email foi enviado para ${notificationEmail}`,
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erro ao enviar teste",
                          description: error.message || "Verifique as credenciais do Gmail",
                          variant: "destructive"
                        });
                      } finally {
                        setIsTesting(false);
                      }
                    }} 
                    disabled={isTesting || !notificationEmail || !gmailUser}
                    className="gap-2"
                  >
                    {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Testar Envio
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ação, recurso, IP..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border/50"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as ActionFilter)}>
              <SelectTrigger className="w-[150px] bg-card border-border/50">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ações</SelectItem>
                <SelectItem value="create">Criações</SelectItem>
                <SelectItem value="update">Atualizações</SelectItem>
                <SelectItem value="delete">Exclusões</SelectItem>
                <SelectItem value="list">Consultas</SelectItem>
                <SelectItem value="error">Erros</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-[150px] bg-card border-border/50">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Últimos 7 dias</SelectItem>
                <SelectItem value="month">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todo período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logs Table */}
        <Card className="border-border/50 overflow-hidden">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              {filteredLogs.length} registro(s) encontrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-muted-foreground">Carregando logs...</p>
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Nenhum log encontrado</p>
                  <p className="text-sm text-muted-foreground/70">Ajuste os filtros ou aguarde novas chamadas da API</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className={`p-4 hover:bg-muted/30 transition-colors ${
                        log.action.includes('error') || log.action.includes('failed') 
                          ? 'bg-destructive/5 border-l-2 border-l-destructive' 
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className={`p-1 rounded ${
                              log.action.includes('error') ? 'bg-destructive/10' : 'bg-primary/10'
                            }`}>
                              {getActionIcon(log.action)}
                            </div>
                            <Badge variant={getActionColor(log.action)} className="font-mono text-xs">
                              {log.action.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{log.resource_type}</Badge>
                            {log.request_method && (
                              <Badge variant="secondary" className="text-xs font-mono">{log.request_method}</Badge>
                            )}
                            {log.response_status && (
                              <Badge variant={getStatusColor(log.response_status)} className="text-xs font-mono">
                                {log.response_status}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {log.ip_address && log.ip_address !== 'unknown' && (
                              <span className="flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5" />
                                {log.ip_address}
                              </span>
                            )}
                            {log.resource_id && (
                              <span className="flex items-center gap-1.5 font-mono text-xs">
                                <Server className="w-3.5 h-3.5" />
                                {log.resource_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>

                          {log.request_path && (
                            <p className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-1 rounded inline-block">
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