import { ReactNode } from 'react';
import { DashboardSidebar } from './DashboardSidebar';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
      <DashboardSidebar />
      <main className="flex-1 min-h-screen ml-16 lg:ml-56 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
