import { usePermissions } from '@/hooks/usePermissions';
import { NumerosAquecimentoCard } from './NumerosAquecimentoCard';
import { CapacityBanner } from '@/components/numeros-aquecimento/CapacityBanner';
import { useNumerosAquecimento, useNumerosModelos } from '@/hooks/useNumerosAquecimento';

export function NumerosAquecimentoSection() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_numeros_aquecimento');

  const { data: numeros = [] } = useNumerosAquecimento();
  const { data: modelosList = [] } = useNumerosModelos();

  if (!canView) {
    return null;
  }

  return (
    <>
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2 font-display">
        <span className="h-5 w-1 bg-cyan-500 rounded-full"></span>
        Status de Números
      </h3>
      <div className="grid grid-cols-1 gap-4 mb-6">
        <CapacityBanner numeros={numeros} modelosList={modelosList} />
        <NumerosAquecimentoCard />
      </div>
    </>
  );
}
