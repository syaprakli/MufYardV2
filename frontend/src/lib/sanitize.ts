import DOMPurify from 'dompurify';

/**
 * HTML özel karakterlerini kaçırır (&, <, >, ", ').
 */
export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Yalnızca güvenli http/https veya göreli (/) URL şemalarına izin verir.
 */
export function isSafeHttpUrl(url: string): boolean {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * HTML içeriğini DOMPurify ile güvenli hale getirir.
 * XSS saldırılarına karşı koruma sağlar.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty || '', {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'b', 'i', 'u',
      'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'span', 'div',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'mark', 'blockquote', 'pre', 'code',
      'img', 'hr', 'sub', 'sup', 'del',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'style',
      'src', 'alt', 'width', 'height',
      'colspan', 'rowspan',
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * SVG içeriğini güvenli hale getirir.
 */
export function sanitizeSvg(dirty: string): string {
  return DOMPurify.sanitize(dirty || '', {
    USE_PROFILES: { svg: true, svgFilters: true },
  });
}
