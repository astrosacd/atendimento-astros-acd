import { DashboardLayout } from '@/components/DashboardLayout';
import { SalaAgentesScene } from '@/features/sala-agentes/SalaAgentesScene';

export default function SalaAgentes() {
  return (
    <DashboardLayout>
      <div className="p-2 md:p-4">
        <SalaAgentesScene />
      </div>
    </DashboardLayout>
  );
}
