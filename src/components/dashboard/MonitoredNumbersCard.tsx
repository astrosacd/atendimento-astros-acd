import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, ChevronRight, Loader2 } from 'lucide-react';

export function MonitoredNumbersCard() {
  const navigate = useNavigate();

  // Fetch reminder config to get monitored statuses
  const { data: reminderConfig, isLoading: configLoading } = useQuery({
    queryKey: ['reminder-config-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consulta_numeros_reminder_config')
        .select('status_to_monitor, is_active')
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  const monitoredStatuses = reminderConfig?.status_to_monitor || [];
  const isReminderActive = reminderConfig?.is_active || false;

  // Fetch count of numbers with monitored statuses
  const { data: totalCount = 0, isLoading: countLoading } = useQuery({
    queryKey: ['monitored-numbers-count', monitoredStatuses],
    queryFn: async () => {
      if (!monitoredStatuses.length) return 0;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return 0;

      let total = 0;
      const seenIds = new Set<number>();

      for (const status of monitoredStatuses) {
        const params = new URLSearchParams({
          status: status,
          size: '200',
        });

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-consulta-numeros/consultar?${params}`,
          {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          }
        );

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            json.data.forEach((row: any) => {
              if (!seenIds.has(row.id)) {
                seenIds.add(row.id);
                total++;
              }
            });
          }
        }
      }

      return total;
    },
    enabled: monitoredStatuses.length > 0,
    staleTime: 2 * 60 * 1000,
  });

  const isLoading = configLoading || countLoading;

  // Don't show if no statuses configured
  if (!configLoading && monitoredStatuses.length === 0) {
    return null;
  }

  return (
    <Card 
      className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border-indigo-500/20 hover:border-indigo-500/40 transition-colors cursor-pointer group"
      onClick={() => navigate('/admin/consulta-numeros')}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              {isLoading ? (
                <Loader2 className="h-6 w-6 text-indigo-500 animate-spin" />
              ) : (
                <Bell className="h-6 w-6 text-indigo-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold text-foreground font-display">
                  {isLoading ? '...' : totalCount}
                </p>
                {isReminderActive && (
                  <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                    Ativo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Status Monitorados</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex flex-wrap gap-1 max-w-[150px]">
              {monitoredStatuses.slice(0, 2).map((status: string) => (
                <Badge key={status} variant="secondary" className="text-xs truncate max-w-[70px]">
                  {status}
                </Badge>
              ))}
              {monitoredStatuses.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{monitoredStatuses.length - 2}
                </Badge>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-indigo-500 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
