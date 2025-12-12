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
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar 
        onOpenChat={() => setChatOpen(true)} 
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      <main 
        className="flex-1 min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarCollapsed ? '68px' : '240px' }}
      >
        {children}
      </main>
      <ChatPopup isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
