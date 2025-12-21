import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowLeft, Loader2, MessageCircle } from 'lucide-react';
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

type OrderSummary = {
  pedido?: string;
  nome?: string;
  email?: string;
  telefone?: string;
  produto?: string;
  valor?: string;
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

export default function Sucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verified, setVerified] = useState(false);
  const [successSettings, setSuccessSettings] = useState<SuccessPageSettings | null>(null);
  const [orderVars, setOrderVars] = useState<OrderSummary>({});

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');

      try {
        // Load success page settings
        const { data: settingsRow } = await supabase
          .from('gateway_settings')
          .select('value')
          .eq('key', 'success_page')
          .maybeSingle();

        const loadedSettings = (settingsRow?.value || null) as SuccessPageSettings | null;
        setSuccessSettings(loadedSettings);

        if (sessionId) {
          const { data } = await supabase.functions.invoke('gateway-verify-payment', {
            body: { sessionId }
          });

          if (data?.success && (data?.status === 'paid' || data?.status === 'already_paid')) {
            setVerified(true);
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
            });
          }
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
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {isVerifying ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Verificando Pagamento...</h1>
              <p className="text-muted-foreground mb-6">Aguarde enquanto confirmamos seu pagamento.</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">{finalTitle}</h1>

              <p className="text-muted-foreground mb-4">{finalMessage}</p>

              {finalInstructions ? (
                <div className="text-left rounded-lg border border-border bg-muted/30 p-4 mb-6">
                  <p className="text-sm text-foreground whitespace-pre-wrap">{finalInstructions}</p>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row items-stretch justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => navigate(buttonPath)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {buttonText}
                </Button>

                {supportEnabled && supportUrl ? (
                  <Button asChild className="gap-2">
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="h-4 w-4" />
                      {supportButtonText}
                    </a>
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}