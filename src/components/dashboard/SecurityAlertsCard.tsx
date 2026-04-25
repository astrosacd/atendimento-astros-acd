import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, X, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface SecurityAlert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  metadata: any;
  created_at: string;
}

export function SecurityAlertsCard() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_security_alerts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    setAlerts((data as SecurityAlert[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;

    const channel = supabase
      .channel("security-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_security_alerts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newAlert = payload.new as SecurityAlert;
          setAlerts((prev) => [newAlert, ...prev]);
          toast.warning(newAlert.title, { description: newAlert.message });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const dismiss = async (id: string) => {
    await supabase.from("user_security_alerts").update({ is_read: true }).eq("id", id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const dismissAll = async () => {
    if (!user) return;
    await supabase
      .from("user_security_alerts")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setAlerts([]);
  };

  if (loading || alerts.length === 0) return null;

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-warning" />
          Alertas de Segurança
          <Badge variant="outline" className="border-warning text-warning">
            {alerts.length}
          </Badge>
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/perfil">
              <ExternalLink className="h-3 w-3 mr-1" /> Ver tudo
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissAll}>
            Marcar tudo como lido
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((a) => (
          <div
            key={a.id}
            className="flex items-start justify-between gap-3 p-3 bg-background rounded-lg border"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{a.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{a.message}</div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => dismiss(a.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
