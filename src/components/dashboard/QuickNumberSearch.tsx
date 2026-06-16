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
import { useLatestCheckinByNumero } from '@/hooks/useCheckinDiario';
import { useNumerosModelos } from '@/hooks/useNumerosAquecimento';
import { useAutoHospedadoNumbers } from '@/hooks/useQrScan';
import { SearchableSelect } from '@/components/ui/searchable-select';



export function QuickNumberSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [modeloFilter, setModeloFilter] = useState<string>('');
  const { hasPermission } = usePermissions();
  const canCheckin = hasPermission('view_consulta_numeros');

  const { data: insuranceStatus } = useInsurancePaymentStatusHybrid();
  const latestCheckinByNumero = useLatestCheckinByNumero();
  const { data: modelosList = [] } = useNumerosModelos();
  const { data: autoHosp = [] } = useAutoHospedadoNumbers();



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

        <div>
          <SearchableSelect
            value={modeloFilter}
            onValueChange={(v) => setModeloFilter(v)}
            placeholder="Ou filtre por modelo…"
            searchPlaceholder="Buscar modelo…"
            emptyMessage="Sem modelos"
            options={(() => {
              const modeloIdsComNumeros = new Set<string>();
              let temExterno = false;
              for (const ck of latestCheckinByNumero.values()) {
                if (ck.modelo_id == null) temExterno = true;
                else modeloIdsComNumeros.add(ck.modelo_id);
              }
              const opts: { value: string; label: string }[] = [];
              if (temExterno) opts.push({ value: '__externo__', label: '📦 Aparelho externo' });
              for (const m of modelosList) {
                if (modeloIdsComNumeros.has(m.id)) opts.push({ value: m.id, label: m.nome });
              }
              return opts;
            })()}
          />
        </div>

        {modeloFilter && (() => {
          const numerosDoModelo: { numero: string; cliente: string | null; data: string }[] = [];
          for (const [numero, ck] of latestCheckinByNumero.entries()) {
            const match = modeloFilter === '__externo__' ? ck.modelo_id == null : ck.modelo_id === modeloFilter;
            if (match) numerosDoModelo.push({ numero, cliente: ck.cliente_nome, data: ck.data_checkin });
          }
          numerosDoModelo.sort((a, b) => b.data.localeCompare(a.data));
          const modeloNome = modeloFilter === '__externo__' ? '📦 Aparelho externo' : (modelosList.find((m) => m.id === modeloFilter)?.nome ?? '');
          return (
            <div className="rounded-md border border-border/50 bg-muted/20 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  {modeloNome} · {numerosDoModelo.length} número{numerosDoModelo.length === 1 ? '' : 's'}
                </p>
                <button
                  onClick={() => setModeloFilter('')}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  limpar
                </button>
              </div>
              {numerosDoModelo.length === 0 ? (
                <p className="text-xs italic text-muted-foreground py-1">Nenhum número com check-in nesse modelo.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {numerosDoModelo.map((n) => (
                    <button
                      key={n.numero}
                      onClick={() => {
                        setSearchTerm(n.numero);
                        setAppliedSearch(n.numero);
                      }}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1 rounded text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                    >
                      <span className="text-xs font-mono font-medium truncate">{n.numero}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[55%]" title={n.cliente ?? ''}>
                        {n.cliente ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

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
                {numberData.baserow_row_id != null && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(numberData.baserow_row_id));
                        const { toast } = await import('@/hooks/use-toast');
                        toast({ title: `Linha #${numberData.baserow_row_id} copiada` });
                      } catch {}
                    }}
                    className="inline-flex items-center gap-1 px-1.5 py-0 rounded bg-muted text-[10px] font-mono text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                    title="Copiar linha do Baserow"
                  >
                    linha #{numberData.baserow_row_id}
                  </button>
                )}
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

            {(() => {
              const numeroStr = (numberData.row_data as any)?.numero || '';
              const lastCk = latestCheckinByNumero.get(numeroStr);
              if (!lastCk) {
                return (
                  <div className="p-2 rounded-md bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold">
                      <Smartphone className="h-3 w-3 text-amber-500" />
                      Modelo atual
                    </div>
                    <p className="text-xs italic text-muted-foreground mt-0.5">Sem check-in registrado</p>
                  </div>
                );
              }
              const isExterno = lastCk.modelo_id == null;
              return (
                <div className={`p-2 rounded-md border ${isExterno ? 'bg-muted/30 border-muted-foreground/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-bold">
                    <Smartphone className={`h-3 w-3 ${isExterno ? 'text-muted-foreground' : 'text-emerald-500'}`} />
                    Modelo atual {isExterno ? '(externo)' : ''}
                  </div>
                  <p className="text-xs font-medium mt-0.5 truncate" title={lastCk.modelo_snapshot ?? ''}>
                    {isExterno ? '📦 Aparelho externo' : (lastCk.modelo_snapshot ?? '—')}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    Último check-in: {new Date(lastCk.data_checkin).toLocaleDateString('pt-BR')} · {lastCk.status_conexao}
                  </p>
                  {lastCk.observacao && lastCk.observacao.trim() && (
                    <p className="text-[10px] italic text-amber-500 mt-1 whitespace-pre-wrap break-words border-l-2 border-amber-500/40 pl-1.5">
                      "{lastCk.observacao.trim()}"
                    </p>
                  )}
                </div>
              );
            })()}

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

      {numberData && (() => {
        const numeroStr = (numberData.row_data as any)?.numero || '';
        const lastCk = latestCheckinByNumero.get(numeroStr);
        return (
          <CheckinInlineDialog
            open={checkinOpen}
            onOpenChange={setCheckinOpen}
            numero={numeroStr}
            baserowRowId={numberData.baserow_row_id}
            clienteNome={(numberData.row_data as any)?.nome ?? (numberData.row_data as any)?.cliente ?? info?.clientName ?? null}
            defaultModeloId={lastCk?.modelo_id ?? null}
          />
        );
      })()}

    </Card>
  );
}
