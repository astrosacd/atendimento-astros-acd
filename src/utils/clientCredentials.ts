import {
  Bot,
  Facebook,
  Globe,
  Instagram,
  Server,
  Twitter,
  Workflow,
  Youtube,
  type LucideIcon,
} from 'lucide-react';

export type ClientCredentialCategory = 'social' | 'server';

export interface ClientCredentialPlatform {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
  category: ClientCredentialCategory;
}

const URL_PREFIX = 'URL:';

export const CLIENT_CREDENTIAL_PLATFORMS: ClientCredentialPlatform[] = [
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500', category: 'social' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600', category: 'social' },
  { value: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500', category: 'social' },
  { value: 'threads', label: 'Threads', icon: Globe, color: 'text-foreground', category: 'social' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500', category: 'social' },
  { value: 'tiktok', label: 'TikTok', icon: Globe, color: 'text-foreground', category: 'social' },
  { value: 'linkedin', label: 'LinkedIn', icon: Globe, color: 'text-blue-700', category: 'social' },
  { value: 'evolution', label: 'Evolution', icon: Bot, color: 'text-primary', category: 'server' },
  { value: 'chatwoot', label: 'Chatwoot', icon: Bot, color: 'text-primary', category: 'server' },
  { value: 'n8n', label: 'n8n', icon: Workflow, color: 'text-primary', category: 'server' },
  { value: 'servidor', label: 'Servidor / VPS', icon: Server, color: 'text-primary', category: 'server' },
  { value: 'outro', label: 'Outro', icon: Globe, color: 'text-muted-foreground', category: 'social' },
  { value: 'outro-servidor', label: 'Outro servidor', icon: Server, color: 'text-muted-foreground', category: 'server' },
];

export const getClientCredentialPlatform = (value: string): ClientCredentialPlatform => {
  return CLIENT_CREDENTIAL_PLATFORMS.find((platform) => platform.value === value)
    || CLIENT_CREDENTIAL_PLATFORMS[CLIENT_CREDENTIAL_PLATFORMS.length - 1];
};

export const isServerCredentialPlatform = (value: string): boolean => {
  return getClientCredentialPlatform(value).category === 'server';
};

export const parseCredentialNotes = (rawNotes: string | null | undefined) => {
  if (!rawNotes) {
    return { url: '', notes: '' };
  }

  const lines = rawNotes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const urlLine = lines.find((line) => line.toUpperCase().startsWith(URL_PREFIX));
  const url = urlLine ? urlLine.slice(URL_PREFIX.length).trim() : '';
  const notes = lines
    .filter((line) => line !== urlLine)
    .join('\n')
    .trim();

  return { url, notes: notes || (!urlLine ? rawNotes.trim() : '') };
};

export const buildCredentialNotes = (url: string, notes: string) => {
  const normalizedUrl = url.trim();
  const normalizedNotes = notes.trim();

  return [
    normalizedUrl ? `${URL_PREFIX} ${normalizedUrl}` : '',
    normalizedNotes,
  ]
    .filter(Boolean)
    .join('\n') || null;
};