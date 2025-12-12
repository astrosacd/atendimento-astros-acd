import { ReactNode, useState } from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import ChatPopup from './ChatPopup';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar onOpenChat={() => setChatOpen(true)} />
      <main className="flex-1 min-h-screen ml-16 lg:ml-56 transition-all duration-300">
        {children}
      </main>
      <ChatPopup isOpen={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
