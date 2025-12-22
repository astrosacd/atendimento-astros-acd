import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Users, Calendar, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";

interface GroupedPollResult {
  poll_name: string;
  message_id: string;
  group_name: string;
  total_votes: number;
  options: {
    option_name: string;
    vote_count: number;
    percentage: number;
    voters: string[];
  }[];
  created_at: string;
}

export const PollResultsHistory = () => {
  const [expandedPolls, setExpandedPolls] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: pollResults, isLoading } = useQuery({
    queryKey: ["divulgador-poll-results"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("divulgador_poll_results")
        .select(`
          *,
          divulgador_groups(name),
          divulgador_messages(content, poll_options)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const fetchResultsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("divulgador-fetch-poll-results");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["divulgador-poll-results"] });
      toast.success(data?.message || "Resultados atualizados com sucesso");
    },
    onError: (error: Error) => {
      toast.error(`Erro ao buscar resultados: ${error.message}`);
    },
  });

  const groupedResults = pollResults?.reduce((acc, result: any) => {
    const key = `${result.message_id}-${result.group_id}`;
    if (!acc[key]) {
      acc[key] = {
        poll_name: result.poll_name,
        message_id: result.message_id,
        group_name: result.divulgador_groups?.name || "Grupo desconhecido",
        total_votes: 0,
        options: [],
        created_at: result.created_at,
      };
    }
    acc[key].total_votes += result.vote_count;
    acc[key].options.push({
      option_name: result.option_name,
      vote_count: result.vote_count,
      percentage: 0,
      voters: result.voters || [],
    });
    return acc;
  }, {} as Record<string, GroupedPollResult>);

  // Calculate percentages
  Object.values(groupedResults || {}).forEach((poll: GroupedPollResult) => {
    poll.options.forEach((option) => {
      option.percentage = poll.total_votes > 0 
        ? Math.round((option.vote_count / poll.total_votes) * 100) 
        : 0;
    });
    // Sort options by vote count descending
    poll.options.sort((a, b) => b.vote_count - a.vote_count);
  });

  const togglePoll = (key: string) => {
    const newExpanded = new Set(expandedPolls);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPolls(newExpanded);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Resultados das Enquetes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const polls = Object.entries(groupedResults || {});

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Resultados das Enquetes
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => fetchResultsMutation.mutate()}
          disabled={fetchResultsMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${fetchResultsMutation.isPending ? "animate-spin" : ""}`} />
          {fetchResultsMutation.isPending ? "Buscando..." : "Atualizar Resultados"}
        </Button>
      </CardHeader>
      <CardContent>
        {polls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum resultado de enquete ainda.</p>
            <p className="text-sm mt-1">
              Clique em "Atualizar Resultados" para buscar os votos das enquetes enviadas.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {polls.map(([key, poll]) => (
                <Collapsible
                  key={key}
                  open={expandedPolls.has(key)}
                  onOpenChange={() => togglePoll(key)}
                >
                  <Card className="border">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium text-left">
                            {poll.poll_name}
                          </span>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {poll.total_votes} votos
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {poll.group_name}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(poll.created_at), "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                        </div>
                        {expandedPolls.has(key) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-3">
                        {poll.options.map((option, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span>{option.option_name}</span>
                              <span className="text-muted-foreground">
                                {option.vote_count} ({option.percentage}%)
                              </span>
                            </div>
                            <Progress value={option.percentage} className="h-2" />
                            {option.voters.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                Votantes: {option.voters.slice(0, 3).join(", ")}
                                {option.voters.length > 3 &&
                                  ` +${option.voters.length - 3} mais`}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default PollResultsHistory;
