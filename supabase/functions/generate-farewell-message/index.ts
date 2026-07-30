import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-temp-access-token',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const { groupName, motivo, clienteName } = await req.json();

    const prompt = `Gere uma mensagem de encerramento de projeto profissional e cordial para um grupo de WhatsApp.

Contexto:
- Nome do grupo: ${groupName || 'N/A'}
- Serviço prestado: ${motivo || 'N/A'}
- Nome do cliente: ${clienteName || 'N/A'}

A mensagem deve:
- Agradecer pelo tempo de parceria e confiança
- Mencionar o serviço prestado de forma natural
- Ser cordial e profissional
- Ter no máximo 500 caracteres
- Informar que o grupo será encerrado
- NÃO usar markdown, apenas texto simples com emojis
- Ser em português brasileiro`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'Você é um assistente que gera mensagens profissionais de encerramento de projetos. Responda apenas com a mensagem, sem explicações.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      throw new Error('Erro ao gerar mensagem com IA');
    }

    const data = await response.json();
    const generatedMessage = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ success: true, message: generatedMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error generating farewell message:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
