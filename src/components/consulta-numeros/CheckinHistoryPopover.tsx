import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Loader2 } from "lucide-react";
import { useCheckins } from "@/hooks/useCheckinDiario";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  numero: string;
}

export function CheckinHistoryPopover({ numero }: Props) {
  const [open, setOpen] = useState(false);
  const { data: checkins = [], isLoading } = useCheckins(
    open ? { numero } : undefined,
  );

  const filtered = open ? checkins.filter((c) => c.numero === numero) : [];
  const userIds = [
    ...new Set(filtered.map((c: any) => c.created_by).filter(Boolean)),
  ] as string[];

  const { data: profiles = [] } = useQuery({
    queryKey: ["checkin-profiles", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", userIds);
      if (error) throw error;
      return data;
    },
    enabled: open && userIds.length > 0,
  });

  const profileMap = new Map(
    (profiles ?? []).map((p: any) => [p.user_id, p.name || p.email || "—"]),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          title="Ver histórico de check-ins"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-3 py-2 border-b">
          <p className="text-xs font-semibold">Histórico de check-ins</p>
          <p className="text-[10px] text-muted-foreground font-mono">{numero}</p>
        </div>
        <ScrollArea className="max-h-72">
          <div className="p-2 space-y-2">
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3 justify-center">
                <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
              </div>
            )}
            {!isLoading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Nenhum check-in registrado.
              </p>
            )}
            {filtered.map((c: any) => {
              const dt = new Date(c.created_at);
              const userName = c.created_by
                ? profileMap.get(c.created_by) ?? "—"
                : "—";
              return (
                <div
                  key={c.id}
                  className="border rounded-md p-2 text-xs space-y-1 bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    {c.status_conexao === "conectado" ? (
                      <Badge variant="default" className="text-[10px] h-5">🟢 Conectado</Badge>
                    ) : c.status_conexao === "desconectado_cliente" ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] h-5 border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      >
                        🟡 Desconectado do Cliente
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] h-5">🔴 Desconectado</Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {dt.toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {c.modelo_snapshot && (
                    <div className="text-[11px]">
                      📱 <span className="font-medium">{c.modelo_snapshot}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    por <span className="font-medium">{userName}</span>
                  </div>
                  {c.observacao && (
                    <div className="text-[11px] text-muted-foreground italic border-l-2 border-muted pl-2">
                      "{c.observacao}"
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
