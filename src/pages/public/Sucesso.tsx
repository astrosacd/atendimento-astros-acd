import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function Sucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (sessionId) {
        try {
          const { data, error } = await supabase.functions.invoke('gateway-verify-payment', {
            body: { sessionId }
          });

          console.log('Verification result:', data, error);
          
          if (data?.success) {
            setVerified(true);
          }
        } catch (err) {
          console.error('Error verifying payment:', err);
        }
      }
      
      setIsVerifying(false);
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          {isVerifying ? (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Verificando Pagamento...
              </h1>
              <p className="text-muted-foreground mb-6">
                Aguarde enquanto confirmamos seu pagamento.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Compra Realizada!
              </h1>
              
              <p className="text-muted-foreground mb-6">
                Obrigado pela sua compra! Você receberá uma confirmação por WhatsApp e/ou email em breve.
              </p>

              <Button
                variant="outline"
                onClick={() => navigate('/catalogo')}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao Catálogo
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}