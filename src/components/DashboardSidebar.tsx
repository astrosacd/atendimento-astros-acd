import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTranslation } from 'react-i18next';
import { 
  UserPlus, Search, Edit, Trash2, Users, Settings, 
  LayoutDashboard, Webhook, LogOut, ChevronLeft, ChevronRight, 
  Key, FileText, CreditCard, MessageCircle, MessageSquare, ShieldCheck, Tag, Megaphone, Smartphone, Database, HelpCircle, ShoppingBag, Ticket, Sparkles, Store, BarChart3, ListTodo, FileSignature, Receipt, CalendarClock, Columns3, Crosshair, CalendarDays, Link2, Brain, Network, Package, UserCircle, Bot,
  Instagram, History, Activity, PhoneCall
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef, memo } from 'react';

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

interface NavButtonProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
  navRef: React.RefObject<HTMLDivElement | null>;
}

const NavButton = memo(({ item, collapsed, isActive, navRef }: NavButtonProps) => {
  const base = cn(
    "w-full h-11 px-3 rounded-md flex items-center relative",
    "text-sm text-left overflow-hidden whitespace-nowrap",
    "transition-all duration-300 ease-in-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    collapsed ? "justify-center px-0" : "gap-3",
    isActive
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
  );

  const content = (
    <Link
      to={item.path}
      aria-current={isActive ? "page" : undefined}
      onClick={() => {
        if (navRef.current) {
          sessionStorage.setItem('sidebarScroll', navRef.current.scrollTop.toString());
        }
      }}
      className={base}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
      )}

      <div className={cn("relative flex items-center justify-center shrink-0 w-10 transition-transform duration-300", isActive && "scale-110")}>
        <item.icon
          className={cn(
            "h-5 w-5",
            isActive ? "text-primary" : item.color || "text-muted-foreground",
          )}
        />
      </div>

      <span className={cn(
        "truncate transition-all duration-300 ease-in-out origin-left",
        collapsed ? "w-0 opacity-0 -translate-x-10 invisible" : "w-auto opacity-100 translate-x-0 visible"
      )}>
        {item.title}
      </span>
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border-border shadow-lg">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
});

NavButton.displayName = 'NavButton';

interface FooterButtonProps {
  collapsed: boolean;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: "ghost" | "outline" | "default" | "destructive" | "secondary" | "link";
  className?: string;
  showIndicator?: boolean;
}

const FooterButton = memo(({ 
  collapsed, 
  onClick, 
  icon: Icon, 
  label, 
  variant = "ghost",
  className,
  showIndicator = false
}: FooterButtonProps) => {
  const content = (
    <Button
      variant={variant}
      onClick={onClick}
      className={cn(
        "w-full h-11 transition-all duration-300 overflow-hidden whitespace-nowrap",
        collapsed ? "justify-center px-0" : "justify-start gap-3 px-3",
        className
      )}
    >
      <div className="relative shrink-0 w-10 flex justify-center">
        <Icon className={cn("h-5 w-5", !collapsed && "shrink-0")} />
        {showIndicator && <span className="absolute top-0 right-2 w-2 h-2 bg-purple-500 rounded-full" />}
      </div>
      <span className={cn(
        "text-sm truncate transition-all duration-300 ease-in-out origin-left",
        collapsed ? "w-0 opacity-0 -translate-x-10 invisible" : "w-auto opacity-100 translate-x-0 visible"
      )}>
        {label}
      </span>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="bg-popover border-border shadow-lg">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
});

FooterButton.displayName = 'FooterButton';


interface DashboardSidebarProps {
  onOpenChat?: () => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isMobile?: boolean;
}

export function DashboardSidebar({ onOpenChat, collapsed = false, onCollapsedChange, mobileOpen = false, onMobileClose: _onMobileClose, isMobile = false }: DashboardSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin, signOut, user } = useAuth();
  const { canCreateClients, canUpdateClients, canDeleteClients, canViewClientGraph, canManageUsers, canManagePermissions, canManageBilling, canManageWebhooks, canManageApi, canViewLogs, canManageSettings, canViewDivulgador, canViewNumeros, canViewConsultaNumeros, canViewGuia, canViewGateway, canViewChamados, canViewRevendedor, canViewReports, canViewDespesas, canViewFollowups, canViewProposals, canViewPipeline, canViewAgenda, canViewPaymentLinks, canViewSalesForecast, canViewPaymentSecurity, canViewCentralAjuda, canManagePredefinedProducts, canManageSystemHealth, hasPermission } = usePermissions();
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

  const menuGroups = [
    {
      id: 'crm',
      title: t('sidebar.groups.crm'),
      items: [
        { title: t('sidebar.dashboard'), icon: LayoutDashboard, path: '/dashboard', color: 'text-info', gradient: 'from-blue-500 to-cyan-500' },
        { title: 'Sala dos Agentes', icon: Bot, path: '/sala-agentes', color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-purple-500' },
        { title: t('sidebar.pipeline'), icon: Columns3, path: '/kanban', adminOnly: !canViewPipeline(), color: 'text-indigo-500', gradient: 'from-indigo-500 to-violet-500' },
        { title: t('sidebar.calendar'), icon: CalendarDays, path: '/agenda', adminOnly: !canViewAgenda(), color: 'text-teal-500', gradient: 'from-teal-500 to-cyan-500' },
        { title: t('sidebar.tasks'), icon: ListTodo, path: '/tarefas', color: 'text-amber-500', gradient: 'from-amber-500 to-orange-500' },
        { title: t('sidebar.followups'), icon: CalendarClock, path: '/followups', adminOnly: !canViewFollowups(), color: 'text-violet-500', gradient: 'from-violet-500 to-purple-500' },
        { title: t('sidebar.tickets'), icon: Ticket, path: '/admin/chamados', adminOnly: !canViewChamados(), color: 'text-orange-500', gradient: 'from-orange-500 to-amber-500' },
        { title: t('sidebar.iaIntelligence'), icon: Brain, path: '/admin/ia', adminOnly: !canViewSalesForecast(), color: 'text-purple-400', gradient: 'from-purple-400 to-indigo-500' },
        { title: 'Central de Ajuda', icon: HelpCircle, path: '/central-ajuda', adminOnly: !canViewCentralAjuda(), color: 'text-sky-400', gradient: 'from-sky-400 to-blue-500' },
      ]
    },
    {
      id: 'marketing',
      title: t('sidebar.groups.marketing'),
      items: [
        { title: t('sidebar.leadhunter'), icon: Crosshair, path: '/lead-hunter', color: 'text-orange-500', gradient: 'from-orange-500 to-red-500' },
        { title: t('sidebar.broadcaster'), icon: Megaphone, path: '/admin/divulgador', adminOnly: !canViewDivulgador(), color: 'text-amber-500', gradient: 'from-amber-500 to-yellow-500' },
        { title: 'Instagram', icon: Instagram, path: '/instagram', color: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' },
        { title: t('sidebar.proposals'), icon: FileSignature, path: '/propostas', adminOnly: !canViewProposals(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
        { title: t('sidebar.paymentlink'), icon: Link2, path: '/link-pagamento', adminOnly: !canViewPaymentLinks(), color: 'text-green-500', gradient: 'from-green-500 to-emerald-500' },
        { title: 'Ligações IA', icon: PhoneCall, path: '/ligacoes-ia', adminOnly: !hasPermission('view_ligacoes_ia'), color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-purple-500' },
        { title: 'Central de SMS', icon: MessageSquare, path: '/central-sms', adminOnly: !hasPermission('view_central_sms'), color: 'text-blue-500', gradient: 'from-blue-500 to-indigo-500' },
      ]
    },
    {
      id: 'clients',
      title: t('sidebar.groups.clients'),
      items: [
        { title: t('sidebar.search'), icon: Search, path: '/consultar', color: 'text-info', gradient: 'from-blue-500 to-indigo-500' },
        { title: t('sidebar.register'), icon: UserPlus, path: '/cadastrar', adminOnly: !canCreateClients(), color: 'text-primary', gradient: 'from-green-500 to-emerald-500' },
        { title: t('sidebar.update'), icon: Edit, path: '/atualizar', adminOnly: !canUpdateClients(), color: 'text-update', gradient: 'from-violet-500 to-purple-500' },
        { title: 'Mapa 360°', icon: Network, path: '/grafo-clientes', adminOnly: !canViewClientGraph(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-blue-500' },
        { title: t('sidebar.delete'), icon: Trash2, path: '/excluir', adminOnly: !canDeleteClients(), color: 'text-destructive', gradient: 'from-red-500 to-rose-500' },
      ]
    },
    {
      id: 'telephony',
      title: t('sidebar.groups.telephony'),
      items: [
        { title: t('sidebar.numberStatus'), icon: Smartphone, path: '/admin/numeros', adminOnly: !canViewNumeros(), color: 'text-lime-500', gradient: 'from-lime-500 to-green-500' },
        { title: t('sidebar.numberQuery'), icon: Database, path: '/admin/consulta-numeros', adminOnly: !canViewConsultaNumeros(), color: 'text-indigo-500', gradient: 'from-indigo-500 to-violet-500' },
      ]
    },
    {
      id: 'finance',
      title: t('sidebar.groups.finance'),
      items: [
        { title: t('sidebar.expenses'), icon: Receipt, path: '/despesas', adminOnly: !canViewDespesas(), color: 'text-orange-500', gradient: 'from-orange-500 to-red-500' },
        { title: t('sidebar.reports'), icon: BarChart3, path: '/admin/relatorios', adminOnly: !canViewReports(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-blue-500' },
        { title: t('sidebar.billing'), icon: CreditCard, path: '/admin/cobranca', adminOnly: !canManageBilling(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
        { title: 'Segurança de Pagamento', icon: ShieldCheck, path: '/admin/seguranca-pagamento', adminOnly: !canViewPaymentSecurity(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
      ]
    },
    {
      id: 'settings',
      title: t('sidebar.groups.settings'),
      items: [
        { title: t('sidebar.users'), icon: Users, path: '/usuarios', adminOnly: !canManageUsers(), color: 'text-blue-500', gradient: 'from-blue-500 to-sky-500' },
        { title: t('sidebar.permissions'), icon: ShieldCheck, path: '/admin/permissoes', adminOnly: !canManagePermissions(), color: 'text-violet-500', gradient: 'from-violet-500 to-purple-500' },
        { title: t('sidebar.gateway'), icon: ShoppingBag, path: '/admin/gateway', adminOnly: !canViewGateway(), color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-pink-500' },
        { title: t('sidebar.reseller'), icon: Store, path: '/admin/revendedor', adminOnly: !canViewRevendedor(), color: 'text-sky-500', gradient: 'from-sky-500 to-blue-500' },
        { title: t('sidebar.tags'), icon: Tag, path: '/admin/tags', adminOnly: !canManageSettings(), color: 'text-pink-500', gradient: 'from-pink-500 to-rose-500' },
        { title: 'Produtos Predefinidos', icon: Package, path: '/admin/produtos', adminOnly: !canManagePredefinedProducts(), color: 'text-indigo-500', gradient: 'from-indigo-500 to-purple-500' },
        { title: t('sidebar.webhooks'), icon: Webhook, path: '/admin/webhooks', adminOnly: !canManageWebhooks(), color: 'text-cyan-500', gradient: 'from-cyan-500 to-teal-500' },
        { title: 'Formulários Atomicat', icon: Webhook, path: '/admin/formularios-atomicat', adminOnly: !canManageWebhooks(), color: 'text-fuchsia-500', gradient: 'from-fuchsia-500 to-pink-500' },
        { title: t('sidebar.apiRest'), icon: Key, path: '/admin/api', adminOnly: !canManageApi(), color: 'text-amber-500', gradient: 'from-amber-500 to-orange-500' },
        { title: t('sidebar.apiLogs'), icon: FileText, path: '/admin/logs', adminOnly: !canViewLogs(), color: 'text-rose-500', gradient: 'from-rose-500 to-red-500' },
        { title: t('sidebar.activities'), icon: FileText, path: '/admin/activity', adminOnly: !canViewLogs(), color: 'text-teal-500', gradient: 'from-teal-500 to-cyan-500' },
        { title: t('sidebar.guide'), icon: HelpCircle, path: '/admin/guia', adminOnly: !canViewGuia(), color: 'text-purple-500', gradient: 'from-purple-500 to-violet-500' },
        { title: 'Saúde do Sistema', icon: Activity, path: '/admin/saude', adminOnly: !canManageSystemHealth(), color: 'text-emerald-500', gradient: 'from-emerald-500 to-teal-500' },
        { title: t('sidebar.settings'), icon: Settings, path: '/admin', adminOnly: !canManageSettings(), color: 'text-slate-400', gradient: 'from-slate-500 to-zinc-500' },
      ]
    }
  ];

  const visibleGroups = menuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !item.adminOnly || isAdmin)
  })).filter(group => group.items.length > 0);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };



  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-card border-r border-border flex flex-col transition-all duration-300 z-40",
      isMobile ? "w-[260px]" : (collapsed ? "w-[68px]" : "w-60"),
      isMobile && !mobileOpen && "-translate-x-full",
      isMobile && mobileOpen && "translate-x-0 shadow-2xl"
    )}>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      
      {/* Header */}
      <div className={cn(
        "p-4 border-b border-border flex items-center",
        collapsed && !isMobile ? "justify-center" : "justify-between"
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

      {/* Toggle Button - escondido em mobile */}
      {!isMobile && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleToggle}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full bg-card shadow-md hover:bg-muted transition-colors z-30"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      )}

      {/* User Info */}
      <div className={cn(
        "px-4 py-3 border-b border-border transition-all duration-300 overflow-hidden whitespace-nowrap",
        collapsed ? "h-0 opacity-0 py-0 border-b-0" : "h-[65px] opacity-100"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
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


      {/* Navigation */}
      <nav
        ref={navRef}
        className="flex-1 p-2 space-y-0.5 overflow-y-auto scrollbar-thin"
      >
        {visibleGroups.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-4")}>
            {!collapsed ? (
              <p className="px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {group.title}
              </p>
            ) : (
              index > 0 && <div className="my-3 mx-2 border-t border-border" />
            )}
            {group.items.map((item) => (
              <NavButton 
                key={item.path} 
                item={item} 
                collapsed={collapsed}
                isActive={location.pathname === item.path}
                navRef={navRef}
              />

            ))}
          </div>
        ))}

        {/* Chat Button */}
        {chatEnabled && onOpenChat && (
          <div className="mt-2">
            <FooterButton
              collapsed={collapsed}
              onClick={onOpenChat}
              icon={MessageCircle}
              label={t('sidebar.help')}
              className="text-purple-500 hover:text-purple-400 hover:bg-purple-500/10"
              showIndicator={true}
            />
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border space-y-1">
        {/* Language Selector */}
        <LanguageSelector collapsed={collapsed} />

        {/* Profile */}
        <FooterButton
          collapsed={collapsed}
          onClick={() => navigate('/perfil')}
          icon={UserCircle}
          label="Meu Perfil"
          className="text-muted-foreground hover:text-primary hover:bg-primary/10"
        />

        {/* Logout Button */}
        <FooterButton
          collapsed={collapsed}
          onClick={handleSignOut}
          icon={LogOut}
          label={t('auth.logout')}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        />
      </div>
    </aside>
  );
}
