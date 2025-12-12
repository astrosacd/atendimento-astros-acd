import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, 
  LayoutDashboard, Webhook, LogOut, ChevronLeft, ChevronRight, Key, FileText 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
}

export function DashboardSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const clientItems: NavItem[] = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { title: 'Cadastrar', icon: UserPlus, path: '/cadastrar', adminOnly: true },
    { title: 'Consultar', icon: Search, path: '/consultar' },
    { title: 'Atualizar', icon: Edit, path: '/atualizar', adminOnly: true },
    { title: 'Excluir', icon: Trash2, path: '/excluir', adminOnly: true },
  ];

  const adminItems: NavItem[] = [
    { title: 'Usuários', icon: Users, path: '/usuarios', adminOnly: true },
    { title: 'Webhooks', icon: Webhook, path: '/admin/webhooks', adminOnly: true },
    { title: 'API REST', icon: Key, path: '/admin/api', adminOnly: true },
    { title: 'Logs', icon: FileText, path: '/admin/logs', adminOnly: true },
    { title: 'Configurações', icon: Settings, path: '/admin', adminOnly: true },
  ];

  const visibleClientItems = clientItems.filter(item => isAdmin || !item.adminOnly);
  const visibleAdminItems = isAdmin ? adminItems : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    
    return (
      <Button
        variant="ghost"
        onClick={() => navigate(item.path)}
        className={cn(
          "w-full justify-start gap-3 h-10 px-3 transition-all",
          isActive 
            ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
        {!collapsed && <span className="truncate">{item.title}</span>}
      </Button>
    );
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-card border-r border-border/40 flex flex-col transition-all duration-300 z-20",
      collapsed ? "w-16" : "w-56"
    )}>
      {/* Logo */}
      <div className="p-4 border-b border-border/40 flex items-center justify-between">
        {!collapsed && (
          <img 
            src="https://i.imgur.com/odbwwWW.png" 
            alt="Astros" 
            className="h-8"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 shrink-0"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Clientes
          </p>
        )}
        {visibleClientItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

        {visibleAdminItems.length > 0 && (
          <>
            {!collapsed && (
              <p className="px-3 py-2 mt-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Admin
              </p>
            )}
            {collapsed && <div className="my-4 border-t border-border/40" />}
            {visibleAdminItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-border/40">
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="w-full justify-start gap-3 h-10 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </Button>
      </div>
    </aside>
  );
}
