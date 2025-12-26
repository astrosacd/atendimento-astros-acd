import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowLeft, Loader2, MessageCircle, Sparkles, PartyPopper, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type SuccessPageSettings = {
  enabled?: boolean;
  title?: string;
  message?: string;
  instructions?: string;
  primary_button_text?: string;
  primary_button_path?: string;
  support_whatsapp_enabled?: boolean;
  support_whatsapp_number?: string;
  support_whatsapp_button_text?: string;
  support_whatsapp_message?: string;
};

type OrderBumpItem = {
  name: string;
  price: number;
};

type OrderSummary = {
  pedido?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  produto?: string;
  valor?: string;
  orderBumps?: OrderBumpItem[];
};

const applyVars = (text: string, vars: OrderSummary) => {
  return text
    .replace(/{pedido}/g, vars.pedido || '')
    .replace(/{nome}/g, vars.nome || '')
    .replace(/{email}/g, vars.email || '')
    .replace(/{telefone}/g, vars.telefone || '')
    .replace(/{produto}/g, vars.produto || '')
    .replace(/{valor}/g, vars.valor || '');
};

// Confetti animation component
const Confetti = () => {
  const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
  
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {[...Array(50)].map((_, i) => {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        const animationDelay = Math.random() * 3;
        const size = Math.random() * 8 + 4;
        
        return (
          <div
            key={i}
            className="absolute animate-confetti"
            style={{
              left: `${left}%`,
              top: '-20px',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${animationDelay}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          animation: confetti linear forwards;
        }
      `}</style>
    </div>
  );
};

export default function Sucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [successSettings, setSuccessSettings] = useState<SuccessPageSettings | null>(null);
  const [orderVars, setOrderVars] = useState<OrderSummary>({});
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');

      try {
        // Load success page settings (public endpoint to avoid permission issues)
        const { data: publicData } = await supabase.functions.invoke('gateway-public-settings');
        const loadedSettings = (publicData?.success_page || null) as SuccessPageSettings | null;
        setSuccessSettings(loadedSettings);

        if (sessionId) {
          const { data } = await supabase.functions.invoke('gateway-verify-payment', {
            body: { sessionId }
          });

          if (data?.success && (data?.status === 'paid' || data?.status === 'already_paid')) {
            setVerified(true);
            setShowConfetti(true);
            // Stop confetti after 5 seconds
            setTimeout(() => setShowConfetti(false), 5000);
          }

          const order = data?.order;
          if (order) {
            setOrderVars({
              pedido: order.id,
              nome: order.customer_name,
              email: order.customer_email,
              telefone: order.customer_phone || '',
              produto: order.product?.name || order.product_name || '',
              valor: typeof order.total === 'number' ? order.total.toFixed(2) : String(order.total || ''),
              orderBumps: order.order_bumps || [],
            });
          }
        } else {
          // No session ID, still show success animation
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5000);
        }
      } catch {
        // Ignore
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  const defaults: Required<SuccessPageSettings> = useMemo(() => ({
    enabled: true,
    title: 'Compra Realizada!',
    message: 'Obrigado pela sua compra! Você receberá uma confirmação por WhatsApp e/ou email em breve.',
    instructions: '',
    primary_button_text: 'Voltar ao Catálogo',
    primary_button_path: '/catalogo',
    support_whatsapp_enabled: false,
    support_whatsapp_number: '',
    support_whatsapp_button_text: 'Falar com Suporte no WhatsApp',
    support_whatsapp_message: 'Olá! Preciso de ajuda com meu pedido {pedido}.\n\nNome: {nome}\nEmail: {email}\nProduto: {produto}\nValor: {valor}\nTelefone: {telefone}'
  }), []);

  const resolved = {
    ...defaults,
    ...(successSettings || {})
  };

  useEffect(() => {
    document.title = resolved.title.length 
      ? `${resolved.title} | Checkout`
      : 'Compra realizada | Checkout';
  }, [resolved.title]);

  const finalTitle = resolved.enabled ? applyVars(resolved.title, orderVars) : defaults.title;
  const finalMessage = resolved.enabled ? applyVars(resolved.message, orderVars) : defaults.message;
  const finalInstructions = resolved.enabled ? applyVars(resolved.instructions || '', orderVars) : '';
  const buttonText = resolved.enabled ? applyVars(resolved.primary_button_text, orderVars) : defaults.primary_button_text;
  const buttonPath = resolved.enabled ? applyVars(resolved.primary_button_path, orderVars) : defaults.primary_button_path;

  // WhatsApp support is independent of the "enabled" flag for general customization
  const supportEnabled = !!resolved.support_whatsapp_enabled;
  const supportNumberRaw = String(resolved.support_whatsapp_number || '');
  const supportNumber = supportNumberRaw.replace(/\D/g, '');
  const supportButtonText = applyVars(resolved.support_whatsapp_button_text || defaults.support_whatsapp_button_text, orderVars);
  const supportMessage = applyVars(resolved.support_whatsapp_message || defaults.support_whatsapp_message, orderVars);
  const supportUrl = supportNumber ? `https://wa.me/${supportNumber}?text=${encodeURIComponent(supportMessage)}` : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-green-500/5 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {showConfetti && <Confetti />}

      <Card className="max-w-lg w-full relative z-10 border-border/30 bg-gradient-to-br from-card to-card/80 shadow-2xl animate-scale-in overflow-hidden">
        {/* Top decoration */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-green-500 via-emerald-500 to-green-400" />
        
        <CardContent className="pt-10 pb-10 px-8 text-center">
          {isVerifying ? (
            <div className="animate-fade-in">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
                <div className="absolute inset-2 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verificando Pagamento...</h1>
              <p className="text-muted-foreground">Aguarde enquanto confirmamos seu pagamento.</p>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Success icon with celebration */}
              <div className="relative w-28 h-28 mx-auto mb-6">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/30 to-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/10" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 shadow-lg shadow-green-500/30 flex items-center justify-center">
                  <CheckCircle2 className="h-14 w-14 text-white drop-shadow-md" />
                </div>
                {/* Floating celebration icons */}
                <PartyPopper className="absolute -top-2 -right-2 h-8 w-8 text-yellow-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                <Gift className="absolute -bottom-1 -left-2 h-7 w-7 text-pink-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>

              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-3">
                {finalTitle}
              </h1>

              <p className="text-muted-foreground mb-6 text-lg leading-relaxed">{finalMessage}</p>

              {finalInstructions ? (
                <div className="text-left rounded-xl border border-border/50 bg-gradient-to-br from-muted/50 to-muted/30 p-5 mb-6 shadow-inner">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{finalInstructions}</p>
                </div>
              ) : null}

              {/* Order Bumps display */}
              {orderVars.orderBumps && orderVars.orderBumps.length > 0 && (
                <div className="text-left rounded-xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5 p-5 mb-6 shadow-md">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="h-4 w-4 text-green-500" />
                    <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">
                      {orderVars.orderBumps.length === 1 ? 'Adicional Incluído' : 'Adicionais Incluídos'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {orderVars.orderBumps.map((ob, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-background/50 rounded-lg p-3">
                        <p className="text-sm font-medium text-foreground">{ob.name}</p>
                        <p className="text-sm font-semibold text-green-600">+ R$ {ob.price.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate(buttonPath)}
                  className="gap-2 h-12 px-6 shadow-md hover:shadow-lg transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {buttonText}
                </Button>

                {supportEnabled && supportUrl ? (
                  <Button asChild className="gap-2 h-12 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all">
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      {supportButtonText}
                    </a>
                  </Button>
                ) : null}
              </div>

              {/* Trust message */}
              <p className="text-xs text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                Obrigado por confiar em nós!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
