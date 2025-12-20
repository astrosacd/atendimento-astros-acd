import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Package, ShoppingCart, CreditCard, Shield, Check, Tag, ArrowLeft, AlertTriangle, Timer } from 'lucide-react';
import { formatCPF } from '@/utils/formatters';

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
  allow_coupon?: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  currency: string;
  usage_count: number;
  total_discount_given: number;
}

// Phone mask helper
const formatPhoneBR = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

// Track event helper (fire and forget)
const trackEvent = (eventType: string, data: Record<string, unknown> = {}) => {
  supabase.functions.invoke('gateway-track-event', {
    body: { event_type: eventType, ...data },
  }).catch(() => { /* ignore tracking errors */ });
};

export default function Checkout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCpf, setCustomerCpf] = useState('');
  const [paymentGateway, setPaymentGateway] = useState<'stripe' | 'mercadopago' | null>(null);
  const [currency, setCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch enabled payment gateways and checkout settings
  const { data: gatewaySettings, isLoading: gatewayLoading } = useQuery({
    queryKey: ['gateway-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_settings')
        .select('key, value')
        .in('key', ['stripe', 'mercadopago', 'checkout']);
      if (error) throw error;
      
      const settings: Record<string, any> = {};
      data?.forEach(item => {
        settings[item.key] = item.value;
      });
      return settings;
    },
  });

  const stripeEnabled = gatewaySettings?.stripe?.enabled === true;
  const mercadopagoEnabled = gatewaySettings?.mercadopago?.enabled === true;
  const checkoutSettings = gatewaySettings?.checkout as { 
    countdown_enabled?: boolean; 
    countdown_minutes?: number;
    countdown_message?: string;
  } | undefined;
  
  const availableGateways = [
    ...(mercadopagoEnabled ? ['mercadopago'] : []),
    ...(stripeEnabled ? ['stripe'] : []),
  ] as ('stripe' | 'mercadopago')[];

  // Auto-select gateway when settings load
  useEffect(() => {
    if (!paymentGateway && availableGateways.length > 0) {
      setPaymentGateway(availableGateways[0]);
    }
  }, [availableGateways, paymentGateway]);

  // Countdown timer state
  const [countdown, setCountdown] = useState<number | null>(null);
  
  useEffect(() => {
    if (checkoutSettings?.countdown_enabled && checkoutSettings?.countdown_minutes) {
      // Initialize countdown
      setCountdown(checkoutSettings.countdown_minutes * 60);
    }
  }, [checkoutSettings?.countdown_enabled, checkoutSettings?.countdown_minutes]);

  // Countdown tick
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

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

  // Track page view on mount
  useEffect(() => {
    if (slug && product?.id) {
      trackEvent('checkout_view', { slug, product_id: product.id });
    }
  }, [slug, product?.id]);

  // Keep currency simple for the customer:
  // - Mercado Pago: BRL
  // - Stripe: USD
  useEffect(() => {
    setCurrency(paymentGateway === 'stripe' ? 'USD' : 'BRL');
  }, [paymentGateway]);

  const formatPrice = (priceBrl: number, priceUsd: number) => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(priceUsd);
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceBrl);
  };

  const getPrice = (priceBrl: number, priceUsd: number) => {
    return currency === 'USD' ? priceUsd : priceBrl;
  };

  const subtotal = product ? getPrice(product.price_brl, product.price_usd) : 0;
  
  const orderBumpsTotal = orderBumps
    .filter(ob => selectedOrderBumps.includes(ob.id))
    .reduce((sum, ob) => sum + getPrice(ob.price_brl, ob.price_usd), 0);

  // Check if any selected order bump blocks coupons
  const couponBlockedByBump = orderBumps
    .filter(ob => selectedOrderBumps.includes(ob.id))
    .some(ob => ob.allow_coupon === false);

  // Clear coupon if blocked by bump
  useEffect(() => {
    if (couponBlockedByBump && appliedCoupon) {
      setAppliedCoupon(null);
      toast.info('Cupom removido: uma das ofertas selecionadas não permite cupom.');
    }
  }, [couponBlockedByBump, appliedCoupon]);

  const discountAmount = appliedCoupon && !couponBlockedByBump
    ? appliedCoupon.discount_type === 'percentage'
      ? ((subtotal + orderBumpsTotal) * appliedCoupon.discount_value) / 100
      : appliedCoupon.discount_value
    : 0;

  const total = subtotal + orderBumpsTotal - discountAmount;

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;

    if (couponBlockedByBump) {
      toast.error('Uma das ofertas selecionadas não permite cupom de desconto.');
      return;
    }
    
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
    
    if (data.currency !== currency && data.discount_type === 'fixed') {
      toast.error(`Este cupom é válido apenas para ${data.currency}`);
      return;
    }
    
    const now = new Date();
    if (data.starts_at && new Date(data.starts_at) > now) {
      toast.error('Este cupom ainda não está ativo');
      return;
    }
    if (data.expires_at && new Date(data.expires_at) < now) {
      toast.error('Este cupom expirou');
      return;
    }
    
    if (data.max_uses_global && data.usage_count >= data.max_uses_global) {
      toast.error('Este cupom atingiu o limite de uso');
      return;
    }
    
    setAppliedCoupon(data as Coupon);
    trackEvent('coupon_applied', { slug, product_id: product?.id, coupon_code: data.code });
    toast.success('Cupom aplicado!');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerEmail.trim()) {
      toast.error('Email é obrigatório');
      return;
    }

    const phoneDigits = customerPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      toast.error('Telefone inválido. Use o formato (00) 00000-0000');
      return;
    }

    // CPF validation for Mercado Pago
    if (paymentGateway === 'mercadopago') {
      const cpfDigits = customerCpf.replace(/\D/g, '');
      if (cpfDigits.length !== 11) {
        toast.error('CPF inválido. Digite os 11 dígitos');
        return;
      }
    }
    
    setIsProcessing(true);
    trackEvent('checkout_submit', {
      slug,
      product_id: product?.id,
      order_bump_ids: selectedOrderBumps,
      coupon_code: appliedCoupon?.code || null,
      payment_gateway: paymentGateway,
      currency,
    });
    
    try {
      const { data: orderData, error: createOrderError } = await supabase.functions.invoke('gateway-create-order', {
        body: {
          productId: product?.id,
          orderBumpIds: selectedOrderBumps,
          couponCode: couponBlockedByBump ? null : (appliedCoupon?.code || couponCode || null),
          customerName,
          customerEmail,
          customerPhone: customerPhone.replace(/\D/g, '') || null,
          customerCpf: paymentGateway === 'mercadopago' ? customerCpf.replace(/\D/g, '') : null,
          paymentGateway,
          currency,
        },
      });

      if (createOrderError) throw createOrderError;
      if (!orderData?.orderId) throw new Error('Falha ao criar pedido');

      trackEvent('order_created', {
        slug,
        product_id: product?.id,
        order_id: orderData.orderId,
        payment_gateway: paymentGateway,
        currency,
      });

      const { data: paymentData, error: paymentError } = await supabase.functions.invoke('gateway-process-payment', {
        body: {
          orderId: orderData.orderId,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (productError || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Produto não encontrado</h1>
          <p className="text-muted-foreground mb-8">O produto que você está procurando não existe ou foi removido.</p>
          <Button onClick={() => navigate('/catalogo')} size="lg">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Ver catálogo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Countdown Banner */}
      {checkoutSettings?.countdown_enabled && countdown !== null && countdown > 0 && (
        <div className="bg-green-600 text-white py-3 px-4 sticky top-0 z-20">
          <div className="container mx-auto flex items-center justify-center gap-4">
            <Timer className="h-5 w-5 animate-pulse" />
            <span className="text-sm sm:text-base font-medium">
              {checkoutSettings.countdown_message || 'Complete sua compra antes do contador chegar a zero!'}
            </span>
            <div className="font-mono text-xl sm:text-2xl font-bold tabular-nums">
              {formatCountdown(countdown)}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`border-b border-border/50 bg-card/50 backdrop-blur-sm sticky ${checkoutSettings?.countdown_enabled && countdown && countdown > 0 ? 'top-[52px]' : 'top-0'} z-10`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Checkout Seguro</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-green-500" />
              <span className="hidden sm:inline">Compra 100% segura</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 lg:py-12">
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column - Form */}
            <div className="lg:col-span-7 space-y-6">
              {/* Product Card */}
              <section className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex gap-5">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-28 h-28 object-cover rounded-xl flex-shrink-0"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-muted rounded-xl flex items-center justify-center flex-shrink-0">
                      <Package className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-bold text-foreground mb-1">{product.name}</h2>
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{product.description}</p>
                    )}
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(product.price_brl, product.price_usd)}
                    </p>
                  </div>
                </div>
              </section>

              {/* ORDER BUMPS - Now more prominent and higher up */}
              {orderBumps.length > 0 && (
                <section className="rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 relative overflow-hidden">
                  {/* Decorative badge */}
                  <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl">
                    OFERTA ESPECIAL
                  </div>
                  
                  <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                    <span className="text-2xl">🔥</span>
                    Aproveite! Oferta por tempo limitado
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">Adicione ao seu pedido com desconto exclusivo</p>
                  
                  <div className="space-y-3">
                    {orderBumps.map((bump) => {
                      const isSelected = selectedOrderBumps.includes(bump.id);
                      const toggle = () => {
                        const nowSelected = !isSelected;
                        setSelectedOrderBumps((prev) =>
                          prev.includes(bump.id)
                            ? prev.filter((id) => id !== bump.id)
                            : [...prev, bump.id]
                        );
                        trackEvent(nowSelected ? 'order_bump_selected' : 'order_bump_unselected', {
                          slug,
                          product_id: product?.id,
                          order_bump_id: bump.id,
                        });
                      };

                      return (
                        <div
                          key={bump.id}
                          role="button"
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle();
                            }
                          }}
                          className={`w-full text-left p-4 rounded-xl border-2 cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background ${
                            isSelected
                              ? "border-primary bg-primary/20 shadow-lg shadow-primary/20"
                              : "border-border bg-card hover:border-primary/50 hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              aria-hidden="true"
                              className={`mt-0.5 h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${
                                isSelected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-muted-foreground/50 bg-background"
                              }`}
                            >
                              {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="font-bold text-foreground">{bump.title}</span>
                                <span className="font-bold text-lg text-primary whitespace-nowrap">
                                  +{formatPrice(bump.price_brl, bump.price_usd)}
                                </span>
                              </div>
                              {bump.description && (
                                <p className="text-sm text-muted-foreground">{bump.description}</p>
                              )}
                              {!bump.allow_coupon && (
                                <p className="text-xs text-amber-600 mt-1">⚠️ Esta oferta não aceita cupom</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Payment Method - Only show if at least one gateway is enabled */}
              {availableGateways.length > 0 && (
                <section className="rounded-2xl border border-border/50 bg-card p-6">
                  <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">1</div>
                    Forma de pagamento
                  </h3>
                  
                  {/* If only one gateway, just show it selected without radio */}
                  {availableGateways.length === 1 ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-primary bg-primary/5">
                      <CreditCard className="h-8 w-8 text-primary" />
                      <div className="flex-1">
                        <p className="font-semibold">
                          {availableGateways[0] === 'mercadopago' ? 'Mercado Pago' : 'Stripe'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {availableGateways[0] === 'mercadopago' ? 'Pix, Cartão, Boleto' : 'Cartão Internacional'}
                        </p>
                      </div>
                      <div className="bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    </div>
                  ) : (
                    <RadioGroup
                      value={paymentGateway || ''}
                      onValueChange={(v) => setPaymentGateway(v as 'stripe' | 'mercadopago')}
                      className="grid grid-cols-2 gap-3"
                    >
                      {mercadopagoEnabled && (
                        <label 
                          htmlFor="mercadopago"
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                            paymentGateway === 'mercadopago' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="mercadopago" id="mercadopago" className="sr-only" />
                          <CreditCard className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-semibold text-sm">Mercado Pago</p>
                            <p className="text-xs text-muted-foreground">Pix, Cartão, Boleto</p>
                          </div>
                          {paymentGateway === 'mercadopago' && (
                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </label>
                      )}
                      {stripeEnabled && (
                        <label 
                          htmlFor="stripe"
                          className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all text-center ${
                            paymentGateway === 'stripe' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <RadioGroupItem value="stripe" id="stripe" className="sr-only" />
                          <CreditCard className="h-8 w-8 text-primary" />
                          <div>
                            <p className="font-semibold text-sm">Stripe</p>
                            <p className="text-xs text-muted-foreground">Cartão Internacional</p>
                          </div>
                          {paymentGateway === 'stripe' && (
                            <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-0.5">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </label>
                      )}
                    </RadioGroup>
                  )}
                </section>
              )}

              {/* Warning if no gateway is enabled - only show after data has loaded */}
              {!gatewayLoading && availableGateways.length === 0 && gatewaySettings && (
                <section className="rounded-2xl border-2 border-destructive/50 bg-destructive/10 p-6">
                  <div className="flex items-center gap-3 text-destructive">
                    <AlertTriangle className="h-6 w-6" />
                    <p className="font-medium">Nenhum método de pagamento disponível no momento.</p>
                  </div>
                </section>
              )}

              {/* Customer Info - NOW STEP 2 */}
              <section className="rounded-2xl border border-border/50 bg-card p-6">
                <h3 className="text-lg font-semibold mb-5 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">2</div>
                  Seus dados
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium">Nome completo</Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Digite seu nome"
                      className="mt-1.5 h-12"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="mt-1.5 h-12"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className="text-sm font-medium">
                        Telefone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(formatPhoneBR(e.target.value))}
                        placeholder="(00) 00000-0000"
                        required
                        className="mt-1.5 h-12"
                        maxLength={15}
                      />
                    </div>
                    {/* CPF Field - Only for Mercado Pago */}
                    {paymentGateway === 'mercadopago' && (
                      <div>
                        <Label htmlFor="cpf" className="text-sm font-medium">
                          CPF <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="cpf"
                          type="text"
                          inputMode="numeric"
                          value={customerCpf}
                          onChange={(e) => setCustomerCpf(formatCPF(e.target.value))}
                          placeholder="000.000.000-00"
                          required
                          className="mt-1.5 h-12"
                          maxLength={14}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Dados necessários para aprovação do pagamento</p>
                </div>
              </section>

              {/* Submit Button - At the bottom of the form */}
              <section className="rounded-2xl border border-border/50 bg-card p-6">
                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700"
                  disabled={isProcessing || availableGateways.length === 0}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5 mr-2" />
                      Finalizar Pedido
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-muted-foreground mt-3">
                  Ao finalizar, você concorda com nossos termos de uso e política de privacidade
                </p>
              </section>
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <div className="rounded-2xl border border-border/50 bg-card p-6">
                  <h3 className="text-lg font-semibold mb-5">Resumo do pedido</h3>
                  
                  {/* Currency is automatic based on the payment method */}
                  <div className="mb-5 rounded-lg bg-muted/50 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">Moeda:</span>{" "}
                    <span className="font-semibold text-foreground">{currency === 'BRL' ? 'BRL (R$)' : 'USD ($)'}</span>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-3 py-4 border-y border-border/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{product.name}</span>
                      <span className="font-medium">{formatPrice(product.price_brl, product.price_usd)}</span>
                    </div>
                    {orderBumps
                      .filter(ob => selectedOrderBumps.includes(ob.id))
                      .map(ob => (
                        <div key={ob.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{ob.name}</span>
                          <span className="font-medium text-primary">+{formatPrice(ob.price_brl, ob.price_usd)}</span>
                        </div>
                      ))}
                  </div>

                  {/* Coupon */}
                  <div className="py-4 border-b border-border/50">
                    {couponBlockedByBump && (
                      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 text-sm">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Cupom bloqueado: uma das ofertas selecionadas não permite desconto.</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Cupom de desconto"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          disabled={!!appliedCoupon || couponBlockedByBump}
                          className="pl-10 h-11"
                        />
                      </div>
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
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
                          variant="secondary"
                          onClick={applyCoupon}
                          className="h-11"
                          disabled={couponBlockedByBump}
                        >
                          Aplicar
                        </Button>
                      )}
                    </div>
                    {appliedCoupon && !couponBlockedByBump && (
                      <div className="flex justify-between text-sm mt-3 text-green-500">
                        <span className="flex items-center gap-1.5">
                          <Check className="h-4 w-4" />
                          Desconto ({appliedCoupon.code})
                        </span>
                        <span className="font-medium">
                          -{currency === 'BRL' 
                            ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(discountAmount)
                            : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(discountAmount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center py-4">
                    <span className="text-lg font-semibold">Total</span>
                    <span className="text-2xl font-bold text-primary">
                      {currency === 'BRL'
                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)
                        : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}
                    </span>
                  </div>

                  {/* Trust Badges */}
                  <div className="mt-5 pt-5 border-t border-border/50">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span>Pagamento 100% seguro e criptografado</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
