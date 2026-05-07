import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, format, model, count = 1, referenceImage = null } = await req.json();

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

    for (let i = 0; i < Math.min(count, variations.length); i++) {
      const styleHint = variations[i].style;
      const fullPrompt = `${prompt}. Style: ${styleHint}. Aspect ratio: ${aspect_ratio}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        },
        body: JSON.stringify({
          model: model || "gemini-2.0-flash-exp",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: fullPrompt },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      if (response.status === 402) {
        throw new Error("Insufficient credits for image generation.");
      }
      if (!response.ok) {
        const errorText = await response.text();
        console.error("AI Gateway error:", errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      const image_url = data.choices[0]?.message?.images?.[0]?.image_url?.url;

      if (!image_url) {
        throw new Error("No image generated in response");
      }

      // Extract base64
      const base64Data = image_url.split(",")[1];
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
