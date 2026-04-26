import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Smartphone, ChevronRight } from 'lucide-react';
import { useAparelhos, calcularOcupacao, sugerirTipoFaltante } from '@/hooks/useAparelhos';
import type { NumeroAquecimento } from '@/hooks/useNumerosAquecimento';

interface Props {
  numeros: NumeroAquecimento[];
  onGoToAparelhos?: () => void;
}

export function CapacityBanner({ numeros, onGoToAparelhos }: Props) {
  const { data: aparelhos = [], isLoading } = useAparelhos();

  if (isLoading || aparelhos.length === 0) return null;

  const ocupacoes = aparelhos.map(a => calcularOcupacao(a, numeros as any));
  const comVagas = ocupacoes.filter(o => o.status !== 'cheio' && o.livres > 0);
  const semAparelho = numeros.filter((n: any) => !n.aparelho_id).length;

  if (comVagas.length === 0 && semAparelho === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Smartphone className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700 dark:text-green-400">
              Todos os aparelhos estão na capacidade máxima
            </span>
            <Badge variant="outline" className="ml-1">{aparelhos.length} aparelhos</Badge>
          </div>
          {onGoToAparelhos && (
            <Button size="sm" variant="ghost" onClick={onGoToAparelhos}>
              Ver aparelhos <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const totalLivres = comVagas.reduce((acc, o) => acc + o.livres, 0);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="py-3 px-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">
              {totalLivres} {totalLivres === 1 ? 'vaga disponível' : 'vagas disponíveis'} em {comVagas.length} {comVagas.length === 1 ? 'aparelho' : 'aparelhos'}
            </span>
            {semAparelho > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5">
                {semAparelho} {semAparelho === 1 ? 'número sem aparelho vinculado' : 'números sem aparelho vinculado'}
              </Badge>
            )}
          </div>
          {onGoToAparelhos && (
            <Button size="sm" variant="ghost" className="h-7" onClick={onGoToAparelhos}>
              Gerenciar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
        {semAparelho > 0 && (
          <div className="mb-2 text-xs text-muted-foreground bg-background/50 border border-dashed rounded-md px-2.5 py-1.5">
            💡 Você tem <strong>{semAparelho}</strong> {semAparelho === 1 ? 'número cadastrado' : 'números cadastrados'} sem aparelho vinculado. Edite cada número (menu de ações na tabela) e selecione o aparelho correspondente para que a contagem fique correta.
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {comVagas.slice(0, 8).map(o => {
            const sugestao = sugerirTipoFaltante(o);
            return (
              <div
                key={o.aparelho.id}
                className="flex items-center gap-2 bg-background border rounded-md px-2.5 py-1.5 text-xs"
              >
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{o.aparelho.apelido}</span>
                {o.aparelho.modelo && (
                  <span className="text-muted-foreground">({o.aparelho.modelo.nome})</span>
                )}
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {o.ocupados}/{o.aparelho.capacidade_total}
                </Badge>
                <span className="text-muted-foreground">·</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  falta {o.livres} {sugestao && `(${sugestao})`}
                </span>
              </div>
            );
          })}
          {comVagas.length > 8 && (
            <span className="text-xs text-muted-foreground self-center">
              +{comVagas.length - 8} {comVagas.length - 8 === 1 ? 'outro' : 'outros'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
