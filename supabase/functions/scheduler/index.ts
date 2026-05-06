import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, user_id')
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString());

    if (error) throw error;

    console.log(`Found ${posts?.length || 0} posts to publish.`);

    const results = [];
    for (const post of posts || []) {
      console.log(`Publishing post ${post.id}...`);
      
      // Call publish-instagram function
      // Using the internal URL or the public one
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/publish-instagram`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` // Using service role should bypass user auth if handled correctly
        },
        body: JSON.stringify({ postId: post.id })
      });

      const result = await response.json();
      results.push({ postId: post.id, success: response.ok, result });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Scheduler error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
