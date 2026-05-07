import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldCheck, X, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';

export function PaymentSecurityAlertBanner() {
  const navigate = useNavigate();
  const { canViewPaymentSecurity } = usePermissions();
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!canViewPaymentSecurity()) {
      setIsLoading(false);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const { count, error } = await supabase
          .from('client_payments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_approval');
        
        if (!error) {
          setPendingCount(count || 0);
        }
      } catch (err) {
        console.error('Error fetching pending payments:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPendingCount();

    // Subscribe to changes in client_payments
    const channel = supabase
      .channel('payment-security-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'client_payments' },
        () => fetchPendingCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canViewPaymentSecurity]);

  if (!canViewPaymentSecurity() || isLoading || pendingCount === 0 || dismissed) {
    return null;
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5 dark:bg-destructive/10 animate-in fade-in slide-in-from-top-4 duration-500 mb-6 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-center">
          <div className="flex-shrink-0 bg-destructive/10 p-4 self-stretch flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-destructive animate-pulse" />
          </div>
          
          <div className="flex-1 py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-destructive flex items-center gap-2">
                  Segurança de Pagamento
                </h4>
                <p className="text-sm text-muted-foreground">
                  Existem <span className="font-bold text-destructive">{pendingCount}</span> pagamento(s) aguardando sua análise e aprovação manual.
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 font-semibold shadow-sm hover:shadow-md transition-all"
                  onClick={() => navigate('/admin/seguranca-pagamento')}
                >
                  Analisar Agora
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDismissed(true)}
                  title="Ocultar alerta"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
