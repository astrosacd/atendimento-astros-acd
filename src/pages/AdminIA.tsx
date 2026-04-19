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
            Inteligência Artificial
          </h1>
          <p className="text-muted-foreground">
            Gerencie as ferramentas de IA preditiva e automação do seu pipeline.
          </p>
        </div>

        <Tabs defaultValue="forecast" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
            <TabsTrigger value="forecast" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Previsão de Receita
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
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
                    Como funciona a IA Preditiva?
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm leading-relaxed">
                  <p>
                    Nossa IA analisa todo o seu funil de vendas (Kanban), considerando:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Valor total das oportunidades em cada etapa.</li>
                    <li>Probabilidade histórica de conversão de cada estágio.</li>
                    <li>Engajamento e notas registradas nos leads.</li>
                    <li>Sazonalidade e tendências do seu mercado.</li>
                  </ul>
                  <p className="font-semibold">
                    Resultado: "Com base no seu histórico, você deve fechar R$ X mil nos próximos 30 dias."
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
                    Configurações de Previsão (Forecasting)
                  </CardTitle>
                  <CardDescription>
                    Ajuste os parâmetros que a IA utiliza para calcular a receita prevista.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">
                    Configurações avançadas de forecasting estarão disponíveis em breve. 
                    Atualmente a IA utiliza o modelo global de alta precisão.
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
