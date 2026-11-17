import { describe, expect, it } from 'vitest';
import { buildContext, classify, inferUserRfc, roleOf } from '../../src/lib/classifier.ts';
import { DEMO_ISSUERS, OTHER_PERSON } from '../../src/lib/synthetic.ts';
import type { Invoice } from '../../src/lib/types.ts';
import { invoiceFrom, spec, testUuid, USER_RFC } from './helpers.ts';

function run(invoices: Invoice[], target: Invoice = invoices[0]!, year = 2025) {
  return classify(target, buildContext(invoices, USER_RFC, year));
}

const codes = (r: { reasons: { code: string }[] }) => r.reasons.map((x) => x.code);
const receptor = (uso: string, regimen = '605') => ({ rfc: USER_RFC, nombre: 'PERSONA', regimen, uso });

describe('clasificador: requisitos generales', () => {
  it('honorarios médicos pagados por transferencia en el año: posiblemente deducible', () => {
    const r = run([invoiceFrom(spec())]);
    expect(r.status).toBe('likely');
    expect(r.key).toBe('D01');
    expect(r.amount).toBe(1000);
  });

  it('D01 en efectivo: no deducible (LISR 151 fr. I)', () => {
    const r = run([invoiceFrom(spec({ formaPago: '01' }))]);
    expect(r.status).toBe('no');
    expect(r.reasons.find((x) => x.code === 'cash')?.rule).toBe('lisr-151-I-medios');
  });

  it('D10 en efectivo: no deducible (Decreto art. 1.9)', () => {
    const r = run([invoiceFrom(spec({ formaPago: '01', receptor: receptor('D10') }))]);
    expect(r.status).toBe('no');
    expect(r.reasons.find((x) => x.code === 'cash')?.rule).toBe('decreto-1.9');
  });

  it('D08 en efectivo: no deducible (fr. VII)', () => {
    const r = run([invoiceFrom(spec({ formaPago: '01', receptor: receptor('D08') }))]);
    expect(r.status).toBe('no');
  });

  it('D07 en efectivo: requiere revisión (la ley no lo exige, el SAT lo recomienda)', () => {
    const r = run([invoiceFrom(spec({ formaPago: '01', receptor: receptor('D07') }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('cash-not-required');
  });

  it('D02 en efectivo: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ formaPago: '01', receptor: receptor('D02') }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('cash-incapacidad');
  });

  it('forma de pago 05 en D01: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ formaPago: '05' }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('forma-not-listed');
  });

  it('PUE con forma 99: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ formaPago: '99' }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('forma-99');
  });

  it('otro ejercicio: no deducible en el año seleccionado', () => {
    const r = run([invoiceFrom(spec({ fecha: '2024-12-30T10:00:00' }))]);
    expect(r.status).toBe('no');
    expect(codes(r)).toContain('other-year');
  });

  it('RFC genérico de público en general: no deducible', () => {
    const r = run([invoiceFrom(spec({ receptor: { rfc: 'XAXX010101000', nombre: 'PUBLICO EN GENERAL', regimen: '616', uso: 'S01' } }))]);
    expect(r.status).toBe('no');
    expect(codes(r)).toContain('generic-rfc');
  });

  it('factura a otro RFC: no deducible para la persona usuaria', () => {
    const r = run([invoiceFrom(spec({ receptor: { ...OTHER_PERSON, uso: 'D01' } }))]);
    expect(r.status).toBe('no');
    expect(r.reasons.find((x) => x.code === 'other-rfc')?.params?.rfc).toBe(OTHER_PERSON.rfc);
  });

  it('factura emitida por la persona usuaria: no aplica', () => {
    const inv = invoiceFrom(
      spec({ emisor: { rfc: USER_RFC, nombre: 'YO', regimen: '612' }, receptor: { ...DEMO_ISSUERS.tecnologia, uso: 'G03' } }),
    );
    expect(roleOf(inv, USER_RFC)).toBe('issued');
    expect(run([inv]).status).toBe('na');
  });

  it('régimen del receptor sin claves D (626 RESICO): requiere revisión', () => {
    const r = run([invoiceFrom(spec({ receptor: receptor('D01', '626') }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('regime-not-allowed');
  });

  it('nómina, pago y traslado: no aplica', () => {
    const n = invoiceFrom(
      spec({
        tipo: 'N',
        conceptos: undefined,
        receptor: receptor('CN01'),
        nomina: { fechaPago: '2025-01-15', fechaInicial: '2025-01-01', fechaFinal: '2025-01-15', percepciones: 1000, isr: 100, curp: 'X' },
      }),
    );
    expect(run([n]).status).toBe('na');
    const t = invoiceFrom(spec({ tipo: 'T', conceptos: [{ clave: '78101800', descripcion: 'Traslado', importe: 0 }] }));
    expect(run([t]).status).toBe('na');
  });
});

describe('clasificador: UsoCFDI', () => {
  it('G03 en un restaurante: no deducible como deducción personal', () => {
    const r = run([
      invoiceFrom(spec({ receptor: receptor('G03'), conceptos: [{ clave: '90101501', descripcion: 'Comida', importe: 500, iva: true }] })),
    ]);
    expect(r.status).toBe('no');
    expect(codes(r)).toContain('uso-not-deduction');
  });

  it('G03 con servicio médico en CFDI 4.0: requiere revisión (SAT: cancelar y sustituir)', () => {
    const r = run([invoiceFrom(spec({ receptor: receptor('G03') }))]);
    expect(r.status).toBe('review');
    expect(r.reasons[0]).toMatchObject({ code: 'uso-mismatch-40', rule: 'faq40-uso' });
  });

  it('G03 con servicio médico en CFDI 3.3: requiere revisión con el criterio de 3.3', () => {
    const r = run([invoiceFrom(spec({ version: '3.3', fecha: '2022-02-01T10:00:00', receptor: receptor('G03') }))], undefined, 2022);
    expect(r.reasons[0]).toMatchObject({ code: 'uso-mismatch-33', rule: 'faq33-uso' });
  });

  it('P01 en CFDI 3.3: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ version: '3.3', fecha: '2022-02-01T10:00:00', receptor: receptor('P01') }))], undefined, 2022);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('uso-p01');
  });
});

describe('clasificador: PPD, pagos y notas de crédito', () => {
  it('PPD sin complemento de pago: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ metodoPago: 'PPD', formaPago: '99' }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('ppd-no-payment');
  });

  it('PPD con pago en el ejercicio: toma el monto y la forma del complemento', () => {
    const inv = invoiceFrom(spec({ metodoPago: 'PPD', formaPago: '99' }));
    const pago = invoiceFrom(
      spec({
        tipo: 'P',
        conceptos: undefined,
        receptor: receptor('CP01'),
        pagos: [{ fecha: '2025-05-02T12:00:00', forma: '04', doctos: [{ uuid: inv.uuid, impPagado: 600, saldoAnterior: 1000 }] }],
      }),
    );
    const r = run([inv, pago], inv);
    expect(r.status).toBe('likely');
    expect(r.amount).toBe(600);
    expect(codes(r)).toContain('ppd-paid');
  });

  it('PPD pagada con efectivo en el complemento: no deducible', () => {
    const inv = invoiceFrom(spec({ metodoPago: 'PPD', formaPago: '99' }));
    const pago = invoiceFrom(
      spec({
        tipo: 'P',
        conceptos: undefined,
        receptor: receptor('CP01'),
        pagos: [{ fecha: '2025-05-02T12:00:00', forma: '01', doctos: [{ uuid: inv.uuid, impPagado: 1000 }] }],
      }),
    );
    expect(run([inv, pago], inv).status).toBe('no');
  });

  it('PPD de diciembre pagada en enero siguiente: cuenta en el año del pago', () => {
    const inv = invoiceFrom(spec({ fecha: '2025-12-20T10:00:00', metodoPago: 'PPD', formaPago: '99' }));
    const pago = invoiceFrom(
      spec({
        tipo: 'P',
        fecha: '2026-01-10T10:00:00',
        conceptos: undefined,
        receptor: receptor('CP01'),
        pagos: [{ fecha: '2026-01-10T12:00:00', forma: '03', doctos: [{ uuid: inv.uuid, impPagado: 1000 }] }],
      }),
    );
    const r2025 = run([inv, pago], inv, 2025);
    expect(r2025.status).toBe('no');
    expect(codes(r2025)).toContain('paid-other-year');
    const r2026 = run([inv, pago], inv, 2026);
    expect(r2026.status).toBe('likely');
    expect(r2026.amount).toBe(1000);
  });

  it('nota de crédito relacionada reduce el monto', () => {
    const inv = invoiceFrom(spec());
    const nota = invoiceFrom(
      spec({
        tipo: 'E',
        relacionados: { tipo: '01', uuids: [inv.uuid] },
        conceptos: [{ clave: '84111506', descripcion: 'Bonificación', importe: 250 }],
      }),
    );
    const r = run([inv, nota], inv);
    expect(r.amount).toBe(750);
    expect(codes(r)).toContain('credit-applied');
    expect(run([inv, nota], nota).status).toBe('na');
  });
});

describe('clasificador: reglas por clave', () => {
  it('D01 con medicinas: requiere revisión (RLISR 264)', () => {
    const r = run([invoiceFrom(spec({ conceptos: [{ clave: '51101500', descripcion: 'Medicamentos', importe: 300 }] }))]);
    expect(r.status).toBe('review');
    expect(r.reasons.find((x) => x.code === 'medicines')?.rule).toBe('rlisr-264');
  });

  it('D01 de hospital con medicinas incluidas: posible (RLISR 264)', () => {
    const r = run([
      invoiceFrom(
        spec({
          conceptos: [
            { clave: '85101501', descripcion: 'Servicios hospitalarios', importe: 9000 },
            { clave: '51101500', descripcion: 'Medicamentos suministrados', importe: 800 },
          ],
        }),
      ),
    ]);
    expect(r.status).toBe('likely');
    expect(codes(r)).toContain('medicines-hospital');
  });

  it('D01 con lentes: requiere revisión por el tope de $2,500 por persona', () => {
    const r = run([invoiceFrom(spec({ conceptos: [{ clave: '42142913', descripcion: 'Lentes graduados', importe: 3000 }] }))]);
    expect(codes(r)).toContain('lenses');
  });

  it('D02 sin mención de la incapacidad: requiere revisión; con mención: posible', () => {
    const sin = run([invoiceFrom(spec({ receptor: receptor('D02') }))]);
    expect(sin.status).toBe('review');
    const con = run([invoiceFrom(spec({ receptor: receptor('D02'), leyenda: 'Gasto relacionado con la atención de la discapacidad' }))]);
    expect(con.status).toBe('likely');
  });

  it('D04 con complemento de donatarias: posible; sin él: revisar directorio', () => {
    const con = run([invoiceFrom(spec({ receptor: receptor('D04'), donataria: { noAutorizacion: '1', fechaAutorizacion: '2020-01-01' } }))]);
    expect(con.status).toBe('likely');
    const sin = run([invoiceFrom(spec({ receptor: receptor('D04') }))]);
    expect(sin.status).toBe('review');
    expect(codes(sin)).toContain('donat-check');
  });

  it('D05 y D08 piden revisión por requisitos no verificables', () => {
    expect(run([invoiceFrom(spec({ receptor: receptor('D05') }))]).status).toBe('review');
    expect(run([invoiceFrom(spec({ receptor: receptor('D08') }))]).status).toBe('review');
  });

  it('D10 sin complemento iedu: requiere revisión', () => {
    const r = run([invoiceFrom(spec({ receptor: receptor('D10'), conceptos: [{ clave: '86121501', descripcion: 'Colegiatura', importe: 3000 }] }))]);
    expect(r.status).toBe('review');
    expect(codes(r)).toContain('iedu-missing');
  });

  it('D10 con iedu: posible, por alumno, y excluye la reinscripción', () => {
    const iedu = { nombreAlumno: 'A', curp: 'XAXX150101HDFXXX02', nivelEducativo: 'Primaria', autRVOE: 'R', rfcPago: USER_RFC };
    const r = run([
      invoiceFrom(
        spec({
          receptor: receptor('D10'),
          conceptos: [
            { clave: '86121501', descripcion: 'Colegiatura', importe: 3000, iedu },
            { clave: '86121501', descripcion: 'Cuota de reinscripción', importe: 1000 },
          ],
        }),
      ),
    ]);
    expect(r.status).toBe('likely');
    expect(r.amount).toBe(3000);
    expect(r.students).toEqual([{ curp: 'XAXX150101HDFXXX02', nombre: 'A', nivel: 'primaria', amount: 3000 }]);
    expect(codes(r)).toContain('enrollment-excluded');
  });

  it('D10 con nivel no cubierto o pagada por otro RFC: requiere revisión', () => {
    const base = { nombreAlumno: 'A', curp: 'C', autRVOE: 'R' };
    const lic = run([
      invoiceFrom(spec({ receptor: receptor('D10'), conceptos: [{ clave: '86121700', descripcion: 'Licenciatura', importe: 9000, iedu: { ...base, nivelEducativo: 'Licenciatura' } }] })),
    ]);
    expect(codes(lic)).toContain('nivel-unknown');
    const otro = run([
      invoiceFrom(
        spec({
          receptor: receptor('D10'),
          conceptos: [{ clave: '86121501', descripcion: 'Colegiatura', importe: 3000, iedu: { ...base, nivelEducativo: 'Primaria', rfcPago: OTHER_PERSON.rfc } }],
        }),
      ),
    ]);
    expect(codes(otro)).toContain('rfc-pago-mismatch');
  });
});

describe('inferUserRfc', () => {
  it('elige el receptor más frecuente sin contar RFC genéricos', () => {
    const list = [
      invoiceFrom(spec()),
      invoiceFrom(spec()),
      invoiceFrom(spec({ receptor: { rfc: 'XAXX010101000', nombre: 'PG', regimen: '616', uso: 'S01' } })),
      invoiceFrom(spec({ receptor: { rfc: 'XAXX010101000', nombre: 'PG', regimen: '616', uso: 'S01' } })),
      invoiceFrom(spec({ receptor: { rfc: 'XAXX010101000', nombre: 'PG', regimen: '616', uso: 'S01' } })),
      invoiceFrom(spec({ uuid: testUuid(), receptor: { ...OTHER_PERSON, uso: 'G03' } })),
    ];
    expect(inferUserRfc(list)).toEqual({ rfc: USER_RFC, count: 2, total: 3 });
  });
});
