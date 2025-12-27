import { ReactNode, useState } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import ChatPopup from './ChatPopup';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-primary/5 relative">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-primary/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-gradient-to-tr from-info/5 to-transparent rounded-full blur-3xl translate-y-1/2" />
      </div>

      <DashboardSidebar
        onOpenChat={() => setChatOpen(true)}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main
        className="flex-1 min-h-screen min-w-0 transition-all duration-300 relative z-10"
        style={{ marginLeft: sidebarCollapsed ? '68px' : '240px' }}
      >
        {children}
      </main>
      <ChatPopup isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
