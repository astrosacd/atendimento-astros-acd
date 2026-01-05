import { usePermissions } from '@/hooks/usePermissions';
import { MonitoredNumbersCard } from './MonitoredNumbersCard';

export function ConsultaNumerosSection() {
  const { hasPermission } = usePermissions();
  const canView = hasPermission('view_consulta_numeros');

  if (!canView) {
    return null;
  }

  return (
    <>
      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2 font-display">
        <span className="h-5 w-1 bg-indigo-500 rounded-full"></span>
        Consulta Números
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <MonitoredNumbersCard />
      </div>
    </>
  );
}
