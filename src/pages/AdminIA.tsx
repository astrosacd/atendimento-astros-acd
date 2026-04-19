import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalesForecastCard } from '@/components/dashboard/SalesForecastCard';
import { KanbanAIConfig } from '@/components/kanban/KanbanAIConfig';
import { Brain, TrendingUp, Settings, Sparkles } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

export default function AdminIA() {
  const { t } = useTranslation();
  const { canViewSalesForecast, canManageSalesForecast, canViewPipelineAI, canManagePipelineAI } = usePermissions();

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            {t('ia.title')}
          </h1>
          <p className="text-muted-foreground">
            {t('ia.subtitle')}
          </p>
        </div>

        <Tabs defaultValue="forecast" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="forecast" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t('ia.tabs.forecast')}
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              {t('ia.tabs.settings')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forecast" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {canViewSalesForecast() ? (
                <SalesForecastCard />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Acesso Negado</CardTitle>
                    <CardDescription>
                      Você não tem permissão para visualizar a previsão de vendas.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Sparkles className="h-5 w-5" />
                    {t('ia.howItWorks.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-relaxed">
                  <p>
                    {t('ia.howItWorks.desc1')}
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>{t('ia.howItWorks.item1')}</li>
                    <li>{t('ia.howItWorks.item2')}</li>
                    <li>{t('ia.howItWorks.item3')}</li>
                    <li>{t('ia.howItWorks.item4')}</li>
                  </ul>
                  <p className="font-semibold">
                    {t('ia.howItWorks.result')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              {(canViewPipelineAI() || canManagePipelineAI()) && (
                <KanbanAIConfig />
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {t('ia.forecastSettings.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('ia.forecastSettings.desc')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">
                    {t('ia.forecastSettings.comingSoon')}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
