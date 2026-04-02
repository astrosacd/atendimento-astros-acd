/**
 * Copy text to clipboard with fallback for iframes (e.g. Chatwoot).
 * Uses the modern Clipboard API first, then falls back to a hidden textarea.
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard API blocked (iframe permissions policy) — fall through
    }
  }

  // Fallback: hidden textarea + execCommand
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    document.body.removeChild(textarea);
  }
}
