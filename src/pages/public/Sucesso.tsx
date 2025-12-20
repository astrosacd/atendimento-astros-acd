import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowLeft } from 'lucide-react';

export default function Sucesso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Compra Realizada!
          </h1>
          
          <p className="text-muted-foreground mb-6">
            Obrigado pela sua compra! Você receberá um email com os detalhes do seu pedido em breve.
          </p>

          <Button
            variant="outline"
            onClick={() => navigate('/catalogo')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Catálogo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
