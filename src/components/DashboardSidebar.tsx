import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, 
  LayoutDashboard, Webhook, LogOut, ChevronLeft, ChevronRight, 
  Key, FileText, CreditCard, MessageCircle, ShieldCheck, Tag, Megaphone, Smartphone, Database, HelpCircle, ShoppingBag, Ticket, Sparkles, Store, BarChart3, ListTodo, FileSignature, Receipt, CalendarClock, Columns3
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
import { LanguageSelector } from '@/components/LanguageSelector';

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
  const { canCreateClients, canUpdateClients, canDeleteClients, canManageUsers, canManagePermissions, canManageBilling, canManageWebhooks, canManageApi, canViewLogs, canManageSettings, canViewDivulgador, canViewNumeros, canViewConsultaNumeros, canViewGuia, canViewGateway, canViewChamados, canViewRevendedor, canViewReports, canViewDespesas, canViewFollowups, canViewProposals } = usePermissions();
  const { t } = useTranslation();
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
    { title: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/dashboard', color: 'text-info', gradient: 'from-blue-500 to-cyan-500' },
    { title: t('sidebar.register'), icon: UserPlus, path: '/cadastrar', adminOnly: !canCreateClients(), color: 'text-primary', gradient: 'from-green-500 to-emerald-500' },
    { title: t('sidebar.search'), icon: Search, path: '/consultar', color: 'text-info', gradient: 'from-blue-500 to-indigo-500' },
    { title: t('sidebar.update'), icon: Edit, path: '/atualizar', adminOnly: !canUpdateClients(), color: 'text-update', gradient: 'from-violet-500 to-purple-500' },
    { title: t('sidebar.delete'), icon: Trash2, path: '/excluir', adminOnly: !canDeleteClients(), color: 'text-destructive', gradient: 'from-red-500 to-rose-500' },
    { title: t('sidebar.tasks'), icon: ListTodo, path: '/tarefas', color: 'text-amber-500', gradient: 'from-amber-500 to-orange-500' },
    { title: t('sidebar.proposals'), icon: FileSignature, path: '/propostas', adminOnly: !canViewProposals(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
    { title: 'Follow-ups', icon: CalendarClock, path: '/followups', adminOnly: !canViewFollowups(), color: 'text-violet-500', gradient: 'from-violet-500 to-purple-500' },
    { title: 'Despesas', icon: Receipt, path: '/despesas', adminOnly: !canViewDespesas(), color: 'text-orange-500', gradient: 'from-orange-500 to-red-500' },
  ];

  const adminItems: NavItem[] = [
    { title: t('sidebar.users'), icon: Users, path: '/usuarios', adminOnly: !canManageUsers(), color: 'text-blue-500', gradient: 'from-blue-500 to-sky-500' },
    { title: t('sidebar.tickets'), icon: Ticket, path: '/admin/chamados', adminOnly: !canViewChamados(), color: 'text-orange-500', gradient: 'from-orange-500 to-amber-500' },
    { title: t('sidebar.broadcaster'), icon: Megaphone, path: '/admin/divulgador', adminOnly: !canViewDivulgador(), color: 'text-amber-500', gradient: 'from-amber-500 to-yellow-500' },
    { title: t('sidebar.numberStatus'), icon: Smartphone, path: '/admin/numeros', adminOnly: !canViewNumeros(), color: 'text-lime-500', gradient: 'from-lime-500 to-green-500' },
    { title: t('sidebar.numberQuery'), icon: Database, path: '/admin/consulta-numeros', adminOnly: !canViewConsultaNumeros(), color: 'text-indigo-500', gradient: 'from-indigo-500 to-violet-500' },
    { title: t('sidebar.permissions'), icon: ShieldCheck, path: '/admin/permissoes', adminOnly: !canManagePermissions(), color: 'text-violet-500', gradient: 'from-violet-500 to-purple-500' },
    { title: t('sidebar.billing'), icon: CreditCard, path: '/admin/cobranca', adminOnly: !canManageBilling(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
    { title: t('sidebar.gateway'), icon: ShoppingBag, path: '/admin/gateway', adminOnly: !canViewGateway(), color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-pink-500' },
    { title: t('sidebar.reseller'), icon: Store, path: '/admin/revendedor', adminOnly: !canViewRevendedor(), color: 'text-sky-500', gradient: 'from-sky-500 to-blue-500' },
    { title: t('sidebar.reports'), icon: BarChart3, path: '/admin/relatorios', adminOnly: !canViewReports(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-blue-500' },
    { title: t('sidebar.tags'), icon: Tag, path: '/admin/tags', adminOnly: !canManageSettings(), color: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' },
    { title: t('sidebar.webhooks'), icon: Webhook, path: '/admin/webhooks', adminOnly: !canManageWebhooks(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-teal-500' },
    { title: t('sidebar.apiRest'), icon: Key, path: '/admin/api', adminOnly: !canManageApi(), color: 'text-amber-500', gradient: 'from-amber-500 to-orange-500' },
    { title: t('sidebar.apiLogs'), icon: FileText, path: '/admin/logs', adminOnly: !canViewLogs(), color: 'text-rose-500', gradient: 'from-rose-500 to-red-500' },
    { title: t('sidebar.activities'), icon: FileText, path: '/admin/activity', adminOnly: !canViewLogs(), color: 'text-teal-500', gradient: 'from-teal-500 to-cyan-500' },
    { title: t('sidebar.settings'), icon: Settings, path: '/admin', adminOnly: !canManageSettings(), color: 'text-slate-400', gradient: 'from-slate-500 to-zinc-500' },
    { title: t('sidebar.guide'), icon: HelpCircle, path: '/admin/guia', adminOnly: !canViewGuia(), color: 'text-purple-500', gradient: 'from-purple-500 to-violet-500' },
  ];

  const visibleClientItems = clientItems.filter(item => !item.adminOnly || isAdmin);
  const visibleAdminItems = adminItems.filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const isActive = location.pathname === item.path;

    const base = cn(
      "w-full h-11 px-3 rounded-md flex items-center gap-3 relative",
      "text-sm text-left",
      "transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      collapsed && "justify-center px-0",
      isActive
        ? "bg-primary/15 text-primary"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
    );

    const content = (
      <button
        type="button"
        aria-current={isActive ? "page" : undefined}
        onClick={() => {
          if (navRef.current) {
            sessionStorage.setItem('sidebarScroll', navRef.current.scrollTop.toString());
          }
          navigate(item.path);
        }}
        className={base}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
        )}

        <div className={cn("relative flex items-center justify-center shrink-0", isActive && "scale-110")}
        >
          <item.icon
            className={cn(
              "h-5 w-5",
              isActive ? "text-primary" : item.color || "text-muted-foreground",
            )}
          />
        </div>

        {!collapsed && <span className="truncate">{item.title}</span>}
      </button>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right" className="bg-popover border-border shadow-lg">
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return content;
  };

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-[width] duration-300 z-20",
      collapsed ? "w-[68px]" : "w-60"
    )}>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border flex items-center",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                <span className="text-primary-foreground font-bold text-lg">A</span>
              </div>
              <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-foreground text-sm">Astros CRM</span>
              <span className="text-[10px] text-muted-foreground">Sistema de Gestão</span>
            </div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <span className="text-primary-foreground font-bold text-lg">A</span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggle}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-card shadow-md hover:bg-muted transition-colors z-30"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* User Info */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              {isLoading ? (
                <div className="w-4 h-4 rounded-full bg-muted animate-pulse" />
              ) : (
                <span className="text-primary font-semibold text-sm">
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
              <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isAdmin ? "bg-primary" : "bg-muted-foreground"
                )} />
                {isAdmin ? t('user.administrator') : t('user.user')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        ref={navRef}
        className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin"
      >
        {!collapsed && (
          <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {t('sidebar.clients')}
          </p>
        )}
        {collapsed && <div className="py-1" />}
        {visibleClientItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}

        {visibleAdminItems.length > 0 && (
          <>
            {!collapsed ? (
              <p className="px-3 py-2 mt-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('sidebar.administration')}
              </p>
            ) : (
              <div className="my-3 mx-2 border-t border-border" />
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
                    className="w-full justify-center h-11 px-0 mt-2 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
                  >
                    <div className="relative">
                      <MessageCircle className="h-5 w-5" />
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
                    </div>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-popover border-border shadow-lg">
                  {t('sidebar.help')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                onClick={onOpenChat}
                className="w-full justify-start gap-3 h-11 px-3 mt-2 text-purple-500 hover:text-purple-400 hover:bg-purple-500/10 transition-colors"
              >
                <div className="relative">
                  <MessageCircle className="h-5 w-5 shrink-0" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-500 rounded-full" />
                </div>
                <span className="text-sm">{t('sidebar.help')}</span>
              </Button>
            )}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Language Selector */}
        <LanguageSelector collapsed={collapsed} />
        
        {/* Logout Button */}
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={handleSignOut}
                className="w-full justify-center h-11 px-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-popover border-border shadow-lg">
              {t('auth.logout')}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className="w-full justify-start gap-3 h-11 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="text-sm">{t('auth.logout')}</span>
          </Button>
        )}
      </div>
    </aside>
  );
}
