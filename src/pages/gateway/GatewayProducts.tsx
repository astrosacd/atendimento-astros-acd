import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGatewayProducts, useGatewayCategories, useGatewayOrderBumps, useProductOrderBumps, useGatewaySettings, GatewayProduct } from '@/hooks/useGateway';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { Plus, Pencil, Trash2, Copy, Link2, Image, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { copyToClipboard as __copyToClipboard } from '@/utils/clipboard';


export default function GatewayProducts() {
  const { settings } = useGatewaySettings();
  const siteBaseUrl = String(settings.site_base_url?.url || '').trim();

  const { products, isLoading, createProduct, updateProduct, deleteProduct, isCreating, isUpdating, isDeleting } = useGatewayProducts();
  const { categories } = useGatewayCategories();
  const { orderBumps } = useGatewayOrderBumps();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<GatewayProduct | null>(null);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const { isLoading: isConverting, convertBRLtoUSD, convertUSDtoBRL } = useCurrencyConversion();
  
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image_url: '',
    price_brl: 0,
    price_usd: 0,
    category_id: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [pricesSynced, setPricesSynced] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ directUsd: number; adjustedUsd: number; targetBrl: number; rate: number } | null>(null);

  const { setOrderBumps } = useProductOrderBumps(editingProduct?.id || null);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image_url: '',
      price_brl: 0,
      price_usd: 0,
      category_id: '',
      status: 'active',
    });
    setEditingProduct(null);
    setSelectedOrderBumps([]);
    setPricesSynced(false);
    setSyncInfo(null);
  };

  const handleEdit = async (product: GatewayProduct) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      image_url: product.image_url || '',
      price_brl: product.price_brl,
      price_usd: product.price_usd,
      category_id: product.category_id || '',
      status: product.status,
    });
    setPricesSynced(true); // Dados existentes já foram sincronizados antes

    // Load linked order bumps
    const { data } = await supabase
      .from('gateway_product_order_bumps')
      .select('order_bump_id')
      .eq('product_id', product.id);
    
    setSelectedOrderBumps(data?.map(d => d.order_bump_id) || []);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.price_brl <= 0 || formData.price_usd <= 0) {
      toast.error('Preencha os preços em BRL e USD antes de salvar.');
      return;
    }
    
    if (!pricesSynced) {
      toast.error('Use o botão de conversão para sincronizar os preços antes de salvar.');
      return;
    }
    
    const productData = {
      ...formData,
      category_id: formData.category_id || null,
    };

    if (editingProduct) {
      updateProduct({ id: editingProduct.id, ...productData }, {
        onSuccess: () => {
          setOrderBumps({ productId: editingProduct.id, orderBumpIds: selectedOrderBumps });
          handleOpenChange(false);
        }
      });
    } else {
      createProduct(productData, {
        onSuccess: (data: any) => {
          if (selectedOrderBumps.length > 0) {
            setOrderBumps({ productId: data.id, orderBumpIds: selectedOrderBumps });
          }
          handleOpenChange(false);
        }
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      deleteProduct(id);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;

    const { error } = await supabase.storage
      .from('gateway-products')
      .upload(fileName, file);

    if (error) {
      toast.error('Erro ao fazer upload: ' + error.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('gateway-products')
      .getPublicUrl(fileName);

    setFormData(prev => ({ ...prev, image_url: publicUrl }));
    setUploading(false);
    toast.success('Imagem enviada com sucesso');
  };

  const copyLink = (publicSlug: string) => {
    const base = siteBaseUrl.replace(/\/+$/, '');
    if (!base) {
      toast.error('Configure a URL do site nas configurações para copiar links completos.');
      return;
    }
    const url = `${base}/p/${publicSlug}`;
    __copyToClipboard(url);
    toast.success('Link copiado!');
  };

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Produtos ({products.length})</h2>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Novo Produto</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto px-1 pr-3 pt-3">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label>Imagem</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImage}
                        disabled={uploading}
                        className="flex-1"
                      />
                      {formData.image_url && (
                        <img src={formData.image_url} alt="Preview" className="h-10 w-10 object-cover rounded" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price_brl" className="flex items-center gap-2">
                      Preço BRL *
                      {pricesSynced ? (
                        <span className="text-xs text-green-500 font-normal">(sincronizado)</span>
                      ) : formData.price_brl > 0 && (
                        <span className="text-xs text-amber-500 font-normal">(não sincronizado)</span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="price_brl"
                        type="number"
                        step="0.01"
                        value={formData.price_brl}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, price_brl: parseFloat(e.target.value) || 0 }));
                          setPricesSynced(false);
                        }}
                        required
                        className={`flex-1 ${pricesSynced ? 'border-green-500 focus-visible:ring-green-500' : formData.price_brl > 0 ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isConverting || formData.price_brl <= 0}
                              onClick={async () => {
                                // Primeiro, obtém a cotação atual
                                const result = await convertBRLtoUSD(formData.price_brl);
                                if (result !== null) {
                                  // Valor de conversão direta (sem taxas)
                                  const directUsd = result.value;
                                  
                                  // Usa o cálculo inverso para obter o USD necessário para receber exatamente o BRL desejado
                                  const stripeSettings = settings.stripe || {};
                                  const feePercentage = typeof stripeSettings.fee_percentage === 'number' ? stripeSettings.fee_percentage : 3.99;
                                  const feeFixed = typeof stripeSettings.fee_fixed_usd === 'number' ? stripeSettings.fee_fixed_usd : 0.30;
                                  const exchangeSpread = typeof stripeSettings.exchange_spread === 'number' ? stripeSettings.exchange_spread : 4.0;
                                  
                                  const currentRate = result.rate; // Taxa de câmbio BRL/USD
                                  const targetBRL = formData.price_brl;
                                  const spreadMultiplier = 1 - exchangeSpread / 100;
                                  const feeMultiplier = 1 - feePercentage / 100;
                                  const targetUsdBeforeFees = targetBRL / (currentRate * spreadMultiplier);
                                  const adjustedUsd = Math.round(((targetUsdBeforeFees + feeFixed) / feeMultiplier) * 100) / 100;
                                  
                                  setFormData(prev => ({ ...prev, price_usd: adjustedUsd }));
                                  setPricesSynced(true);
                                  setSyncInfo({ directUsd, adjustedUsd, targetBrl: targetBRL, rate: currentRate });
                                  toast.success(`USD calculado: $${adjustedUsd.toFixed(2)} (para receber R$${targetBRL.toFixed(2)} líquido)`);
                                }
                              }}
                            >
                              <RefreshCw className={`h-4 w-4 ${isConverting ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Calcular USD para receber BRL líquido</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="price_usd" className="flex items-center gap-2">
                      Preço USD
                      {pricesSynced ? (
                        <span className="text-xs text-green-500 font-normal">(sincronizado)</span>
                      ) : formData.price_usd > 0 && (
                        <span className="text-xs text-amber-500 font-normal">(não sincronizado)</span>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="price_usd"
                        type="number"
                        step="0.01"
                        value={formData.price_usd}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, price_usd: parseFloat(e.target.value) || 0 }));
                          setPricesSynced(false);
                        }}
                        className={`flex-1 ${pricesSynced ? 'border-green-500 focus-visible:ring-green-500' : formData.price_usd > 0 ? 'border-amber-500 focus-visible:ring-amber-500' : ''}`}
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              disabled={isConverting || formData.price_usd <= 0}
                              onClick={async () => {
                                const result = await convertUSDtoBRL(formData.price_usd);
                                if (result !== null) {
                                  setFormData(prev => ({ ...prev, price_brl: result.value }));
                                  setPricesSynced(true);
                                  toast.success(`Convertido: R$${result.value.toFixed(2)} (cotação: R$${result.rate.toFixed(2)})`);
                                }
                              }}
                            >
                              <RefreshCw className={`h-4 w-4 ${isConverting ? 'animate-spin' : ''}`} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Converter USD → BRL</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Sync Info Display */}
                  {syncInfo && pricesSynced && (
                    <div className="col-span-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2 text-green-700 dark:text-green-400">
                        ✅ Sincronização Realizada
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">BRL Desejado:</span>
                          <p className="font-medium text-primary">R$ {syncInfo.targetBrl.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cotação:</span>
                          <p className="font-medium">R$ {syncInfo.rate.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Conversão Direta:</span>
                          <p className="font-medium text-muted-foreground line-through">${syncInfo.directUsd.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Com Taxas Embutidas:</span>
                          <p className="font-medium text-green-600 dark:text-green-400">${syncInfo.adjustedUsd.toFixed(2)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                        Conversão direta seria ${syncInfo.directUsd.toFixed(2)}, mas com taxas Stripe embutidas você deve cobrar ${syncInfo.adjustedUsd.toFixed(2)} para receber R$ {syncInfo.targetBrl.toFixed(2)} líquido.
                      </p>
                    </div>
                  )}

                  {/* Net Amount Display */}
                  {formData.price_usd > 0 && (
                    <div className="col-span-2 p-3 bg-muted/50 rounded-lg border">
                      <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                        💰 Valor Líquido Estimado (Stripe)
                      </Label>
                      {(() => {
                        const stripeSettings = settings.stripe || {};
                        const feePercentage = typeof stripeSettings.fee_percentage === 'number' ? stripeSettings.fee_percentage : 3.99;
                        const feeFixed = typeof stripeSettings.fee_fixed_usd === 'number' ? stripeSettings.fee_fixed_usd : 0.30;
                        const exchangeSpread = typeof stripeSettings.exchange_spread === 'number' ? stripeSettings.exchange_spread : 4.0;
                        
                        const percentageFee = formData.price_usd * (feePercentage / 100);
                        const totalFees = percentageFee + feeFixed;
                        const netUsd = formData.price_usd - totalFees;
                        const netAfterSpread = netUsd * (1 - exchangeSpread / 100);
                        
                        // Cálculo reverso: quanto cobrar em USD para receber exatamente o valor em BRL
                        const currentRate = formData.price_brl / formData.price_usd;
                        const targetBRL = formData.price_brl;
                        
                        const spreadMultiplier = 1 - exchangeSpread / 100;
                        const feeMultiplier = 1 - feePercentage / 100;
                        const targetUsdBeforeFees = targetBRL / (currentRate * spreadMultiplier);
                        const requiredUsd = (targetUsdBeforeFees + feeFixed) / feeMultiplier;
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-muted-foreground">Preço USD:</span>
                                <p className="font-medium">${formData.price_usd.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Taxa ({feePercentage}% + ${feeFixed.toFixed(2)}):</span>
                                <p className="font-medium text-red-500">-${totalFees.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Líquido USD:</span>
                                <p className="font-medium text-green-600">${netUsd.toFixed(2)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Após spread ({exchangeSpread}%):</span>
                                <p className="font-medium text-green-600">${netAfterSpread.toFixed(2)}</p>
                              </div>
                            </div>
                            
                            {formData.price_brl > 0 && !pricesSynced && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="flex items-center gap-2 text-sm">
                                  <span className="text-muted-foreground">Para receber exatamente R$ {formData.price_brl.toFixed(2)}, você deve cobrar:</span>
                                  <span className="font-bold text-primary">${requiredUsd.toFixed(2)} USD</span>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                      <p className="text-xs text-muted-foreground mt-2">
                        Configure as taxas em Configurações → Gateways → Stripe
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Categoria</Label>
                    <Select value={formData.category_id || 'none'} onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value === 'none' ? '' : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {categories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: 'active' | 'inactive') => setFormData(prev => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Ativo</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Order Bumps Vinculados</Label>
                    <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                      {orderBumps.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum order bump cadastrado</p>
                      ) : (
                        orderBumps.map(ob => (
                          <div key={ob.id} className="flex items-center gap-2">
                            <Checkbox
                              id={ob.id}
                              checked={selectedOrderBumps.includes(ob.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedOrderBumps(prev => [...prev, ob.id]);
                                } else {
                                  setSelectedOrderBumps(prev => prev.filter(id => id !== ob.id));
                                }
                              }}
                            />
                            <label htmlFor={ob.id} className="text-sm cursor-pointer flex-1">
                              {ob.name} - {formatCurrency(ob.price_brl)}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {editingProduct ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto -mx-2 px-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Preço BRL</TableHead>
                  <TableHead>Preço USD</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhum produto cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img src={product.image_url} alt="" className="h-10 w-10 object-cover rounded" />
                          ) : (
                            <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                              <Image className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{product.category?.name || '-'}</TableCell>
                      <TableCell>{formatCurrency(product.price_brl)}</TableCell>
                      <TableCell>{formatCurrency(product.price_usd, 'USD')}</TableCell>
                      <TableCell>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyLink(product.public_slug)}
                            title="Copiar link"
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
