import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { analyze, defaultYear, emptyDataset, mergeResults } from '../../src/lib/aggregate.ts';
import { inferUserRfc } from '../../src/lib/classifier.ts';
import { rowsToCsv } from '../../src/lib/csv.ts';
import { extractZip } from '../../src/lib/ingest.ts';
import { parseCfdiXml } from '../../src/lib/parser.ts';
import { buildCfdi, DEMO_USER, generateDataset } from '../../src/lib/synthetic.ts';
import { invoiceFrom, spec, USER_RFC } from './helpers.ts';

const CAPS = { umaAnnual: 41273.52, income: null, prevYearIncome: null };

describe('mergeResults', () => {
  it('descarta duplicados por UUID y guarda errores', () => {
    const s = spec();
    const xml = buildCfdi(s);
    const results = [parseCfdiXml(xml, 'a.xml'), parseCfdiXml(xml, 'copia-a.xml'), parseCfdiXml('<x/>', 'x.xml')];
    const ds = mergeResults(emptyDataset(), results);
    expect(ds.invoices).toHaveLength(1);
    expect(ds.duplicates).toEqual([{ key: s.uuid, fileName: 'copia-a.xml', firstFileName: 'a.xml' }]);
    expect(ds.failures).toHaveLength(1);
    const again = mergeResults(ds, [parseCfdiXml(xml, 'b.xml')]);
    expect(again.invoices).toHaveLength(1);
    expect(again.duplicates).toHaveLength(2);
  });
});

describe('analyze', () => {
  it('suma gasto neto con notas de crédito y separa nómina y emitidas', () => {
    const a = invoiceFrom(spec({ fecha: '2025-01-10T10:00:00', receptor: { rfc: USER_RFC, nombre: 'X', regimen: '612', uso: 'G03' }, conceptos: [{ clave: '50192100', descripcion: 'Súper', importe: 1000 }] }));
    const nota = invoiceFrom(
      spec({
        tipo: 'E',
        fecha: '2025-01-11T10:00:00',
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '612', uso: 'G02' },
        relacionados: { tipo: '01', uuids: [a.uuid] },
        conceptos: [{ clave: '84111506', descripcion: 'Bonificación', importe: 100 }],
      }),
    );
    const nomina = invoiceFrom(
      spec({
        tipo: 'N',
        conceptos: undefined,
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'CN01' },
        nomina: { fechaPago: '2025-01-15', fechaInicial: '2025-01-01', fechaFinal: '2025-01-15', percepciones: 20000, isr: 3000, curp: 'X' },
      }),
    );
    const emitida = invoiceFrom(
      spec({ emisor: { rfc: USER_RFC, nombre: 'YO', regimen: '612' }, receptor: { rfc: 'EWE1709045U0', nombre: 'CLIENTE', regimen: '601', uso: 'G03' } }),
    );
    const res = analyze([a, nota, nomina, emitida], USER_RFC, 2025, CAPS);
    expect(res.spending).toMatchObject({ gross: 1000, credits: 100, net: 900, count: 1, creditCount: 1 });
    expect(res.byMonth).toHaveLength(12);
    expect(res.byMonth[0]).toEqual({ month: '2025-01', amount: 900 });
    expect(res.payroll).toMatchObject({ count: 1, percepciones: 20000, isr: 3000, neto: 17000 });
    expect(res.issued).toEqual({ count: 1, total: 1000 });
    expect(res.topIssuers[0]?.amount).toBe(900);
    expect(res.byCategory[0]).toMatchObject({ category: 'alimentos', amount: 900 });
  });

  it('incluye en el ejercicio una PPD del año anterior pagada en este año', () => {
    const inv = invoiceFrom(spec({ fecha: '2024-12-20T10:00:00', metodoPago: 'PPD', formaPago: '99' }));
    const pago = invoiceFrom(
      spec({
        tipo: 'P',
        fecha: '2025-01-10T10:00:00',
        conceptos: undefined,
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'CP01' },
        pagos: [{ fecha: '2025-01-10T12:00:00', forma: '03', doctos: [{ uuid: inv.uuid, impPagado: 1000 }] }],
      }),
    );
    const res = analyze([inv, pago], USER_RFC, 2025, CAPS);
    const row = res.rows.find((r) => r.invoice.uuid === inv.uuid);
    expect(row?.deduction.status).toBe('likely');
    expect(res.deductions.estimatedTotal).toBe(1000);
    // El gasto se cuenta en el año de emisión (2024), no en 2025.
    expect(res.spending.gross).toBe(0);
  });
});

describe('conjunto sintético grande', () => {
  it('procesa 2,500 XML sintéticos (parseo + análisis) en tiempo razonable', () => {
    const files = generateDataset({ count: 2500, year: 2025, seed: 7 });
    const t0 = performance.now();
    const parser = new DOMParser();
    const ds = mergeResults(
      emptyDataset(),
      files.map((f) => parseCfdiXml(f.xml, f.name, parser)),
    );
    const t1 = performance.now();
    const res = analyze(ds.invoices, USER_RFC, 2025, CAPS);
    const t2 = performance.now();
    console.info(`[perf jsdom] ${files.length} archivos: parseo ${Math.round(t1 - t0)} ms, análisis ${Math.round(t2 - t1)} ms`);
    expect(ds.failures).toHaveLength(0);
    expect(ds.duplicates.length).toBe(files.length - 2500);
    expect(ds.invoices).toHaveLength(2500);
    expect(res.rows.length).toBeGreaterThan(2400);
    const statuses = new Set(res.rows.map((r) => r.deduction.status));
    expect(statuses).toEqual(new Set(['likely', 'review', 'no', 'na']));
    expect(inferUserRfc(ds.invoices)?.rfc).toBe(DEMO_USER.rfc);
    expect(defaultYear(ds.invoices, USER_RFC)).toBe(2025);
    expect(t2 - t1).toBeLessThan(2000);
  });
});

describe('ZIP', () => {
  it('extrae XML de un ZIP, incluso anidado, e ignora otros archivos', () => {
    const enc = new TextEncoder();
    const inner = zipSync({ 'b.xml': enc.encode(buildCfdi(spec())) });
    const outer = zipSync({
      'a.xml': enc.encode(buildCfdi(spec())),
      'notas.txt': enc.encode('hola'),
      '__MACOSX/._a.xml': enc.encode('basura'),
      'sub/inner.zip': inner,
    });
    const out = extractZip(outer, 'descarga.zip');
    expect(out.sources.map((s) => s.name).sort()).toEqual(['descarga.zip/a.xml', 'descarga.zip/sub/inner.zip/b.xml']);
    expect(out.issues).toHaveLength(0);
  });

  it('reporta ZIP dañado', () => {
    const out = extractZip(new Uint8Array([1, 2, 3, 4]), 'roto.zip');
    expect(out.issues[0]?.code).toBe('zip-error');
  });
});

describe('CSV', () => {
  const rows = analyze(
    [
      invoiceFrom(spec({ emisor: { rfc: 'H&E951128469', nombre: '=HYPERLINK("x")', regimen: '601' }, conceptos: [{ clave: '85121502', descripcion: 'Consulta, "especial"', importe: 1000 }] })),
    ],
    USER_RFC,
    2025,
    CAPS,
  ).rows;

  it('CSV plano: RFC 4180, sin BOM', () => {
    const csv = rowsToCsv(rows, { lang: 'es', excel: false });
    expect(csv.startsWith('UUID,Fecha')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('=HYPERLINK(""x"")');
  });

  it('CSV para Excel: BOM y protección contra fórmulas', () => {
    const csv = rowsToCsv(rows, { lang: 'en', excel: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('Possibly deductible');
  });
});
