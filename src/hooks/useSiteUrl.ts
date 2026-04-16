import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useSiteUrl() {
  const { data: siteUrl = '' } = useQuery({
    queryKey: ['site-base-url'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gateway_settings')
        .select('value')
        .eq('key', 'site_base_url')
        .maybeSingle();
      
      if (error || !data?.value) {
        // Fallback to origin but remove lovable.app if it's there (editor case)
        const origin = window.location.origin;
        if (origin.includes('lovable.app') && !origin.includes('atendimento-astros-acd.lovable.app')) {
          // If we are in the editor, we should try to use the preview URL if possible
          // But since we don't know it for sure, using the origin is actually what's happening now.
          // For this specific project, the user's setting is already 'https://atendimento-astros-acd.lovable.app'
          return origin; 
        }
        return origin;
      }
      
      const url = String((data.value as any)?.url || '').trim().replace(/\/+$/, '');
      return url || window.location.origin;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return siteUrl;
}
