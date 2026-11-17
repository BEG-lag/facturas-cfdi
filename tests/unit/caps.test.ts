import { describe, expect, it } from 'vitest';
import { summarizeDeductions } from '../../src/lib/caps.ts';
import { COLEGIATURA_LIMITS, UMA, umaFor } from '../../src/lib/rules.ts';
import type { DeductionResult } from '../../src/lib/types.ts';

const UMA_2025 = 41273.52;

function res(key: string, amount: number, status: DeductionResult['status'] = 'likely', students: DeductionResult['students'] = []): DeductionResult {
  return { key, amount, status, reasons: [], students };
}

describe('valores oficiales', () => {
  it('UMA anual 2023 a 2026 publicada en el DOF', () => {
    expect(UMA[2023]?.annual).toBe(37844.4);
    expect(UMA[2024]?.annual).toBe(39606.36);
    expect(UMA[2025]?.annual).toBe(41273.52);
    expect(UMA[2026]?.annual).toBe(42794.64);
    expect(umaFor(2019)).toBeNull();
  });

  it('la UMA anual es diaria x 30.4 x 12 (redondeada por el INEGI)', () => {
    for (const v of Object.values(UMA)) {
      expect(Math.abs(v.daily * 30.4 * 12 - v.annual)).toBeLessThan(0.5);
    }
  });

  it('topes de colegiaturas del Decreto art. 1.10', () => {
    expect(COLEGIATURA_LIMITS).toEqual({
      preescolar: 14200,
      primaria: 12900,
      secundaria: 19900,
      'profesional tecnico': 17100,
      bachillerato: 24500,
    });
  });
});

describe('tope global (LISR 151, último párrafo)', () => {
  it('sin ingresos usa 5 UMA y avisa', () => {
    const s = summarizeDeductions([res('D01', 250000)], { umaAnnual: UMA_2025, income: null, prevYearIncome: null });
    expect(s.umaCap).toBe(206367.6);
    expect(s.globalCap).toBe(206367.6);
    expect(s.subjectAllowed).toBe(206367.6);
    expect(s.notes).toContain('income-missing');
  });

  it('con ingresos usa el menor entre 5 UMA y 15%', () => {
    const s = summarizeDeductions([res('D01', 100000)], { umaAnnual: UMA_2025, income: 400000, prevYearIncome: null });
    expect(s.incomeCap).toBe(60000);
    expect(s.globalCap).toBe(60000);
    expect(s.subjectAllowed).toBe(60000);
    expect(s.estimatedTotal).toBe(60000);
  });

  it('colegiaturas, incapacidad, retiro y art. 185 quedan fuera del tope global', () => {
    const s = summarizeDeductions(
      [
        res('D01', 80000),
        res('D02', 30000),
        res('D06', 5000),
        res('D09', 10000),
        res('D10', 12000, 'likely', [{ curp: 'A', nombre: 'A', nivel: 'primaria', amount: 12000 }]),
      ],
      { umaAnnual: UMA_2025, income: 400000, prevYearIncome: null },
    );
    expect(s.subjectAllowed).toBe(60000);
    expect(s.outsideAllowed).toBe(30000 + 5000 + 10000 + 12000);
    expect(s.estimatedTotal).toBe(60000 + 57000);
  });

  it('donativos sí entran al tope global (desde 2022) y tienen tope de 7%', () => {
    const s = summarizeDeductions([res('D04', 20000)], { umaAnnual: UMA_2025, income: null, prevYearIncome: 100000 });
    const d04 = s.byKey.find((k) => k.key === 'D04')!;
    expect(d04.subjectToGlobal).toBe(true);
    expect(d04.allowed).toBe(7000);
  });

  it('sin ingreso del año anterior no aplica el 7% y lo señala', () => {
    const s = summarizeDeductions([res('D04', 20000)], { umaAnnual: UMA_2025, income: null, prevYearIncome: null });
    expect(s.byKey[0]?.capNote).toBe('cap-needs-prev-income');
    expect(s.byKey[0]?.allowed).toBe(20000);
  });
});

describe('topes propios', () => {
  it('funerales hasta 1 UMA anual', () => {
    const s = summarizeDeductions([res('D03', 50000)], { umaAnnual: UMA_2025, income: null, prevYearIncome: null });
    expect(s.byKey[0]?.allowed).toBe(UMA_2025);
  });

  it('aportaciones voluntarias: menor de 10% de ingresos o 5 UMA', () => {
    const s = summarizeDeductions([res('D06', 90000)], { umaAnnual: UMA_2025, income: 500000, prevYearIncome: null });
    expect(s.byKey[0]?.allowed).toBe(50000);
  });

  it('cuentas especiales de ahorro hasta $152,000', () => {
    const s = summarizeDeductions([res('D09', 200000)], { umaAnnual: UMA_2025, income: null, prevYearIncome: null });
    expect(s.byKey[0]?.allowed).toBe(152000);
  });

  it('colegiaturas por alumno; si cambia de nivel aplica el tope mayor', () => {
    const s = summarizeDeductions(
      [
        res('D10', 15000, 'likely', [{ curp: 'A', nombre: 'A', nivel: 'primaria', amount: 15000 }]),
        res('D10', 6000, 'likely', [{ curp: 'A', nombre: 'A', nivel: 'secundaria', amount: 6000 }]),
        res('D10', 30000, 'likely', [{ curp: 'B', nombre: 'B', nivel: 'preescolar', amount: 30000 }]),
      ],
      { umaAnnual: UMA_2025, income: null, prevYearIncome: null },
    );
    const d10 = s.byKey.find((k) => k.key === 'D10')!;
    // A: 21,000 con tope de secundaria 19,900; B: 30,000 con tope de preescolar 14,200.
    expect(d10.allowed).toBe(19900 + 14200);
  });

  it('separa montos por revisar y cuenta estatus', () => {
    const s = summarizeDeductions([res('D01', 1000), res('D01', 500, 'review'), res('D01', 300, 'no'), { ...res('', 0, 'na'), key: null }], {
      umaAnnual: UMA_2025,
      income: null,
      prevYearIncome: null,
    });
    expect(s.reviewTotal).toBe(500);
    expect(s.counts).toEqual({ likely: 1, review: 1, no: 1, na: 1 });
    expect(s.estimatedTotal).toBe(1000);
  });

  it('sin UMA no hay tope global y lo señala', () => {
    const s = summarizeDeductions([res('D01', 1000)], { umaAnnual: null, income: null, prevYearIncome: null });
    expect(s.globalCap).toBeNull();
    expect(s.notes).toContain('uma-missing');
  });
});
