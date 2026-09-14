import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { ClientConnectionGraph } from '@/components/ClientConnectionGraph';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Network, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { resolveClienteSituacao, ClienteSituacao } from '@/hooks/useClientConnectionGraph';

const SITUACAO_LABEL: Record<ClienteSituacao, string> = {
  cancelado: 'Cancelado',
  inadimplente: 'Inadimplente',
  agendado: 'Agendado',
  registro: 'Registro',
  ativo: 'Ativo',
};

export default function GrafoClientes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clientes, setClientes] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>(searchParams.get('cliente') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clientes')
        .select('id, nome, cpf, tags, status_cliente, cobranca_ativa, ciclo_cobranca, cancelado_em, data_renovacao')
        .order('nome', { ascending: true });
      setClientes(data || []);
      setLoading(false);
    })();
  }, []);

  const handleChange = (id: string) => {
    setSelectedId(id);
    if (id) setSearchParams({ cliente: id });
    else setSearchParams({});
  };

  const options = clientes.map((c) => {
    const situacao = resolveClienteSituacao(c);
    const base = c.cpf ? `${c.nome} • ${c.cpf}` : c.nome;
    return {
      value: c.id,
      label: `${base} • ${SITUACAO_LABEL[situacao]}`,
    };
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Network className="h-6 w-6 text-primary" />
              Mapa de Conexões 360°
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              Visualize todas as conexões e relações de um cliente em um único diagrama interativo
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selecionar Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <SearchableSelect
              options={options}
              value={selectedId}
              onValueChange={handleChange}
              placeholder={loading ? 'Carregando clientes...' : 'Buscar cliente por nome ou CPF...'}
              searchPlaceholder="Digite para buscar..."
              emptyMessage="Nenhum cliente encontrado"
              disabled={loading}
            />
          </CardContent>
        </Card>

        <ClientConnectionGraph clienteId={selectedId || null} height={650} />
      </div>
    </DashboardLayout>
  );
}
