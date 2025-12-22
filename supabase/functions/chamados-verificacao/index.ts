import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { action, email, codigo } = body;
    
    if (action === 'send') {
      // Send verification code
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Check if email has any tickets
      const { data: tickets } = await supabase
        .from('chamados')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .limit(1);
      
      if (!tickets?.length) {
        return new Response(JSON.stringify({ error: 'Nenhum chamado encontrado para este email' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Get expiry time config
      const { data: configData } = await supabase
        .from('chamados_config')
        .select('config_value')
        .eq('config_key', 'verification_code_expiry_minutes')
        .single();
      
      const expiryMinutes = parseInt(configData?.config_value || '5');
      const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
      
      const verificationCode = generateVerificationCode();
      
      // Invalidate old codes
      await supabase
        .from('chamados_codigos_verificacao')
        .update({ used: true })
        .eq('email', email.toLowerCase().trim())
        .eq('used', false);
      
      // Create new code
      await supabase.from('chamados_codigos_verificacao').insert({
        email: email.toLowerCase().trim(),
        codigo: verificationCode,
        expires_at: expiresAt.toISOString(),
      });
      
      // TODO: Send email with verification code
      // For now, log it (in production, integrate with Resend)
      console.log(`Verification code for ${email}: ${verificationCode}`);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Código de verificação enviado para seu email',
        expires_in_minutes: expiryMinutes,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'verify') {
      // Verify code and return tickets
      if (!email || !codigo) {
        return new Response(JSON.stringify({ error: 'Email e código são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { data: codeData } = await supabase
        .from('chamados_codigos_verificacao')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .eq('codigo', codigo)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!codeData) {
        return new Response(JSON.stringify({ error: 'Código inválido ou expirado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Mark code as used
      await supabase
        .from('chamados_codigos_verificacao')
        .update({ used: true })
        .eq('id', codeData.id);
      
      // Get user tickets
      const { data: tickets } = await supabase
        .from('chamados')
        .select(`
          id, codigo, nome, email, contato, motivo, status, prioridade, hash_acesso, created_at, updated_at, closed_at,
          chamados_comentarios(id, autor_nome, tipo, conteudo, created_at)
        `)
        .eq('email', email.toLowerCase().trim())
        .order('created_at', { ascending: false });
      
      // Filter comments to only public ones
      const ticketsFiltered = tickets?.map(t => ({
        ...t,
        chamados_comentarios: t.chamados_comentarios?.filter((c: any) => c.tipo === 'publico'),
      }));
      
      return new Response(JSON.stringify({ 
        success: true,
        chamados: ticketsFiltered,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (err) {
    console.error('Verification Error:', err);
    return new Response(JSON.stringify({ error: 'Erro interno do servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
