import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeXml } from '../../src/lib/ingest.ts';
import { doctoPaidMxn, parseCfdiXml } from '../../src/lib/parser.ts';
import { buildCfdi, DEMO_ISSUERS } from '../../src/lib/synthetic.ts';
import { invoiceFrom, spec, USER_RFC } from './helpers.ts';

const fixture = (name: string) => readFileSync(join(import.meta.dirname, '..', 'fixtures', name), 'utf8');

describe('parseCfdiXml: CFDI 4.0', () => {
  it('lee comprobante, emisor, receptor, conceptos, impuestos y timbre', () => {
    const s = spec({
      conceptos: [
        { clave: '85121502', descripcion: 'Consulta', importe: 1000 },
        { clave: '42142913', descripcion: 'Material', importe: 200, iva: true },
      ],
    });
    const inv = invoiceFrom(s);
    expect(inv.version).toBe('4.0');
    expect(inv.uuid).toBe(s.uuid);
    expect(inv.key).toBe(s.uuid);
    expect(inv.tipo).toBe('I');
    expect(inv.year).toBe(2025);
    expect(inv.month).toBe('2025-03');
    expect(inv.emisor.rfc).toBe(DEMO_ISSUERS.medico.rfc);
    expect(inv.receptor.rfc).toBe(USER_RFC);
    expect(inv.receptor.usoCfdi).toBe('D01');
    expect(inv.receptor.regimenFiscal).toBe('605');
    expect(inv.conceptos).toHaveLength(2);
    expect(inv.subTotal).toBe(1200);
    expect(inv.totalTrasladados).toBe(32);
    expect(inv.total).toBe(1232);
    expect(inv.totalMxn).toBe(1232);
    expect(inv.complementos).toContain('TimbreFiscalDigital');
  });

  it('escapa y conserva caracteres especiales del RFC y nombre (H&E)', () => {
    const inv = invoiceFrom(spec({ emisor: DEMO_ISSUERS.ropa }));
    expect(inv.emisor.rfc).toBe('H&E951128469');
    expect(inv.emisor.nombre).toBe('H&E ROPA DE PRUEBA');
  });

  it('convierte moneda extranjera con TipoCambio', () => {
    const inv = invoiceFrom(spec({ moneda: 'USD', tipoCambio: 18.5, conceptos: [{ clave: '43232408', descripcion: 'x', importe: 100 }] }));
    expect(inv.moneda).toBe('USD');
    expect(inv.total).toBe(100);
    expect(inv.totalMxn).toBe(1850);
  });

  it('lee el complemento de instituciones educativas (iedu)', () => {
    const inv = invoiceFrom(
      spec({
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'D10' },
        conceptos: [
          {
            clave: '86121501',
            descripcion: 'Colegiatura',
            importe: 3000,
            iedu: { nombreAlumno: 'ALUMNO', curp: 'xaxx150101hdfxxx02', nivelEducativo: 'Primaria', autRVOE: 'R1', rfcPago: USER_RFC },
          },
        ],
      }),
    );
    expect(inv.conceptos[0]?.iedu).toEqual({
      nombreAlumno: 'ALUMNO',
      curp: 'XAXX150101HDFXXX02',
      nivelEducativo: 'Primaria',
      autRvoe: 'R1',
      rfcPago: USER_RFC,
    });
  });

  it('lee nómina 1.2 con ISR retenido', () => {
    const inv = invoiceFrom(
      spec({
        tipo: 'N',
        formaPago: '99',
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'CN01' },
        conceptos: undefined,
        nomina: {
          fechaPago: '2025-01-15',
          fechaInicial: '2025-01-01',
          fechaFinal: '2025-01-15',
          percepciones: 20000,
          isr: 3000,
          otrasDeducciones: 500,
          curp: 'XAXX760510HDFXXX01',
        },
      }),
    );
    expect(inv.nomina).toMatchObject({ totalPercepciones: 20000, totalDeducciones: 3500, isrRetenido: 3000 });
    expect(inv.total).toBe(16500);
  });

  it('lee pagos 2.0 y calcula el monto pagado en MXN', () => {
    const inv = invoiceFrom(
      spec({
        tipo: 'P',
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'CP01' },
        conceptos: undefined,
        pagos: [{ fecha: '2025-04-01T12:00:00', forma: '04', doctos: [{ uuid: 'aaaa', impPagado: 500 }] }],
      }),
    );
    expect(inv.moneda).toBe('XXX');
    expect(inv.totalMxn).toBe(0);
    expect(inv.pagos).toHaveLength(1);
    expect(inv.pagos[0]?.doctos[0]?.idDocumento).toBe('AAAA');
    expect(doctoPaidMxn(inv.pagos[0]!, inv.pagos[0]!.doctos[0]!)).toBe(500);
  });

  it('convierte pagos en dólares con EquivalenciaDR y TipoCambioP', () => {
    const pago = {
      fechaPago: '2025-01-01',
      formaDePago: '03',
      moneda: 'USD',
      tipoCambio: 20,
      monto: 10,
      doctos: [{ idDocumento: 'X', monedaDR: 'MXN', equivalenciaDR: 20, numParcialidad: 1, impPagado: 200 }],
    };
    // 200 MXN del documento = 10 USD del pago = 200 MXN.
    expect(doctoPaidMxn(pago, pago.doctos[0]!)).toBe(200);
  });

  it('lee leyendas y donatarias', () => {
    const inv = invoiceFrom(
      spec({
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'D04' },
        leyenda: 'Gasto relacionado con la discapacidad',
        donataria: { noAutorizacion: '123', fechaAutorizacion: '2020-01-01' },
      }),
    );
    expect(inv.leyendas).toEqual(['Gasto relacionado con la discapacidad']);
    expect(inv.donataria).toEqual({ noAutorizacion: '123', fechaAutorizacion: '2020-01-01' });
  });
});

describe('parseCfdiXml: CFDI 3.3 y namespaces', () => {
  it('lee CFDI 3.3 sin RegimenFiscalReceptor', () => {
    const inv = invoiceFrom(spec({ version: '3.3', fecha: '2022-06-01T10:00:00' }));
    expect(inv.version).toBe('3.3');
    expect(inv.receptor.regimenFiscal).toBe('');
    expect(inv.year).toBe(2022);
  });

  it('lee pagos 1.0 dentro de un CFDI 3.3', () => {
    const inv = invoiceFrom(
      spec({
        version: '3.3',
        tipo: 'P',
        fecha: '2022-06-01T10:00:00',
        receptor: { rfc: USER_RFC, nombre: 'X', regimen: '605', uso: 'P01' },
        conceptos: undefined,
        pagos: [{ fecha: '2022-06-01T12:00:00', forma: '03', doctos: [{ uuid: 'BBBB', impPagado: 750 }] }],
      }),
    );
    expect(inv.pagos[0]?.formaDePago).toBe('03');
    expect(inv.pagos[0]?.doctos[0]?.impPagado).toBe(750);
  });

  it('tolera prefijos distintos y namespace por omisión', () => {
    const xml = fixture('prefijo-distinto-4.0.xml');
    const r = parseCfdiXml(xml, 'prefijo.xml');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice.emisor.rfc).toBe('EKU9003173C9');
      expect(r.invoice.uuid).toBe('11111111-2222-4333-8444-555555555555');
      expect(r.invoice.conceptos).toHaveLength(1);
    }
  });

  it('acepta BOM al inicio', () => {
    const xml = '\uFEFF' + buildCfdi(spec());
    expect(parseCfdiXml(xml, 'bom.xml').ok).toBe(true);
  });
});

describe('parseCfdiXml: errores', () => {
  it('rechaza XML mal formado', () => {
    const r = parseCfdiXml('<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0"><sin-cerrar>', 'malo.xml');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('malformed');
  });

  it('detecta el parsererror que Chromium inserta dentro de un Comprobante truncado', () => {
    const chromiumLike = {
      parseFromString: () =>
        new DOMParser().parseFromString(
          '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I"><parsererror xmlns="http://www.w3.org/1999/xhtml">error</parsererror></cfdi:Comprobante>',
          'application/xml',
        ),
    } as unknown as DOMParser;
    const r = parseCfdiXml('<truncado', 'truncado.xml', chromiumLike);
    expect(!r.ok && r.error.code).toBe('malformed');
  });

  it('rechaza documentos que no son CFDI', () => {
    const r = parseCfdiXml('<?xml version="1.0"?><nota>hola</nota>', 'nota.xml');
    expect(!r.ok && r.error.code).toBe('not-cfdi');
  });

  it('identifica CFDI de retenciones', () => {
    const r = parseCfdiXml(fixture('retenciones-2.0.xml'), 'ret.xml');
    expect(!r.ok && r.error.code).toBe('retenciones');
  });

  it('rechaza versiones distintas de 4.0 y 3.3', () => {
    const r = parseCfdiXml(fixture('cfdi-3.2.xml'), 'v32.xml');
    expect(!r.ok && r.error.code).toBe('unsupported-version');
  });

  it('marca archivos vacíos', () => {
    const r = parseCfdiXml('   ', 'vacio.xml');
    expect(!r.ok && r.error.code).toBe('empty');
  });
});

describe('decodeXml', () => {
  it('decodifica UTF-8 por omisión', () => {
    const bytes = new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8"?><a>Educación</a>');
    expect(decodeXml(bytes)).toContain('Educación');
  });

  it('respeta encoding ISO-8859-1 declarado', () => {
    const text = '<?xml version="1.0" encoding="ISO-8859-1"?><a>Educación</a>';
    const bytes = Uint8Array.from(Array.from(text, (ch) => ch.charCodeAt(0)));
    expect(decodeXml(bytes)).toContain('Educación');
  });
});
