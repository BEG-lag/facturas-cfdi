import { analyze, defaultYear, emptyDataset, mergeResults, yearsIn, type Analysis, type Dataset, type Row } from '../lib/aggregate.ts';
import { CATEGORY_IDS } from '../lib/categories.ts';
import { indexPayments, inferUserRfc } from '../lib/classifier.ts';
import { rowsToCsv } from '../lib/csv.ts';
import { formatMoney, isRfcShape, monthLabel, escapeHtml as h } from '../lib/format.ts';
import { setLang, t } from '../lib/i18n.ts';
import { parseSources, readFiles, type IngestIssue, type XmlSource } from '../lib/ingest.ts';
import { umaFor } from '../lib/rules.ts';
import { hasSaved, loadState, saveState, wipeState, type SavedSettings } from '../lib/store.ts';
import { generateDataset } from '../lib/synthetic.ts';
import type { DeductionStatus, Invoice } from '../lib/types.ts';
import { printHtml } from './print.ts';
import {
  deductionsHtml,
  detailHtml,
  noticesHtml,
  pagerHtml,
  shellHtml,
  summaryHtml,
  tableBodyHtml,
  tableHeadHtml,
  type SortCol,
} from './views.ts';

type Tab = 'summary' | 'deductions' | 'invoices';

interface TableState {
  query: string;
  status: DeductionStatus | 'all';
  tipo: string;
  category: string;
  month: string;
  sort: { col: SortCol; dir: 'asc' | 'desc' };
  page: number;
}

interface State {
  dataset: Dataset;
  issues: IngestIssue[];
  settings: SavedSettings;
  persist: boolean;
  rfcDismissed: boolean;
  analysis: Analysis | null;
  tab: Tab;
  table: TableState;
  busy: boolean;
}

const PAGE_SIZE = 50;
const STATUS_RANK: Record<DeductionStatus, number> = { likely: 0, review: 1, no: 2, na: 3 };

const state: State = {
  dataset: emptyDataset(),
  issues: [],
  settings: { userRfc: '', year: null, income: null, prevYearIncome: null, umaOverride: {}, lang: 'es' },
  persist: false,
  rfcDismissed: false,
  analysis: null,
  tab: 'summary',
  table: { query: '', status: 'all', tipo: 'all', category: 'all', month: 'all', sort: { col: 'date', dir: 'desc' }, page: 1 },
  busy: false,
};

let root: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/* ------------------------------------------------------------------ utilidades */

function applyBars(container: ParentNode): void {
  // Anchos y altos vía CSSOM (permitido por la CSP, a diferencia de atributos style en línea).
  container.querySelectorAll<HTMLElement>('[data-w]').forEach((el) => el.style.setProperty('--w', el.dataset.w ?? '0'));
  container.querySelectorAll<HTMLElement>('[data-h]').forEach((el) => el.style.setProperty('--h', el.dataset.h ?? '0'));
}

function announce(message: string): void {
  const live = $('live');
  live.textContent = '';
  window.setTimeout(() => (live.textContent = message), 30);
}

let toastTimer = 0;
function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2600);
}

function parseAmount(value: string): number | null {
  const clean = value.replace(/[,\s$]/g, '');
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

const searchCache = new WeakMap<Invoice, string>();
function searchText(inv: Invoice): string {
  let s = searchCache.get(inv);
  if (!s) {
    s = normalize(
      [inv.uuid, inv.emisor.rfc, inv.emisor.nombre, inv.receptor.rfc, inv.receptor.nombre, inv.serie, inv.folio, inv.fileName, ...inv.conceptos.map((c) => c.descripcion)].join(' '),
    );
    searchCache.set(inv, s);
  }
  return s;
}

/* ------------------------------------------------------------------ cálculo */

function currentYear(): number {
  const years = yearsIn(state.dataset.invoices);
  const y = state.settings.year;
  if (y && (years.includes(y) || hasPaymentsIn(y))) return y;
  return defaultYear(state.dataset.invoices, state.settings.userRfc);
}

function hasPaymentsIn(year: number): boolean {
  return state.dataset.invoices.some((i) => i.tipo === 'P' && i.pagos.some((p) => p.fechaPago.startsWith(String(year))));
}

function umaAnnualFor(year: number): number | null {
  return state.settings.umaOverride[year] ?? umaFor(year)?.annual ?? null;
}

function recompute(): void {
  if (state.dataset.invoices.length === 0) {
    state.analysis = null;
    return;
  }
  const year = currentYear();
  state.settings.year = year;
  state.analysis = analyze(state.dataset.invoices, state.settings.userRfc, year, {
    umaAnnual: umaAnnualFor(year),
    income: state.settings.income,
    prevYearIncome: state.settings.prevYearIncome,
  });
}

/* ------------------------------------------------------------------ render */

function renderAll(): void {
  const loaded = state.dataset.invoices.length > 0 || state.dataset.failures.length > 0;
  root.classList.toggle('is-loaded', loaded);
  $('results').hidden = !loaded;
  $('choose-label').textContent = loaded ? t('drop.add') : t('drop.choose');
  if (!state.analysis) return;
  syncSettingsForm();
  renderNotices();
  renderTabs();
  renderSummary();
  renderDeductions();
  renderTableControls();
  renderTable();
}

function renderNotices(): void {
  const a = state.analysis;
  if (!a) return;
  $('notices').innerHTML = noticesHtml({
    analysis: a,
    lang: state.settings.lang,
    userRfc: state.settings.userRfc,
    inferred: inferUserRfc(state.dataset.invoices),
    rfcDismissed: state.rfcDismissed,
    duplicates: state.dataset.duplicates,
    failures: state.dataset.failures,
    issues: state.issues,
    years: yearsIn(state.dataset.invoices),
  });
}

function renderTabs(): void {
  const a = state.analysis;
  for (const tab of ['summary', 'deductions', 'invoices'] as Tab[]) {
    const btn = $(`tab-${tab}`);
    const selected = state.tab === tab;
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  }
  if (a) {
    $('tab-deductions-count').textContent = String(a.deductions.counts.likely + a.deductions.counts.review);
    $('tab-invoices-count').textContent = String(a.rows.length);
  }
}

function renderSummary(): void {
  if (!state.analysis) return;
  const panel = $('panel-summary');
  panel.innerHTML = summaryHtml(state.analysis, state.settings.lang);
  applyBars(panel);
}

function renderDeductions(): void {
  const a = state.analysis;
  if (!a) return;
  const panel = $('panel-deductions');
  panel.innerHTML = deductionsHtml(a, state.settings.lang, umaFor(a.year), umaAnnualFor(a.year));
  applyBars(panel);
}

function setOptions(select: HTMLSelectElement, options: { value: string; label: string }[], value: string): void {
  const html = options.map((o) => `<option value="${h(o.value)}">${h(o.label)}</option>`).join('');
  if (select.dataset.html !== html) {
    select.innerHTML = html;
    select.dataset.html = html;
  }
  select.value = options.some((o) => o.value === value) ? value : (options[0]?.value ?? '');
}

function renderTableControls(): void {
  const a = state.analysis;
  if (!a) return;
  const lang = state.settings.lang;
  $('table-title').textContent = t('table.title', { year: a.year });
  const all = { value: 'all', label: t('table.all') };
  setOptions(
    $('f-status') as HTMLSelectElement,
    [all, ...(['likely', 'review', 'no', 'na'] as const).map((s) => ({ value: s, label: t(`status.${s}`) }))],
    state.table.status,
  );
  const tipos = Array.from(new Set(a.rows.map((r) => r.invoice.tipo))).sort();
  setOptions($('f-type') as HTMLSelectElement, [all, ...tipos.map((x) => ({ value: x, label: t(`type.${x}`) }))], state.table.tipo);
  const cats = CATEGORY_IDS.filter((c) => a.rows.some((r) => r.category === c));
  setOptions($('f-category') as HTMLSelectElement, [all, ...cats.map((c) => ({ value: c, label: t(`cat.${c}`) }))], state.table.category);
  const months = Array.from(new Set(a.rows.map((r) => r.invoice.month))).sort();
  setOptions($('f-month') as HTMLSelectElement, [all, ...months.map((m) => ({ value: m, label: `${monthLabel(m, lang)} ${m.slice(0, 4)}` }))], state.table.month);
  const q = $('q') as HTMLInputElement;
  if (document.activeElement !== q) q.value = state.table.query;
  $('inv-head').innerHTML = tableHeadHtml(state.table.sort, lang);
}

function filteredRows(): Row[] {
  const a = state.analysis;
  if (!a) return [];
  const { query, status, tipo, category, month, sort } = state.table;
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const rows = a.rows.filter(
    (r) =>
      (status === 'all' || r.deduction.status === status) &&
      (tipo === 'all' || r.invoice.tipo === tipo) &&
      (category === 'all' || r.category === category) &&
      (month === 'all' || r.invoice.month === month) &&
      (terms.length === 0 || terms.every((term) => searchText(r.invoice).includes(term))),
  );
  const dir = sort.dir === 'asc' ? 1 : -1;
  const lang = state.settings.lang;
  const cmp: Record<SortCol, (x: Row, y: Row) => number> = {
    date: (x, y) => x.invoice.fecha.localeCompare(y.invoice.fecha),
    issuer: (x, y) => (x.invoice.emisor.nombre || x.invoice.emisor.rfc).localeCompare(y.invoice.emisor.nombre || y.invoice.emisor.rfc, lang),
    type: (x, y) => x.invoice.tipo.localeCompare(y.invoice.tipo),
    use: (x, y) => x.invoice.receptor.usoCfdi.localeCompare(y.invoice.receptor.usoCfdi),
    category: (x, y) => t(`cat.${x.category}`).localeCompare(t(`cat.${y.category}`), lang),
    total: (x, y) => x.invoice.totalMxn - y.invoice.totalMxn,
    status: (x, y) => STATUS_RANK[x.deduction.status] - STATUS_RANK[y.deduction.status],
  };
  return rows.sort((x, y) => cmp[sort.col](x, y) * dir || x.invoice.fecha.localeCompare(y.invoice.fecha) * -1);
}

function renderTable(): void {
  const rows = filteredRows();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.table.page = Math.min(Math.max(1, state.table.page), pages);
  const start = (state.table.page - 1) * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  $('inv-body').innerHTML = tableBodyHtml(slice, state.settings.lang);
  $('pager').innerHTML = pagerHtml(state.table.page, pages, rows.length ? start + 1 : 0, start + slice.length, rows.length, state.settings.lang);
}

function syncSettingsForm(): void {
  const a = state.analysis;
  const s = state.settings;
  const rfc = $('rfc') as HTMLInputElement;
  if (document.activeElement !== rfc) rfc.value = s.userRfc;
  const years = Array.from(new Set([...yearsIn(state.dataset.invoices), ...(a ? [a.year] : [])])).sort((x, y) => y - x);
  setOptions(
    $('year') as HTMLSelectElement,
    years.map((y) => ({ value: String(y), label: String(y) })),
    String(a?.year ?? ''),
  );
  const year = a?.year ?? new Date().getFullYear();
  const uma = umaFor(year);
  const umaInput = $('uma') as HTMLInputElement;
  const umaValue = umaAnnualFor(year);
  if (document.activeElement !== umaInput) umaInput.value = umaValue === null ? '' : String(umaValue);
  $('uma-help').innerHTML = uma
    ? `${h(t('settings.umaHelp', { year, value: formatMoney(uma.annual, s.lang), dof: uma.dof }))} <a href="${h(uma.url)}" target="_blank" rel="noopener noreferrer">${h(t('settings.umaSource'))}</a>`
    : h(t('settings.umaUnknown', { year }));
  const income = $('income') as HTMLInputElement;
  if (document.activeElement !== income) income.value = s.income === null ? '' : String(s.income);
  const prev = $('prev-income') as HTMLInputElement;
  if (document.activeElement !== prev) prev.value = s.prevYearIncome === null ? '' : String(s.prevYearIncome);
  const payrollBtn = $('use-payroll') as HTMLButtonElement;
  const gross = a ? a.payroll.percepciones + a.payroll.otrosPagos : 0;
  payrollBtn.hidden = !a || a.payroll.count === 0;
  payrollBtn.textContent = t('settings.useNomina', { amount: formatMoney(gross, s.lang) });
  payrollBtn.dataset.amount = String(Math.round(gross * 100) / 100);
  ($('persist') as HTMLInputElement).checked = state.persist;
}

/* ------------------------------------------------------------------ persistencia */

let saveTimer = 0;
function schedulePersist(): void {
  if (!state.persist) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveState({ version: 1, savedAt: new Date().toISOString(), dataset: state.dataset, settings: state.settings })
      .then(() => announce(t('settings.saved')))
      .catch(() => undefined);
  }, 400);
}

function update(options: { resetPage?: boolean } = {}): void {
  if (options.resetPage) state.table.page = 1;
  recompute();
  renderAll();
  schedulePersist();
}

/* ------------------------------------------------------------------ carga */

async function ingest(getSources: () => Promise<{ sources: XmlSource[]; issues: IngestIssue[] }>): Promise<void> {
  if (state.busy) return;
  state.busy = true;
  const progress = $('progress');
  const text = $('progress-text');
  const fill = $('progress-fill');
  progress.hidden = false;
  text.textContent = t('progress.reading');
  fill.style.setProperty('--w', '0');
  const t0 = performance.now();
  try {
    const { sources, issues } = await getSources();
    const results = await parseSources(sources, (done, total) => {
      text.textContent = t('progress.parsing', { done, total });
      fill.style.setProperty('--w', String(total ? (done / total) * 100 : 100));
    });
    const before = state.dataset.invoices.length;
    state.dataset = mergeResults(state.dataset, results);
    state.issues = [...state.issues, ...issues];
    if (!state.settings.year) state.settings.year = null;
    update({ resetPage: true });
    const ms = Math.round(performance.now() - t0);
    const added = state.dataset.invoices.length - before;
    const message = t('progress.done', { count: added, ms });
    text.textContent = message;
    root.dataset.lastLoadMs = String(ms);
    root.dataset.invoiceCount = String(state.dataset.invoices.length);
    announce(message);
  } finally {
    state.busy = false;
  }
}

async function loadFiles(files: File[]): Promise<void> {
  if (files.length === 0) return;
  await ingest(() => readFiles(files));
}

async function loadDemo(): Promise<void> {
  await ingest(async () => {
    const files = generateDataset({ count: 420, year: 2025, seed: 2025 });
    return { sources: files.map((f) => ({ name: f.name, text: f.xml })), issues: [] };
  });
}

/** Recorre carpetas arrastradas (webkitGetAsEntry) para encontrar XML y ZIP. */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 0) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      out.push(file);
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of batch) await walk(child);
      } while (batch.length > 0);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

/* ------------------------------------------------------------------ exportar e imprimir */

function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCsv(excel: boolean): void {
  const a = state.analysis;
  if (!a) return;
  const csv = rowsToCsv(filteredRows(), { lang: state.settings.lang, excel });
  download(`facturas-${a.year}${excel ? '-excel' : ''}.csv`, csv, 'text/csv;charset=utf-8');
}

function printSummary(): void {
  const a = state.analysis;
  if (!a) return;
  $('print-summary').innerHTML = printHtml(a, state.settings.lang, state.settings.userRfc);
  window.print();
}

/* ------------------------------------------------------------------ detalle */

function openDetail(key: string, opener: HTMLElement | null): void {
  const a = state.analysis;
  const row = a?.rows.find((r) => r.invoice.key === key);
  if (!a || !row) return;
  const dialog = $('detail') as HTMLDialogElement;
  const payments = indexPayments(state.dataset.invoices).get(row.invoice.uuid) ?? [];
  const byUuid = new Map(state.dataset.invoices.map((i) => [i.uuid, i] as const));
  dialog.innerHTML = detailHtml(row, state.settings.lang, payments, byUuid);
  dialog.showModal();
  $('detail-close').focus();
  dialog.addEventListener(
    'close',
    () => {
      opener?.focus();
    },
    { once: true },
  );
}

/* ------------------------------------------------------------------ eventos */

function setTab(tab: Tab, focus = false): void {
  state.tab = tab;
  renderTabs();
  if (focus) $(`tab-${tab}`).focus();
}

function bindEvents(): void {
  const fileInput = $('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    void loadFiles(files);
  });
  $('demo-btn').addEventListener('click', () => void loadDemo());

  const zone = $('dropzone');
  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  zone.addEventListener('dragleave', (e) => {
    if (e.target === zone) zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    if (e.dataTransfer) void filesFromDataTransfer(e.dataTransfer).then(loadFiles);
  });

  $('lang-toggle').addEventListener('click', () => {
    state.settings.lang = state.settings.lang === 'es' ? 'en' : 'es';
    mount();
    $('lang-toggle').focus();
    schedulePersist();
  });

  // Ajustes
  const rfc = $('rfc') as HTMLInputElement;
  rfc.addEventListener('input', () => {
    const value = rfc.value.trim().toUpperCase();
    const valid = value === '' || isRfcShape(value);
    rfc.setAttribute('aria-invalid', String(!valid));
    $('rfc-error').hidden = valid;
    if (valid && value !== state.settings.userRfc) {
      state.settings.userRfc = value;
      update({ resetPage: true });
    }
  });
  ($('year') as HTMLSelectElement).addEventListener('change', (e) => {
    state.settings.year = Number((e.target as HTMLSelectElement).value) || null;
    update({ resetPage: true });
  });
  $('uma').addEventListener('change', (e) => {
    const year = state.analysis?.year;
    if (!year) return;
    const v = parseAmount((e.target as HTMLInputElement).value);
    if (v === null || v === umaFor(year)?.annual) delete state.settings.umaOverride[year];
    else state.settings.umaOverride[year] = v;
    update();
  });
  $('income').addEventListener('change', (e) => {
    state.settings.income = parseAmount((e.target as HTMLInputElement).value);
    update();
  });
  $('prev-income').addEventListener('change', (e) => {
    state.settings.prevYearIncome = parseAmount((e.target as HTMLInputElement).value);
    update();
  });
  $('use-payroll').addEventListener('click', (e) => {
    state.settings.income = Number((e.currentTarget as HTMLElement).dataset.amount) || null;
    update();
  });
  $('settings').addEventListener('submit', (e) => e.preventDefault());
  ($('persist') as HTMLInputElement).addEventListener('change', (e) => {
    state.persist = (e.target as HTMLInputElement).checked;
    if (state.persist) schedulePersist();
    else void wipeState();
  });
  $('clear-all').addEventListener('click', () => {
    if (!window.confirm(t('settings.clearConfirm'))) return;
    void wipeState().then(() => {
      const lang = state.settings.lang;
      state.dataset = emptyDataset();
      state.issues = [];
      state.settings = { userRfc: '', year: null, income: null, prevYearIncome: null, umaOverride: {}, lang };
      state.persist = false;
      state.rfcDismissed = false;
      state.analysis = null;
      state.tab = 'summary';
      mount();
      $('progress').hidden = true;
      toast(t('settings.cleared'));
      announce(t('settings.cleared'));
    });
  });

  // Avisos (delegación)
  $('notices').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('#infer-yes')) {
      state.settings.userRfc = (target.closest('#infer-yes') as HTMLElement).dataset.rfc ?? '';
      update({ resetPage: true });
      $('rfc').focus();
    } else if (target.closest('#infer-no')) {
      state.rfcDismissed = true;
      renderNotices();
      $('rfc').focus();
    }
  });

  // Pestañas con teclado (patrón ARIA tabs)
  const tablist = root.querySelector<HTMLElement>('[role="tablist"]')!;
  tablist.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (btn) setTab(btn.dataset.tab as Tab);
  });
  tablist.addEventListener('keydown', (e) => {
    const order: Tab[] = ['summary', 'deductions', 'invoices'];
    const idx = order.indexOf(state.tab);
    const moves: Record<string, number> = {
      ArrowRight: (idx + 1) % order.length,
      ArrowLeft: (idx - 1 + order.length) % order.length,
      Home: 0,
      End: order.length - 1,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setTab(order[next]!, true);
  });

  // Deducciones: ver en la tabla con filtro
  $('panel-deductions').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-filter-status]');
    if (!btn) return;
    state.table = { ...state.table, status: btn.dataset.filterStatus as DeductionStatus, page: 1 };
    renderTableControls();
    renderTable();
    setTab('invoices', true);
  });

  // Tabla
  let searchTimer = 0;
  $('q').addEventListener('input', (e) => {
    window.clearTimeout(searchTimer);
    const value = (e.target as HTMLInputElement).value;
    searchTimer = window.setTimeout(() => {
      state.table.query = value;
      state.table.page = 1;
      renderTable();
    }, 120);
  });
  const filters: [string, keyof TableState][] = [
    ['f-status', 'status'],
    ['f-type', 'tipo'],
    ['f-category', 'category'],
    ['f-month', 'month'],
  ];
  for (const [id, key] of filters) {
    $(id).addEventListener('change', (e) => {
      (state.table as unknown as Record<string, unknown>)[key] = (e.target as HTMLSelectElement).value;
      state.table.page = 1;
      renderTable();
    });
  }
  $('inv-head').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sort]');
    if (!btn) return;
    const col = btn.dataset.sort as SortCol;
    const same = state.table.sort.col === col;
    state.table.sort = { col, dir: same && state.table.sort.dir === 'desc' ? 'asc' : same ? 'desc' : col === 'date' || col === 'total' ? 'desc' : 'asc' };
    $('inv-head').innerHTML = tableHeadHtml(state.table.sort, state.settings.lang);
    renderTable();
    root.querySelector<HTMLElement>(`[data-sort="${col}"]`)?.focus();
  });
  $('inv-body').addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const tr = target.closest<HTMLElement>('tr[data-key]');
    if (!tr || target.closest('a')) return;
    const opener = tr.querySelector<HTMLElement>('.row-open');
    openDetail(tr.dataset.key!, opener);
  });
  $('pager').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-page]');
    if (!btn || btn.disabled) return;
    state.table.page = Number(btn.dataset.page);
    renderTable();
    $('panel-invoices').scrollIntoView({ block: 'start' });
  });

  $('export-csv').addEventListener('click', () => exportCsv(false));
  $('export-excel').addEventListener('click', () => exportCsv(true));
  $('print-btn').addEventListener('click', printSummary);

  // Detalle
  const dialog = $('detail') as HTMLDialogElement;
  dialog.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target === dialog || target.closest('#detail-close')) dialog.close();
    const copy = target.closest<HTMLElement>('#copy-uuid');
    if (copy) {
      void navigator.clipboard?.writeText(copy.dataset.uuid ?? '').then(
        () => toast(t('detail.copied')),
        () => undefined,
      );
    }
  });

  window.addEventListener('beforeprint', () => {
    if (state.analysis && !$('print-summary').innerHTML) {
      $('print-summary').innerHTML = printHtml(state.analysis, state.settings.lang, state.settings.userRfc);
    }
  });
}

/** Evita que soltar un archivo fuera de la zona haga que el navegador lo abra. */
function guardWindowDrop(): void {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

function mount(): void {
  setLang(state.settings.lang);
  document.documentElement.lang = state.settings.lang === 'es' ? 'es-MX' : 'en';
  document.title = state.settings.lang === 'es' ? 'facturas-cfdi · Ordena tus facturas CFDI sin subirlas' : 'facturas-cfdi · Sort your CFDI invoices without uploading them';
  root.innerHTML = shellHtml(state.settings.lang);
  bindEvents();
  renderAll();
}

export async function start(container: HTMLElement): Promise<void> {
  root = container;
  guardWindowDrop();
  const params = new URLSearchParams(location.search);
  if (params.get('lang') === 'en') state.settings.lang = 'en';
  mount();
  if (await hasSaved()) {
    const saved = await loadState().catch(() => null);
    if (saved) {
      state.dataset = saved.dataset;
      state.settings = { ...state.settings, ...saved.settings };
      state.persist = true;
      setLang(state.settings.lang);
      recompute();
      mount();
    }
  }
}
