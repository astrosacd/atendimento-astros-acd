import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Branding {
  login_logo_url: string | null;
  favicon_url: string | null;
  og_image_url: string | null;
  sidebar_logo_url: string | null;
}

export const DEFAULT_LOGIN_LOGO = '/logo-login.png';
export const DEFAULT_FAVICON = '/favicon.png';

const EMPTY: Branding = {
  login_logo_url: null,
  favicon_url: null,
  og_image_url: null,
  sidebar_logo_url: null,
};

let cache: Branding | null = null;
let inflight: Promise<Branding> | null = null;
const listeners = new Set<(b: Branding) => void>();

function emit(b: Branding) {
  cache = b;
  listeners.forEach((l) => l(b));
}

export function applyBrandingToDocument(b: Branding) {
  const favicon = b.favicon_url || b.login_logo_url || DEFAULT_FAVICON;
  if (favicon) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
    if (!favicon.startsWith('data:')) {
      link.type = favicon.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
    } else {
      link.type = favicon.slice(5, favicon.indexOf(';'));
    }
  }

  const og = b.og_image_url || b.login_logo_url;
  if (og && !og.startsWith('data:')) {
    const setMeta = (attr: 'property' | 'name', key: string) => {
      let el = document.querySelector<HTMLMetaElement>(`meta[${attr}='${key}']`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.content = og;
    };
    setMeta('property', 'og:image');
    setMeta('name', 'twitter:image');
  }
}

export async function fetchBranding(force = false): Promise<Branding> {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    const { data } = await supabase
      .from('system_branding')
      .select('login_logo_url, favicon_url, og_image_url, sidebar_logo_url')
      .limit(1)
      .maybeSingle();
    const branding: Branding = { ...EMPTY, ...(data ?? {}) } as Branding;
    emit(branding);
    applyBrandingToDocument(branding);
    return branding;
  })();

  try {
    return await inflight;
  } catch {
    emit(EMPTY);
    return EMPTY;
  } finally {
    inflight = null;
  }
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(cache ?? EMPTY);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    listeners.add(setBranding);
    fetchBranding().finally(() => setLoading(false));
    return () => {
      listeners.delete(setBranding);
    };
  }, []);

  return {
    branding,
    loading,
    loginLogo: branding.login_logo_url || DEFAULT_LOGIN_LOGO,
    sidebarLogo: branding.sidebar_logo_url || branding.login_logo_url || null,
    faviconUrl: branding.favicon_url || DEFAULT_FAVICON,
    ogImage: branding.og_image_url || null,
    refresh: () => fetchBranding(true),
  };
}
