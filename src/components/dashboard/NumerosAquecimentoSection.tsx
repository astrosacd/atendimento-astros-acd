import { usePermissions } from '@/hooks/usePermissions';
import { NumerosAquecimentoCard } from './NumerosAquecimentoCard';
import { CapacityBanner } from '@/components/numeros-aquecimento/CapacityBanner';
import { useNumerosAquecimento, useNumerosModelos, useNumerosStatus } from '@/hooks/useNumerosAquecimento';
import { useActiveCheckinsByModelo } from '@/hooks/useCheckinDiario';

export function NumerosAquecimentoSection() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_numeros_aquecimento');

  const { data: numeros = [], isLoading: loadingNumeros } = useNumerosAquecimento();
  const { data: modelosList = [], isLoading: loadingModelos } = useNumerosModelos();
  const { data: statusList = [], isLoading: loadingStatus } = useNumerosStatus();

  if (!canView) {
    return null;
  }

  const isLoading = loadingNumeros || loadingModelos || loadingStatus;

  return (
    <>
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2 font-display">
        <span className="h-5 w-1 bg-cyan-500 rounded-full"></span>
        Status de Números
      </h3>
      <div className="grid grid-cols-1 gap-4 mb-6">
        {!isLoading && (
          <CapacityBanner numeros={numeros} modelosList={modelosList} statusList={statusList} />
        )}
        <NumerosAquecimentoCard />
      </div>
    </>
  );
}
