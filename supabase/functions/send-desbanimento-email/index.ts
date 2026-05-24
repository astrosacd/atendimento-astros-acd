import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

interface EmailRequest {
  email: string;
  nome: string;
  numero: string;
  imageBase64: string;
  imageName: string;
  imageType: string;
}

// SECURITY: Sanitize PII from log messages
const sanitizePII = (text: string): string => {
  return text
    .replace(/[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '[CPF]')
    .replace(/\b\d{11}\b/g, '[CPF]')
    .replace(/\b\d{10,11}\b/g, '[PHONE]');
};

serve(async (req) => {
  const startTime = Date.now();
  console.log("[send-desbanimento-email] ========== INICIANDO PROCESSAMENTO ==========");
  console.log("[send-desbanimento-email] Timestamp:", new Date().toISOString());
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[send-desbanimento-email] Requisição OPTIONS (CORS preflight)");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[send-desbanimento-email] ERRO: Header de autorização ausente");
      throw new Error("Não autorizado");
    }
    console.log("[send-desbanimento-email] Autorização verificada");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("[send-desbanimento-email] Cliente Supabase inicializado");

    // Get email config from consulta_numeros_config
    console.log("[send-desbanimento-email] Buscando configurações de email...");
    const { data: configs, error: configError } = await supabase
      .from("consulta_numeros_config")
      .select("config_key, config_value");

    if (configError) {
      console.error("[send-desbanimento-email] ERRO ao buscar configurações:", configError);
      throw new Error("Erro ao buscar configurações");
    }

    const configMap: Record<string, string> = {};
    configs?.forEach((c: { config_key: string; config_value: string }) => {
      configMap[c.config_key] = c.config_value;
    });
    console.log("[send-desbanimento-email] Configurações carregadas:", Object.keys(configMap).join(", "));

    // Check if email is enabled
    if (configMap["email_enabled"] !== "true") {
      console.log("[send-desbanimento-email] Email desativado nas configurações - pulando envio");
      return new Response(
        JSON.stringify({ success: true, message: "Email desativado nas configurações" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const gmailUser = configMap["email_gmail_user"];
    const gmailAppPassword = configMap["email_gmail_app_password"];

    if (!gmailUser || !gmailAppPassword) {
      console.error("[send-desbanimento-email] ERRO: Credenciais de email não configuradas");
      console.error("[send-desbanimento-email] Gmail User presente:", !!gmailUser);
      console.error("[send-desbanimento-email] Gmail App Password presente:", !!gmailAppPassword);
      throw new Error("Credenciais de email não configuradas. Configure em Configurações > Email.");
    }

    console.log("[send-desbanimento-email] Usando Gmail:", gmailUser);

    // Parse request body
    const body: EmailRequest = await req.json();
    const { email, nome, numero, imageBase64, imageName, imageType } = body;
    
    console.log("[send-desbanimento-email] Dados recebidos:");
    console.log("[send-desbanimento-email]   - Email destino:", sanitizePII(email || ''));
    console.log("[send-desbanimento-email]   - Nome: [REDACTED]");
    console.log("[send-desbanimento-email]   - Número:", sanitizePII(numero || ''));
    console.log("[send-desbanimento-email]   - Nome do arquivo:", imageName);
    console.log("[send-desbanimento-email]   - Tipo da imagem:", imageType);
    console.log("[send-desbanimento-email]   - Tamanho do base64:", imageBase64 ? `${(imageBase64.length / 1024).toFixed(2)} KB` : "N/A");

    if (!email || !imageBase64) {
      console.error("[send-desbanimento-email] ERRO: Dados obrigatórios ausentes");
      console.error("[send-desbanimento-email]   - Email presente:", !!email);
      console.error("[send-desbanimento-email]   - Imagem presente:", !!imageBase64);
      throw new Error("Email e imagem são obrigatórios");
    }

    // Get email templates
    let subject = configMap["email_subject_template"] || "Desbanimento - {{numero}}";
    let htmlBody = configMap["email_body_template"] || 
      "<p>Olá {{nome}},</p><p>Seu número {{numero}} foi desbanido com sucesso.</p>";

    // Replace variables
    subject = subject.replace(/\{\{numero\}\}/g, numero || "").replace(/\{\{nome\}\}/g, nome || "");
    htmlBody = htmlBody.replace(/\{\{numero\}\}/g, numero || "").replace(/\{\{nome\}\}/g, nome || "");

    console.log("[send-desbanimento-email] Template de email preparado:");
    console.log("[send-desbanimento-email]   - Assunto:", subject);

    // Create SMTP client
    console.log("[send-desbanimento-email] Criando cliente SMTP...");
    console.log("[send-desbanimento-email]   - Servidor: smtp.gmail.com:465");
    
    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailUser,
          password: gmailAppPassword,
        },
      },
    });
    console.log("[send-desbanimento-email] Cliente SMTP criado com sucesso");

    // Decode base64 image
    console.log("[send-desbanimento-email] Decodificando imagem base64...");
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    console.log("[send-desbanimento-email] Imagem decodificada:", `${(imageBytes.length / 1024).toFixed(2)} KB`);

    // Send email with attachment
    console.log("[send-desbanimento-email] Enviando email...");
    const sendStartTime = Date.now();
    
    await client.send({
      from: gmailUser,
      to: email,
      subject: subject,
      content: "Veja o anexo para mais informações.",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0;">Desbanimento Concluído</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
    ${htmlBody}
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      <strong>Confira o comprovante em anexo.</strong>
    </p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
    <p style="font-size: 11px; color: #9ca3af; text-align: center;">Sistema de Consulta de Números</p>
  </div>
</body>
</html>
      `.trim(),
      attachments: [
        {
          filename: imageName || "comprovante.png",
          content: imageBytes,
          contentType: imageType || "image/png",
          encoding: "binary" as const,
        },
      ],
    });

    const sendDuration = Date.now() - sendStartTime;
    console.log("[send-desbanimento-email] Email enviado com sucesso!");
    console.log("[send-desbanimento-email]   - Tempo de envio:", `${sendDuration}ms`);

    await client.close();
    console.log("[send-desbanimento-email] Conexão SMTP fechada");

    const totalDuration = Date.now() - startTime;
    console.log("[send-desbanimento-email] ========== PROCESSAMENTO CONCLUÍDO ==========");
    console.log("[send-desbanimento-email] Resumo:");
    console.log("[send-desbanimento-email]   - Destinatário:", sanitizePII(email));
    console.log("[send-desbanimento-email]   - Nome: [REDACTED]");
    console.log("[send-desbanimento-email]   - Número:", sanitizePII(numero));
    console.log("[send-desbanimento-email]   - Tamanho do anexo:", `${(imageBytes.length / 1024).toFixed(2)} KB`);
    console.log("[send-desbanimento-email]   - Tempo total:", `${totalDuration}ms`);
    console.log("[send-desbanimento-email]   - Status: SUCESSO");

    // Get user info from the token
    let usuarioId: string | null = null;
    let usuarioEmail: string | null = null;
    try {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        usuarioId = user.id;
        usuarioEmail = user.email || null;
      }
    } catch (e) {
      console.log("[send-desbanimento-email] Não foi possível obter usuário do token");
    }

    // Log to consulta_numeros_history for audit
    console.log("[send-desbanimento-email] Registrando no histórico de auditoria...");
    const { error: historyError } = await supabase
      .from("consulta_numeros_history")
      .insert({
        numero: numero || "N/A",
        acao: "email_desbanimento",
        origem: "painel",
        usuario_id: usuarioId,
        usuario_email: usuarioEmail,
        dados_novos: {
          email_destino: email,
          nome_destinatario: nome,
          numero: numero,
          assunto: subject,
          anexo_tamanho_kb: (imageBytes.length / 1024).toFixed(2),
          enviado_em: new Date().toISOString(),
        },
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || null,
        user_agent: req.headers.get("user-agent") || null,
      });

    if (historyError) {
      console.error("[send-desbanimento-email] Erro ao registrar histórico:", historyError);
    } else {
      console.log("[send-desbanimento-email] Histórico registrado com sucesso");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    console.error("[send-desbanimento-email] ========== ERRO NO PROCESSAMENTO ==========");
    console.error("[send-desbanimento-email] Erro:", error.message);
    console.error("[send-desbanimento-email] Stack:", error.stack);
    console.error("[send-desbanimento-email] Tempo até o erro:", `${totalDuration}ms`);
    console.error("[send-desbanimento-email] Status: FALHA");
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
