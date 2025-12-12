import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, RefreshCw, Eye } from 'lucide-react';

export default function ConsultarCliente() {
  const navigate = useNavigate();
  const { searchCliente, isLoading } = useClientes();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cliente[] | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const data = await searchCliente(query);
    setResults(data);
  };

  const resetSearch = () => {
    setQuery('');
    setResults(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl bg-card border-border shadow-xl">
        <CardHeader className="border-b border-border pb-6">
          <div className="flex items-center justify-center gap-3">
            <div className="p-2.5 rounded-xl bg-info/10">
              <Eye className="w-6 h-6 text-info" />
            </div>
            <CardTitle className="text-2xl font-semibold text-foreground">
              Consulta de Cliente
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!results ? (
            <form onSubmit={handleSearch} className="space-y-4">
              <Input
                placeholder="Digite o CPF, CNPJ, número ou nome"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-secondary border-border text-foreground h-12"
                required
              />
              <Button 
                type="submit" 
                className="w-full h-12 bg-info text-info-foreground hover:bg-info/90 font-medium"
                disabled={isLoading}
              >
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? 'Consultando...' : 'Consultar'}
              </Button>
              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-secondary h-12"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-info text-center">
                {results.length > 0 ? `${results.length} cliente(s) encontrado(s)` : 'Nenhum cliente encontrado'}
              </h2>
              
              {results.length > 0 ? (
                <div className="grid gap-4">
                  {results.map((cliente) => (
                    <div 
                      key={cliente.id}
                      className="bg-info/5 border border-info/20 rounded-xl p-5 space-y-3 animate-fade-in"
                    >
                      <h3 className="text-lg font-semibold text-info capitalize">{cliente.nome}</h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <p className="text-muted-foreground">ID: <span className="text-foreground">{cliente.id.slice(0, 8)}...</span></p>
                        <p className="text-muted-foreground">Telefone: <span className="text-foreground">{cliente.numero}</span></p>
                        <p className="text-muted-foreground">Email: <span className="text-foreground">{cliente.email}</span></p>
                        <p className="text-muted-foreground">CPF/CNPJ: <span className="text-foreground">{cliente.cpf}</span></p>
                        <p className="text-muted-foreground">Produto: <span className="text-foreground">{cliente.produto}</span></p>
                        <p className="text-muted-foreground">Plano: <span className="text-foreground">{cliente.plano || 'Nenhum'}</span></p>
                        <p className="text-muted-foreground">Valor: <span className="text-primary font-medium">{formatCurrency(cliente.valor)}</span></p>
                        <p className="text-muted-foreground">Renovação: <span className="text-info font-medium">{formatDate(cliente.data_renovacao)}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-destructive">
                  Nenhum cliente encontrado com os dados informados.
                </p>
              )}

              <div className="flex justify-center gap-4">
                <Button 
                  onClick={resetSearch}
                  className="bg-info text-info-foreground hover:bg-info/90 h-11"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nova Consulta
                </Button>
                <Button 
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-secondary h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Menu
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
