import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Smartphone, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { NumeroAquecimento, NumeroModelo, NumeroStatus } from '@/hooks/useNumerosAquecimento';

interface Props {
  numeros: NumeroAquecimento[];
  modelosList: NumeroModelo[];
  statusList?: NumeroStatus[];
  /** Slots adicionais ocupados por modelo (ex.: check-ins ativos de auto-hospedados). */
  extraOcupadosByModelo?: Map<string, { total: number; normal: number; business: number; clone: number }>;
}

interface ModeloOcupacao {
  modelo: NumeroModelo;
  ocupados: number;
  capacidade: number;
  livres: number;
  normal: number;
  business: number;
  autoHospedados: number;
}

function getTipoEspecificadoNoModelo(nome: string): 'normal' | 'business' | null {
  const normalized = nome.toLowerCase();
  if (/\bbusiness\b/.test(normalized)) return 'business';
  if (/\bnormal\b/.test(normalized)) return 'normal';
  return null;
}

function sugerirTipo(o: ModeloOcupacao): string {
  if (o.livres <= 0) return '';
  // Sempre respeitar o tipo especificado no nome do modelo
  const tipoEspecificado = getTipoEspecificadoNoModelo(o.modelo.nome);
  if (tipoEspecificado) return tipoEspecificado;
  // Sem tipo no nome: sugerir conforme a ocupação atual
  if (o.normal > 0 && o.business === 0) return 'business';
  if (o.business > 0 && o.normal === 0) return 'normal';
  return 'normal ou business';
}

export function CapacityBanner({ numeros, modelosList, statusList, extraOcupadosByModelo }: Props) {
  if (modelosList.length === 0) return null;

  // Excluir números com status "Vendido" — capacidade é só do estoque
  const vendidoStatusId = statusList?.find((s) => s.nome === 'Vendido')?.id;
  const numerosEstoque = vendidoStatusId
    ? numeros.filter((n) => n.status_id !== vendidoStatusId)
    : numeros;

  // Considera apenas números não vendidos (status fica fora — quem chama já filtra se quiser)
  const ocupacoes: ModeloOcupacao[] = modelosList
    .filter((m) => m.capacidade_whatsapp > 0)
    .map((modelo) => {
      const doModelo = numerosEstoque.filter((n) => n.modelo_id === modelo.id);
      const extra = extraOcupadosByModelo?.get(modelo.id);
      const normal = doModelo.filter((n) => n.tipo_whatsapp === 'normal').length + (extra?.normal ?? 0);
      const business = doModelo.filter((n) => n.tipo_whatsapp === 'business').length + (extra?.business ?? 0);
      const ocupados = doModelo.length + (extra?.total ?? 0);
      return {
        modelo,
        ocupados,
        capacidade: modelo.capacidade_whatsapp,
        livres: Math.max(0, modelo.capacidade_whatsapp - ocupados),
        normal,
        business,
        autoHospedados: extra?.total ?? 0,
      };
    });

  const comVagas = ocupacoes.filter((o) => o.livres > 0);
  const semTipo = numerosEstoque.filter((n) => !n.tipo_whatsapp).length;

  if (comVagas.length === 0 && semTipo === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="py-3 px-4 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="font-medium text-green-700 dark:text-green-400">
            Todos os modelos com números cadastrados estão na capacidade máxima
          </span>
        </CardContent>
      </Card>
    );
  }

  const totalLivres = comVagas.reduce((acc, o) => acc + o.livres, 0);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">
            {totalLivres} {totalLivres === 1 ? 'vaga disponível' : 'vagas disponíveis'} em {comVagas.length} {comVagas.length === 1 ? 'modelo' : 'modelos'}
          </span>
          {semTipo > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5">
              {semTipo} {semTipo === 1 ? 'número sem tipo de WhatsApp' : 'números sem tipo de WhatsApp'}
            </Badge>
          )}
        </div>

        {comVagas.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {comVagas.slice(0, 12).map((o) => {
              const sugestao = sugerirTipo(o);
              return (
                <div
                  key={o.modelo.id}
                  className="flex items-center gap-2 bg-background border rounded-md px-2.5 py-1.5 text-xs"
                >
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{o.modelo.nome}</span>
                  <Badge variant="secondary" className="h-5 text-[10px]">
                    {o.ocupados}/{o.capacidade}
                  </Badge>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    falta {o.livres}{sugestao && ` (${sugestao})`}
                  </span>
                </div>
              );
            })}
            {comVagas.length > 12 && (
              <span className="text-xs text-muted-foreground self-center">
                +{comVagas.length - 12} {comVagas.length - 12 === 1 ? 'outro' : 'outros'}
              </span>
            )}
          </div>
        )}

        {semTipo > 0 && (
          <div className="mt-2 text-xs text-muted-foreground bg-background/50 border border-dashed rounded-md px-2.5 py-1.5">
            💡 Edite os números sem tipo de WhatsApp e selecione Normal ou Business para que a contagem fique completa.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
