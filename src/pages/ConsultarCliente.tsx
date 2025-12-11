import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Search, RefreshCw } from 'lucide-react';

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
      <Card className="w-full max-w-2xl bg-card border-border">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-info text-center">
            Consulta de Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!results ? (
            <form onSubmit={handleSearch} className="space-y-4">
              <Input
                placeholder="Digite o CPF, CNPJ, número ou nome"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-input border-border text-foreground"
                required
              />
              <Button 
                type="submit" 
                className="w-full bg-info text-foreground hover:bg-info/90"
                disabled={isLoading}
              >
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? 'Consultando...' : 'Consultar'}
              </Button>
              <Button 
                type="button"
                onClick={() => navigate('/')}
                variant="outline"
                className="w-full border-border text-foreground hover:bg-secondary"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao Menu
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-info text-center">
                {results.length > 0 ? 'Clientes Encontrados' : 'Nenhum cliente encontrado'}
              </h2>
              
              {results.length > 0 ? (
                <div className="grid gap-4">
                  {results.map((cliente) => (
                    <div 
                      key={cliente.id}
                      className="bg-secondary border border-primary rounded-xl p-4 space-y-2 animate-fade-in"
                    >
                      <h3 className="text-lg font-bold text-primary capitalize">{cliente.nome}</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <p><strong className="text-muted-foreground">ID:</strong> {cliente.id.slice(0, 8)}...</p>
                        <p><strong className="text-muted-foreground">Telefone:</strong> {cliente.numero}</p>
                        <p><strong className="text-muted-foreground">Email:</strong> {cliente.email}</p>
                        <p><strong className="text-muted-foreground">CPF/CNPJ:</strong> {cliente.cpf}</p>
                        <p><strong className="text-muted-foreground">Produto:</strong> {cliente.produto}</p>
                        <p><strong className="text-muted-foreground">Plano:</strong> {cliente.plano || 'Nenhum'}</p>
                        <p><strong className="text-muted-foreground">Valor:</strong> {formatCurrency(cliente.valor)}</p>
                        <p><strong className="text-muted-foreground">Renovação:</strong> {formatDate(cliente.data_renovacao)}</p>
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
                  className="bg-info text-foreground"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Nova Consulta
                </Button>
                <Button 
                  onClick={() => navigate('/')}
                  variant="outline"
                  className="border-border"
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
