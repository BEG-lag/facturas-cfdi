import { FORMAS_PAGO_LEGALES, isDeductionKey, REGIMENES_DEDUCCION_PERSONAL, RFC_EXTRANJERO, RFC_PUBLICO_GENERAL } from './catalogs.ts';
import { looksLikePersonalDeduction } from './categories.ts';
import { doctoPaidMxn } from './parser.ts';
import { BANKED_PAYMENT_REQUIRED, LENTES_LIMIT, normalizeNivel } from './rules.ts';
import type { DeductionResult, DeductionStatus, Invoice, Reason, Role } from './types.ts';

/** Un pago aplicado a una factura PPD, tomado de un CFDI de tipo P. */
export interface AppliedPayment {
  paymentUuid: string;
  fechaPago: string;
  year: number;
  formaDePago: string;
  amountMxn: number;
}

export interface ClassifyContext {
  /** RFC de la persona usuaria, en mayúsculas. Vacío si no lo ha indicado. */
  userRfc: string;
  /** Ejercicio fiscal a evaluar. */
  year: number;
  paymentsByUuid: Map<string, AppliedPayment[]>;
  creditsByUuid: Map<string, Invoice[]>;
}

/** Tipos de relación que reducen el monto de la factura original (c_TipoRelacion 01 y 03). */
const REDUCING_RELATIONS = ['01', '03'];

export function roleOf(invoice: Invoice, userRfc: string): Role {
  if (!userRfc) return 'received';
  if (invoice.receptor.rfc === userRfc) return 'received';
  if (invoice.emisor.rfc === userRfc) return 'issued';
  return 'other';
}

/** Índice UUID de factura -> pagos aplicados, a partir de los CFDI de pago (tipo P). */
export function indexPayments(invoices: Invoice[]): Map<string, AppliedPayment[]> {
  const map = new Map<string, AppliedPayment[]>();
  for (const inv of invoices) {
    if (inv.tipo !== 'P') continue;
    for (const pago of inv.pagos) {
      for (const docto of pago.doctos) {
        if (!docto.idDocumento) continue;
        const list = map.get(docto.idDocumento) ?? [];
        list.push({
          paymentUuid: inv.uuid,
          fechaPago: pago.fechaPago,
          year: Number(pago.fechaPago.slice(0, 4)) || 0,
          formaDePago: pago.formaDePago,
          amountMxn: doctoPaidMxn(pago, docto),
        });
        map.set(docto.idDocumento, list);
      }
    }
  }
  return map;
}

/** Índice UUID de factura -> notas de crédito (tipo E) que la reducen. */
export function indexCredits(invoices: Invoice[]): Map<string, Invoice[]> {
  const map = new Map<string, Invoice[]>();
  for (const inv of invoices) {
    if (inv.tipo !== 'E') continue;
    for (const rel of inv.relacionados) {
      if (!REDUCING_RELATIONS.includes(rel.tipoRelacion)) continue;
      for (const uuid of rel.uuids) {
        const list = map.get(uuid) ?? [];
        list.push(inv);
        map.set(uuid, list);
      }
    }
  }
  return map;
}

export function buildContext(invoices: Invoice[], userRfc: string, year: number): ClassifyContext {
  return {
    userRfc: userRfc.trim().toUpperCase(),
    year,
    paymentsByUuid: indexPayments(invoices),
    creditsByUuid: indexCredits(invoices),
  };
}

const RANK: Record<DeductionStatus, number> = { na: 0, likely: 1, review: 2, no: 3 };

function statusFrom(reasons: Reason[], base: DeductionStatus): DeductionStatus {
  let status = base;
  for (const r of reasons) {
    const candidate: DeductionStatus = r.level === 'no' ? 'no' : r.level === 'review' ? 'review' : status;
    if (RANK[candidate] > RANK[status]) status = candidate;
  }
  return status;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

const INSCRIPCION = /inscripci/i;
const LENTES = /\blentes?\b|anteojos|armaz[oó]n|micas?\b/i;
const INCAPACIDAD = /incapacidad|discapacidad/i;

function notApplicable(code: string, params?: Record<string, string | number>): DeductionResult {
  return {
    status: 'na',
    key: null,
    amount: 0,
    reasons: [{ code, level: 'info', ...(params ? { params } : {}) }],
    students: [],
  };
}

/**
 * Clasifica una factura para el ejercicio indicado. Nunca afirma que algo ES deducible:
 * "likely" significa "posiblemente deducible" según lo que se puede revisar sin conexión.
 */
export function classify(invoice: Invoice, ctx: ClassifyContext): DeductionResult {
  const role = roleOf(invoice, ctx.userRfc);
  const uso = invoice.receptor.usoCfdi;

  if (invoice.tipo === 'P') return notApplicable('payment-complement');
  if (invoice.tipo === 'N') return notApplicable(role === 'issued' ? 'payroll-issued' : 'payroll');
  if (invoice.tipo === 'T') return notApplicable('transfer');
  if (role === 'issued') return notApplicable('issued-by-you');
  if (invoice.tipo === 'E') {
    if (!isDeductionKey(uso) || role !== 'received') return notApplicable('credit-note');
    const linked = invoice.relacionados.some((r) => REDUCING_RELATIONS.includes(r.tipoRelacion) && r.uuids.length > 0);
    if (linked) return notApplicable('credit-note-applied');
    return {
      status: 'review',
      key: uso,
      amount: 0,
      reasons: [{ code: 'credit-note-unlinked', level: 'review', params: { amount: invoice.totalMxn } }],
      students: [],
    };
  }

  // Desde aquí: tipo I (ingreso) recibido o de otro RFC.
  const reasons: Reason[] = [];
  const receptorRfc = invoice.receptor.rfc;
  if (receptorRfc === RFC_PUBLICO_GENERAL) {
    reasons.push({ code: 'generic-rfc', level: 'no', rule: 'anexo20-receptor' });
  } else if (receptorRfc === RFC_EXTRANJERO) {
    reasons.push({ code: 'foreign-rfc', level: 'no', rule: 'anexo20-receptor' });
  } else if (role === 'other') {
    reasons.push({ code: 'other-rfc', level: 'no', params: { rfc: receptorRfc }, rule: 'lisr-151-I' });
  }

  if (!isDeductionKey(uso)) {
    if (uso === 'P01') {
      reasons.push({ code: 'uso-p01', level: 'review', rule: 'faq33-uso' });
    } else {
      const area = looksLikePersonalDeduction(invoice);
      if (area && reasons.length === 0) {
        reasons.push({
          code: invoice.version === '4.0' ? 'uso-mismatch-40' : 'uso-mismatch-33',
          level: 'review',
          params: { uso: uso || '-', area },
          rule: invoice.version === '4.0' ? 'faq40-uso' : 'faq33-uso',
        });
      } else {
        reasons.push({ code: 'uso-not-deduction', level: 'no', params: { uso: uso || '-' } });
      }
    }
    const amount = invoice.year === ctx.year ? invoice.totalMxn : 0;
    return { status: statusFrom(reasons, 'likely'), key: null, amount, reasons, students: [] };
  }

  const key = uso;

  // Pago efectivamente realizado en el ejercicio.
  let amount = 0;
  let formas: string[] = [];
  if (invoice.metodoPago === 'PPD') {
    const pays = ctx.paymentsByUuid.get(invoice.uuid) ?? [];
    if (pays.length === 0) {
      reasons.push({ code: 'ppd-no-payment', level: 'review', rule: 'guia-pagos' });
      amount = invoice.year === ctx.year ? invoice.totalMxn : 0;
    } else {
      const inYear = pays.filter((p) => p.year === ctx.year);
      if (inYear.length === 0) {
        const years = Array.from(new Set(pays.map((p) => p.year))).join(', ');
        reasons.push({ code: 'paid-other-year', level: 'no', params: { years }, rule: 'lisr-151-pagadas' });
      } else {
        amount = inYear.reduce((s, p) => s + p.amountMxn, 0);
        formas = Array.from(new Set(inYear.map((p) => p.formaDePago)));
        reasons.push({ code: 'ppd-paid', level: 'info', params: { count: inYear.length }, rule: 'guia-pagos' });
      }
    }
  } else {
    formas = [invoice.formaPago];
    if (invoice.year !== ctx.year) {
      reasons.push({ code: 'other-year', level: 'no', params: { year: invoice.year }, rule: 'lisr-151-pagadas' });
    } else {
      amount = invoice.totalMxn;
    }
  }

  // Notas de crédito relacionadas (tipo E) reducen el monto.
  const credits = (ctx.creditsByUuid.get(invoice.uuid) ?? []).filter((c) => roleOf(c, ctx.userRfc) === 'received');
  if (credits.length > 0 && amount > 0) {
    const creditTotal = credits.reduce((s, c) => s + c.totalMxn, 0);
    amount = Math.max(0, amount - creditTotal);
    reasons.push({ code: 'credit-applied', level: 'info', params: { amount: round2(creditTotal) } });
  }

  // Medio de pago.
  const requiredRule = BANKED_PAYMENT_REQUIRED[key];
  for (const forma of formas) {
    if (forma === '01') {
      if (requiredRule) {
        reasons.push({ code: 'cash', level: 'no', rule: requiredRule });
      } else if (key === 'D02') {
        reasons.push({ code: 'cash-incapacidad', level: 'review', rule: 'lisr-151-I-medios' });
      } else {
        reasons.push({ code: 'cash-not-required', level: 'review', rule: 'sat-minisitio' });
      }
    } else if (forma === '99') {
      reasons.push({ code: 'forma-99', level: 'review', rule: 'guia40-forma' });
    } else if (!forma) {
      reasons.push({ code: 'forma-missing', level: 'review' });
    } else if (!FORMAS_PAGO_LEGALES.includes(forma) && requiredRule) {
      reasons.push({ code: 'forma-not-listed', level: 'review', params: { forma }, rule: requiredRule });
    }
  }

  // Régimen del receptor admitido para claves D (sólo CFDI 4.0 trae RegimenFiscalReceptor).
  const regimen = invoice.receptor.regimenFiscal;
  if (invoice.version === '4.0' && regimen && !REGIMENES_DEDUCCION_PERSONAL.includes(regimen)) {
    reasons.push({ code: 'regime-not-allowed', level: 'review', params: { regimen }, rule: 'catalogo-uso' });
  }

  const students: DeductionResult['students'] = [];
  const text = invoice.conceptos.map((c) => c.descripcion).join(' ');

  switch (key) {
    case 'D01': {
      if (invoice.conceptos.some((c) => c.claveProdServ.startsWith('51'))) {
        reasons.push({ code: 'medicines', level: 'review', rule: 'rlisr-264' });
      }
      if (invoice.conceptos.some((c) => c.claveProdServ.startsWith('421429') || LENTES.test(c.descripcion))) {
        reasons.push({ code: 'lenses', level: 'review', params: { limit: LENTES_LIMIT }, rule: 'rlisr-264' });
      }
      reasons.push({ code: 'beneficiaries', level: 'info', rule: 'lisr-151-I' });
      break;
    }
    case 'D02': {
      const mentions = INCAPACIDAD.test(text) || invoice.leyendas.some((l) => INCAPACIDAD.test(l));
      if (!mentions) {
        reasons.push({ code: 'incapacidad-spec', level: 'review', rule: 'lisr-151-I-incapacidad' });
      }
      reasons.push({ code: 'incapacidad-50', level: 'info', rule: 'lisr-151-I-incapacidad' });
      break;
    }
    case 'D03':
      reasons.push({ code: 'funeral-cap', level: 'info', rule: 'lisr-151-II' });
      break;
    case 'D04':
      if (invoice.donataria) {
        reasons.push({
          code: 'donat-complement',
          level: 'info',
          params: { no: invoice.donataria.noAutorizacion || '-' },
          rule: 'sat-donatarias',
        });
      } else {
        reasons.push({ code: 'donat-check', level: 'review', rule: 'sat-donatarias' });
      }
      reasons.push({ code: 'donat-cap', level: 'info', rule: 'lisr-151-III' });
      break;
    case 'D05':
      reasons.push({ code: 'mortgage-real-interest', level: 'review', rule: 'lisr-151-IV' });
      break;
    case 'D06':
      reasons.push({ code: 'retiro-cap', level: 'info', rule: 'lisr-151-V' });
      break;
    case 'D07':
      reasons.push({ code: 'insurance-beneficiary', level: 'info', rule: 'lisr-151-VI' });
      break;
    case 'D08':
      reasons.push({ code: 'transport-mandatory', level: 'review', rule: 'rlisr-269' });
      break;
    case 'D09':
      reasons.push({ code: 'ahorro-cap', level: 'info', rule: 'lisr-185' });
      break;
    case 'D10': {
      const net = (c: Invoice['conceptos'][number]) => Math.max(0, c.importe - c.descuento);
      const allNet = invoice.conceptos.reduce((s, c) => s + net(c), 0);
      const share = allNet > 0 ? amount / allNet : 0;
      const enrollment = invoice.conceptos.filter((c) => INSCRIPCION.test(c.descripcion));
      if (enrollment.length > 0) {
        const excluded = enrollment.reduce((s, c) => s + net(c), 0) * share;
        amount = Math.max(0, amount - excluded);
        reasons.push({ code: 'enrollment-excluded', level: 'info', params: { amount: round2(excluded) }, rule: 'decreto-1.8' });
      }
      const withIedu = invoice.conceptos.filter((c) => c.iedu && !INSCRIPCION.test(c.descripcion));
      if (withIedu.length === 0) {
        reasons.push({ code: 'iedu-missing', level: 'review', rule: 'sat-colegiaturas' });
      }
      for (const c of withIedu) {
        const iedu = c.iedu!;
        const nivel = normalizeNivel(iedu.nivelEducativo);
        if (!nivel) {
          reasons.push({ code: 'nivel-unknown', level: 'review', params: { nivel: iedu.nivelEducativo || '-' }, rule: 'decreto-1.10' });
        }
        if (iedu.rfcPago && ctx.userRfc && iedu.rfcPago !== ctx.userRfc) {
          reasons.push({ code: 'rfc-pago-mismatch', level: 'review', params: { rfc: iedu.rfcPago }, rule: 'decreto-1.8' });
        }
        students.push({ curp: iedu.curp, nombre: iedu.nombreAlumno, nivel: nivel ?? '', amount: round2(net(c) * share) });
      }
      reasons.push({ code: 'becas', level: 'info', rule: 'decreto-1.8' });
      break;
    }
  }

  const status = statusFrom(reasons, 'likely');
  return { status, key, amount: round2(amount), reasons, students: dedupeStudents(students) };
}

function dedupeStudents(list: DeductionResult['students']): DeductionResult['students'] {
  const map = new Map<string, DeductionResult['students'][number]>();
  for (const s of list) {
    const k = `${s.curp}|${s.nivel}`;
    const prev = map.get(k);
    if (prev) prev.amount = round2(prev.amount + s.amount);
    else map.set(k, { ...s });
  }
  return Array.from(map.values());
}

/** Infiere el RFC de la persona: el receptor más frecuente, sin RFC genéricos. */
export function inferUserRfc(invoices: Invoice[]): { rfc: string; count: number; total: number } | null {
  const counts = new Map<string, number>();
  let total = 0;
  for (const inv of invoices) {
    const rfc = inv.receptor.rfc;
    if (!rfc || rfc === RFC_PUBLICO_GENERAL || rfc === RFC_EXTRANJERO) continue;
    if (inv.tipo === 'P' || inv.tipo === 'T') continue;
    counts.set(rfc, (counts.get(rfc) ?? 0) + 1);
    total++;
  }
  let best: { rfc: string; count: number; total: number } | null = null;
  for (const [rfc, count] of counts) {
    if (!best || count > best.count) best = { rfc, count, total };
  }
  return best;
}
