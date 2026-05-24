import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-temp-access-token, x-cron-call",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    let userId: string;

    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authError || !user) throw new Error("Unauthorized");
      userId = user.id;
    } else {
      // Allow internal calls (e.g. from scheduler) if a secret key matches or if it's via service role
      // For now, let's assume it needs a payload with postId
      const { postId, secret } = await req.json();
      if (secret !== Deno.env.get("INTERNAL_SECRET")) throw new Error("Unauthorized internal call");
      
      const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single();
      if (!post) throw new Error("Post not found");
      userId = post.user_id;
    }

    const { postId } = await (authHeader ? req.json() : Promise.resolve({ postId: (await req.json()).postId }));

    // 1. Fetch post and settings
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !post) throw new Error("Post not found");

    const { data: settings, error: settingsError } = await supabase
      .from('instagram_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError || !settings) throw new Error("Instagram settings not found");

    const accessToken = settings.access_token || Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) throw new Error("No Meta Access Token available");

    const graphHost = accessToken.startsWith("IGAA") 
      ? "https://graph.instagram.com/v23.0" 
      : "https://graph.facebook.com/v23.0";

    const log = async (level: 'info' | 'success' | 'error', message: string) => {
      await supabase.from('post_logs').insert({
        post_id: postId,
        user_id: userId,
        level,
        message
      });
    };

    await supabase.from('posts').update({ status: 'publishing' }).eq('id', postId);
    await log('info', `Iniciando publicação de ${post.type}...`);

    let creationId: string;

    // 2. Create Media Container
    if (post.type === 'carousel') {
      // Carousels need children containers first
      const childrenIds = [];
      for (const url of post.media_urls) {
        const isVideo = url.toLowerCase().includes('.mp4') || url.toLowerCase().includes('.mov');
        const containerParams = new URLSearchParams({
          access_token: accessToken,
          [isVideo ? 'video_url' : 'image_url']: url,
          is_carousel_item: 'true'
        });

        const res = await fetch(`${graphHost}/${settings.ig_user_id}/media?${containerParams}`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(`Error creating carousel item: ${JSON.stringify(data)}`);
        
        // Wait for video processing if needed
        if (isVideo) {
          await waitForProcessing(graphHost, data.id, accessToken);
        }
        childrenIds.push(data.id);
      }

      const carouselParams = new URLSearchParams({
        access_token: accessToken,
        caption: post.caption || '',
        media_type: 'CAROUSEL',
        children: childrenIds.join(',')
      });
      const res = await fetch(`${graphHost}/${settings.ig_user_id}/media?${carouselParams}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(`Error creating carousel container: ${JSON.stringify(data)}`);
      creationId = data.id;
    } else {
      const isVideo = post.type === 'reels' || post.type === 'stories' || (post.media_urls[0]?.toLowerCase().includes('.mp4'));
      const mediaType = post.type === 'reels' ? 'REELS' : (post.type === 'stories' ? 'STORIES' : undefined);
      
      const containerParams = new URLSearchParams({
        access_token: accessToken,
        [isVideo ? 'video_url' : 'image_url']: post.media_urls[0],
        caption: post.caption || ''
      });
      if (mediaType) containerParams.append('media_type', mediaType);

      const res = await fetch(`${graphHost}/${settings.ig_user_id}/media?${containerParams}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(`Error creating container: ${JSON.stringify(data)}`);
      creationId = data.id;

      if (isVideo) {
        await waitForProcessing(graphHost, creationId, accessToken);
      }
    }

    await log('info', `Container criado (${creationId}). Publicando...`);

    // 3. Publish Media
    const publishParams = new URLSearchParams({
      access_token: accessToken,
      creation_id: creationId
    });
    const publishRes = await fetch(`${graphHost}/${settings.ig_user_id}/media_publish?${publishParams}`, { method: 'POST' });
    const publishData = await publishRes.json();
    
    if (!publishRes.ok) throw new Error(`Error publishing: ${JSON.stringify(publishData)}`);

    const igMediaId = publishData.id;

    // 4. Fetch permalink
    const mediaInfoRes = await fetch(`${graphHost}/${igMediaId}?fields=permalink&access_token=${accessToken}`);
    const mediaInfo = await mediaInfoRes.json();

    await supabase.from('posts').update({
      status: 'published',
      published_at: new Date().toISOString(),
      ig_media_id: igMediaId,
      permalink: mediaInfo.permalink
    }).eq('id', postId);

    await log('success', `Publicado com sucesso! Link: ${mediaInfo.permalink}`);

    return new Response(JSON.stringify({ success: true, permalink: mediaInfo.permalink }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Error publishing to Instagram:", error);
    // Try to update post status if we have postId
    // ...
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function waitForProcessing(host: string, containerId: string, token: string) {
  let attempts = 0;
  const maxAttempts = 60; // Increased to 60 (10 minutes approx) for larger Reels/Videos
  while (attempts < maxAttempts) {
    const res = await fetch(`${host}/${containerId}?fields=status_code&access_token=${token}`);
    const data = await res.json();
    if (data.status_code === 'FINISHED') return;
    if (data.status_code === 'ERROR') throw new Error(`Video processing failed: ${data.status_message}`);
    await new Promise(r => setTimeout(r, 15000)); // Polling every 15s instead of 10s to be safer with Meta limits
    attempts++;
  }
  throw new Error("Video processing timed out");
}
