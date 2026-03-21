import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crosshair, Users, Megaphone, Settings, History, Search, Database
} from 'lucide-react';
import LeadHunterLeads from '@/components/lead-hunter/LeadHunterLeads';
import LeadHunterCampanhas from '@/components/lead-hunter/LeadHunterCampanhas';
import LeadHunterBusca from '@/components/lead-hunter/LeadHunterBusca';
import LeadHunterConfig from '@/components/lead-hunter/LeadHunterConfig';
import LeadHunterHistorico from '@/components/lead-hunter/LeadHunterHistorico';

export default function LeadHunter() {
  const [activeTab, setActiveTab] = useState('leads');

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
              <Crosshair className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Lead Hunter</h1>
              <p className="text-muted-foreground text-sm">Prospecção automatizada via Google Maps + WhatsApp</p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 bg-muted/50">
            <TabsTrigger value="leads" className="gap-2 data-[state=active]:bg-background">
              <Users className="h-4 w-4" />
              Leads
            </TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-2 data-[state=active]:bg-background">
              <Megaphone className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="busca" className="gap-2 data-[state=active]:bg-background">
              <Search className="h-4 w-4" />
              Busca SERP
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-background">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-2 data-[state=active]:bg-background">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-0">
            <LeadHunterLeads />
          </TabsContent>
          <TabsContent value="campanhas" className="mt-0">
            <LeadHunterCampanhas />
          </TabsContent>
          <TabsContent value="busca" className="mt-0">
            <LeadHunterBusca />
          </TabsContent>
          <TabsContent value="config" className="mt-0">
            <LeadHunterConfig />
          </TabsContent>
          <TabsContent value="historico" className="mt-0">
            <LeadHunterHistorico />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
