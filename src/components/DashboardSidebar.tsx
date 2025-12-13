import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, 
  LayoutDashboard, Webhook, LogOut, ChevronLeft, ChevronRight, 
  Key, FileText, CreditCard, MessageCircle, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  adminOnly?: boolean;
  color?: string;
}

interface DashboardSidebarProps {
  onOpenChat?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function DashboardSidebar({ onOpenChat, collapsed = false, onCollapsedChange }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, signOut, user } = useAuth();
  const { canCreateClients, canUpdateClients, canDeleteClients, canManageUsers, canManagePermissions, canManageBilling, canManageWebhooks, canManageApi, canViewLogs, canManageSettings } = usePermissions();
  const [chatEnabled, setChatEnabled] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navRef = useRef<HTMLDivElement | null>(null);

  const handleToggle = () => {
    onCollapsedChange?.(!collapsed);
  };

  // Load user profile name on mount - cache in sessionStorage to prevent flickering
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const cacheKey = `profile_name_${user.id}`;
    const cached = sessionStorage.getItem(cacheKey);
    
    if (cached) {
      setUserName(cached);
      setIsLoading(false);
    }

    let isMounted = true;
    
    const loadData = async () => {
      const [chatResult, profileResult] = await Promise.all([
        supabase
          .from('billing_config')
          .select('config_value')
          .eq('config_key', 'chat_enabled')
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      if (isMounted) {
        setChatEnabled(chatResult.data?.config_value === 'true');
        const name = profileResult.data?.name || user.email?.split('@')[0] || 'Usuário';
        setUserName(name);
        sessionStorage.setItem(cacheKey, name);
        setIsLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Restore sidebar scroll position between navigations
  useEffect(() => {
    const saved = sessionStorage.getItem('sidebarScroll');
    if (navRef.current && saved) {
      navRef.current.scrollTop = Number(saved);
    }
  }, []);

  const clientItems: NavItem[] = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', color: 'text-info' },
    { title: 'Cadastrar', icon: UserPlus, path: '/cadastrar', adminOnly: !canCreateClients(), color: 'text-primary' },
    { title: 'Consultar', icon: Search, path: '/consultar', color: 'text-info' },
    { title: 'Atualizar', icon: Edit, path: '/atualizar', adminOnly: !canUpdateClients(), color: 'text-update' },
    { title: 'Excluir', icon: Trash2, path: '/excluir', adminOnly: !canDeleteClients(), color: 'text-destructive' },
  ];

  const adminItems: NavItem[] = [
    { title: 'Usuários', icon: Users, path: '/usuarios', adminOnly: !canManageUsers() },
    { title: 'Permissões', icon: ShieldCheck, path: '/admin/permissoes', adminOnly: !canManagePermissions() },
    { title: 'Cobrança', icon: CreditCard, path: '/admin/cobranca', adminOnly: !canManageBilling() },
    { title: 'Webhooks', icon: Webhook, path: '/admin/webhooks', adminOnly: !canManageWebhooks() },
    { title: 'API REST', icon: Key, path: '/admin/api', adminOnly: !canManageApi() },
    { title: 'Logs API', icon: FileText, path: '/admin/logs', adminOnly: !canViewLogs() },
    { title: 'Atividades', icon: FileText, path: '/admin/activity', adminOnly: !canViewLogs() },
    { title: 'Configurações', icon: Settings, path: '/admin', adminOnly: !canManageSettings() },
  ];

  const visibleClientItems = clientItems.filter(item => !item.adminOnly || isAdmin);
  const visibleAdminItems = adminItems.filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;
    
    const button = (
      <Button
        variant="ghost"
        onClick={() => {
          if (navRef.current) {
            sessionStorage.setItem('sidebarScroll', navRef.current.scrollTop.toString());
          }
          navigate(item.path);
        }}
        className={cn(
          "w-full justify-start gap-3 h-11 px-3 transition-all duration-200 relative group",
          isActive 
            ? "bg-primary/10 text-primary font-medium" 
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          collapsed && "justify-center px-0"
        )}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}
        <item.icon className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          isActive ? "text-primary" : item.color || "text-muted-foreground group-hover:text-foreground"
        )} />
        {!collapsed && (
          <span className="truncate text-sm">{item.title}</span>
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-gradient-to-b from-card to-card/95 border-r border-border/40 flex flex-col transition-all duration-300 z-20 shadow-xl",
      collapsed ? "w-[68px]" : "w-60"
    )}>
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border/40 flex items-center",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-foreground text-sm">Astros CRM</span>
              <span className="text-xs text-muted-foreground">Sistema de Gestão</span>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="text-primary-foreground font-bold text-lg">A</span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className={cn(
          "absolute -right-3 top-20 h-6 w-6 rounded-full border border-border bg-card shadow-md hover:bg-muted transition-all",
          "flex items-center justify-center z-30"
        )}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
              {isLoading ? (
                <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
              ) : (
                <span className="text-primary font-medium text-sm">
                  {(userName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="h-4 w-24 bg-muted rounded animate-pulse mb-1" />
              ) : (
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {isAdmin ? 'Administrador' : 'Usuário'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        ref={navRef}
        className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin"
      >
        {!collapsed && (
          <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
            Clientes
          </p>
        )}
        {collapsed && <div className="py-1" />}
        {visibleClientItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

        {visibleAdminItems.length > 0 && (
          <>
            {!collapsed ? (
              <p className="px-3 py-2 mt-4 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                Administração
              </p>
            ) : (
              <div className="my-3 mx-2 border-t border-border/40" />
            )}
            {visibleAdminItems.map((item) => (
              <NavButton key={item.path} item={item} />
            ))}
          </>
        )}

        {/* Chat Button */}
        {chatEnabled && onOpenChat && (
          <>
            {collapsed ? (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={onOpenChat}
                    className="w-full justify-center h-11 px-0 mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                  >
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border">
                  Ajuda
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={onOpenChat}
                className="w-full justify-start gap-3 h-11 px-3 mt-2 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="text-sm">Ajuda</span>
              </Button>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border/40 space-y-1">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-center h-11 px-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border">
              Sair
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 h-11 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="text-sm">Sair</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
