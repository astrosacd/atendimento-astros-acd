import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  User as UserIcon,
  Shield,
  Monitor,
  Smartphone,
  LogOut,
  AlertCircle,
  MapPin,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LoginRecord {
  id: string;
  ip_address: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  city: string | null;
  country: string | null;
  is_new_device: boolean;
  session_id: string | null;
  logged_in_at: string;
  logged_out_at: string | null;
  is_active: boolean;
}

export default function Perfil() {
  const { user, signOut } = useAuth();
  const [logins, setLogins] = useState<LoginRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const currentSessionId =
    typeof window !== "undefined" && user ? sessionStorage.getItem(`login_tracked_${user.id}`) : null;

  const loadLogins = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_login_history")
      .select("*")
      .eq("user_id", user.id)
      .order("logged_in_at", { ascending: false })
      .limit(50);

    if (error) {
      toast.error("Erro ao carregar sessões: " + error.message);
    } else {
      setLogins((data as LoginRecord[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogins();
  }, [user?.id]);

  const handleEndSession = async (id: string, isCurrent: boolean) => {
    const { error } = await supabase
      .from("user_login_history")
      .update({ is_active: false, logged_out_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao encerrar sessão");
      return;
    }
    toast.success("Sessão encerrada");
    if (isCurrent) {
      await signOut();
    } else {
      loadLogins();
    }
  };

  const handleEndAllOthers = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("user_login_history")
      .update({ is_active: false, logged_out_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("is_active", true)
      .neq("session_id", currentSessionId || "");

    if (error) {
      toast.error("Erro ao encerrar sessões");
      return;
    }
    toast.success("Todas as outras sessões foram encerradas");
    loadLogins();
  };

  const activeLogins = logins.filter((l) => l.is_active);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold flex items-center gap-2">
            <UserIcon className="h-7 w-7 text-primary" />
            Meu Perfil
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie suas informações e a segurança da sua conta.
          </p>
        </div>

        <Tabs defaultValue="security" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="security" className="gap-1">
              <Shield className="h-4 w-4" />
              Sessões e Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Dados da conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">E-mail</span>
                  <span className="font-medium">{user?.email}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">ID do usuário</span>
                  <span className="font-mono text-xs">{user?.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Conta criada em</span>
                  <span>{user?.created_at ? new Date(user.created_at).toLocaleString("pt-BR") : "—"}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Sessões ativas ({activeLogins.length})
                  </CardTitle>
                  <CardDescription>
                    Dispositivos onde você está logado agora. Encerre sessões que você não reconhece.
                  </CardDescription>
                </div>
                {activeLogins.length > 1 && (
                  <Button variant="outline" size="sm" onClick={handleEndAllOthers}>
                    Encerrar todas as outras
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {loading ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">Carregando...</div>
                ) : activeLogins.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    Nenhuma sessão ativa registrada.
                  </div>
                ) : (
                  activeLogins.map((l) => {
                    const isCurrent = l.session_id === currentSessionId;
                    const isMobile = /iPhone|Android.*mobile|iPad/i.test(l.device_name || "");
                    const Icon = isMobile ? Smartphone : Monitor;
                    return (
                      <div
                        key={l.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border rounded-lg bg-card/50"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">
                                {l.device_name} · {l.browser} ({l.os})
                              </span>
                              {isCurrent && (
                                <Badge variant="default" className="gap-1 text-[10px]">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Esta sessão
                                </Badge>
                              )}
                              {l.is_new_device && (
                                <Badge variant="outline" className="text-[10px] border-warning text-warning">
                                  Novo dispositivo
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {(l.city || l.country) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[l.city, l.country].filter(Boolean).join(", ")}
                                </span>
                              )}
                              {l.ip_address && <span>IP: {l.ip_address}</span>}
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(l.logged_in_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEndSession(l.id, isCurrent)}
                          className="text-destructive hover:text-destructive gap-1"
                        >
                          <LogOut className="h-3 w-3" />
                          {isCurrent ? "Sair desta sessão" : "Encerrar"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Histórico de logins
                </CardTitle>
                <CardDescription>Últimos 50 acessos à sua conta.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logins.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between gap-3 py-2 border-b last:border-0 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`h-2 w-2 rounded-full shrink-0 ${
                            l.is_active ? "bg-success" : "bg-muted-foreground/40"
                          }`}
                        />
                        <span className="truncate">
                          {l.device_name} · {l.browser}
                        </span>
                        {l.is_new_device && (
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            Novo
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">
                        {[l.city, l.country].filter(Boolean).join(", ")} ·{" "}
                        {new Date(l.logged_in_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
