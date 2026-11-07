/**
 * Copies text. Uses the Clipboard API where the browser allows it (https or localhost),
 * and the older copy command on plain-http pages (a local or private-network address).
 * → true if the text was copied.
 */
export async function copyText(text) {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }

  const previousFocus = document.activeElement;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  Object.assign(area.style, { position: 'fixed', top: '0', left: '0', opacity: '0', pointerEvents: 'none' });
  document.body.appendChild(area);
  area.select();
  let copied;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  previousFocus?.focus?.({ preventScroll: true });
  return copied;
}

/** Highlights an element's text so the visitor can copy it by hand. */
export function selectText(el) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
