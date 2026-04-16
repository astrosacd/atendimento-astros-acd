import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Clock, User, Settings, Database, Search, DollarSign, MessageSquare, Info, FileText, ListTodo, Webhook, TrendingDown, Send, Shield, LayoutDashboard, Phone, HelpCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Activity {
  id: string;
  action: string;
  resource_type: string;
  details: string | null;
  created_at: string;
  profiles: {
    display_name: string | null;
  } | null;
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data, error } = await supabase
        .from("system_activities")
        .select(`
          id, 
          action, 
          resource_type, 
          details, 
          created_at,
          profiles:user_id (
            display_name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!error && data) {
        setActivities(data as any);
      }
      setLoading(false);
    };

    fetchActivities();

    // Set up real-time subscription
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_activities'
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'consulta': return <Search className="h-4 w-4" />;
      case 'pagamento': return <DollarSign className="h-4 w-4" />;
      case 'venda': return <DollarSign className="h-4 w-4" />;
      case 'duvida': return <MessageSquare className="h-4 w-4" />;
      case 'cliente': return <User className="h-4 w-4" />;
      case 'config': return <Settings className="h-4 w-4" />;
      case 'lead_hunter': return <Search className="h-4 w-4" />;
      case 'numeros_aquecimento': return <Clock className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Últimas Atividades
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3">
                <div className="h-8 w-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade recente.</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {getIcon(activity.resource_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {activity.action}
                  </p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-xs text-primary font-medium">
                      {activity.profiles?.display_name || 'Sistema'}
                    </span>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="capitalize">{activity.resource_type.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
