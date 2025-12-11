import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserPlus, Search, Edit, Trash2, LogOut, Users } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, userRole, isAdmin, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const menuItems = [
    {
      title: 'Cadastrar Cliente',
      description: 'Cadastrar um novo cliente',
      icon: UserPlus,
      path: '/cadastrar',
      adminOnly: true,
    },
    {
      title: 'Consultar Cliente',
      description: 'Visualizar clientes cadastrados',
      icon: Search,
      path: '/consultar',
      adminOnly: false,
    },
    {
      title: 'Atualizar Cliente',
      description: 'Editar dados de um cliente',
      icon: Edit,
      path: '/atualizar',
      adminOnly: true,
    },
    {
      title: 'Excluir Cliente',
      description: 'Remover cliente do sistema',
      icon: Trash2,
      path: '/excluir',
      adminOnly: true,
      variant: 'destructive' as const,
    },
    {
      title: 'Gerenciar Usuários',
      description: 'Criar e gerenciar usuários do sistema',
      icon: Users,
      path: '/usuarios',
      adminOnly: true,
    },
  ];

  const visibleMenuItems = menuItems.filter(item => isAdmin || !item.adminOnly);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-xl bg-card border-border">
        <CardContent className="p-8">
          <div className="flex justify-center mb-6">
            <img 
              src="https://i.imgur.com/odbwwWW.png" 
              alt="Astros Comunicação Digital" 
              className="h-24"
            />
          </div>
          
          <h1 className="text-2xl font-bold text-center text-primary mb-2">
            Selecione uma opção
          </h1>
          
          <p className="text-sm text-muted-foreground text-center mb-6">
            Logado como: {user?.email} ({userRole === 'admin' ? 'Administrador' : 'Usuário'})
          </p>

          <div className="flex flex-col gap-4">
            {visibleMenuItems.map((item) => (
              <Button
                key={item.path}
                onClick={() => navigate(item.path)}
                variant={item.variant || 'outline'}
                className={`relative group py-6 rounded-xl text-center font-semibold transition duration-300 shadow-lg ${
                  item.variant === 'destructive' 
                    ? 'bg-destructive/20 text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground' 
                    : 'bg-secondary text-foreground border-primary hover:bg-primary hover:text-primary-foreground'
                }`}
              >
                <item.icon className="w-5 h-5 mr-2" />
                {item.title}
                <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 text-sm text-foreground bg-card border border-primary rounded shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 z-10 whitespace-nowrap">
                  {item.description}
                </span>
              </Button>
            ))}

            <Button
              onClick={handleSignOut}
              variant="destructive"
              className="relative group py-6 rounded-xl text-center font-semibold transition duration-300 shadow-lg"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sair
              <span className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 text-sm text-foreground bg-card border border-destructive rounded shadow-lg opacity-0 group-hover:opacity-100 transition duration-200 z-10">
                Encerrar a sessão
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
