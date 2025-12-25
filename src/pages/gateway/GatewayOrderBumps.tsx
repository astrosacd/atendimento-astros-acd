import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGatewayOrderBumps, useGatewaySettings, GatewayOrderBump } from '@/hooks/useGateway';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { Plus, Pencil, Trash2, Image, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function GatewayOrderBumps() {
  const { settings } = useGatewaySettings();
  const { orderBumps, isLoading, createOrderBump, updateOrderBump, deleteOrderBump, isCreating, isUpdating } = useGatewayOrderBumps();
  const [isOpen, setIsOpen] = useState(false);
  const [editingOrderBump, setEditingOrderBump] = useState<GatewayOrderBump | null>(null);
  const [uploading, setUploading] = useState(false);
  const [couponFilter, setCouponFilter] = useState<'all' | 'allowed' | 'blocked'>('all');
  const { isLoading: isConverting, convertBRLtoUSD, convertUSDtoBRL } = useCurrencyConversion();
  
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    description: '',
    image_url: '',
    price_brl: 0,
    price_usd: 0,
    status: 'active' as 'active' | 'inactive',
    allow_coupon: true,
  });
  const [pricesSynced, setPricesSynced] = useState(false);
  const [syncInfo, setSyncInfo] = useState<{ directUsd: number; adjustedUsd: number; targetBrl: number; rate: number } | null>(null);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      title: '',
      description: '',
      image_url: '',
      price_brl: 0,
      price_usd: 0,
      status: 'active',
      allow_coupon: true,
    });
    setEditingOrderBump(null);
    setPricesSynced(false);
    setSyncInfo(null);
  };

  const handleEdit = (orderBump: GatewayOrderBump) => {
    setEditingOrderBump(orderBump);
    setFormData({
      name: orderBump.name,
      title: orderBump.title,
      description: orderBump.description || '',
      image_url: orderBump.image_url || '',
      price_brl: orderBump.price_brl,
      price_usd: orderBump.price_usd,
      status: orderBump.status,
      allow_coupon: orderBump.allow_coupon ?? true,
    });
    setPricesSynced(true); // Dados existentes já foram sincronizados antes
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.price_brl <= 0 || formData.price_usd <= 0) {
      toast.error('Preencha os preços em BRL e USD antes de salvar.');
      return;
    }
    
    if (!pricesSynced) {
      toast.error('Use o botão de conversão para sincronizar os preços antes de salvar.');
      return;
    }
    
    if (editingOrderBump) {
      updateOrderBump({ id: editingOrderBump.id, ...formData }, {
        onSuccess: () => handleOpenChange(false)
      });
    } else {
      createOrderBump(formData, {
        onSuccess: () => handleOpenChange(false)
      });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este order bump?')) {
      deleteOrderBump(id);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `order-bumps/${crypto.randomUUID()}.${fileExt}`;

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

  const formatCurrency = (value: number, currency: 'BRL' | 'USD' = 'BRL') => {
    return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', {
      style: 'currency',
      currency,
    }).format(value);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-pulse">Carregando...</div></div>;
  }

  const filteredOrderBumps = orderBumps.filter((ob) => {
    if (couponFilter === 'allowed') return (ob.allow_coupon ?? true) === true;
    if (couponFilter === 'blocked') return (ob.allow_coupon ?? true) === false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Order Bumps ({filteredOrderBumps.length})</h2>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtro:</span>
            <Select value={couponFilter} onValueChange={(v: 'all' | 'allowed' | 'blocked') => setCouponFilter(v)}>
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Permite cupom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="allowed">Permite cupom</SelectItem>
                <SelectItem value="blocked">Não permite cupom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Novo Order Bump</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingOrderBump ? 'Editar Order Bump' : 'Novo Order Bump'}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[65vh] overflow-y-auto px-1 pr-3 pt-3">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                  <Label htmlFor="name">Nome Interno *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Identificação interna"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="title">Título (exibido no checkout) *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required
                    placeholder="Adicione também..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="Descrição do order bump"
                  />
                </div>
                <div className="space-y-1.5">
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
                <div className="grid grid-cols-2 gap-4">
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
                                const result = await convertBRLtoUSD(formData.price_brl);
                                if (result !== null) {
                                  // Valor de conversão direta (sem taxas)
                                  const directUsd = result.value;
                                  
                                  // Usa o cálculo inverso para obter o USD necessário para receber exatamente o BRL desejado
                                  const stripeSettings = settings.stripe || {};
                                  const feePercentage = typeof stripeSettings.fee_percentage === 'number' ? stripeSettings.fee_percentage : 3.99;
                                  const feeFixed = typeof stripeSettings.fee_fixed_usd === 'number' ? stripeSettings.fee_fixed_usd : 0.30;
                                  const exchangeSpread = typeof stripeSettings.exchange_spread === 'number' ? stripeSettings.exchange_spread : 4.0;
                                  
                                  const currentRate = result.rate;
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
                </div>

                {/* Sync Info Display */}
                {syncInfo && pricesSynced && (
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <Label className="text-sm font-medium flex items-center gap-2 mb-2 text-green-700 dark:text-green-400">
                      ✅ Sincronização Realizada
                    </Label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
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
                  <div className="p-3 bg-muted/50 rounded-lg border">
                    <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                      💰 Valor Líquido Estimado (Stripe)
                    </Label>
                    {(() => {
                      const stripeSettings = settings.stripe || {};
                      const feePercentage = typeof stripeSettings.fee_percentage === 'number' ? stripeSettings.fee_percentage : 3.99;
                      const feeFixed = typeof stripeSettings.fee_fixed_usd === 'number' ? stripeSettings.fee_fixed_usd : 0.30;
                      const exchangeSpread = typeof stripeSettings.exchange_spread === 'number' ? stripeSettings.exchange_spread : 4.0;
                      
                      const grossUsd = formData.price_usd;
                      const stripeFee = (grossUsd * feePercentage / 100) + feeFixed;
                      const netUsd = grossUsd - stripeFee;
                      const effectiveRate = syncInfo?.rate || 5.50;
                      const spreadMultiplier = 1 - exchangeSpread / 100;
                      const netBrl = netUsd * effectiveRate * spreadMultiplier;

                      return (
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">Valor Bruto:</span>
                            <p className="font-medium">${grossUsd.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Taxa Stripe ({feePercentage}% + ${feeFixed.toFixed(2)}):</span>
                            <p className="font-medium text-destructive">-${stripeFee.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Líquido USD:</span>
                            <p className="font-medium">${netUsd.toFixed(2)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Líquido BRL (spread {exchangeSpread}%):</span>
                            <p className="font-medium text-green-600 dark:text-green-400">≈ R$ {netBrl.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

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
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="allow_coupon"
                    checked={formData.allow_coupon}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, allow_coupon: !!checked }))}
                  />
                  <label htmlFor="allow_coupon" className="text-sm cursor-pointer">
                    Permitir uso de cupom com este Order Bump
                  </label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {editingOrderBump ? 'Salvar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Card className="border-border/50">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order Bump</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Preço BRL</TableHead>
              <TableHead>Preço USD</TableHead>
              <TableHead>Permite cupom</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrderBumps.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum order bump encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredOrderBumps.map((ob) => (
                <TableRow key={ob.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {ob.image_url ? (
                        <img src={ob.image_url} alt="" className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <div className="h-10 w-10 bg-muted rounded flex items-center justify-center">
                          <Image className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <span className="font-medium">{ob.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{ob.title}</TableCell>
                  <TableCell>{formatCurrency(ob.price_brl)}</TableCell>
                  <TableCell>{formatCurrency(ob.price_usd, 'USD')}</TableCell>
                  <TableCell>
                    <Badge variant={(ob.allow_coupon ?? true) ? 'default' : 'secondary'}>
                      {(ob.allow_coupon ?? true) ? 'Sim' : 'Não'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={ob.status === 'active' ? 'default' : 'secondary'}>
                      {ob.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(ob)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(ob.id)}
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
      </CardContent>
    </Card>
    </div>
  );
}
