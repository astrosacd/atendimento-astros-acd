import { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  FolderOpen,
  Gift,
  Ticket,
  ShoppingCart,
  Settings,
  BarChart3,
  ChevronLeft,
} from 'lucide-react';

import GatewayDashboard from './gateway/GatewayDashboard';
import GatewayProducts from './gateway/GatewayProducts';
import GatewayCategories from './gateway/GatewayCategories';
import GatewayOrderBumps from './gateway/GatewayOrderBumps';
import GatewayCoupons from './gateway/GatewayCoupons';
import GatewayOrders from './gateway/GatewayOrders';
import GatewaySettings from './gateway/GatewaySettings';
import GatewayReports from './gateway/GatewayReports';

interface NavItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  color?: string;
}

const navItems: NavItem[] = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/admin/gateway', color: 'text-blue-500' },
  { title: 'Produtos', icon: Package, path: '/admin/gateway/produtos', color: 'text-green-500' },
  { title: 'Categorias', icon: FolderOpen, path: '/admin/gateway/categorias', color: 'text-yellow-500' },
  { title: 'Order Bumps', icon: Gift, path: '/admin/gateway/order-bumps', color: 'text-pink-500' },
  { title: 'Cupons', icon: Ticket, path: '/admin/gateway/cupons', color: 'text-purple-500' },
  { title: 'Pedidos', icon: ShoppingCart, path: '/admin/gateway/pedidos', color: 'text-orange-500' },
  { title: 'Configurações', icon: Settings, path: '/admin/gateway/configuracoes', color: 'text-slate-400' },
  { title: 'Relatórios', icon: BarChart3, path: '/admin/gateway/relatorios', color: 'text-cyan-500' },
];

export default function AdminGateway() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/admin/gateway') {
      return location.pathname === '/admin/gateway';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <DashboardLayout>
      <div className="flex h-full">
        {/* Internal Sidebar */}
        <aside className="w-56 border-r border-border/40 bg-card/50 flex flex-col">
          <div className="p-4 border-b border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin/cobranca')}
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </Button>
          </div>
          
          <div className="p-3">
            <h2 className="px-3 text-lg font-semibold text-foreground mb-1">Gateway</h2>
            <p className="px-3 text-xs text-muted-foreground mb-4">Gestão de Pagamentos</p>
          </div>

          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full justify-start gap-3 h-10 px-3 relative",
                  isActive(item.path)
                    ? "bg-primary/10 text-primary font-medium hover:bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {isActive(item.path) && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full" />
                )}
                <item.icon className={cn(
                  "h-4 w-4 shrink-0",
                  isActive(item.path) ? "text-primary" : item.color
                )} />
                <span className="text-sm">{item.title}</span>
              </Button>
            ))}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route index element={<GatewayDashboard />} />
            <Route path="produtos" element={<GatewayProducts />} />
            <Route path="categorias" element={<GatewayCategories />} />
            <Route path="order-bumps" element={<GatewayOrderBumps />} />
            <Route path="cupons" element={<GatewayCoupons />} />
            <Route path="pedidos" element={<GatewayOrders />} />
            <Route path="configuracoes" element={<GatewaySettings />} />
            <Route path="relatorios" element={<GatewayReports />} />
          </Routes>
        </main>
      </div>
    </DashboardLayout>
  );
}
