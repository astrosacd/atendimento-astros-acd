import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Search, Copy, ShoppingCart, Package, Sparkles, ArrowRight, Star } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_brl: number;
  price_usd: number;
  public_slug: string;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function Catalogo() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['public-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_products')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['public-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_categories')
        .select('*')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: siteBaseUrlSetting } = useQuery({
    queryKey: ['public-site-base-url'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_settings')
        .select('value')
        .eq('key', 'site_base_url')
        .maybeSingle();
      if (error) return '';
      return String((data?.value as any)?.url || '').trim().replace(/\/+$/, '');
    },
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const formatPrice = (priceBrl: number, priceUsd: number) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceUsd);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBrl);
  };

  const copyLink = (slug: string) => {
    const path = `/p/${slug}`;
    const base = siteBaseUrlSetting || '';
    const url = base ? `${base}${path}` : `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/30 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <Package className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Catálogo</h1>
                <p className="text-xs text-muted-foreground">Encontre o produto perfeito</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={currency} onValueChange={(v) => setCurrency(v as 'BRL' | 'USD')}>
                <SelectTrigger className="w-28 bg-background/50 border-border/50 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">🇧🇷 BRL</SelectItem>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-8 relative z-10">
          <div className="flex items-center gap-2 text-sm text-primary mb-2">
            <Sparkles className="h-4 w-4" />
            <span className="font-medium">Produtos em destaque</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Explore nossa coleção
          </h2>
          <p className="text-muted-foreground max-w-xl">
            Descubra produtos incríveis com preços especiais. Navegue por categorias ou busque pelo que você procura.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 h-12 bg-background/50 border-border/50 shadow-sm focus:shadow-md transition-all"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-56 h-12 bg-background/50 border-border/50 shadow-sm">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏷️ Todas categorias</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden border-border/30">
                <Skeleton className="h-52 w-full" />
                <CardContent className="p-5">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-7 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 animate-fade-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Nenhum produto encontrado</h3>
            <p className="text-muted-foreground">Tente ajustar seus filtros de busca</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product, index) => (
              <Card 
                key={product.id} 
                className="overflow-hidden group hover:shadow-2xl transition-all duration-500 border-border/30 bg-gradient-to-br from-card to-card/50 animate-fade-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="relative h-52 bg-gradient-to-br from-muted to-muted/50 overflow-hidden">
                  {product.image_url ? (
                    <>
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Quick action overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <Button 
                      size="lg"
                      className="shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300"
                      onClick={() => navigate(`/p/${product.public_slug}`)}
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Comprar agora
                    </Button>
                  </div>
                  {/* Badge */}
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-1 bg-background/90 backdrop-blur-sm text-xs font-medium px-2.5 py-1 rounded-full shadow-md">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span>Destaque</span>
                    </div>
                  </div>
                </div>
                <CardContent className="p-5">
                  <h3 className="font-bold text-foreground mb-1.5 line-clamp-1 group-hover:text-primary transition-colors">{product.name}</h3>
                  {product.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{product.description}</p>
                  )}
                  <p className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                    {formatPrice(product.price_brl, product.price_usd)}
                  </p>
                </CardContent>
                <CardFooter className="p-5 pt-0 flex gap-2">
                  <Button
                    className="flex-1 group/btn shadow-md hover:shadow-lg transition-all"
                    onClick={() => navigate(`/p/${product.public_slug}`)}
                  >
                    <span>Comprar</span>
                    <ArrowRight className="h-4 w-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(product.public_slug)}
                    title="Copiar link"
                    className="shadow-sm hover:shadow-md transition-all"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Results count */}
        {!productsLoading && filteredProducts.length > 0 && (
          <div className="text-center mt-8 text-sm text-muted-foreground">
            Mostrando {filteredProducts.length} {filteredProducts.length === 1 ? 'produto' : 'produtos'}
          </div>
        )}
      </div>
    </div>
  );
}
