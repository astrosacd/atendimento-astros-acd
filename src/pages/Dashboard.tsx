import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus, Search, Edit, Trash2, LogOut, Users, Settings, ChevronRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userRole, isAdmin, isApproved, signOut } = useAuth();

  useEffect(() => {
    if (user && !isApproved) {
      navigate('/auth');
    }
  }, [user, isApproved, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

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
    {
      title: 'Gerenciar Usuários',
      description: 'Criar, editar e gerenciar acessos',
      icon: Users,
      path: '/usuarios',
    },
    {
      title: 'Configurações',
      description: 'Recuperação de senha e mais',
      icon: Settings,
      path: '/admin',
    },
  ];

  const visibleClientActions = clientActions.filter(item => isAdmin || !item.adminOnly);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src="https://i.imgur.com/odbwwWW.png" 
              alt="Astros Comunicação Digital" 
              className="h-10"
            />
            <div className="hidden sm:block">
              <h1 className="text-lg font-semibold text-foreground">Astros Digital</h1>
              <p className="text-xs text-muted-foreground">Sistema de Gestão</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                {user?.email}
              </p>
              <p className="text-xs text-muted-foreground">
                {userRole === 'admin' ? 'Administrador' : 'Visualizador'}
              </p>
            </div>
            <Button
              onClick={handleSignOut}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Bem-vindo de volta!
          </h2>
          <p className="text-muted-foreground">
            O que você gostaria de fazer hoje?
          </p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Quick Stats (Optional visual element) */}
        <section className="mt-10 pt-8 border-t border-border/40">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-2xl font-bold text-foreground">CRM</p>
              <p className="text-xs text-muted-foreground">Sistema Ativo</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-2xl font-bold text-primary">24/7</p>
              <p className="text-xs text-muted-foreground">Disponibilidade</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-2xl font-bold text-foreground">Cloud</p>
              <p className="text-xs text-muted-foreground">Hospedagem</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 text-center">
              <p className="text-2xl font-bold text-emerald-500">Seguro</p>
              <p className="text-xs text-muted-foreground">Dados Protegidos</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
