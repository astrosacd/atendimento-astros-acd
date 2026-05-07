import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_IMAGE_MODELS = new Set([
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image-preview",
  "google/gemini-3.1-flash-image-preview",
]);

const DEFAULT_IMAGE_MODEL = "google/gemini-3.1-flash-image-preview";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, format, model, count = 1, referenceImage = null } = await req.json();

    if (typeof prompt !== "string" || prompt.trim().length < 5 || prompt.length > 1500) {
      return jsonResponse({ error: "Descreva a imagem com pelo menos 5 caracteres e no máximo 1500." }, 400);
    }

    const safeModel = typeof model === "string" && ALLOWED_IMAGE_MODELS.has(model)
      ? model
      : DEFAULT_IMAGE_MODEL;

    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 3);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const aspect_ratio = format === "stories" || format === "reels" ? "9:16" : "1:1";
    const variations = [
      { name: "Vibrante", style: "vibrant colors, high saturation, energetic lighting" },
      { name: "Minimalista", style: "minimalist, clean lines, plenty of whitespace, professional" },
      { name: "Cinematográfico", style: "cinematic lighting, shallow depth of field, dramatic atmosphere" }
    ];

    const results = [];

    for (let i = 0; i < Math.min(safeCount, variations.length); i++) {
      const styleHint = variations[i].style;
      const fullPrompt = referenceImage 
        ? `Use the attached reference image only as visual guidance. Create a new Instagram-ready image: ${prompt.trim()}. Keep it polished, readable, commercial, and do not copy private details unless explicitly requested. Style hint: ${styleHint}. Aspect ratio: ${aspect_ratio}`
        : `Create an Instagram-ready image: ${prompt.trim()}. Keep it polished, readable, commercial. Style: ${styleHint}. Aspect ratio: ${aspect_ratio}`;

      let messageContent: string | Array<Record<string, unknown>> = fullPrompt;
      
      if (referenceImage) {
        messageContent = [
          { type: "text", text: fullPrompt },
          { type: "image_url", image_url: { url: referenceImage } },
        ];
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: safeModel,
          messages: [
            {
              role: "user",
              content: messageContent,
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (response.status === 429) {
        throw new Error("Limite de IA excedido. Tente novamente em alguns instantes.");
      }
      if (response.status === 402) {
        throw new Error("Créditos insuficientes para gerar imagem com IA.");
      }
      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", errorText);
        throw new Error(`A IA não conseguiu gerar a imagem agora. Código: ${response.status}`);
      }

      const data = await response.json();
      const image_url = data.choices[0]?.message?.images?.[0]?.image_url?.url;

      if (!image_url) {
        throw new Error("A IA não retornou uma imagem. Tente ajustar a descrição.");
      }

      // Extract base64
      const base64Data = image_url.includes(",") ? image_url.split(",")[1] : image_url;
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

      const fileName = `${user.id}/${Date.now()}-${i}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("instagram-media")
        .upload(fileName, binaryData, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from("instagram-media")
        .getPublicUrl(fileName);

      results.push({
        url: publicUrl,
        name: variations[i].name,
        style: styleHint
      });
    }

    return new Response(JSON.stringify({ images: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generate-image:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
