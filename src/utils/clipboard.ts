/**
 * Copy text to clipboard with fallback for iframes (e.g. Chatwoot).
 * Uses the modern Clipboard API first, then falls back to a visible-but-tiny textarea
 * (some iframes block copy from off-screen elements).
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Try modern API first
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Clipboard API blocked (iframe permissions policy) — fall through
    }
  }

  // Fallback: textarea + execCommand. Some iframes (Chatwoot) require the element
  // to be in viewport AND have focus on it for selection to succeed.
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Keep visible but extremely small to avoid layout shift while still being focusable
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.padding = '0';
  textarea.style.border = 'none';
  textarea.style.outline = 'none';
  textarea.style.boxShadow = 'none';
  textarea.style.background = 'transparent';
  textarea.style.opacity = '0';
  textarea.style.zIndex = '-1';
  document.body.appendChild(textarea);

  // Preserve previously focused element to restore later
  const previouslyFocused = document.activeElement as HTMLElement | null;

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const ok = document.execCommand('copy');
    if (!ok) throw new Error('execCommand copy failed');
  } finally {
    document.body.removeChild(textarea);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
  }
}
