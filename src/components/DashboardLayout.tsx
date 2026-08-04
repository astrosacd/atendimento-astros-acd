import { ReactNode, useState, useEffect } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import ChatPopup from './ChatPopup';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useLoginTracker } from '@/hooks/useLoginTracker';
import { useBranding } from '@/hooks/useBranding';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { sidebarLogo } = useBranding();
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  // Registra login do usuário e detecta novos dispositivos
  useLoginTracker();

  // Fechar o sidebar mobile ao trocar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const marginLeft = isMobile ? 0 : (sidebarCollapsed ? 68 : 240);

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-primary/5 relative">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-info/5 to-transparent rounded-full blur-3xl translate-y-1/2" />
      </div>

      {/* Backdrop mobile */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden animate-in fade-in"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <DashboardSidebar
        onOpenChat={() => setChatOpen(true)}
        collapsed={!isMobile && sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        isMobile={isMobile}
      />

      <main
        className={cn(
          "flex-1 min-h-screen min-w-0 transition-all duration-300 relative z-10",
        )}
        style={{ marginLeft }}
      >
        {/* Header mobile com hamburger */}
        {isMobile && (
          <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            {sidebarLogo && (
              <img src={sidebarLogo} alt="Logo" className="h-7 w-7 rounded-md object-contain shrink-0" />
            )}
            <span className="font-display font-bold text-foreground text-sm truncate">Astros CRM</span>

          </div>
        )}
        {children}
      </main>
      <ChatPopup isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
