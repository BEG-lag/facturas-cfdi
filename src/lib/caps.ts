import { DEDUCTION_KEYS } from './catalogs.ts';
import {
  AHORRO_185_LIMIT,
  COLEGIATURA_LIMITS,
  DONATIVOS_RATE,
  GLOBAL_CAP_INCOME_RATE,
  GLOBAL_CAP_UMAS,
  RETIRO_RATE,
  RETIRO_UMAS,
  SUBJECT_TO_GLOBAL_CAP,
} from './rules.ts';
import type { DeductionResult, DeductionStatus } from './types.ts';

export interface CapSettings {
  /** Valor anual de la UMA a usar (oficial o capturado). null si no se conoce. */
  umaAnnual: number | null;
  /** Ingresos totales del ejercicio, incluidos exentos (para el 15% y la fr. V). Opcional. */
  income: number | null;
  /** Ingresos acumulables del ejercicio anterior (para el 7% de donativos). Opcional. */
  prevYearIncome: number | null;
}

export interface KeyBreakdown {
  key: string;
  count: number;
  likely: number;
  review: number;
  /** Monto posiblemente deducible tras el tope propio de la clave (antes del tope global). */
  allowed: number;
  subjectToGlobal: boolean;
  /** Código de nota sobre el tope propio, si se aplicó o falta un dato. */
  capNote: string | null;
  capValue: number | null;
}

export interface DeductionSummary {
  byKey: KeyBreakdown[];
  umaCap: number | null;
  incomeCap: number | null;
  globalCap: number | null;
  subjectAllowed: number;
  subjectBeforeCap: number;
  outsideAllowed: number;
  /** Estimado de deducciones posiblemente deducibles, ya con topes. */
  estimatedTotal: number;
  reviewTotal: number;
  counts: Record<DeductionStatus, number>;
  notes: string[];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function summarizeDeductions(results: DeductionResult[], settings: CapSettings): DeductionSummary {
  const { umaAnnual, income, prevYearIncome } = settings;
  const counts: Record<DeductionStatus, number> = { likely: 0, review: 0, no: 0, na: 0 };
  const sums = new Map<string, { likely: number; review: number; count: number }>();
  const studentTotals = new Map<string, { amount: number; limit: number }>();

  for (const r of results) {
    counts[r.status]++;
    if (!r.key) continue;
    const entry = sums.get(r.key) ?? { likely: 0, review: 0, count: 0 };
    entry.count++;
    if (r.status === 'likely') entry.likely += r.amount;
    if (r.status === 'review') entry.review += r.amount;
    sums.set(r.key, entry);
    if (r.key === 'D10' && r.status === 'likely') {
      for (const s of r.students) {
        const limit = COLEGIATURA_LIMITS[s.nivel] ?? 0;
        const prev = studentTotals.get(s.curp) ?? { amount: 0, limit: 0 };
        // Si en el año hay dos niveles, aplica el tope mayor (Decreto art. 1.10).
        studentTotals.set(s.curp, { amount: prev.amount + s.amount, limit: Math.max(prev.limit, limit) });
      }
    }
  }

  const notes: string[] = [];
  if (umaAnnual === null) notes.push('uma-missing');
  if (income === null) notes.push('income-missing');

  const byKey: KeyBreakdown[] = [];
  for (const key of DEDUCTION_KEYS) {
    const s = sums.get(key);
    if (!s) continue;
    let allowed = s.likely;
    let capNote: string | null = null;
    let capValue: number | null = null;
    switch (key) {
      case 'D03':
        if (umaAnnual !== null) {
          capValue = umaAnnual;
          capNote = 'cap-funeral';
          allowed = Math.min(allowed, capValue);
        } else capNote = 'cap-needs-uma';
        break;
      case 'D04':
        if (prevYearIncome !== null) {
          capValue = prevYearIncome * DONATIVOS_RATE;
          capNote = 'cap-donativos';
          allowed = Math.min(allowed, capValue);
        } else capNote = 'cap-needs-prev-income';
        break;
      case 'D06': {
        const limits: number[] = [];
        if (umaAnnual !== null) limits.push(umaAnnual * RETIRO_UMAS);
        if (income !== null) limits.push(income * RETIRO_RATE);
        if (limits.length > 0) {
          capValue = Math.min(...limits);
          allowed = Math.min(allowed, capValue);
        }
        capNote = income === null ? 'cap-retiro-partial' : 'cap-retiro';
        break;
      }
      case 'D09':
        capValue = AHORRO_185_LIMIT;
        capNote = 'cap-ahorro';
        allowed = Math.min(allowed, capValue);
        break;
      case 'D10': {
        let total = 0;
        let limitSum = 0;
        for (const st of studentTotals.values()) {
          total += Math.min(st.amount, st.limit);
          limitSum += st.limit;
        }
        allowed = Math.min(allowed, total);
        capValue = limitSum || null;
        capNote = 'cap-colegiaturas';
        break;
      }
    }
    byKey.push({
      key,
      count: s.count,
      likely: round2(s.likely),
      review: round2(s.review),
      allowed: round2(allowed),
      subjectToGlobal: SUBJECT_TO_GLOBAL_CAP.includes(key),
      capNote,
      capValue: capValue === null ? null : round2(capValue),
    });
  }

  const umaCap = umaAnnual === null ? null : round2(umaAnnual * GLOBAL_CAP_UMAS);
  const incomeCap = income === null ? null : round2(income * GLOBAL_CAP_INCOME_RATE);
  const caps = [umaCap, incomeCap].filter((v): v is number => v !== null);
  const globalCap = caps.length > 0 ? Math.min(...caps) : null;

  const subjectBeforeCap = byKey.filter((k) => k.subjectToGlobal).reduce((s, k) => s + k.allowed, 0);
  const subjectAllowed = globalCap === null ? subjectBeforeCap : Math.min(subjectBeforeCap, globalCap);
  const outsideAllowed = byKey.filter((k) => !k.subjectToGlobal).reduce((s, k) => s + k.allowed, 0);
  const reviewTotal = byKey.reduce((s, k) => s + k.review, 0);

  return {
    byKey,
    umaCap,
    incomeCap,
    globalCap,
    subjectAllowed: round2(subjectAllowed),
    subjectBeforeCap: round2(subjectBeforeCap),
    outsideAllowed: round2(outsideAllowed),
    estimatedTotal: round2(subjectAllowed + outsideAllowed),
    reviewTotal: round2(reviewTotal),
    counts,
    notes,
  };
}
