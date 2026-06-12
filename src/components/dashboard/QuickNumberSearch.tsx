import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Shield, Smartphone, ExternalLink, Loader2, AlertCircle, CheckCircle2, XCircle, CalendarCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInsurancePaymentStatusHybrid } from '@/hooks/useInsurance';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckinInlineDialog } from '@/components/consulta-numeros/CheckinInlineDialog';
import { usePermissions } from '@/hooks/usePermissions';

export function QuickNumberSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const { hasPermission } = usePermissions();
  const canCheckin = hasPermission('view_consulta_numeros');

  const { data: insuranceStatus } = useInsurancePaymentStatusHybrid();

  const { data: numberData, isLoading } = useQuery({
    queryKey: ['quick-number-search', appliedSearch],
    queryFn: async () => {
      if (!appliedSearch) return null;
      
      const normalizedSearch = appliedSearch.replace(/\D/g, '');
      if (!normalizedSearch) return null;

      const { data, error } = await supabase
        .from('consulta_numeros_cache')
        .select('baserow_row_id, row_data, auto_hospedado')
        .or(`row_data->>numero.ilike.%${normalizedSearch}%`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!appliedSearch,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(searchTerm.trim());
  };

  const getNumeroTipo = (row: any): 'IN' | 'EX' => {
    const rowData = row?.row_data || {};
    const obs = rowData?.observacoes ?? rowData?.observacao ?? '';
    if (typeof obs !== 'string') return 'EX';
    
    const obsLower = obs.toLowerCase();
    
    if (
      obsLower.includes('sim não aprovisionado') ||
      obsLower.includes('sim nao aprovisionado') ||
      obs.includes('✅ COM SEGURO') ||
      obsLower.includes('com seguro') ||
      obs.includes('🚫 SEM SEGURO') ||
      obsLower.includes('sem seguro')
    ) {
      return 'IN';
    }
    
    return 'EX';
  };

  const getInsuranceInfo = () => {
    if (!numberData || !insuranceStatus) return null;
    return insuranceStatus.get(numberData.baserow_row_id);
  };

  const info = getInsuranceInfo();
  const tipo = numberData ? getNumeroTipo(numberData) : 'EX';

  return (
    <Card className="bg-card border-border overflow-hidden group">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Pesquisa Rápida de Número
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Smartphone className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Digite o número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
          </Button>
        </form>

        {appliedSearch && !isLoading && !numberData && (
          <div className="flex items-center gap-2 text-sm text-amber-500 bg-amber-500/10 p-2 rounded-md border border-amber-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Número não encontrado na base.
          </div>
        )}

        {numberData && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 border border-border/50">
              <div className="space-y-0.5">
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Número</p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={tipo === 'IN' ? 'default' : 'secondary'}
                    className={`text-[10px] px-1 py-0 h-4 min-w-[24px] justify-center ${tipo === 'IN' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
                  >
                    {tipo}
                  </Badge>
                  <p className="text-sm font-mono font-bold">{(numberData.row_data as any)?.numero || '-'}</p>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge 
                      variant={numberData.auto_hospedado ? "default" : "secondary"}
                      className="gap-1 px-1.5 py-0"
                    >
                      {numberData.auto_hospedado ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" />
                          Hospedado
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          Externo
                        </>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{numberData.auto_hospedado ? 'Número auto-hospedado' : 'Número externo (não hospedado)'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md border border-border/50 bg-card space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold">
                  <Shield className="h-3 w-3 text-indigo-500" />
                  Seguro
                </div>
                {info ? (
                  <Badge 
                    variant={info.status === 'pago' ? 'default' : 'destructive'}
                    className="w-full justify-center text-[10px] py-0"
                  >
                    {info.status === 'pago' ? 'Ativo' : 'Vencido'}
                  </Badge>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground px-1 italic">N/A</p>
                )}
              </div>

              <div className="p-2 rounded-md border border-border/50 bg-card space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold">
                  <ExternalLink className="h-3 w-3 text-cyan-500" />
                  Hospedagem
                </div>
                {numberData.auto_hospedado ? (
                  <Badge 
                    variant={info?.status === 'pago' ? 'default' : 'destructive'}
                    className="w-full justify-center text-[10px] py-0"
                  >
                    {info?.status === 'pago' ? 'Ativo' : 'Vencido'}
                  </Badge>
                ) : (
                  <p className="text-xs font-medium text-muted-foreground px-1 italic">Externo</p>
                )}
              </div>
            </div>

            {info?.clientName && (
              <div className="p-2 rounded-md bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Cliente Vinculado</p>
                <p className="text-xs font-medium truncate" title={info.clientName}>{info.clientName}</p>
              </div>
            )}

            {canCheckin && (
              <Button
                size="sm"
                variant="default"
                className="w-full h-9"
                onClick={() => setCheckinOpen(true)}
              >
                <CalendarCheck className="h-4 w-4 mr-1.5" />
                Foi checado agora (check-in)
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {numberData && (
        <CheckinInlineDialog
          open={checkinOpen}
          onOpenChange={setCheckinOpen}
          numero={(numberData.row_data as any)?.numero || ''}
          baserowRowId={numberData.baserow_row_id}
          clienteNome={(numberData.row_data as any)?.nome ?? (numberData.row_data as any)?.cliente ?? info?.clientName ?? null}
          defaultModeloId={null}
        />
      )}
    </Card>
  );
}
