export type Lang = 'es' | 'en';

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, lang: Lang, currency = 'MXN'): string {
  const key = `${lang}|${currency}`;
  let f = moneyFormatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: currency === 'XXX' ? 'MXN' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    moneyFormatters.set(key, f);
  }
  return f.format(value);
}

/** Monto compacto para ejes de gráficas: 12.5 k, 1.2 M. */
export function formatCompact(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US').format(value);
}

export function formatPercent(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(
    value,
  );
}

const MONTHS: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "2025-03" -> "mar" */
export function monthLabel(month: string, lang: Lang): string {
  const m = Number(month.slice(5, 7));
  return MONTHS[lang][m - 1] ?? month;
}

/** "2025-03-14T10:22:00" -> "14 mar 2025" (sin conversión de zona horaria). */
export function formatDate(fecha: string, lang: Lang): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return fecha || '-';
  const [y, m, d] = [fecha.slice(0, 4), Number(fecha.slice(5, 7)), Number(fecha.slice(8, 10))];
  return lang === 'es' ? `${d} ${MONTHS.es[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`;
}

/** Valida la forma de un RFC (12 caracteres morales, 13 físicas). No verifica que exista. */
export function isRfcShape(value: string): boolean {
  return /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/.test(value.trim().toUpperCase());
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
