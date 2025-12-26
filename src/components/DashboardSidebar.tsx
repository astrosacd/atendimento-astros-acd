import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, 
  LayoutDashboard, Webhook, LogOut, ChevronLeft, ChevronRight, 
  Key, FileText, CreditCard, MessageCircle, ShieldCheck, Tag, Megaphone, Smartphone, Database, HelpCircle, ShoppingBag, Ticket, Sparkles
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
  gradient?: string;
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
  const { canCreateClients, canUpdateClients, canDeleteClients, canManageUsers, canManagePermissions, canManageBilling, canManageWebhooks, canManageApi, canViewLogs, canManageSettings, canViewDivulgador, canViewNumeros, canViewConsultaNumeros, canViewGuia, canViewGateway, canViewChamados } = usePermissions();
  const navRef = useRef<HTMLDivElement | null>(null);

  // Initialize from cache immediately to prevent flicker on navigation
  const cacheKey = user?.id ? `profile_name_${user.id}` : null;
  const chatCacheKey = 'sidebar_chat_enabled';
  const cachedName = cacheKey ? sessionStorage.getItem(cacheKey) : null;
  const cachedChat = sessionStorage.getItem(chatCacheKey);
  
  const [chatEnabled, setChatEnabled] = useState(() => cachedChat === 'true');
  const [userName, setUserName] = useState<string | null>(() => cachedName || user?.email?.split('@')[0] || null);
  const [isLoading, setIsLoading] = useState(() => !cachedName);

  const handleToggle = () => {
    onCollapsedChange?.(!collapsed);
  };

  // Load user profile name on mount - use cache to prevent flickering
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const profileCacheKey = `profile_name_${user.id}`;
    const cached = sessionStorage.getItem(profileCacheKey);
    
    // If we have cached data, don't show loading
    if (cached) {
      setUserName(cached);
      setIsLoading(false);
    }
    
    let isMounted = true;
    
    const loadData = async () => {
      // Always fetch chat_enabled fresh (no cache) to reflect admin changes immediately
      const [chatResult, profileResult] = await Promise.all([
        supabase
          .from('billing_config')
          .select('config_value')
          .eq('config_key', 'chat_enabled')
          .maybeSingle(),
        cached ? Promise.resolve({ data: { name: cached } }) : supabase
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle()
      ]);
      
      if (isMounted) {
        const chatValue = chatResult.data?.config_value === 'true';
        setChatEnabled(chatValue);
        sessionStorage.setItem(chatCacheKey, chatValue ? 'true' : 'false');
        
        const name = profileResult.data?.name || user.email?.split('@')[0] || 'Usuário';
        setUserName(name);
        if (!cached) {
          sessionStorage.setItem(profileCacheKey, name);
        }
        setIsLoading(false);
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email]);

  // Restore sidebar scroll position between navigations
  useEffect(() => {
    const saved = sessionStorage.getItem('sidebarScroll');
    if (navRef.current && saved) {
      navRef.current.scrollTop = Number(saved);
    }
  }, []);

  const clientItems: NavItem[] = [
    { title: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', color: 'text-info', gradient: 'from-blue-500 to-cyan-500' },
    { title: 'Cadastrar', icon: UserPlus, path: '/cadastrar', adminOnly: !canCreateClients(), color: 'text-primary', gradient: 'from-green-500 to-emerald-500' },
    { title: 'Consultar', icon: Search, path: '/consultar', color: 'text-info', gradient: 'from-blue-500 to-indigo-500' },
    { title: 'Atualizar', icon: Edit, path: '/atualizar', adminOnly: !canUpdateClients(), color: 'text-update', gradient: 'from-violet-500 to-purple-500' },
    { title: 'Excluir', icon: Trash2, path: '/excluir', adminOnly: !canDeleteClients(), color: 'text-destructive', gradient: 'from-red-500 to-rose-500' },
  ];

  const adminItems: NavItem[] = [
    { title: 'Usuários', icon: Users, path: '/usuarios', adminOnly: !canManageUsers(), color: 'text-blue-500', gradient: 'from-blue-500 to-sky-500' },
    { title: 'Chamados', icon: Ticket, path: '/admin/chamados', adminOnly: !canViewChamados(), color: 'text-orange-500', gradient: 'from-orange-500 to-amber-500' },
    { title: 'Divulgador', icon: Megaphone, path: '/admin/divulgador', adminOnly: !canViewDivulgador(), color: 'text-amber-500', gradient: 'from-amber-500 to-yellow-500' },
    { title: 'Status Números', icon: Smartphone, path: '/admin/numeros', adminOnly: !canViewNumeros(), color: 'text-lime-500', gradient: 'from-lime-500 to-green-500' },
    { title: 'Consulta Números', icon: Database, path: '/admin/consulta-numeros', adminOnly: !canViewConsultaNumeros(), color: 'text-indigo-500', gradient: 'from-indigo-500 to-violet-500' },
    { title: 'Permissões', icon: ShieldCheck, path: '/admin/permissoes', adminOnly: !canManagePermissions(), color: 'text-violet-500', gradient: 'from-violet-500 to-purple-500' },
    { title: 'Cobrança', icon: CreditCard, path: '/admin/cobranca', adminOnly: !canManageBilling(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
    { title: 'Gateway', icon: ShoppingBag, path: '/admin/gateway', adminOnly: !canViewGateway(), color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-pink-500' },
    { title: 'Tags', icon: Tag, path: '/admin/tags', adminOnly: !canManageSettings(), color: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' },
    { title: 'Webhooks', icon: Webhook, path: '/admin/webhooks', adminOnly: !canManageWebhooks(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-teal-500' },
    { title: 'API REST', icon: Key, path: '/admin/api', adminOnly: !canManageApi(), color: 'text-amber-500', gradient: 'from-amber-500 to-orange-500' },
    { title: 'Logs API', icon: FileText, path: '/admin/logs', adminOnly: !canViewLogs(), color: 'text-rose-500', gradient: 'from-rose-500 to-red-500' },
    { title: 'Atividades', icon: FileText, path: '/admin/activity', adminOnly: !canViewLogs(), color: 'text-teal-500', gradient: 'from-teal-500 to-cyan-500' },
    { title: 'Configurações', icon: Settings, path: '/admin', adminOnly: !canManageSettings(), color: 'text-slate-400', gradient: 'from-slate-500 to-zinc-500' },
    { title: 'Guia', icon: HelpCircle, path: '/admin/guia', adminOnly: !canViewGuia(), color: 'text-purple-500', gradient: 'from-purple-500 to-violet-500' },
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
          "w-full justify-start gap-3 h-11 px-3 relative group transition-all duration-300",
          isActive
            ? "bg-gradient-to-r from-primary/20 to-primary/5 text-primary font-medium hover:from-primary/25 hover:to-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-gradient-to-r hover:from-muted/80 hover:to-muted/40",
          collapsed && "justify-center px-0"
        )}
      >
        {/* Active indicator with glow */}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-gradient-to-b from-primary via-primary to-primary/50 rounded-r-full shadow-lg shadow-primary/50" />
        )}
        
        {/* Icon with gradient background on active */}
        <div className={cn(
          "relative flex items-center justify-center shrink-0 transition-all duration-300",
          isActive ? "scale-110" : "group-hover:scale-105"
        )}>
          {isActive && (
            <div className={cn(
              "absolute inset-0 rounded-lg bg-gradient-to-br opacity-20 blur-sm -m-1",
              item.gradient || "from-primary to-primary/50"
            )} />
          )}
          <item.icon className={cn(
            "h-5 w-5 relative z-10 transition-colors duration-300",
            isActive ? "text-primary" : item.color || "text-muted-foreground group-hover:text-foreground"
          )} />
        </div>
        
        {!collapsed && (
          <span className="truncate text-sm">{item.title}</span>
        )}
        
        {/* Hover glow effect */}
        {!isActive && !collapsed && (
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        )}
      </Button>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {button}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return button;
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-gradient-to-b from-card via-card to-card/95 border-r border-border/30 flex flex-col transition-all duration-300 z-20",
      collapsed ? "w-[68px]" : "w-60",
      // Glass morphism effect
      "backdrop-blur-xl shadow-2xl shadow-black/20"
    )}>
      {/* Decorative gradient line at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border/30 flex items-center relative overflow-hidden",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
        
        {!collapsed ? (
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative group">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-primary/60 blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg">
                <span className="text-primary-foreground font-bold text-lg">A</span>
                <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-yellow-400 animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-foreground text-sm tracking-wide">Astros CRM</span>
              <span className="text-[10px] text-muted-foreground/80 font-medium">Sistema de Gestão</span>
            </div>
          </div>
        ) : (
          <div className="relative group">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-primary/60 blur-md opacity-50 group-hover:opacity-75 transition-opacity" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/80 flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-lg">A</span>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggle}
        className={cn(
          "absolute -right-3 top-20 h-6 w-6 rounded-full border border-border/50 bg-card/95 backdrop-blur-sm shadow-lg hover:bg-muted hover:scale-110 transition-all duration-300",
          "flex items-center justify-center z-30"
        )}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-border/30 relative overflow-hidden">
          {/* Background shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent opacity-50" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 blur-sm" />
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30 shadow-inner">
                {isLoading ? (
                  <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
                ) : (
                  <span className="text-primary font-semibold text-sm">
                    {(userName || 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <div className="h-4 w-24 bg-muted/50 rounded animate-pulse mb-1" />
              ) : (
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              )}
              <p className="text-[10px] text-muted-foreground/80 font-medium flex items-center gap-1">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isAdmin ? "bg-primary animate-pulse" : "bg-muted-foreground"
                )} />
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
          <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
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
              <p className="px-3 py-2 mt-4 text-[10px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                Administração
              </p>
            ) : (
              <div className="my-3 mx-2 border-t border-border/30" />
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
                    className="w-full justify-center h-11 px-0 mt-2 text-purple-400 hover:text-purple-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-purple-500/5 transition-all duration-300 group"
                  >
                    <div className="relative">
                      <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl">
                  Ajuda
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={onOpenChat}
                className="w-full justify-start gap-3 h-11 px-3 mt-2 text-purple-400 hover:text-purple-300 hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-purple-500/5 transition-all duration-300 group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <MessageCircle className="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform duration-300" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                </div>
                <span className="text-sm relative z-10">Ajuda</span>
              </Button>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border/30 relative">
        {/* Subtle gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-destructive/5 to-transparent pointer-events-none opacity-0 hover:opacity-100 transition-opacity" />
        
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-center h-11 px-0 text-muted-foreground hover:text-destructive hover:bg-gradient-to-r hover:from-destructive/20 hover:to-destructive/5 transition-all duration-300 group"
              >
                <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-300" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover/95 backdrop-blur-sm border-border/50 shadow-xl">
              Sair
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 h-11 px-3 text-muted-foreground hover:text-destructive hover:bg-gradient-to-r hover:from-destructive/20 hover:to-destructive/5 transition-all duration-300 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-destructive/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <LogOut className="h-5 w-5 shrink-0 group-hover:scale-110 transition-transform duration-300 relative z-10" />
            <span className="text-sm relative z-10">Sair</span>
          </Button>
        )}
      </div>
      
      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </aside>
  );
}
