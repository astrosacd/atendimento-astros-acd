import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const TemporaryAccessHandler = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Token não fornecido");
        setLoading(false);
        return;
      }

      try {
        const usageKey = `temp_access_counted_${token}`;
        const alreadyCounted = !!localStorage.getItem(usageKey);

        const { data, error: fetchError } = await supabase.rpc(
          "validate_temporary_access_token" as any,
          { p_token: token }
        );

        if (fetchError) throw fetchError;

        const result: any = data;
        if (!result || result.valid !== true) {
          const code = result?.error;
          if (code === "max_uses_reached") {
            setError("Este link atingiu o limite máximo de usos");
          } else {
            setError("Link inválido ou expirado");
          }
          setLoading(false);
          return;
        }

        if (!alreadyCounted) {
          localStorage.setItem(usageKey, "1");
        }

        localStorage.setItem("temp_access_token", token);
        localStorage.setItem("temp_access_target", result.target_path);
        navigate(result.target_path);
        
      } catch (err: any) {
        console.error("Error validating token:", err);
        setError("Erro interno ao validar acesso");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Validando seu acesso provisório...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center space-y-6">
        <div className="bg-red-100 p-6 rounded-full dark:bg-red-900/20">
          <AlertCircle className="h-16 w-16 text-red-600" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Acesso Negado</h1>
          <p className="text-xl text-muted-foreground max-w-md">{error}</p>
        </div>
        <Button onClick={() => navigate("/auth")} size="lg">
          Voltar para o Login
        </Button>
      </div>
    );
  }

  return null;
};

export default TemporaryAccessHandler;