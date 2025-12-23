import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

// Compat: some SMTP libs depend on Deno.writeAll (not available in Edge runtime)
// deno-lint-ignore no-explicit-any
if (!(Deno as any).writeAll) {
  // deno-lint-ignore no-explicit-any
  (Deno as any).writeAll = async (writer: any, data: Uint8Array) => {
    let offset = 0;
    while (offset < data.length) {
      offset += await writer.write(data.subarray(offset));
    }
  };
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send email using Gmail SMTP
async function sendEmailWithGmail(
  gmailUser: string,
  gmailPassword: string,
  senderName: string,
  recipientEmail: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  const client = new SmtpClient();
  
  try {
    await client.connectTLS({
      hostname: "smtp.gmail.com",
      port: 465,
      username: gmailUser,
      password: gmailPassword,
    });
    
    await client.send({
      from: `${senderName} <${gmailUser}>`,
      to: recipientEmail,
      subject: subject,
      content: "Visualize este email em um cliente com suporte a HTML",
      html: htmlContent,
    });
    
    await client.close();
    return true;
  } catch (error) {
    console.error("SMTP Error:", error);
    try {
      await client.close();
    } catch {}
    return false;
  }
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
    const { action, email, codigo, tipo } = body;
    
    if (action === 'send') {
      // Send verification code
      if (!email) {
        return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Se for consulta (tipo === 'consulta'), verificar se o email já tem chamados
      if (tipo === 'consulta') {
        const { data: existingTickets, error: ticketError } = await supabase
          .from('chamados')
          .select('id')
          .eq('email', email.toLowerCase().trim())
          .limit(1);
        
        if (ticketError || !existingTickets || existingTickets.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Nenhum chamado encontrado para este email' 
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Get SMTP config from chamados_config
      const { data: configRows } = await supabase
        .from('chamados_config')
        .select('config_key, config_value');
      
      const config: Record<string, string> = {};
      configRows?.forEach((row: any) => {
        config[row.config_key] = row.config_value;
      });
      
      const smtpEnabled = config['smtp_enabled'] === 'true';
      // Suporta as chaves usadas no painel (smtp_gmail_*) e também as antigas (gmail_*)
      const gmailUser = config['smtp_gmail_user'] || config['gmail_user'] || '';
      const gmailPassword = config['smtp_gmail_app_password'] || config['gmail_app_password'] || '';
      const senderName = config['smtp_sender_name'] || 'Sistema de Chamados';
      const expiryMinutes = parseInt(config['verification_code_expiry_minutes'] || '5');
      
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
      
      // Send email with verification code
      let emailSent = false;
      if (smtpEnabled && gmailUser && gmailPassword) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
          </head>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; text-align: center;">Código de Verificação</h1>
            </div>
            <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e9ecef; border-top: none;">
              <p style="color: #495057; font-size: 16px;">Olá,</p>
              <p style="color: #495057; font-size: 16px;">Seu código de verificação para acessar seus chamados é:</p>
              <div style="background: #e9ecef; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #495057;">${verificationCode}</span>
              </div>
              <p style="color: #6c757d; font-size: 14px;">Este código expira em <strong>${expiryMinutes} minutos</strong>.</p>
              <p style="color: #6c757d; font-size: 14px;">Se você não solicitou este código, ignore este email.</p>
              <hr style="border: none; border-top: 1px solid #e9ecef; margin: 20px 0;">
              <p style="color: #adb5bd; font-size: 12px; text-align: center;">Este é um email automático, não responda.</p>
            </div>
          </body>
          </html>
        `;
        
        emailSent = await sendEmailWithGmail(
          gmailUser,
          gmailPassword,
          senderName,
          email,
          `Código de Verificação: ${verificationCode}`,
          htmlContent
        );
        
        console.log(`Email ${emailSent ? 'sent' : 'failed'} to ${email} with code ${verificationCode}`);
      } else {
        console.log(`SMTP not configured. Code for ${email}: ${verificationCode}`);
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: emailSent 
          ? 'Código de verificação enviado para seu email' 
          : 'Código gerado (SMTP não configurado - verifique as configurações)',
        email_sent: emailSent,
        expires_in_minutes: expiryMinutes,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'verify') {
      // Verify code and return tickets
      if (!email || !codigo) {
        return new Response(JSON.stringify({ success: false, error: 'Email e código são obrigatórios' }), {
          status: 200,
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
        // Importante: retornar 200 para o frontend conseguir exibir a mensagem real (supabase.functions.invoke marca non-2xx como erro genérico)
        return new Response(JSON.stringify({ success: false, error: 'Código inválido ou expirado' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Delete code from database (one-time use)
      await supabase
        .from('chamados_codigos_verificacao')
        .delete()
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
