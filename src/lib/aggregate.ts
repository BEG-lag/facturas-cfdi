import { summarizeDeductions, type CapSettings, type DeductionSummary } from './caps.ts';
import { categorize, type CategoryId } from './categories.ts';
import { buildContext, classify, roleOf } from './classifier.ts';
import type { DeductionResult, Invoice, ParseFailure, ParseResult, Role } from './types.ts';

export interface Duplicate {
  key: string;
  fileName: string;
  firstFileName: string;
}

export interface Dataset {
  invoices: Invoice[];
  duplicates: Duplicate[];
  failures: ParseFailure[];
}

export function emptyDataset(): Dataset {
  return { invoices: [], duplicates: [], failures: [] };
}

/** Agrega resultados de parseo a un conjunto, descartando duplicados por UUID. */
export function mergeResults(dataset: Dataset, results: ParseResult[]): Dataset {
  const byKey = new Map(dataset.invoices.map((i) => [i.key, i] as const));
  const invoices = dataset.invoices.slice();
  const duplicates = dataset.duplicates.slice();
  const failures = dataset.failures.slice();
  for (const r of results) {
    if (!r.ok) {
      failures.push(r.error);
      continue;
    }
    const prev = byKey.get(r.invoice.key);
    if (prev) {
      duplicates.push({ key: r.invoice.key, fileName: r.invoice.fileName, firstFileName: prev.fileName });
      continue;
    }
    byKey.set(r.invoice.key, r.invoice);
    invoices.push(r.invoice);
  }
  return { invoices, duplicates, failures };
}

export interface Row {
  invoice: Invoice;
  role: Role;
  category: CategoryId;
  deduction: DeductionResult;
}

export interface Analysis {
  year: number;
  rows: Row[];
  spending: { gross: number; credits: number; net: number; count: number; creditCount: number };
  byMonth: { month: string; amount: number }[];
  byCategory: { category: CategoryId; amount: number; count: number }[];
  topIssuers: { rfc: string; nombre: string; amount: number; count: number }[];
  payroll: { count: number; percepciones: number; otrosPagos: number; deducciones: number; isr: number; neto: number };
  issued: { count: number; total: number };
  otherRfcCount: number;
  paymentCount: number;
  transferCount: number;
  foreignCurrencyCount: number;
  deductions: DeductionSummary;
}

export function yearsIn(invoices: Invoice[]): number[] {
  return Array.from(new Set(invoices.map((i) => i.year).filter((y) => y > 0))).sort((a, b) => b - a);
}

/** Año con más facturas recibidas; sirve como ejercicio por omisión. */
export function defaultYear(invoices: Invoice[], userRfc: string): number {
  const counts = new Map<number, number>();
  for (const inv of invoices) {
    if (inv.tipo !== 'I' || roleOf(inv, userRfc) !== 'received') continue;
    counts.set(inv.year, (counts.get(inv.year) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [year, count] of counts) {
    if (count > bestCount || (count === bestCount && year > best)) {
      best = year;
      bestCount = count;
    }
  }
  return best || yearsIn(invoices)[0] || new Date().getFullYear();
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function analyze(invoices: Invoice[], userRfc: string, year: number, caps: CapSettings): Analysis {
  const ctx = buildContext(invoices, userRfc, year);
  const byUuid = new Map(invoices.filter((i) => i.uuid).map((i) => [i.uuid, i] as const));
  /** Una nota de crédito hereda la categoría de la factura que corrige, si está cargada. */
  const categoryOf = (invoice: Invoice): CategoryId => {
    if (invoice.tipo === 'E') {
      for (const rel of invoice.relacionados) {
        const original = rel.uuids.map((u) => byUuid.get(u)).find(Boolean);
        if (original) return categorize(original);
      }
    }
    return categorize(invoice);
  };
  const rows: Row[] = [];
  const months = new Map<string, number>();
  for (let m = 1; m <= 12; m++) months.set(`${year}-${String(m).padStart(2, '0')}`, 0);
  const categories = new Map<CategoryId, { amount: number; count: number }>();
  const issuers = new Map<string, { rfc: string; nombre: string; amount: number; count: number }>();
  const spending = { gross: 0, credits: 0, net: 0, count: 0, creditCount: 0 };
  const payroll = { count: 0, percepciones: 0, otrosPagos: 0, deducciones: 0, isr: 0, neto: 0 };
  const issued = { count: 0, total: 0 };
  let otherRfcCount = 0;
  let paymentCount = 0;
  let transferCount = 0;
  let foreignCurrencyCount = 0;

  for (const invoice of invoices) {
    const paidThisYear =
      invoice.metodoPago === 'PPD' && (ctx.paymentsByUuid.get(invoice.uuid) ?? []).some((p) => p.year === year);
    if (invoice.year !== year && !paidThisYear) continue;

    const role = roleOf(invoice, ctx.userRfc);
    const category = categoryOf(invoice);
    const deduction = classify(invoice, ctx);
    rows.push({ invoice, role, category, deduction });
    if (invoice.year !== year) continue;

    if (invoice.moneda !== 'MXN' && invoice.moneda !== 'XXX') foreignCurrencyCount++;
    if (invoice.tipo === 'P') paymentCount++;
    if (invoice.tipo === 'T') transferCount++;
    if (role === 'other') otherRfcCount++;

    if (invoice.tipo === 'N' && role === 'received' && invoice.nomina) {
      const n = invoice.nomina;
      payroll.count++;
      payroll.percepciones += n.totalPercepciones;
      payroll.otrosPagos += n.totalOtrosPagos;
      payroll.deducciones += n.totalDeducciones;
      payroll.isr += n.isrRetenido;
      payroll.neto += invoice.totalMxn;
      continue;
    }
    if (role === 'issued' && (invoice.tipo === 'I' || invoice.tipo === 'E')) {
      issued.count++;
      issued.total += invoice.tipo === 'E' ? -invoice.totalMxn : invoice.totalMxn;
      continue;
    }
    if (role !== 'received') continue;

    if (invoice.tipo === 'I' || invoice.tipo === 'E') {
      const sign = invoice.tipo === 'E' ? -1 : 1;
      const amount = sign * invoice.totalMxn;
      if (invoice.tipo === 'I') {
        spending.gross += invoice.totalMxn;
        spending.count++;
      } else {
        spending.credits += invoice.totalMxn;
        spending.creditCount++;
      }
      months.set(invoice.month, (months.get(invoice.month) ?? 0) + amount);
      const cat = categories.get(category) ?? { amount: 0, count: 0 };
      cat.amount += amount;
      cat.count += invoice.tipo === 'I' ? 1 : 0;
      categories.set(category, cat);
      const iss = issuers.get(invoice.emisor.rfc) ?? {
        rfc: invoice.emisor.rfc,
        nombre: invoice.emisor.nombre,
        amount: 0,
        count: 0,
      };
      iss.amount += amount;
      iss.count += invoice.tipo === 'I' ? 1 : 0;
      issuers.set(invoice.emisor.rfc, iss);
    }
  }
  spending.net = spending.gross - spending.credits;

  const deductionResults = rows.map((r) => r.deduction);
  return {
    year,
    rows,
    spending: {
      gross: round2(spending.gross),
      credits: round2(spending.credits),
      net: round2(spending.net),
      count: spending.count,
      creditCount: spending.creditCount,
    },
    byMonth: Array.from(months, ([month, amount]) => ({ month, amount: round2(amount) })).sort((a, b) =>
      a.month.localeCompare(b.month),
    ),
    byCategory: Array.from(categories, ([category, v]) => ({ category, amount: round2(v.amount), count: v.count }))
      .filter((c) => c.amount !== 0)
      .sort((a, b) => b.amount - a.amount),
    topIssuers: Array.from(issuers.values())
      .map((i) => ({ ...i, amount: round2(i.amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    payroll: {
      count: payroll.count,
      percepciones: round2(payroll.percepciones),
      otrosPagos: round2(payroll.otrosPagos),
      deducciones: round2(payroll.deducciones),
      isr: round2(payroll.isr),
      neto: round2(payroll.neto),
    },
    issued: { count: issued.count, total: round2(issued.total) },
    otherRfcCount,
    paymentCount,
    transferCount,
    foreignCurrencyCount,
    deductions: summarizeDeductions(deductionResults, caps),
  };
}
