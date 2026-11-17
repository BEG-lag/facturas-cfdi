import type { Analysis, Row } from '../lib/aggregate.ts';
import { describe, FORMA_PAGO, METODO_PAGO, REGIMEN_FISCAL, USO_CFDI } from '../lib/catalogs.ts';
import { categorize } from '../lib/categories.ts';
import type { AppliedPayment } from '../lib/classifier.ts';
import { escapeHtml as h, formatDate, formatMoney, formatNumber, formatPercent, monthLabel, type Lang } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import { reasonSource, reasonText } from '../lib/reasons.ts';
import { SOURCES, type UmaValue } from '../lib/rules.ts';
import type { DeductionStatus, Invoice, Reason } from '../lib/types.ts';
import { icons } from './icons.ts';

export const REPO_URL = 'https://github.com/BEG-lag/facturas-cfdi';
export const RULES_URL = `${REPO_URL}/blob/main/docs/reglas.md`;

const money = (v: number, lang: Lang) => h(formatMoney(v, lang));

export function chip(status: DeductionStatus, lang: Lang): string {
  return `<span class="chip chip-${status}">${icons.status[status]()}${h(t(`status.${status}`, undefined, lang))}</span>`;
}

function sourceLink(reason: Reason): string {
  const src = reasonSource(reason);
  if (!src) return '';
  return `<a class="src" href="${h(src.url)}" target="_blank" rel="noopener noreferrer">${h(src.cite)}</a>`;
}

/* ------------------------------------------------------------------ armazón */

export function shellHtml(lang: Lang): string {
  return `
<a class="skip" href="#main">${h(t('app.skip'))}</a>
<div class="app">
<header class="top">
  <div class="wrap">
    <a class="brand" href="./" aria-label="facturas-cfdi">${icons.logo}<span>facturas<span class="dim">-cfdi</span></span></a>
    <div class="badges" aria-hidden="true">
      <span class="badge">${h(t('privacy.local'))}</span>
      <span class="badge">${h(t('privacy.zero'))}</span>
      <span class="badge">${h(t('privacy.offline'))}</span>
    </div>
    <button type="button" class="lang-btn" id="lang-toggle" lang="${lang === 'es' ? 'en' : 'es'}" aria-label="${h(t('lang.toggleLabel'))}">${h(t('lang.toggle'))}</button>
  </div>
</header>

<main id="main" tabindex="-1">
  <section class="hero wrap" aria-labelledby="hero-title">
    <p class="kicker">CFDI 4.0 · 3.3 · XML · ZIP</p>
    <h1 id="hero-title">${lang === 'es' ? 'Ordena tus facturas <em>sin que salgan de tu computadora</em>' : 'Sort your invoices <em>without them leaving your computer</em>'}</h1>
    <p class="lede">${h(t('app.tagline'))}</p>
    <div class="privacy" role="note" aria-labelledby="privacy-title">
      ${icons.lock(26)}
      <div>
        <h2 id="privacy-title">${h(t('privacy.title'))}</h2>
        <p>${h(t('privacy.body'))}</p>
      </div>
    </div>
  </section>

  <section class="drop wrap" aria-label="${h(t('drop.inputLabel'))}">
    <div class="dropzone" id="dropzone">
      <strong id="drop-title">${h(t('drop.title'))}</strong>
      <p class="hint">${h(t('drop.hint'))}</p>
      <div class="actions">
        <label class="btn btn-primary" for="file-input">${icons.upload()}<span id="choose-label">${h(t('drop.choose'))}</span></label>
        <input class="file-input" id="file-input" type="file" multiple accept=".xml,.zip,text/xml,application/xml,application/zip" aria-describedby="drop-title" />
        <button type="button" class="btn" id="demo-btn">${icons.spark()}${h(t('drop.demo'))}</button>
      </div>
      <p class="demo-note">${h(t('drop.demoNote'))}</p>
    </div>
    <div class="progress" id="progress" hidden>
      <span id="progress-text"></span>
      <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
    </div>
  </section>

  <section class="wrap" id="results" hidden>
    <div class="notices" id="notices"></div>

    <form class="settings" id="settings" novalidate>
      <h2>${h(t('settings.title'))}</h2>
      <div class="settings-grid">
        <div class="field">
          <label for="rfc">${h(t('settings.rfc'))}</label>
          <input id="rfc" name="rfc" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="13" aria-describedby="rfc-help rfc-error" />
          <p class="help" id="rfc-help">${h(t('settings.rfcHelp'))}</p>
          <p class="error" id="rfc-error" hidden>${h(t('settings.rfcInvalid'))}</p>
        </div>
        <div class="field">
          <label for="year">${h(t('settings.year'))}</label>
          <select id="year" name="year"></select>
        </div>
        <div class="field">
          <label for="uma">${h(t('settings.uma'))}</label>
          <input id="uma" name="uma" type="number" min="0" step="0.01" inputmode="decimal" aria-describedby="uma-help" />
          <p class="help" id="uma-help"></p>
        </div>
        <div class="field">
          <label for="income">${h(t('settings.income'))}</label>
          <input id="income" name="income" type="number" min="0" step="0.01" inputmode="decimal" aria-describedby="income-help" />
          <p class="help" id="income-help">${h(t('settings.incomeHelp'))}</p>
          <button type="button" class="btn btn-sm" id="use-payroll" hidden></button>
        </div>
        <div class="field">
          <label for="prev-income">${h(t('settings.prevIncome'))}</label>
          <input id="prev-income" name="prev-income" type="number" min="0" step="0.01" inputmode="decimal" aria-describedby="prev-income-help" />
          <p class="help" id="prev-income-help">${h(t('settings.prevIncomeHelp'))}</p>
        </div>
      </div>
      <div class="settings-actions">
        <label class="checkbox"><input type="checkbox" id="persist" aria-describedby="persist-help" />${h(t('settings.persist'))}</label>
        <p class="help" id="persist-help">${h(t('settings.persistHelp'))}</p>
        <button type="button" class="btn btn-danger btn-sm" id="clear-all">${icons.trash()}${h(t('settings.clear'))}</button>
      </div>
    </form>

    <div class="tabs" role="tablist" aria-label="${h(t('tabs.label'))}">
      <button type="button" class="tab" role="tab" id="tab-summary" aria-controls="panel-summary" data-tab="summary">${h(t('tabs.summary'))}</button>
      <button type="button" class="tab" role="tab" id="tab-deductions" aria-controls="panel-deductions" data-tab="deductions">${h(t('tabs.deductions'))}<span class="count" id="tab-deductions-count"></span></button>
      <button type="button" class="tab" role="tab" id="tab-invoices" aria-controls="panel-invoices" data-tab="invoices">${h(t('tabs.invoices'))}<span class="count" id="tab-invoices-count"></span></button>
    </div>

    <div role="tabpanel" id="panel-summary" aria-labelledby="tab-summary" tabindex="0"></div>
    <div role="tabpanel" id="panel-deductions" aria-labelledby="tab-deductions" tabindex="0" hidden></div>
    <div role="tabpanel" id="panel-invoices" aria-labelledby="tab-invoices" tabindex="0" hidden>
      <h2 class="sr-only" id="table-title"></h2>
      <div class="toolbar">
        <div class="field field-search">
          <label for="q">${h(t('table.search'))}</label>
          <input id="q" type="search" placeholder="${h(t('table.searchPlaceholder'))}" autocomplete="off" />
        </div>
        <div class="field"><label for="f-status">${h(t('table.filterStatus'))}</label><select id="f-status"></select></div>
        <div class="field"><label for="f-type">${h(t('table.filterType'))}</label><select id="f-type"></select></div>
        <div class="field"><label for="f-category">${h(t('table.filterCategory'))}</label><select id="f-category"></select></div>
        <div class="field"><label for="f-month">${h(t('table.filterMonth'))}</label><select id="f-month"></select></div>
      </div>
      <div class="export-bar">
        <button type="button" class="btn btn-sm" id="export-csv">${icons.download()}${h(t('export.csv'))}</button>
        <button type="button" class="btn btn-sm" id="export-excel">${icons.download()}${h(t('export.excel'))}</button>
        <button type="button" class="btn btn-sm" id="print-btn">${icons.print()}${h(t('export.print'))}</button>
        <p class="help">${h(t('export.scopeNote'))}</p>
      </div>
      <div class="table-wrap">
        <table class="inv-table">
          <caption class="sr-only">${h(t('table.caption'))}</caption>
          <thead><tr id="inv-head"></tr></thead>
          <tbody id="inv-body"></tbody>
        </table>
      </div>
      <div class="pager" id="pager"></div>
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <p class="disclaimer-strong">${h(t('footer.disclaimer'))}</p>
    <nav aria-label="footer">
      <a href="${RULES_URL}" target="_blank" rel="noopener noreferrer">${h(t('footer.rules'))}</a>
      <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${h(t('footer.code'))}</a>
      <a href="${h(SOURCES.verificaCfdi)}" target="_blank" rel="noopener noreferrer">${h(t('notice.cancelLink'))}</a>
      <span>${h(t('footer.license'))}</span>
    </nav>
    <p class="author">${h(t('footer.author'))} · <em>${h(t('footer.role'))}</em> · <a href="https://pivotek.mx" target="_blank" rel="noopener noreferrer">pivotek.mx</a> · <a href="https://github.com/BEG-lag/portafolio-ia" target="_blank" rel="noopener noreferrer">portafolio-ia</a></p>
    <p>${h(t('footer.synthetic'))}</p>
  </div>
</footer>
</div>

<dialog id="detail" aria-labelledby="detail-title"></dialog>
<div class="print-only print-summary" id="print-summary"></div>
<div class="sr-only" aria-live="polite" id="live"></div>
<div class="toast" id="toast" role="status" hidden></div>
`;
}

/* ------------------------------------------------------------------ avisos */

export interface NoticeInput {
  analysis: Analysis;
  lang: Lang;
  userRfc: string;
  inferred: { rfc: string; count: number; total: number } | null;
  rfcDismissed: boolean;
  duplicates: { fileName: string; firstFileName: string }[];
  failures: { fileName: string; code: string; detail: string }[];
  issues: { name: string; code: string; detail: string }[];
  years: number[];
}

function noticeBox(kind: 'info' | 'warn' | 'alert' | 'ok', body: string): string {
  const icon = kind === 'alert' || kind === 'warn' ? icons.alert() : icons.info();
  return `<div class="notice ${kind}">${icon}<div>${body}</div></div>`;
}

function fileList(items: string[]): string {
  const shown = items.slice(0, 200);
  const more = items.length - shown.length;
  return `<ul>${shown.map((i) => `<li>${h(i)}</li>`).join('')}${more > 0 ? `<li>+${more}</li>` : ''}</ul>`;
}

export function noticesHtml(n: NoticeInput): string {
  const { analysis: a, lang } = n;
  const out: string[] = [];
  if (!n.userRfc && n.inferred && !n.rfcDismissed) {
    out.push(
      noticeBox(
        'info',
        `<p>${h(t('infer.question', { rfc: n.inferred.rfc, count: n.inferred.count, total: n.inferred.total }))}</p>
        <div class="notice-actions"><button type="button" class="btn btn-sm btn-primary" id="infer-yes" data-rfc="${h(n.inferred.rfc)}">${h(t('infer.yes'))}</button><button type="button" class="btn btn-sm" id="infer-no">${h(t('infer.no'))}</button></div>`,
      ),
    );
  } else if (!n.userRfc) {
    out.push(noticeBox('warn', `<p>${h(t('notice.noRfc'))}</p>`));
  }
  out.push(
    noticeBox(
      'warn',
      `<p>${h(t('notice.cancel'))} <a href="${h(SOURCES.verificaCfdi)}" target="_blank" rel="noopener noreferrer">${h(t('notice.cancelLink'))} ${icons.external()}</a></p>`,
    ),
  );
  if (n.duplicates.length) {
    out.push(
      noticeBox(
        'info',
        `<p>${h(t('notice.duplicates', { count: formatNumber(n.duplicates.length, lang) }))}</p><details><summary>${h(t('notice.details'))}</summary>${fileList(n.duplicates.map((d) => `${d.fileName} = ${d.firstFileName}`))}</details>`,
      ),
    );
  }
  if (n.failures.length) {
    out.push(
      noticeBox(
        'alert',
        `<p>${h(t('notice.failures', { count: formatNumber(n.failures.length, lang) }))}</p><details><summary>${h(t('notice.details'))}</summary>${fileList(
          n.failures.map((f) => `${f.fileName}: ${t(`error.${f.code}`, { detail: f.detail })}`),
        )}</details>`,
      ),
    );
  }
  if (n.issues.length) {
    out.push(
      noticeBox(
        'alert',
        `<p>${h(t('notice.issues', { count: formatNumber(n.issues.length, lang) }))}</p><details><summary>${h(t('notice.details'))}</summary>${fileList(
          n.issues.map((f) => `${f.name}: ${t(`error.${f.code}`)}`),
        )}</details>`,
      ),
    );
  }
  if (n.userRfc && a.otherRfcCount) {
    out.push(noticeBox('info', `<p>${h(t('notice.otherRfc', { count: a.otherRfcCount, year: a.year }))}</p>`));
  }
  if (a.foreignCurrencyCount) {
    out.push(noticeBox('info', `<p>${h(t('notice.foreign', { count: a.foreignCurrencyCount }))}</p>`));
  }
  const others = n.years.filter((y) => y !== a.year);
  if (others.length) {
    out.push(noticeBox('info', `<p>${h(t('notice.otherYears', { years: others.join(', ') }))}</p>`));
  }
  return out.join('');
}

/* ------------------------------------------------------------------ resumen */

export function summaryHtml(a: Analysis, lang: Lang): string {
  const d = a.deductions;
  const cards: string[] = [
    `<div class="card"><h3>${h(t('summary.spent', { year: a.year }))}</h3><div class="big" data-testid="net-spending">${money(a.spending.net, lang)}</div><p class="sub">${h(
      t('summary.spentSub', { count: formatNumber(a.spending.count, lang), credits: formatMoney(a.spending.credits, lang) }),
    )}</p></div>`,
    `<div class="card accent"><h3>${h(t('summary.likely'))}</h3><div class="big" data-testid="likely-total">${money(d.estimatedTotal, lang)}</div><p class="sub">${h(
      t('summary.likelySub', { review: formatMoney(d.reviewTotal, lang) }),
    )}</p></div>`,
  ];
  if (a.payroll.count) {
    cards.push(
      `<div class="card"><h3>${h(t('summary.payroll'))}</h3><div class="big">${money(a.payroll.percepciones + a.payroll.otrosPagos, lang)}</div><p class="sub">${h(
        t('summary.payrollSub', { count: a.payroll.count, isr: formatMoney(a.payroll.isr, lang) }),
      )}</p></div>`,
    );
  }
  if (a.issued.count) {
    cards.push(
      `<div class="card"><h3>${h(t('summary.issued'))}</h3><div class="big">${money(a.issued.total, lang)}</div><p class="sub">${h(
        t('summary.issuedSub', { count: a.issued.count }),
      )}</p></div>`,
    );
  }

  const maxMonth = Math.max(1, ...a.byMonth.map((m) => Math.abs(m.amount)));
  const monthBars = a.byMonth
    .map((m) => {
      const pct = (Math.abs(m.amount) / maxMonth) * 100;
      return `<div class="month-col" title="${h(`${monthLabel(m.month, lang)}: ${formatMoney(m.amount, lang)}`)}"><div class="month-bar${m.amount < 0 ? ' is-negative' : ''}" data-h="${pct.toFixed(2)}"></div></div>`;
    })
    .join('');
  const monthLabels = a.byMonth.map((m) => `<span>${h(monthLabel(m.month, lang))}</span>`).join('');
  const monthTable = `<details class="chart-data"><summary>${h(t('summary.month'))} / ${h(t('summary.amount'))}</summary><table><thead><tr><th scope="col">${h(
    t('summary.month'),
  )}</th><th scope="col" class="num">${h(t('summary.amount'))}</th></tr></thead><tbody>${a.byMonth
    .map((m) => `<tr><td>${h(monthLabel(m.month, lang))}</td><td class="num">${money(m.amount, lang)}</td></tr>`)
    .join('')}</tbody></table></details>`;

  const maxCat = Math.max(1, ...a.byCategory.map((c) => Math.abs(c.amount)));
  const cats = a.byCategory.length
    ? `<ul class="hbars">${a.byCategory
        .map(
          (c) =>
            `<li class="hbar-row"><span class="name">${h(t(`cat.${c.category}`))} <span class="meta">· ${formatNumber(c.count, lang)}</span></span><span class="val">${money(
              c.amount,
              lang,
            )}</span><span class="hbar-track" aria-hidden="true"><span class="hbar-fill lime" data-w="${((Math.max(0, c.amount) / maxCat) * 100).toFixed(2)}"></span></span></li>`,
        )
        .join('')}</ul>`
    : `<p class="muted">${h(t('summary.empty', { year: a.year }))}</p>`;

  const maxIss = Math.max(1, ...a.topIssuers.map((c) => Math.abs(c.amount)));
  const issuers = a.topIssuers.length
    ? `<ol class="hbars">${a.topIssuers
        .map(
          (i) =>
            `<li class="hbar-row"><span class="name">${h(i.nombre || i.rfc)} <span class="meta">· ${h(i.rfc)} · ${formatNumber(i.count, lang)}</span></span><span class="val">${money(
              i.amount,
              lang,
            )}</span><span class="hbar-track" aria-hidden="true"><span class="hbar-fill" data-w="${((Math.max(0, i.amount) / maxIss) * 100).toFixed(2)}"></span></span></li>`,
        )
        .join('')}</ol>`
    : `<p class="muted">${h(t('summary.empty', { year: a.year }))}</p>`;

  const payroll = a.payroll.count
    ? `<div class="panel"><h3>${h(t('summary.payroll'))} <span class="serif-note">${a.year}</span></h3><table><tbody>
      <tr><th scope="row">${h(t('payroll.percepciones'))}</th><td class="num">${money(a.payroll.percepciones, lang)}</td></tr>
      <tr><th scope="row">${h(t('payroll.otros'))}</th><td class="num">${money(a.payroll.otrosPagos, lang)}</td></tr>
      <tr><th scope="row">${h(t('payroll.deducciones'))}</th><td class="num">${money(a.payroll.deducciones, lang)}</td></tr>
      <tr><th scope="row">${h(t('payroll.isr'))}</th><td class="num">${money(a.payroll.isr, lang)}</td></tr>
      <tr><th scope="row">${h(t('payroll.neto'))}</th><td class="num">${money(a.payroll.neto, lang)}</td></tr>
    </tbody></table></div>`
    : '';

  return `
  <h2 class="sr-only">${h(t('tabs.summary'))}</h2>
  <div class="cards">${cards.join('')}</div>
  <div class="panel" role="figure" aria-labelledby="month-title" aria-describedby="month-desc">
    <div class="panel-head"><h3 id="month-title">${h(t('summary.byMonth'))}</h3><span class="serif-note">${a.year}</span></div>
    <p class="sr-only" id="month-desc">${h(t('summary.chartDesc'))}</p>
    <div class="month-chart" aria-hidden="true">${monthBars}</div>
    <div class="month-labels" aria-hidden="true">${monthLabels}</div>
    ${monthTable}
  </div>
  <div class="grid-2">
    <div class="panel"><h3>${h(t('summary.byCategory'))}</h3>${cats}</div>
    <div class="panel"><h3>${h(t('summary.topIssuers'))}</h3>${issuers}</div>
  </div>
  ${payroll}`;
}

/* ------------------------------------------------------------------ deducciones */

export function deductionsHtml(a: Analysis, lang: Lang, uma: UmaValue | null, umaAnnual: number | null): string {
  const d = a.deductions;
  const cap = d.globalCap;
  const used = cap === null ? d.subjectBeforeCap : Math.min(d.subjectBeforeCap, cap);
  const pct = cap ? Math.min(1, d.subjectBeforeCap / cap) : 0;
  const exceeded = cap !== null && d.subjectBeforeCap > cap;

  const capBlock =
    cap === null
      ? `<p class="muted">${h(t('ded.capMissing'))}</p>`
      : `<div class="cap">
        <div class="cap-track" role="meter" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${used}" aria-valuetext="${h(
          t('ded.capProgress', { used: formatMoney(used, lang), cap: formatMoney(cap, lang), pct: formatPercent(pct, lang) }),
        )}" aria-labelledby="cap-title"><div class="cap-fill${exceeded ? ' is-full' : ''}" data-w="${(pct * 100).toFixed(2)}"></div></div>
        <div class="cap-legend"><strong>${h(t('ded.capProgress', { used: formatMoney(used, lang), cap: formatMoney(cap, lang), pct: formatPercent(pct, lang) }))}</strong>
        <span class="muted">${h(
          t('ded.capLine', {
            cap: formatMoney(cap, lang),
            uma: d.umaCap === null ? '-' : formatMoney(d.umaCap, lang),
            income: d.incomeCap === null ? t('ded.capNoIncome') : formatMoney(d.incomeCap, lang),
          }),
        )}</span></div>
        ${exceeded ? `<p class="notice warn">${icons.alert()}<span>${h(t('ded.capExceeded', { amount: formatMoney(d.subjectBeforeCap, lang) }))}</span></p>` : ''}
      </div>`;

  const notes: string[] = [];
  if (d.notes.includes('income-missing')) notes.push(t('ded.notesIncome'));
  if (d.notes.includes('uma-missing')) notes.push(t('ded.notesUma'));

  const keyRows = d.byKey
    .map((k) => {
      const concept = USO_CFDI[k.key]?.[lang] ?? k.key;
      const capText = k.capNote ? `${t(`cap.${k.capNote}`)}${k.capValue !== null ? ` (${formatMoney(k.capValue, lang)})` : ''}` : '-';
      return `<tr>
        <td data-label="${h(t('ded.key'))}"><strong>${h(k.key)}</strong></td>
        <td data-label="${h(t('ded.concept'))}">${h(concept)} <span class="muted small">· ${formatNumber(k.count, lang)}</span></td>
        <td class="num" data-label="${h(t('ded.likelyCol'))}">${money(k.likely, lang)}</td>
        <td class="num" data-label="${h(t('ded.reviewCol'))}">${money(k.review, lang)}</td>
        <td class="num" data-label="${h(t('ded.allowedCol'))}">${money(k.allowed, lang)}</td>
        <td data-label="${h(t('ded.capCol'))}" class="small">${h(capText)}</td>
        <td data-label="${h(t('ded.inGlobal'))}">${h(k.subjectToGlobal ? t('ded.yes') : t('ded.no'))}</td>
      </tr>`;
    })
    .join('');

  const byKey = d.byKey.length
    ? `<div class="table-wrap"><table class="ded-table"><thead><tr>
        <th scope="col">${h(t('ded.key'))}</th><th scope="col">${h(t('ded.concept'))}</th>
        <th scope="col" class="num">${h(t('ded.likelyCol'))}</th><th scope="col" class="num">${h(t('ded.reviewCol'))}</th>
        <th scope="col" class="num">${h(t('ded.allowedCol'))}</th><th scope="col">${h(t('ded.capCol'))}</th><th scope="col">${h(t('ded.inGlobal'))}</th>
      </tr></thead><tbody>${keyRows}</tbody></table></div>`
    : `<p class="muted">${h(t('ded.empty', { year: a.year }))}</p>`;

  const statuses: DeductionStatus[] = ['likely', 'review', 'no', 'na'];
  const statusList = `<ul class="status-list">${statuses
    .map(
      (s) =>
        `<li>${chip(s, lang)}<span class="n">${formatNumber(d.counts[s], lang)}</span><button type="button" class="btn btn-sm" data-filter-status="${s}">${h(t('ded.viewList'))}</button></li>`,
    )
    .join('')}</ul>`;

  // Razones más frecuentes entre facturas con estatus distinto de "no aplica".
  const reasonCount = new Map<string, { reason: Reason; n: number }>();
  for (const row of a.rows) {
    if (row.deduction.status === 'na') continue;
    for (const r of row.deduction.reasons) {
      if (r.level === 'info') continue;
      const key = `${r.code}|${JSON.stringify(genericParams(r) ?? {})}`;
      const prev = reasonCount.get(key);
      if (prev) prev.n++;
      else reasonCount.set(key, { reason: r, n: 1 });
    }
  }
  const topReasons = Array.from(reasonCount.values())
    .sort((x, y) => y.n - x.n)
    .slice(0, 8);
  const reasons = topReasons.length
    ? `<ol class="reasons-list">${topReasons
        .map(
          ({ reason, n }) =>
            `<li><strong>${formatNumber(n, lang)} ×</strong> <span class="lvl lvl-${reason.level}">${h(t(`status.${reason.level === 'no' ? 'no' : 'review'}`))}</span> ${h(
              reasonText({ ...reason, ...(reason.params ? { params: genericParams(reason) } : {}) }, lang),
            )}${sourceLink(reason)}</li>`,
        )
        .join('')}</ol>`
    : '';

  const umaLine = uma
    ? `UMA ${uma.year}: ${formatMoney(umaAnnual ?? uma.annual, lang)} · <a href="${h(uma.url)}" target="_blank" rel="noopener noreferrer">DOF ${h(uma.dof)}</a>`
    : umaAnnual
      ? `UMA: ${formatMoney(umaAnnual, lang)}`
      : '';

  return `
  <h2 class="sr-only">${h(t('ded.title', { year: a.year }))}</h2>
  <p class="disclaimer">${h(t('ded.disclaimer'))}</p>
  <div class="panel">
    <div class="panel-head"><h3 id="cap-title">${h(t('ded.capTitle'))}</h3><span class="serif-note">${a.year}</span></div>
    ${capBlock}
    <div class="stat-row">
      <div class="stat"><div class="label">${h(t('ded.subject'))}</div><div class="value">${money(d.subjectAllowed, lang)}</div></div>
      <div class="stat"><div class="label">${h(t('ded.outside'))}</div><div class="value">${money(d.outsideAllowed, lang)}</div></div>
      <div class="stat"><div class="label">${h(t('ded.review'))}</div><div class="value">${money(d.reviewTotal, lang)}</div></div>
      <div class="stat highlight"><div class="label">${h(t('ded.estimated'))}</div><div class="value" data-testid="ded-estimated">${money(d.estimatedTotal, lang)}</div></div>
    </div>
    ${notes.length ? `<p class="small muted">${notes.map(h).join(' ')}</p>` : ''}
    ${umaLine ? `<p class="small muted">${umaLine}</p>` : ''}
  </div>
  <div class="panel">
    <h3>${h(t('ded.byKey'))}</h3>
    ${byKey}
  </div>
  <div class="grid-2">
    <div class="panel"><h3>${h(t('ded.statusTitle'))}</h3>${statusList}</div>
    <div class="panel"><h3>${h(t('ded.reasonsTitle'))}</h3>${reasons || '<p class="muted">-</p>'}</div>
  </div>`;
}

/** En la lista de razones frecuentes se agrupa por código y parámetros, sin montos de una factura concreta. */
function genericParams(reason: Reason): Record<string, string | number> | undefined {
  if (!reason.params) return undefined;
  const generic: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(reason.params)) {
    generic[k] = k === 'amount' || k === 'count' ? '…' : v;
  }
  return generic;
}

/* ------------------------------------------------------------------ tabla */

export type SortCol = 'date' | 'issuer' | 'type' | 'use' | 'category' | 'total' | 'status';

export function tableHeadHtml(sort: { col: SortCol; dir: 'asc' | 'desc' }, lang: Lang): string {
  const cols: { id: SortCol; label: string; cls: string }[] = [
    { id: 'date', label: t('table.date', undefined, lang), cls: 'c-date' },
    { id: 'issuer', label: t('table.issuer', undefined, lang), cls: 'c-issuer' },
    { id: 'type', label: t('table.type', undefined, lang), cls: 'c-type' },
    { id: 'use', label: t('table.use', undefined, lang), cls: 'c-use' },
    { id: 'category', label: t('table.category', undefined, lang), cls: 'c-cat' },
    { id: 'total', label: t('table.total', undefined, lang), cls: 'c-total num' },
    { id: 'status', label: t('table.status', undefined, lang), cls: 'c-status' },
  ];
  return cols
    .map((c) => {
      const active = sort.col === c.id;
      const aria = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
      const icon = active ? (sort.dir === 'asc' ? icons.sortUp() : icons.sortDown()) : icons.sortNone();
      return `<th scope="col" class="${c.cls}" aria-sort="${aria}"><button type="button" class="sort-btn" data-sort="${c.id}" aria-label="${h(
        t('table.sortBy', { col: c.label }, lang),
      )}">${h(c.label)}${icon}</button></th>`;
    })
    .join('');
}

export function tableBodyHtml(rows: Row[], lang: Lang): string {
  if (rows.length === 0) return `<tr><td colspan="7" class="muted">${h(t('table.empty'))}</td></tr>`;
  return rows
    .map((r) => {
      const i = r.invoice;
      const issuer = i.emisor.nombre || i.emisor.rfc;
      const signed = i.tipo === 'E' ? -i.totalMxn : i.totalMxn;
      const meta = `${formatDate(i.fecha, lang)} · ${t(`type.${i.tipo}`)} · ${i.receptor.usoCfdi || '-'} · ${t(`cat.${r.category}`)}`;
      return `<tr data-key="${h(i.key)}">
        <td class="c-date">${h(formatDate(i.fecha, lang))}</td>
        <td class="c-issuer"><button type="button" class="row-open" data-open="${h(i.key)}" aria-label="${h(t('table.open', { issuer }))}">${h(issuer)}</button><div class="muted small">${h(i.emisor.rfc)}</div></td>
        <td class="c-type">${h(t(`type.${i.tipo}`))}</td>
        <td class="c-use">${h(i.receptor.usoCfdi || '-')}</td>
        <td class="c-cat">${h(t(`cat.${r.category}`))}</td>
        <td class="c-total num">${money(signed, lang)}</td>
        <td class="c-meta">${h(meta)}</td>
        <td class="c-status">${chip(r.deduction.status, lang)}</td>
      </tr>`;
    })
    .join('');
}

export function pagerHtml(page: number, pages: number, from: number, to: number, total: number, lang: Lang): string {
  return `<span>${h(t('table.showing', { from: formatNumber(from, lang), to: formatNumber(to, lang), total: formatNumber(total, lang) }))}</span>
  <span class="pager-btns">
    <button type="button" class="btn btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${h(t('table.prev'))}</button>
    <span>${h(t('table.page', { page, pages }))}</span>
    <button type="button" class="btn btn-sm" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>${h(t('table.next'))}</button>
  </span>`;
}

/* ------------------------------------------------------------------ detalle */

function kv(label: string, value: string): string {
  return `<div><dt>${h(label)}</dt><dd>${value}</dd></div>`;
}

export function detailHtml(row: Row, lang: Lang, payments: AppliedPayment[], byUuid: Map<string, Invoice>): string {
  const i = row.invoice;
  const d = row.deduction;
  const reasons = d.reasons.length
    ? `<ul class="reason-items">${d.reasons
        .map(
          (r) =>
            `<li><span class="lvl lvl-${r.level}">${h(r.level === 'info' ? 'i' : r.level === 'no' ? t('status.no') : t('status.review'))}</span><span>${h(
              reasonText(r, lang),
            )}${sourceLink(r)}</span></li>`,
        )
        .join('')}</ul>`
    : '';
  const concepts = `<div class="table-wrap"><table><thead><tr><th scope="col">${h(t('detail.qty'))}</th><th scope="col">${h(
    t('detail.description'),
  )}</th><th scope="col">ClaveProdServ</th><th scope="col" class="num">${h(t('detail.amount'))}</th></tr></thead><tbody>${i.conceptos
    .map(
      (c) =>
        `<tr><td>${h(formatNumber(c.cantidad, lang))}</td><td>${h(c.descripcion)}${
          c.iedu
            ? `<div class="muted small">${h(t('detail.student'))}: ${h(c.iedu.nombreAlumno)} · CURP ${h(c.iedu.curp)} · ${h(c.iedu.nivelEducativo)} · RVOE ${h(c.iedu.autRvoe)}</div>`
            : ''
        }</td><td>${h(c.claveProdServ)}</td><td class="num">${h(formatMoney(c.importe, lang, i.moneda))}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;

  const related = i.relacionados.length
    ? `<section><h3>${h(t('detail.related'))}</h3><ul class="small">${i.relacionados
        .flatMap((r) =>
          r.uuids.map((u) => {
            const other = byUuid.get(u);
            return `<li>${h(r.tipoRelacion)} · <span class="uuid">${h(u)}</span>${other ? ` · ${h(other.emisor.nombre)} · ${money(other.totalMxn, lang)}` : ''}</li>`;
          }),
        )
        .join('')}</ul></section>`
    : '';

  const pays = payments.length
    ? `<section><h3>${h(t('detail.payments'))}</h3><ul class="small">${payments
        .map(
          (p) =>
            `<li>${h(formatDate(p.fechaPago, lang))} · ${h(describe(FORMA_PAGO, p.formaDePago, lang))} · ${money(p.amountMxn, lang)} · <span class="uuid">${h(p.paymentUuid)}</span></li>`,
        )
        .join('')}</ul></section>`
    : '';

  const pagos = i.pagos.length
    ? `<section><h3>${h(t('type.P'))}</h3><ul class="small">${i.pagos
        .map(
          (p) =>
            `<li>${h(formatDate(p.fechaPago, lang))} · ${h(describe(FORMA_PAGO, p.formaDePago, lang))} · ${h(formatMoney(p.monto, lang, p.moneda))}<ul>${p.doctos
              .map((dr) => `<li><span class="uuid">${h(dr.idDocumento)}</span> · ${h(formatMoney(dr.impPagado, lang, dr.monedaDR))}</li>`)
              .join('')}</ul></li>`,
        )
        .join('')}</ul></section>`
    : '';

  const nomina = i.nomina
    ? `<section><h3>${h(t('detail.payroll'))}</h3><dl class="kv">
        ${kv(t('payroll.percepciones'), money(i.nomina.totalPercepciones, lang))}
        ${kv(t('payroll.otros'), money(i.nomina.totalOtrosPagos, lang))}
        ${kv(t('payroll.deducciones'), money(i.nomina.totalDeducciones, lang))}
        ${kv(t('payroll.isr'), money(i.nomina.isrRetenido, lang))}
        ${kv('FechaPago', h(formatDate(i.nomina.fechaPago, lang)))}
      </dl></section>`
    : '';

  const category = categorize(i);
  return `<div class="dialog-inner">
  <div class="dialog-head">
    <div>
      <p class="kicker">${h(t('detail.title'))} · ${h(t(`type.${i.tipo}`))} · CFDI ${h(i.version)}</p>
      <h2 id="detail-title">${h(i.emisor.nombre || i.emisor.rfc)} · ${h(formatMoney(i.total, lang, i.moneda))}</h2>
    </div>
    <button type="button" class="btn btn-sm" id="detail-close" aria-label="${h(t('detail.close'))}">${icons.close()}</button>
  </div>
  <div class="dialog-body">
    <section>
      <h3>${h(t('detail.deduction'))}</h3>
      <p>${chip(d.status, lang)} ${d.key ? `<strong>${h(d.key)}</strong> · ${h(USO_CFDI[d.key]?.[lang] ?? '')}` : ''}</p>
      ${d.key ? `<p class="small">${h(t('detail.amountYear'))}: <strong>${money(d.amount, lang)}</strong></p>` : ''}
      ${reasons}
    </section>
    <section>
      <h3>${h(t('detail.general'))}</h3>
      <dl class="kv">
        ${kv(t('detail.uuid'), `<span class="uuid">${h(i.uuid || '-')}</span> <button type="button" class="btn btn-sm" id="copy-uuid" data-uuid="${h(i.uuid)}">${icons.copy()}${h(t('detail.copy'))}</button>`)}
        ${kv(t('detail.date'), h(formatDate(i.fecha, lang)))}
        ${kv(t('detail.stamped'), h(i.fechaTimbrado || '-'))}
        ${kv(t('detail.serieFolio'), h([i.serie, i.folio].filter(Boolean).join(' ') || '-'))}
        ${kv(t('detail.payment'), h(describe(FORMA_PAGO, i.formaPago, lang)))}
        ${kv(t('detail.method'), h(describe(METODO_PAGO, i.metodoPago, lang)))}
        ${kv(t('detail.currency'), h(i.moneda === 'MXN' || i.moneda === 'XXX' ? i.moneda : `${i.moneda} · TC ${i.tipoCambio}`))}
        ${kv(t('detail.subtotal'), h(formatMoney(i.subTotal, lang, i.moneda)))}
        ${kv(t('detail.discount'), h(formatMoney(i.descuento, lang, i.moneda)))}
        ${kv(t('detail.taxes'), h(formatMoney(i.totalTrasladados, lang, i.moneda)))}
        ${kv(t('detail.withheld'), h(formatMoney(i.totalRetenidos, lang, i.moneda)))}
        ${kv(t('detail.total'), `<strong>${h(formatMoney(i.total, lang, i.moneda))}</strong>${i.moneda !== 'MXN' && i.moneda !== 'XXX' ? ` · ${money(i.totalMxn, lang)}` : ''}`)}
        ${kv(t('table.category'), h(t(`cat.${category}`)))}
      </dl>
      <p class="small muted">${h(t('detail.cancel'))} <a href="${h(SOURCES.verificaCfdi)}" target="_blank" rel="noopener noreferrer">${h(t('notice.cancelLink'))} ${icons.external()}</a></p>
    </section>
    <section>
      <dl class="kv">
        ${kv(t('detail.issuer'), `${h(i.emisor.nombre)}<br><span class="muted">${h(i.emisor.rfc)} · ${h(describe(REGIMEN_FISCAL, i.emisor.regimenFiscal, lang))}</span>`)}
        ${kv(
          t('detail.receiver'),
          `${h(i.receptor.nombre)}<br><span class="muted">${h(i.receptor.rfc)}${i.receptor.regimenFiscal ? ` · ${h(describe(REGIMEN_FISCAL, i.receptor.regimenFiscal, lang))}` : ''}</span>`,
        )}
        ${kv(t('detail.use'), h(describe(USO_CFDI, i.receptor.usoCfdi, lang)))}
      </dl>
    </section>
    <section><h3>${h(t('detail.concepts'))}</h3>${concepts}</section>
    ${nomina}
    ${pagos}
    ${pays}
    ${related}
    <section><h3>${h(t('detail.complements'))}</h3><p class="small">${h(i.complementos.join(', ') || '-')}</p>
    <p class="small muted">${h(t('detail.file'))}: ${h(i.fileName)}</p></section>
  </div>
</div>`;
}
