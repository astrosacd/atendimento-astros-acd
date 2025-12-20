import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, Package, Gift, Ticket, CreditCard, Check } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_brl: number;
  price_usd: number;
  public_slug: string;
}

interface OrderBump {
  id: string;
  name: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_brl: number;
  price_usd: number;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string;
}

export default function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentGateway, setPaymentGateway] = useState<'stripe' | 'mercadopago'>('mercadopago');
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch product by public_slug
  const { data: product, isLoading: productLoading, error: productError } = useQuery({
    queryKey: ['public-product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_products')
        .select('*')
        .eq('public_slug', slug)
        .eq('status', 'active')
        .single();
      if (error) throw error;
      return data as Product;
    },
    enabled: !!slug,
  });

  // Fetch order bumps for this product
  const { data: orderBumps = [] } = useQuery({
    queryKey: ['product-order-bumps', product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data, error } = await supabase
        .from('gateway_product_order_bumps')
        .select('order_bump_id, display_order')
        .eq('product_id', product.id)
        .order('display_order');
      if (error) throw error;
      
      if (data.length === 0) return [];
      
      const bumpIds = data.map(d => d.order_bump_id);
      const { data: bumps, error: bumpsError } = await supabase
        .from('gateway_order_bumps')
        .select('*')
        .in('id', bumpIds)
        .eq('status', 'active');
      if (bumpsError) throw bumpsError;
      
      return bumps as OrderBump[];
    },
    enabled: !!product?.id,
  });

  const formatPrice = (priceBrl: number, priceUsd: number) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceUsd);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBrl);
  };

  const getPrice = (priceBrl: number, priceUsd: number) => {
    return currency === 'USD' ? priceUsd : priceBrl;
  };

  // Calculate totals
  const subtotal = product ? getPrice(product.price_brl, product.price_usd) : 0;
  
  const orderBumpsTotal = orderBumps
    .filter(ob => selectedOrderBumps.includes(ob.id))
    .reduce((sum, ob) => sum + getPrice(ob.price_brl, ob.price_usd), 0);

  const discountAmount = appliedCoupon
    ? appliedCoupon.discount_type === 'percentage'
      ? ((subtotal + orderBumpsTotal) * appliedCoupon.discount_value) / 100
      : appliedCoupon.discount_value
    : 0;

  const total = subtotal + orderBumpsTotal - discountAmount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    
    const { data, error } = await supabase
      .from('gateway_coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      toast.error('Cupom inválido ou expirado');
      return;
    }
    
    // Check if coupon is valid for current currency
    if (data.currency !== currency && data.discount_type === 'fixed') {
      toast.error(`Este cupom é válido apenas para ${data.currency}`);
      return;
    }
    
    // Check dates
    const now = new Date();
    if (data.starts_at && new Date(data.starts_at) > now) {
      toast.error('Este cupom ainda não está ativo');
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < now) {
      toast.error('Este cupom expirou');
      return;
    }
    
    // Check usage limit
    if (data.max_uses_global && data.usage_count >= data.max_uses_global) {
      toast.error('Este cupom atingiu o limite de uso');
      return;
    }
    
    setAppliedCoupon(data as Coupon);
    toast.success('Cupom aplicado!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('gateway_orders')
        .insert([{
          product_id: product?.id,
          order_bump_id: selectedOrderBumps.length > 0 ? selectedOrderBumps[0] : null,
          coupon_id: appliedCoupon?.id || null,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
          subtotal: subtotal + orderBumpsTotal,
          discount_amount: discountAmount,
          total,
          currency,
          status: 'pending',
          payment_gateway: paymentGateway,
        }])
        .select()
        .single();
      
      if (orderError) throw orderError;

      // Record coupon usage if applied
      if (appliedCoupon && order) {
        await supabase.from('gateway_coupon_usages').insert([{
          coupon_id: appliedCoupon.id,
          order_id: order.id,
          discount_amount: discountAmount,
        }]);
        
        // Increment coupon usage
        await supabase
          .from('gateway_coupons')
          .update({ 
            usage_count: (appliedCoupon as any).usage_count + 1,
            total_discount_given: (appliedCoupon as any).total_discount_given + discountAmount,
          })
          .eq('id', appliedCoupon.id);
      }

      // Call edge function to process payment
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('gateway-process-payment', {
        body: {
          orderId: order.id,
          gateway: paymentGateway,
        },
      });

      if (paymentError) throw paymentError;

      if (paymentData?.redirectUrl) {
        window.location.href = paymentData.redirectUrl;
      } else {
        navigate('/sucesso');
      }
    } catch (error: any) {
      console.error('Error processing order:', error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (productLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-6">O produto que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => navigate('/catalogo')}>Ver catálogo</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <form onSubmit={handleSubmit}>
          <div className="grid md:grid-cols-5 gap-6">
            {/* Main Form */}
            <div className="md:col-span-3 space-y-6">
              {/* Product Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Produto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4">
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-foreground">{product.name}</h3>
                      {product.description && (
                        <p className="text-sm text-muted-foreground mt-1">{product.description}</p>
                      )}
                      <p className="text-lg font-bold text-primary mt-2">
                        {formatPrice(product.price_brl, product.price_usd)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Seus Dados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Order Bumps */}
              {orderBumps.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-pink-500" />
                      Ofertas Especiais
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {orderBumps.map((bump) => (
                      <div
                        key={bump.id}
                        className={`border-2 rounded-lg p-4 transition-colors cursor-pointer ${
                          selectedOrderBumps.includes(bump.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                          setSelectedOrderBumps(prev =>
                            prev.includes(bump.id)
                              ? prev.filter(id => id !== bump.id)
                              : [...prev, bump.id]
                          );
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={selectedOrderBumps.includes(bump.id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{bump.title}</span>
                              <span className="text-sm font-bold text-primary">
                                +{formatPrice(bump.price_brl, bump.price_usd)}
                              </span>
                            </div>
                            {bump.description && (
                              <p className="text-sm text-muted-foreground mt-1">{bump.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-500" />
                    Forma de Pagamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={paymentGateway}
                    onValueChange={(v) => setPaymentGateway(v as 'stripe' | 'mercadopago')}
                  >
                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                      <RadioGroupItem value="mercadopago" id="mercadopago" />
                      <Label htmlFor="mercadopago" className="flex-1 cursor-pointer">
                        <span className="font-medium">Mercado Pago</span>
                        <span className="block text-sm text-muted-foreground">Pix, Cartão, Boleto</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 border rounded-lg mt-2">
                      <RadioGroupItem value="stripe" id="stripe" />
                      <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                        <span className="font-medium">Stripe</span>
                        <span className="block text-sm text-muted-foreground">Cartão Internacional</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="md:col-span-2">
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Resumo do Pedido</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Currency Selector */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={currency === 'BRL' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrency('BRL')}
                      className="flex-1"
                    >
                      R$ BRL
                    </Button>
                    <Button
                      type="button"
                      variant={currency === 'USD' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrency('USD')}
                      className="flex-1"
                    >
                      $ USD
                    </Button>
                  </div>

                  <Separator />

                  {/* Line Items */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{product.name}</span>
                      <span>{formatPrice(product.price_brl, product.price_usd)}</span>
                    </div>
                    {orderBumps
                      .filter(ob => selectedOrderBumps.includes(ob.id))
                      .map(ob => (
                        <div key={ob.id} className="flex justify-between text-pink-500">
                          <span>{ob.name}</span>
                          <span>+{formatPrice(ob.price_brl, ob.price_usd)}</span>
                        </div>
                      ))}
                  </div>

                  {/* Coupon */}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Cupom de desconto"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      disabled={!!appliedCoupon}
                    />
                    {appliedCoupon ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setAppliedCoupon(null);
                          setCouponCode('');
                        }}
                      >
                        ×
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={applyCoupon}
                      >
                        <Ticket className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {appliedCoupon && (
                    <div className="flex justify-between text-sm text-green-500">
                      <span className="flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Desconto ({appliedCoupon.code})
                      </span>
                      <span>
                        -{currency === 'BRL' 
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountAmount)
                          : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(discountAmount)}
                      </span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">
                      {currency === 'BRL'
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)
                        : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Finalizar Compra'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
