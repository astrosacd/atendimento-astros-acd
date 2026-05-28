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
        const { data, error: fetchError } = await supabase
          .from("temporary_access_tokens")
          .select("*")
          .eq("token", token)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!data) {
          setError("Link inválido ou expirado");
          setLoading(false);
          return;
        }

        if (data.max_uses !== null && data.uses >= data.max_uses) {
          setError("Este link atingiu o limite máximo de usos");
          setLoading(false);
          return;
        }

        // Conta como 1 uso por dispositivo/navegador (evita contar múltiplas abas)
        const usageKey = `temp_access_counted_${token}`;
        if (!localStorage.getItem(usageKey)) {
          await supabase
            .from("temporary_access_tokens")
            .update({ uses: data.uses + 1 })
            .eq("id", data.id);
          localStorage.setItem(usageKey, "1");
        }

        // Store the temporary bypass in session storage or similar
        // For now, since RLS is handled by service role in specific logic or public read,
        // we'll redirect to the target path with the token in state or similar.
        // A better approach would be to sign in as a specific guest user or use a specific header.
        // But the user asked for a "provisional link", so we'll redirect them.
        
        localStorage.setItem("temp_access_token", token);
        localStorage.setItem("temp_access_target", data.target_path);
        navigate(data.target_path);
        
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