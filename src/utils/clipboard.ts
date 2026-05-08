/**
 * Copy text to clipboard with multiple fallbacks for restrictive environments
 * (iframes such as Chatwoot, Lovable preview, etc.).
 *
 * Order of attempts:
 *   1. navigator.clipboard.writeText (modern, requires secure context + permission)
 *   2. document.execCommand('copy') with a focused textarea inside the active dialog
 *      (works inside most iframes that allow scripted copy)
 *   3. window.prompt() — last-resort manual copy so the user is never left without the link
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1) Modern Clipboard API
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    window.isSecureContext
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permissions-Policy or iframe sandbox blocked it — fall through
    }
  }

  // 2) execCommand fallback. Inside a Radix Dialog the focus is trapped, so
  //    the textarea must live inside that dialog to receive focus and have
  //    its selection honored by execCommand.
  try {
    const activeRoot =
      (document.activeElement?.closest('[role="dialog"]') as HTMLElement | null) ||
      document.body;

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '50%';
    textarea.style.left = '50%';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    textarea.style.opacity = '0';
    activeRoot.appendChild(textarea);

    const previouslyFocused = document.activeElement as HTMLElement | null;

    try {
      textarea.focus({ preventScroll: true });
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      const ok = document.execCommand('copy');
      if (ok) return true;
    } finally {
      try { activeRoot.removeChild(textarea); } catch { /* ignore */ }
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    }
  } catch {
    // fall through to prompt
  }

  // 3) Last-resort: prompt so the user can always grab the value manually.
  try {
    window.prompt('Copie o link manualmente (Ctrl+C / Cmd+C):', text);
    return true;
  } catch {
    return false;
  }
}
