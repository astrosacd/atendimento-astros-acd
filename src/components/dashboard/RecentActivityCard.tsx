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
  user_id: string | null;
  profiles: {
    name: string | null;
    email: string | null;
  } | null;
}

export function RecentActivityCard() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cleanupOldActivities = async () => {
      try {
        // Keep only activities from the last 24 hours, but always preserve at least 5 most recent
        const { data: recent } = await supabase
          .from("system_activities")
          .select("id, created_at")
          .order("created_at", { ascending: false })
          .limit(5);

        if (!recent || recent.length === 0) return;

        const oldestKeptDate = recent[recent.length - 1].created_at;
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        // Use the older of the two cutoffs so we never delete the 5 most recent
        const cutoff = oldestKeptDate < oneDayAgo ? oldestKeptDate : oneDayAgo;

        await supabase
          .from("system_activities")
          .delete()
          .lt("created_at", cutoff);
      } catch (err) {
        console.warn("[RecentActivity] cleanup skipped:", err);
      }
    };

    const fetchActivities = async () => {
      // 1) Fetch raw activities (no embed — system_activities has no FK to profiles)
      const { data: acts, error } = await supabase
        .from("system_activities")
        .select("id, action, resource_type, details, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("[RecentActivity] fetch error:", error);
        setLoading(false);
        return;
      }

      // 2) Fetch profile names for the unique user_ids
      const userIds = Array.from(
        new Set((acts || []).map((a: any) => a.user_id).filter(Boolean))
      );
      let profilesMap: Record<string, { name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name, email")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => {
          profilesMap[p.user_id] = { name: p.name, email: p.email };
        });
      }

      const merged: Activity[] = (acts || []).map((a: any) => ({
        ...a,
        profiles: a.user_id ? profilesMap[a.user_id] || null : null,
      }));
      setActivities(merged);
      setLoading(false);
    };

    // Run cleanup once on mount, then fetch
    cleanupOldActivities().then(() => fetchActivities());

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
      case 'proposta': return <FileText className="h-4 w-4" />;
      case 'tarefa': return <ListTodo className="h-4 w-4" />;
      case 'webhook': return <Webhook className="h-4 w-4" />;
      case 'despesa': return <TrendingDown className="h-4 w-4" />;
      case 'followup': return <Send className="h-4 w-4" />;
      case 'admin': return <Shield className="h-4 w-4" />;
      case 'contato': return <Phone className="h-4 w-4" />;
      case 'chamado': return <HelpCircle className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  // Defensive translation: any leftover english enum values still in the DB
  const translateAction = (action: string) => {
    return action
      .replace(/\bnot_converted\b/gi, 'Não convertido')
      .replace(/\bconverted\b/gi, 'Convertido');
  };

  return (
    <Card className="h-full w-full flex flex-col overflow-hidden bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-500" />
          Últimas Atividades
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-500/20 hover:scrollbar-thumb-blue-500/40">
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
                    {translateAction(activity.action)}
                  </p>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <span className="text-xs text-primary font-medium">
                      {activity.profiles?.name || activity.profiles?.email || 'Sistema'}
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
