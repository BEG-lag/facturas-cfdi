import { parseCfdiXml } from '../../src/lib/parser.ts';
import { buildCfdi, DEMO_ISSUERS, DEMO_USER, type CfdiSpec } from '../../src/lib/synthetic.ts';
import type { Invoice } from '../../src/lib/types.ts';

export const USER_RFC = DEMO_USER.rfc;

let counter = 0;

/** UUID sintético determinista para pruebas. */
export function testUuid(): string {
  counter++;
  const n = counter.toString(16).toUpperCase().padStart(12, '0');
  return `00000000-0000-4000-8000-${n}`;
}

/** Atajo: una factura I de un médico al usuario, con valores modificables. */
export function spec(overrides: Partial<CfdiSpec> = {}): CfdiSpec {
  return {
    uuid: testUuid(),
    fecha: '2025-03-14T10:00:00',
    tipo: 'I',
    formaPago: '03',
    metodoPago: 'PUE',
    emisor: DEMO_ISSUERS.medico,
    receptor: { rfc: USER_RFC, nombre: DEMO_USER.nombre, regimen: '605', uso: 'D01' },
    conceptos: [{ clave: '85121502', descripcion: 'Consulta médica', importe: 1000 }],
    ...overrides,
  };
}

export function invoiceFrom(s: CfdiSpec, fileName = `${s.uuid}.xml`): Invoice {
  const r = parseCfdiXml(buildCfdi(s), fileName);
  if (!r.ok) throw new Error(`fixture no parsea: ${r.error.code} ${r.error.detail}`);
  return r.invoice;
}
