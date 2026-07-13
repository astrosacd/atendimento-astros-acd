import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

// Rate-limited fetch: retry até 3x em erros transitórios da Graph API
async function graphFetch(url: string, init: RequestInit = {}, attempts = 3): Promise<Response> {
  let lastErr: any = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 || res.status === 429) {
        lastErr = new Error(`HTTP ${res.status}`);
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw lastErr ?? new Error("graphFetch failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Ler body UMA vez só (fix bug: era consumido 2x)
  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }
  const postId: string | undefined = payload.postId;
  const internalSecret: string | undefined = payload.secret;

  const log = async (level: 'info' | 'success' | 'error', message: string) => {
    if (!postId) return;
    try {
      await supabase.from('post_logs').insert({
        post_id: postId,
        user_id: null,
        level,
        message,
      });
    } catch (e) {
      console.error("log insert failed:", e);
    }
  };

  const markFailed = async (msg: string) => {
    if (!postId) return;
    try {
      await supabase.from('posts')
        .update({ status: 'failed', error_message: msg.slice(0, 500) })
        .eq('id', postId);
      await log('error', msg);
    } catch (e) {
      console.error("markFailed error:", e);
    }
  };

  try {
    if (!postId) throw new Error("postId is required");

    // Auth: header do usuário OU internal secret (scheduler)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user) throw new Error("Unauthorized");
      userId = user.id;
    } else {
      const expectedSecret = Deno.env.get("INTERNAL_SECRET");
      if (!expectedSecret || internalSecret !== expectedSecret) {
        throw new Error("Unauthorized internal call");
      }
      const { data: postRow } = await supabase.from('posts').select('user_id').eq('id', postId).single();
      if (!postRow) throw new Error("Post not found");
      userId = postRow.user_id;
    }

    // 1. Fetch post + settings
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();
    if (postError || !post) throw new Error("Post not found");

    // Só publica se estiver em estado válido (evita duplo processamento)
    if (!['scheduled', 'draft', 'failed', 'publishing'].includes(post.status)) {
      return new Response(JSON.stringify({ skipped: true, status: post.status }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('instagram_settings')
      .select('*')
      .eq('user_id', userId!)
      .single();
    if (settingsError || !settings) throw new Error("Instagram settings not found");

    const accessToken = settings.access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) throw new Error("No Meta Access Token available");

    const graphHost = accessToken.startsWith("IGAA")
      ? "https://graph.instagram.com/v23.0"
      : "https://graph.facebook.com/v23.0";

    await supabase.from('posts').update({ status: 'publishing', error_message: null }).eq('id', postId);
    await log('info', `Iniciando publicação de ${post.type}...`);

    let creationId: string;

    // 2. Criação de container
    if (post.type === 'carousel') {
      const childrenIds: string[] = [];
      for (const url of post.media_urls) {
        const isVideo = /\.(mp4|mov)$/i.test(url);
        const containerParams = new URLSearchParams({
          access_token: accessToken,
          [isVideo ? 'video_url' : 'image_url']: url,
          is_carousel_item: 'true',
        });
        const res = await graphFetch(`${graphHost}/${settings.ig_user_id}/media?${containerParams}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(`Erro criando item do carrossel: ${data?.error?.message || JSON.stringify(data)}`);
        if (isVideo) await waitForProcessing(graphHost, data.id, accessToken, log);
        childrenIds.push(data.id);
      }
      const carouselParams = new URLSearchParams({
        access_token: accessToken,
        caption: post.caption || '',
        media_type: 'CAROUSEL',
        children: childrenIds.join(','),
      });
      const res = await graphFetch(`${graphHost}/${settings.ig_user_id}/media?${carouselParams}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(`Erro criando container do carrossel: ${data?.error?.message || JSON.stringify(data)}`);
      creationId = data.id;
    } else {
      const firstUrl = post.media_urls[0];
      const isVideo = post.type === 'reels' || post.type === 'stories' || /\.(mp4|mov)$/i.test(firstUrl || '');
      const mediaType = post.type === 'reels' ? 'REELS' : (post.type === 'stories' ? 'STORIES' : undefined);

      const containerParams = new URLSearchParams({
        access_token: accessToken,
        [isVideo ? 'video_url' : 'image_url']: firstUrl,
        caption: post.type === 'stories' ? '' : (post.caption || ''),
      });
      if (mediaType) containerParams.append('media_type', mediaType);

      const res = await graphFetch(`${graphHost}/${settings.ig_user_id}/media?${containerParams}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(`Erro criando container: ${data?.error?.message || JSON.stringify(data)}`);
      creationId = data.id;

      if (isVideo) await waitForProcessing(graphHost, creationId, accessToken, log);
    }

    await log('info', `Container criado (${creationId}). Publicando...`);

    // 3. Publish (com retry em MEDIA_ID_UNAVAILABLE)
    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: creationId,
    });
    let publishData: any = null;
    let published = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      const publishRes = await graphFetch(`${graphHost}/${settings.ig_user_id}/media_publish?${publishParams}`, { method: 'POST' });
      publishData = await publishRes.json();
      if (publishRes.ok) { published = true; break; }
      const errMsg = publishData?.error?.message || '';
      const errCode = publishData?.error?.code;
      // Sub-error 9007: Media not ready. Sub 2207026 similar.
      const notReady = /not\s*ready|still\s*processing|unavailable/i.test(errMsg) || errCode === 9007;
      if (notReady && attempt < 4) {
        await log('info', `Mídia ainda processando, aguardando 15s (tentativa ${attempt + 1}/5)...`);
        await new Promise(r => setTimeout(r, 15000));
        continue;
      }
      throw new Error(`Erro publicando: ${errMsg || JSON.stringify(publishData)}`);
    }
    if (!published) throw new Error("Falha após múltiplas tentativas de publicação");

    const igMediaId = publishData.id;

    // 4. Permalink
    let permalink: string | null = null;
    try {
      const mediaInfoRes = await graphFetch(`${graphHost}/${igMediaId}?fields=permalink&access_token=${accessToken}`);
      const mediaInfo = await mediaInfoRes.json();
      permalink = mediaInfo?.permalink || null;
    } catch (e) {
      console.warn("permalink fetch failed:", e);
    }

    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: igMediaId,
      permalink,
      error_message: null,
    }).eq('id', postId);

    await log('success', `Publicado com sucesso!${permalink ? ` Link: ${permalink}` : ''}`);

    return new Response(JSON.stringify({ success: true, permalink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error("Error publishing to Instagram:", msg);
    await markFailed(msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function waitForProcessing(
  host: string,
  containerId: string,
  token: string,
  log: (l: 'info' | 'success' | 'error', m: string) => Promise<void>,
) {
  let attempts = 0;
  const maxAttempts = 60; // ~15 min
  while (attempts < maxAttempts) {
    const res = await fetch(`${host}/${containerId}?fields=status_code,status&access_token=${token}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Falha no processamento do vídeo: ${data.status || 'unknown'}`);
    if (attempts % 4 === 0) await log('info', `Aguardando processamento de vídeo... (${attempts * 15}s)`);
    await new Promise(r => setTimeout(r, 15000));
    attempts++;
  }
  throw new Error("Timeout no processamento do vídeo (> 15 min)");
}
