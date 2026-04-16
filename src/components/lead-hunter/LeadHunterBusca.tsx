import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Globe, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useLeadHunterBuscas } from '@/hooks/useLeadHunter';
import { useSystemActivities } from '@/hooks/useSystemActivities';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LeadHunterBusca() {
  const { data: buscas = [], isLoading, refetch } = useLeadHunterBuscas();
  const { logActivity } = useSystemActivities();
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [campanhaId, setCampanhaId] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query) return toast.error('Digite uma busca');
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('lead-hunter-serp-search', {
        body: { query, location, campanhaId: campanhaId || undefined },
      });
      if (error) throw error;
      toast.success(`${data?.totalResults || 0} resultados encontrados!`);
      logActivity(`Realizou busca no Lead Hunter: ${query}`, 'lead_hunter', location ? `Local: ${location}` : undefined);
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Erro na busca');
    } finally {
      setSearching(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'concluida': return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'erro': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'processando': return <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Busca via SERP API (Google Maps)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>O que buscar *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Ex: Restaurantes, Clínicas de estética, Advogados..."
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label>Localização</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="Ex: São Paulo, SP / Fortaleza, CE"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          
          <Button onClick={handleSearch} disabled={searching} className="w-full md:w-auto">
            {searching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Buscar Leads no Google Maps
          </Button>
          
          <p className="text-xs text-muted-foreground">
            A busca utiliza a SERP API para extrair dados de empresas do Google Maps. Configure sua API Key na aba Configurações.
          </p>
        </CardContent>
      </Card>

      {/* Search History */}
      <Card className="border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Histórico de Buscas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-4">Carregando...</p>
          ) : buscas.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma busca realizada</p>
          ) : (
            <div className="space-y-3">
              {buscas.map(b => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-3">
                    {statusIcon(b.status)}
                    <div>
                      <p className="font-medium text-sm">{b.query}</p>
                      {b.localizacao && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{b.localizacao}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{b.total_resultados} resultados</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(b.created_at), 'dd/MM/yyyy HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
