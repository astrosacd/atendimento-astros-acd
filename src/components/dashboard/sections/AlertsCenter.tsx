import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronRight, LucideIcon } from 'lucide-react';
import { SecurityAlertsCard } from '@/components/dashboard/SecurityAlertsCard';
import { PaymentSecurityAlertBanner } from '@/components/dashboard/PaymentSecurityAlertBanner';
import { NumerosAquecimentoAlertBanner } from '@/components/dashboard/NumerosAquecimentoAlertBanner';

export interface PriorityAlert {
  id: string;
  title: string;
  description: string;
  count?: number;
  onClick: () => void;
  tone: 'critical' | 'warning';
  icon: LucideIcon;
  pulse?: boolean;
}

interface AlertsCenterProps {
  priorityAlerts: PriorityAlert[];
}

export function AlertsCenter({ priorityAlerts }: AlertsCenterProps) {
  const totalCount = priorityAlerts.length;

  return (
    <section className="mb-8 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="h-4 w-4 text-primary" />
            Central de Alertas
          </div>
          <p className="text-sm text-muted-foreground">
            Todos os avisos importantes do sistema concentrados em um único lugar.
          </p>
        </div>
        {totalCount > 0 && (
          <Badge variant="outline" className="w-fit border-border/60 bg-background/80 text-foreground">
            {totalCount} alerta(s) ativo(s)
          </Badge>
        )}
      </div>

      {/* Banners de alerta inline */}
      <PaymentSecurityAlertBanner />
      <NumerosAquecimentoAlertBanner />

      {/* Card de Segurança */}
      <SecurityAlertsCard />

      {/* Alertas prioritários (cobrança, follow-ups, instagram, saúde) */}
      {priorityAlerts.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {priorityAlerts.map((alert) => {
            const Icon = alert.icon;
            const isCritical = alert.tone === 'critical';

            return (
              <Card
                key={alert.id}
                className={`cursor-pointer transition-all duration-300 group ${
                  isCritical
                    ? 'border-destructive/30 bg-gradient-to-br from-destructive/10 to-destructive/5 hover:border-destructive/50'
                    : 'border-update/30 bg-gradient-to-br from-update/10 to-update/5 hover:border-update/50'
                }`}
                onClick={alert.onClick}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-12 w-12 shrink-0 rounded-xl flex items-center justify-center ${
                        isCritical ? 'bg-destructive/15 text-destructive' : 'bg-update/15 text-update'
                      } ${alert.pulse ? 'animate-pulse' : ''}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-foreground">{alert.title}</h3>
                        {alert.count !== undefined && (
                          isCritical ? (
                            <Badge variant="destructive">{alert.count}</Badge>
                          ) : (
                            <Badge variant="outline" className="border-update/40 bg-update/10 text-update">
                              {alert.count}
                            </Badge>
                          )
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{alert.description}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        Abrir agora
                        <ChevronRight className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
