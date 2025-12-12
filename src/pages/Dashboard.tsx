import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, Search, Edit, Trash2, Users, Settings, ChevronRight, TrendingUp, Calendar, Webhook } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userRole, isAdmin, isApproved } = useAuth();
  const [stats, setStats] = useState({ totalClientes: 0, pendingUsers: 0, activeWebhooks: 0 });

  useEffect(() => {
    if (user && !isApproved) {
      navigate('/auth');
    }
  }, [user, isApproved, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch client count
      const { count: clienteCount } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      // Fetch pending users count (admin only)
      let pendingCount = 0;
      let webhookCount = 0;
      if (isAdmin) {
        const { count: pending } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'pending');
        pendingCount = pending || 0;

        const { count: webhooks } = await supabase
          .from('webhooks')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);
        webhookCount = webhooks || 0;
      }

      setStats({
        totalClientes: clienteCount || 0,
        pendingUsers: pendingCount,
        activeWebhooks: webhookCount,
      });
    };

    if (user) fetchStats();
  }, [user, isAdmin]);

  const clientActions = [
    {
      title: 'Cadastrar',
      description: 'Adicionar novo cliente ao sistema',
      icon: UserPlus,
      path: '/cadastrar',
      adminOnly: true,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      title: 'Consultar',
      description: 'Buscar e visualizar clientes',
      icon: Search,
      path: '/consultar',
      adminOnly: false,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Atualizar',
      description: 'Editar informações de clientes',
      icon: Edit,
      path: '/atualizar',
      adminOnly: true,
      color: 'from-amber-500 to-amber-600',
    },
    {
      title: 'Excluir',
      description: 'Remover cliente do sistema',
      icon: Trash2,
      path: '/excluir',
      adminOnly: true,
      color: 'from-rose-500 to-rose-600',
    },
  ];

  const adminActions = [
    { title: 'Gerenciar Usuários', description: 'Criar, editar e gerenciar acessos', icon: Users, path: '/usuarios' },
    { title: 'Webhooks', description: 'Integrações e automações', icon: Webhook, path: '/admin/webhooks' },
    { title: 'Configurações', description: 'Recuperação de senha e mais', icon: Settings, path: '/admin' },
  ];

  const visibleClientActions = clientActions.filter(item => isAdmin || !item.adminOnly);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Bem-vindo de volta!
            </h1>
            <p className="text-muted-foreground">
              {user?.email} • {userRole === 'admin' ? 'Administrador' : 'Visualizador'}
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalClientes}</p>
                  <p className="text-xs text-muted-foreground">Clientes Cadastrados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {isAdmin && (
            <>
              <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.pendingUsers}</p>
                      <p className="text-xs text-muted-foreground">Usuários Pendentes</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                      <Webhook className="h-5 w-5 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.activeWebhooks}</p>
                      <p className="text-xs text-muted-foreground">Webhooks Ativos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
          
          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">24/7</p>
                  <p className="text-xs text-muted-foreground">Sistema Online</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Actions */}
        <section className="mb-10">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <span className="h-5 w-1 bg-primary rounded-full"></span>
            Gestão de Clientes
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleClientActions.map((item) => (
              <Card 
                key={item.path}
                onClick={() => navigate(item.path)}
                className="group cursor-pointer border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <h4 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Admin Actions */}
        {isAdmin && (
          <section>
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="h-5 w-1 bg-amber-500 rounded-full"></span>
              Administração
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {adminActions.map((item) => (
                <Card 
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="group cursor-pointer border-border/40 bg-card/50 backdrop-blur-sm hover:bg-card hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
                >
                  <CardContent className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-11 w-11 rounded-xl bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground group-hover:text-primary transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
