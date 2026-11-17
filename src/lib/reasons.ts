import { formatMoney, type Lang } from './format.ts';
import { t } from './i18n.ts';
import { RULES } from './rules.ts';
import type { Reason } from './types.ts';

const MONEY_PARAMS = ['amount', 'limit'];

/** Texto de una razón en el idioma indicado, con montos formateados. */
export function reasonText(reason: Reason, lang: Lang): string {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(reason.params ?? {})) {
    params[k] = MONEY_PARAMS.includes(k) && typeof v === 'number' ? formatMoney(v, lang) : v;
  }
  if (typeof params.area === 'string') params.area = t(`area.${params.area}`, undefined, lang);
  return t(`r.${reason.code}`, params, lang);
}

export function reasonSource(reason: Reason): { cite: string; url: string } | null {
  if (!reason.rule) return null;
  return RULES[reason.rule] ?? null;
}
