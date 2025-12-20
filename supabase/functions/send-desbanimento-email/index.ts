import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  email: string;
  nome: string;
  numero: string;
  imageBase64: string;
  imageType: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: EmailRequest = await req.json();
    const { email, nome, numero, imageBase64, imageType } = body;

    // Validate required fields
    if (!email || !numero || !imageBase64) {
      console.error('Missing required fields');
      return new Response(
        JSON.stringify({ success: false, error: 'Email, número e imagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch email config
    const { data: configData, error: configError } = await supabase
      .from('consulta_numeros_config')
      .select('config_key, config_value')
      .in('config_key', [
        'email_gmail_user',
        'email_gmail_app_password',
        'email_subject_template',
        'email_body_template',
        'email_enabled'
      ]);

    if (configError) {
      console.error('Config fetch error:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao carregar configurações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config: Record<string, string> = {};
    configData?.forEach(item => {
      config[item.config_key] = item.config_value;
    });

    // Check if email is enabled
    if (config.email_enabled !== 'true') {
      console.log('Email sending is disabled');
      return new Response(
        JSON.stringify({ success: false, error: 'Envio de email está desabilitado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check Gmail credentials
    const gmailUser = config.email_gmail_user;
    const gmailPassword = config.email_gmail_app_password;

    if (!gmailUser || !gmailPassword) {
      console.error('Gmail credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais do Gmail não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process templates with variables
    const clientName = nome || 'Cliente';
    const clientNumber = numero;

    const subject = (config.email_subject_template || 'Número {{numero}} - Desbanimento Concluído')
      .replace(/\{\{numero\}\}/g, clientNumber)
      .replace(/\{\{nome\}\}/g, clientName);

    const bodyText = (config.email_body_template || 'Olá {{nome}},\n\nSeu número {{numero}} foi desbanido com sucesso!')
      .replace(/\{\{numero\}\}/g, clientNumber)
      .replace(/\{\{nome\}\}/g, clientName);

    // Create MIME email with attachment
    const boundary = '----=_Part_' + Date.now().toString(36);
    const mimeType = imageType || 'image/png';
    const fileName = `desbanimento_${clientNumber}.${mimeType.split('/')[1] || 'png'}`;

    const emailLines = [
      `From: ${gmailUser}`,
      `To: ${email}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      btoa(unescape(encodeURIComponent(bodyText))),
      '',
      `--${boundary}`,
      `Content-Type: ${mimeType}; name="${fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${fileName}"`,
      '',
      imageBase64,
      '',
      `--${boundary}--`,
    ];

    const rawEmail = emailLines.join('\r\n');
    const encodedEmail = btoa(rawEmail)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Get OAuth2 access token using Gmail App Password via SMTP relay
    // Actually, for Gmail with App Password, we use the Gmail API with basic auth
    // Let's use the Gmail SMTP relay instead

    // Send using nodemailer approach via SMTP
    // Since we can't use nodemailer in Deno, we'll use the Gmail API
    
    // For App Password, we need to use SMTP which is complex in Deno
    // Let's use an alternative approach with the fetch API to Gmail's SMTP relay

    // Using Gmail SMTP2GO or similar service would be easier
    // But for simplicity, let's try using a basic SMTP approach

    // Actually, the simplest way is to use a service like Resend or SendGrid
    // But since user wants Gmail specifically, let's use the Gmail API approach

    // For Gmail App Password, we need to encode credentials for Basic Auth
    // and use the Gmail SMTP relay

    // Let's use the SMTP approach with Deno
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    try {
      // Connect to Gmail SMTP
      const conn = await Deno.connectTls({
        hostname: 'smtp.gmail.com',
        port: 465,
      });

      // Helper to read response
      const readResponse = async (): Promise<string> => {
        const buf = new Uint8Array(1024);
        const n = await conn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : '';
      };

      // Helper to send command
      const sendCommand = async (cmd: string): Promise<string> => {
        await conn.write(encoder.encode(cmd + '\r\n'));
        return await readResponse();
      };

      // Read initial greeting
      await readResponse();

      // EHLO
      await sendCommand(`EHLO localhost`);

      // AUTH LOGIN
      await sendCommand('AUTH LOGIN');
      await sendCommand(btoa(gmailUser));
      const authResult = await sendCommand(btoa(gmailPassword));

      if (!authResult.startsWith('235')) {
        console.error('SMTP Auth failed:', authResult);
        conn.close();
        return new Response(
          JSON.stringify({ success: false, error: 'Falha na autenticação do Gmail. Verifique as credenciais.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // MAIL FROM
      await sendCommand(`MAIL FROM:<${gmailUser}>`);

      // RCPT TO
      await sendCommand(`RCPT TO:<${email}>`);

      // DATA
      await sendCommand('DATA');

      // Send email content
      await conn.write(encoder.encode(rawEmail + '\r\n.\r\n'));
      await readResponse();

      // QUIT
      await sendCommand('QUIT');
      conn.close();

      console.log('Email sent successfully to:', email);

      return new Response(
        JSON.stringify({ success: true, message: 'Email enviado com sucesso!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (smtpError: any) {
      console.error('SMTP Error:', smtpError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Erro ao conectar com o servidor de email. Verifique as credenciais do Gmail.' 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in send-desbanimento-email:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno ao enviar email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);
