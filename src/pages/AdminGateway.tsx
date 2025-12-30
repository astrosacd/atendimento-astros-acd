import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LayoutDashboard, Package, FolderOpen, Gift, Ticket, 
  ShoppingCart, Settings, BarChart3 
} from 'lucide-react';

import GatewayDashboard from './gateway/GatewayDashboard';
import GatewayProducts from './gateway/GatewayProducts';
import GatewayCategories from './gateway/GatewayCategories';
import GatewayOrderBumps from './gateway/GatewayOrderBumps';
import GatewayCoupons from './gateway/GatewayCoupons';
import GatewayOrders from './gateway/GatewayOrders';
import GatewaySettings from './gateway/GatewaySettings';
import GatewayReports from './gateway/GatewayReports';

export default function AdminGateway() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">{t('gateway.title')}</h1>
          <p className="text-muted-foreground">{t('gateway.subtitle')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-background">
              <LayoutDashboard className="h-4 w-4" />
              {t('gateway.dashboard')}
            </TabsTrigger>
            <TabsTrigger value="produtos" className="gap-2 data-[state=active]:bg-background">
              <Package className="h-4 w-4" />
              {t('gateway.products')}
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-2 data-[state=active]:bg-background">
              <FolderOpen className="h-4 w-4" />
              {t('gateway.categories')}
            </TabsTrigger>
            <TabsTrigger value="order-bumps" className="gap-2 data-[state=active]:bg-background">
              <Gift className="h-4 w-4" />
              {t('gateway.orderBumps')}
            </TabsTrigger>
            <TabsTrigger value="cupons" className="gap-2 data-[state=active]:bg-background">
              <Ticket className="h-4 w-4" />
              {t('gateway.coupons')}
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="gap-2 data-[state=active]:bg-background">
              <ShoppingCart className="h-4 w-4" />
              {t('gateway.orders')}
            </TabsTrigger>
            <TabsTrigger value="configuracoes" className="gap-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4" />
              {t('gateway.settings')}
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2 data-[state=active]:bg-background">
              <BarChart3 className="h-4 w-4" />
              {t('gateway.reports')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-0">
            <GatewayDashboard />
          </TabsContent>

          <TabsContent value="produtos" className="mt-0">
            <GatewayProducts />
          </TabsContent>

          <TabsContent value="categorias" className="mt-0">
            <GatewayCategories />
          </TabsContent>

          <TabsContent value="order-bumps" className="mt-0">
            <GatewayOrderBumps />
          </TabsContent>

          <TabsContent value="cupons" className="mt-0">
            <GatewayCoupons />
          </TabsContent>

          <TabsContent value="pedidos" className="mt-0">
            <GatewayOrders />
          </TabsContent>

          <TabsContent value="configuracoes" className="mt-0">
            <GatewaySettings />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-0">
            <GatewayReports />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
