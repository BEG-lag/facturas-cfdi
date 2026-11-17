import type { Analysis } from '../lib/aggregate.ts';
import { USO_CFDI } from '../lib/catalogs.ts';
import { escapeHtml as h, formatDate, formatMoney, monthLabel, type Lang } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import { reasonText } from '../lib/reasons.ts';
import { RULES_URL } from './views.ts';

/** Resumen para imprimir o guardar como PDF y llevar a tu contador. */
export function printHtml(a: Analysis, lang: Lang, userRfc: string): string {
  const m = (v: number) => h(formatMoney(v, lang));
  const today = new Date().toISOString().slice(0, 10);
  const d = a.deductions;
  const candidates = a.rows
    .filter((r) => r.deduction.key && (r.deduction.status === 'likely' || r.deduction.status === 'review'))
    .sort((x, y) => (x.deduction.key ?? '').localeCompare(y.deduction.key ?? '') || x.invoice.fecha.localeCompare(y.invoice.fecha));

  return `
  <h1>${h(t('print.title', { year: a.year }))}</h1>
  <p>${h(t('print.rfc'))}: <strong>${h(userRfc || '-')}</strong></p>
  <p class="note">${h(t('print.generated', { date: today }))}</p>
  <p class="disclaimer">${h(t('footer.disclaimer'))} ${h(t('ded.disclaimer'))}</p>

  <h2>${h(t('tabs.summary'))}</h2>
  <table><tbody>
    <tr><th>${h(t('summary.spent', { year: a.year }))}</th><td class="num">${m(a.spending.net)}</td></tr>
    <tr><th>${h(t('summary.likely'))}</th><td class="num">${m(d.estimatedTotal)}</td></tr>
    <tr><th>${h(t('ded.review'))}</th><td class="num">${m(d.reviewTotal)}</td></tr>
    ${a.payroll.count ? `<tr><th>${h(t('summary.payroll'))}</th><td class="num">${m(a.payroll.percepciones + a.payroll.otrosPagos)}</td></tr><tr><th>${h(t('payroll.isr'))}</th><td class="num">${m(a.payroll.isr)}</td></tr>` : ''}
    ${a.issued.count ? `<tr><th>${h(t('summary.issued'))}</th><td class="num">${m(a.issued.total)}</td></tr>` : ''}
  </tbody></table>

  <h2>${h(t('summary.byMonth'))}</h2>
  ${[a.byMonth.slice(0, 6), a.byMonth.slice(6)]
    .map(
      (half) =>
        `<table><thead><tr>${half.map((x) => `<th class="num">${h(monthLabel(x.month, lang))}</th>`).join('')}</tr></thead><tbody><tr>${half
          .map((x) => `<td class="num">${m(x.amount)}</td>`)
          .join('')}</tr></tbody></table>`,
    )
    .join('')}

  <h2>${h(t('summary.byCategory'))}</h2>
  <table><tbody>${a.byCategory.map((c) => `<tr><td>${h(t(`cat.${c.category}`))}</td><td class="num">${c.count}</td><td class="num">${m(c.amount)}</td></tr>`).join('')}</tbody></table>

  <h2>${h(t('ded.title', { year: a.year }))}</h2>
  <p>${d.globalCap === null ? h(t('ded.capMissing')) : h(t('ded.capLine', { cap: formatMoney(d.globalCap, lang), uma: d.umaCap === null ? '-' : formatMoney(d.umaCap, lang), income: d.incomeCap === null ? t('ded.capNoIncome') : formatMoney(d.incomeCap, lang) }))}</p>
  <table><thead><tr><th>${h(t('ded.key'))}</th><th>${h(t('ded.concept'))}</th><th class="num">${h(t('ded.likelyCol'))}</th><th class="num">${h(t('ded.reviewCol'))}</th><th class="num">${h(t('ded.allowedCol'))}</th><th>${h(t('ded.inGlobal'))}</th></tr></thead>
  <tbody>${d.byKey
    .map(
      (k) =>
        `<tr><td>${h(k.key)}</td><td>${h(USO_CFDI[k.key]?.[lang] ?? '')}</td><td class="num">${m(k.likely)}</td><td class="num">${m(k.review)}</td><td class="num">${m(k.allowed)}</td><td>${h(k.subjectToGlobal ? t('ded.yes') : t('ded.no'))}</td></tr>`,
    )
    .join('')}
  <tr><th colspan="4">${h(t('ded.estimated'))}</th><td class="num"><strong>${m(d.estimatedTotal)}</strong></td><td></td></tr></tbody></table>

  <h2>${h(t('tabs.invoices'))}: ${h(t('status.likely'))} / ${h(t('status.review'))}</h2>
  <table><thead><tr><th>${h(t('table.date'))}</th><th>${h(t('table.issuer'))}</th><th>${h(t('ded.key'))}</th><th class="num">${h(t('detail.amountYear'))}</th><th>${h(t('table.status'))}</th><th>UUID</th></tr></thead>
  <tbody>${candidates
    .map((r) => {
      const main = r.deduction.reasons.find((x) => x.level !== 'info');
      return `<tr><td>${h(formatDate(r.invoice.fecha, lang))}</td><td>${h(r.invoice.emisor.nombre)}<br><span class="note">${h(r.invoice.emisor.rfc)}</span></td><td>${h(r.deduction.key ?? '')}</td><td class="num">${m(r.deduction.amount)}</td><td>${h(t(`status.${r.deduction.status}`))}${main ? `<br><span class="note">${h(reasonText(main, lang))}</span>` : ''}</td><td class="note">${h(r.invoice.uuid)}</td></tr>`;
    })
    .join('')}</tbody></table>
  <p class="note">${h(t('footer.rules'))}: ${h(RULES_URL)}</p>`;
}
