import type {
  CfdiRelacionados,
  CfdiVersion,
  Concepto,
  DocRelacionadoPago,
  Iedu,
  Invoice,
  Nomina,
  Pago,
  ParseResult,
  TipoComprobante,
} from './types.ts';

/**
 * Espacios de nombres del Anexo 20 y sus complementos. El parser busca los nodos por nombre local
 * para tolerar prefijos distintos o declaraciones de namespace imperfectas, y usa estos valores
 * sólo para reportar qué versión encontró.
 */
export const NAMESPACES = {
  cfdi40: 'http://www.sat.gob.mx/cfd/4',
  cfdi33: 'http://www.sat.gob.mx/cfd/3',
  tfd: 'http://www.sat.gob.mx/TimbreFiscalDigital',
  pagos20: 'http://www.sat.gob.mx/Pagos20',
  pagos10: 'http://www.sat.gob.mx/Pagos',
  nomina12: 'http://www.sat.gob.mx/nomina12',
  implocal: 'http://www.sat.gob.mx/implocal',
  leyendas: 'http://www.sat.gob.mx/leyendasFiscales',
  iedu: 'http://www.sat.gob.mx/iedu',
  donat: 'http://www.sat.gob.mx/donat',
} as const;

const TIPOS: readonly string[] = ['I', 'E', 'P', 'N', 'T'];

function attr(el: Element | null | undefined, name: string): string {
  if (!el) return '';
  const direct = el.getAttribute(name);
  if (direct !== null) return direct.trim();
  // CFDI 3.2 y algunos complementos usan la primera letra en minúscula.
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  const alt = el.getAttribute(lower);
  return alt === null ? '' : alt.trim();
}

function num(el: Element | null | undefined, name: string): number {
  const raw = attr(el, name);
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function children(el: Element | null | undefined, localName: string): Element[] {
  if (!el) return [];
  const out: Element[] = [];
  for (let node = el.firstElementChild; node; node = node.nextElementSibling) {
    if (node.localName === localName) out.push(node);
  }
  return out;
}

function child(el: Element | null | undefined, localName: string): Element | null {
  return children(el, localName)[0] ?? null;
}

function descendants(el: Element | Document, localName: string): Element[] {
  return Array.from(el.getElementsByTagNameNS('*', localName));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Chromium y WebKit insertan un <parsererror> dentro del documento parcialmente leído; Firefox y
 * jsdom lo devuelven como raíz. En ambos casos el archivo se reporta como mal formado.
 */
function isParserError(doc: Document): boolean {
  const root = doc.documentElement;
  if (!root) return true;
  if (root.localName === 'parsererror') return true;
  return doc.getElementsByTagName('parsererror').length > 0;
}

function parseIedu(concepto: Element): Iedu | null {
  const node = descendants(concepto, 'instEducativas')[0];
  if (!node) return null;
  return {
    nombreAlumno: attr(node, 'nombreAlumno'),
    curp: attr(node, 'CURP').toUpperCase(),
    nivelEducativo: attr(node, 'nivelEducativo'),
    autRvoe: attr(node, 'autRVOE'),
    rfcPago: attr(node, 'rfcPago').toUpperCase(),
  };
}

function parseConceptos(root: Element): Concepto[] {
  return children(child(root, 'Conceptos'), 'Concepto').map((c) => ({
    claveProdServ: attr(c, 'ClaveProdServ'),
    descripcion: attr(c, 'Descripcion'),
    cantidad: num(c, 'Cantidad'),
    valorUnitario: num(c, 'ValorUnitario'),
    importe: num(c, 'Importe'),
    descuento: num(c, 'Descuento'),
    iedu: parseIedu(c),
  }));
}

function parsePagos(complementos: Element[]): Pago[] {
  const pagos: Pago[] = [];
  for (const comp of complementos) {
    for (const pagosNode of children(comp, 'Pagos')) {
      for (const p of children(pagosNode, 'Pago')) {
        const doctos: DocRelacionadoPago[] = children(p, 'DoctoRelacionado').map((d) => {
          const equivalencia = num(d, 'EquivalenciaDR') || num(d, 'TipoCambioDR') || 1;
          return {
            idDocumento: attr(d, 'IdDocumento').toUpperCase(),
            monedaDR: attr(d, 'MonedaDR') || 'MXN',
            equivalenciaDR: equivalencia,
            numParcialidad: num(d, 'NumParcialidad'),
            impPagado: num(d, 'ImpPagado'),
          };
        });
        pagos.push({
          fechaPago: attr(p, 'FechaPago'),
          formaDePago: attr(p, 'FormaDePagoP'),
          moneda: attr(p, 'MonedaP') || 'MXN',
          tipoCambio: num(p, 'TipoCambioP') || 1,
          monto: num(p, 'Monto'),
          doctos,
        });
      }
    }
  }
  return pagos;
}

function parseNomina(complementos: Element[]): Nomina | null {
  for (const comp of complementos) {
    const node = child(comp, 'Nomina');
    if (!node) continue;
    const deducciones = child(node, 'Deducciones');
    let isr = num(deducciones, 'TotalImpuestosRetenidos');
    if (!isr && deducciones) {
      isr = children(deducciones, 'Deduccion')
        .filter((d) => attr(d, 'TipoDeduccion') === '002')
        .reduce((sum, d) => sum + num(d, 'Importe'), 0);
    }
    return {
      tipoNomina: attr(node, 'TipoNomina'),
      fechaPago: attr(node, 'FechaPago'),
      fechaInicialPago: attr(node, 'FechaInicialPago'),
      fechaFinalPago: attr(node, 'FechaFinalPago'),
      totalPercepciones: num(node, 'TotalPercepciones'),
      totalDeducciones: num(node, 'TotalDeducciones'),
      totalOtrosPagos: num(node, 'TotalOtrosPagos'),
      isrRetenido: round2(isr),
    };
  }
  return null;
}

function parseRelacionados(root: Element): CfdiRelacionados[] {
  return children(root, 'CfdiRelacionados').map((node) => ({
    tipoRelacion: attr(node, 'TipoRelacion'),
    uuids: children(node, 'CfdiRelacionado')
      .map((r) => attr(r, 'UUID').toUpperCase())
      .filter(Boolean),
  }));
}

/** Convierte el texto de un XML CFDI 4.0 o 3.3 en un objeto normalizado. */
export function parseCfdiXml(text: string, fileName: string, parser?: DOMParser): ParseResult {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return { ok: false, error: { fileName, code: 'empty', detail: '' } };

  let doc: Document;
  try {
    doc = (parser ?? new DOMParser()).parseFromString(clean, 'application/xml');
  } catch (err) {
    return { ok: false, error: { fileName, code: 'malformed', detail: String(err) } };
  }
  if (isParserError(doc)) {
    return { ok: false, error: { fileName, code: 'malformed', detail: '' } };
  }

  const root = doc.documentElement;
  if (root.localName === 'Retenciones') {
    return { ok: false, error: { fileName, code: 'retenciones', detail: '' } };
  }
  if (root.localName !== 'Comprobante') {
    return { ok: false, error: { fileName, code: 'not-cfdi', detail: root.localName } };
  }

  const rawVersion = attr(root, 'Version');
  if (rawVersion !== '4.0' && rawVersion !== '3.3') {
    return { ok: false, error: { fileName, code: 'unsupported-version', detail: rawVersion || '?' } };
  }
  const version: CfdiVersion = rawVersion;

  const tipoRaw = attr(root, 'TipoDeComprobante').toUpperCase();
  if (!TIPOS.includes(tipoRaw)) {
    return { ok: false, error: { fileName, code: 'not-cfdi', detail: `TipoDeComprobante=${tipoRaw}` } };
  }
  const tipo = tipoRaw as TipoComprobante;

  const emisorNode = child(root, 'Emisor');
  const receptorNode = child(root, 'Receptor');
  const complementos = children(root, 'Complemento');
  const complementNames = complementos.flatMap((c) => Array.from(c.children).map((n) => n.localName));

  const tfd = complementos.map((c) => child(c, 'TimbreFiscalDigital')).find(Boolean) ?? null;
  const uuid = attr(tfd, 'UUID').toUpperCase();

  const fecha = attr(root, 'Fecha');
  const year = Number(fecha.slice(0, 4)) || 0;
  const moneda = (attr(root, 'Moneda') || 'MXN').toUpperCase();
  const tipoCambio = num(root, 'TipoCambio') || 1;
  const total = num(root, 'Total');
  const totalMxn = moneda === 'XXX' ? 0 : moneda === 'MXN' ? total : round2(total * tipoCambio);

  const impuestos = child(root, 'Impuestos');
  const implocal = complementos.map((c) => child(c, 'ImpuestosLocales')).find(Boolean) ?? null;
  const leyendasNode = complementos.map((c) => child(c, 'LeyendasFiscales')).find(Boolean) ?? null;
  const donat = complementos.map((c) => child(c, 'Donatarias')).find(Boolean) ?? null;

  const invoice: Invoice = {
    key: uuid || `archivo:${fileName}`,
    fileName,
    version,
    uuid,
    fechaTimbrado: attr(tfd, 'FechaTimbrado'),
    serie: attr(root, 'Serie'),
    folio: attr(root, 'Folio'),
    fecha,
    year,
    month: fecha.slice(0, 7),
    tipo,
    formaPago: attr(root, 'FormaPago'),
    metodoPago: attr(root, 'MetodoPago').toUpperCase(),
    moneda,
    tipoCambio,
    subTotal: num(root, 'SubTotal'),
    descuento: num(root, 'Descuento'),
    total,
    totalMxn,
    emisor: {
      rfc: attr(emisorNode, 'Rfc').toUpperCase(),
      nombre: attr(emisorNode, 'Nombre'),
      regimenFiscal: attr(emisorNode, 'RegimenFiscal'),
    },
    receptor: {
      rfc: attr(receptorNode, 'Rfc').toUpperCase(),
      nombre: attr(receptorNode, 'Nombre'),
      regimenFiscal: attr(receptorNode, 'RegimenFiscalReceptor'),
      usoCfdi: attr(receptorNode, 'UsoCFDI').toUpperCase(),
      domicilioFiscal: attr(receptorNode, 'DomicilioFiscalReceptor'),
    },
    conceptos: parseConceptos(root),
    totalTrasladados: num(impuestos, 'TotalImpuestosTrasladados'),
    totalRetenidos: num(impuestos, 'TotalImpuestosRetenidos'),
    relacionados: parseRelacionados(root),
    pagos: parsePagos(complementos),
    nomina: parseNomina(complementos),
    impuestosLocales: implocal
      ? { retenciones: num(implocal, 'TotaldeRetenciones'), traslados: num(implocal, 'TotaldeTraslados') }
      : null,
    leyendas: children(leyendasNode, 'Leyenda')
      .map((l) => attr(l, 'textoLeyenda'))
      .filter(Boolean),
    donataria: donat
      ? { noAutorizacion: attr(donat, 'noAutorizacion'), fechaAutorizacion: attr(donat, 'fechaAutorizacion') }
      : null,
    complementos: Array.from(new Set(complementNames)),
  };
  return { ok: true, invoice };
}

/** Monto pagado en MXN de un documento relacionado dentro de un pago. */
export function doctoPaidMxn(pago: Pago, docto: DocRelacionadoPago): number {
  const inPaymentCurrency = docto.monedaDR === pago.moneda ? docto.impPagado : docto.impPagado / docto.equivalenciaDR;
  const mxn = pago.moneda === 'MXN' ? inPaymentCurrency : inPaymentCurrency * pago.tipoCambio;
  return round2(mxn);
}
