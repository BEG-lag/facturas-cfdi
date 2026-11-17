/**
 * Generador de CFDI SINTÉTICOS para pruebas y para el botón "Probar con datos de ejemplo".
 * Usa únicamente RFC de prueba publicados por el SAT (certificados de sello digital de prueba,
 * http://omawww.sat.gob.mx/tramitesyservicios/Paginas/certificado_sello_digital.htm), los RFC
 * genéricos del Anexo 20 y nombres inventados. No representa a personas ni empresas reales.
 * Los sellos y certificados son marcadores de posición: estos XML no son válidos ante el SAT.
 */

export interface SpecParty {
  rfc: string;
  nombre: string;
  regimen: string;
}

export interface SpecConcepto {
  clave: string;
  descripcion: string;
  importe: number;
  cantidad?: number;
  descuento?: number;
  /** Trasladar IVA al 16%. */
  iva?: boolean;
  iedu?: { nombreAlumno: string; curp: string; nivelEducativo: string; autRVOE: string; rfcPago?: string };
}

export interface SpecPago {
  fecha: string;
  forma: string;
  moneda?: string;
  tipoCambio?: number;
  doctos: { uuid: string; impPagado: number; parcialidad?: number; saldoAnterior?: number; monedaDR?: string; equivalencia?: number }[];
}

export interface SpecNomina {
  fechaPago: string;
  fechaInicial: string;
  fechaFinal: string;
  percepciones: number;
  isr: number;
  otrasDeducciones?: number;
  curp: string;
}

export interface CfdiSpec {
  version?: '4.0' | '3.3';
  uuid: string;
  fecha: string;
  tipo: 'I' | 'E' | 'P' | 'N' | 'T';
  serie?: string;
  folio?: string;
  formaPago?: string;
  metodoPago?: string;
  moneda?: string;
  tipoCambio?: number;
  emisor: SpecParty;
  receptor: SpecParty & { uso: string; cp?: string };
  conceptos?: SpecConcepto[];
  relacionados?: { tipo: string; uuids: string[] };
  pagos?: SpecPago[];
  nomina?: SpecNomina;
  leyenda?: string;
  donataria?: { noAutorizacion: string; fechaAutorizacion: string };
}

const NS4 = 'http://www.sat.gob.mx/cfd/4';
const NS3 = 'http://www.sat.gob.mx/cfd/3';

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money(v: number): string {
  return (Math.round(v * 100) / 100).toFixed(2);
}

function attrs(map: Record<string, string | number | undefined>): string {
  return Object.entries(map)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}="${esc(String(v))}"`)
    .join(' ');
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Construye el texto XML de un CFDI 4.0 o 3.3 sintético. */
export function buildCfdi(spec: CfdiSpec): string {
  const v4 = (spec.version ?? '4.0') === '4.0';
  const ns = v4 ? NS4 : NS3;
  const tipo = spec.tipo;
  const conceptos: SpecConcepto[] =
    spec.conceptos ??
    (tipo === 'P'
      ? [{ clave: '84111506', descripcion: 'Pago', importe: 0 }]
      : tipo === 'N'
        ? [{ clave: '84111505', descripcion: 'Pago de nómina', importe: spec.nomina?.percepciones ?? 0 }]
        : []);

  let subTotal = 0;
  let descuentoTotal = 0;
  let iva = 0;
  const conceptXml: string[] = [];
  for (const c of conceptos) {
    const cantidad = c.cantidad ?? 1;
    const importe = r2(c.importe);
    const descuento = r2(c.descuento ?? (tipo === 'N' ? (spec.nomina?.isr ?? 0) + (spec.nomina?.otrasDeducciones ?? 0) : 0));
    subTotal += importe;
    descuentoTotal += descuento;
    const base = importe - descuento;
    const tax = c.iva ? r2(base * 0.16) : 0;
    iva += tax;
    const objetoImp = v4 ? (c.iva ? '02' : '01') : undefined;
    const head = `<cfdi:Concepto ${attrs({
      ClaveProdServ: c.clave,
      Cantidad: cantidad,
      ClaveUnidad: tipo === 'P' || tipo === 'N' ? 'ACT' : 'E48',
      Descripcion: c.descripcion,
      ValorUnitario: money(importe / cantidad),
      Importe: money(importe),
      Descuento: descuento ? money(descuento) : undefined,
      ObjetoImp: objetoImp,
    })}`;
    const inner: string[] = [];
    if (c.iva) {
      const baseAttr = v4 ? { Base: money(base) } : { Base: money(base) };
      inner.push(
        `<cfdi:Impuestos><cfdi:Traslados><cfdi:Traslado ${attrs({
          ...baseAttr,
          Impuesto: '002',
          TipoFactor: 'Tasa',
          TasaOCuota: '0.160000',
          Importe: money(tax),
        })}/></cfdi:Traslados></cfdi:Impuestos>`,
      );
    }
    if (c.iedu) {
      inner.push(
        `<cfdi:ComplementoConcepto><iedu:instEducativas xmlns:iedu="http://www.sat.gob.mx/iedu" ${attrs({
          version: '1.0',
          nombreAlumno: c.iedu.nombreAlumno,
          CURP: c.iedu.curp,
          nivelEducativo: c.iedu.nivelEducativo,
          autRVOE: c.iedu.autRVOE,
          rfcPago: c.iedu.rfcPago,
        })}/></cfdi:ComplementoConcepto>`,
      );
    }
    conceptXml.push(inner.length ? `${head}>${inner.join('')}</cfdi:Concepto>` : `${head}/>`);
  }
  subTotal = r2(subTotal);
  descuentoTotal = r2(descuentoTotal);
  iva = r2(iva);
  const total = tipo === 'P' || tipo === 'T' ? 0 : r2(subTotal - descuentoTotal + iva);
  const moneda = tipo === 'P' ? 'XXX' : (spec.moneda ?? 'MXN');

  const impuestosXml =
    iva > 0
      ? `<cfdi:Impuestos TotalImpuestosTrasladados="${money(iva)}"><cfdi:Traslados><cfdi:Traslado ${attrs({
          Base: v4 ? money(r2(iva / 0.16)) : undefined,
          Impuesto: '002',
          TipoFactor: 'Tasa',
          TasaOCuota: '0.160000',
          Importe: money(iva),
        })}/></cfdi:Traslados></cfdi:Impuestos>`
      : '';

  const relXml = spec.relacionados
    ? `<cfdi:CfdiRelacionados TipoRelacion="${spec.relacionados.tipo}">${spec.relacionados.uuids
        .map((u) => `<cfdi:CfdiRelacionado UUID="${u}"/>`)
        .join('')}</cfdi:CfdiRelacionados>`
    : '';

  const complementos: string[] = [];
  if (spec.pagos) {
    if (v4) {
      const totalPagos = spec.pagos.reduce((s, p) => s + p.doctos.reduce((a, d) => a + d.impPagado, 0), 0);
      complementos.push(
        `<pago20:Pagos xmlns:pago20="http://www.sat.gob.mx/Pagos20" Version="2.0"><pago20:Totales MontoTotalPagos="${money(totalPagos)}"/>${spec.pagos
          .map((p) => {
            const monto = p.doctos.reduce((a, d) => a + d.impPagado, 0);
            return `<pago20:Pago ${attrs({
              FechaPago: p.fecha,
              FormaDePagoP: p.forma,
              MonedaP: p.moneda ?? 'MXN',
              TipoCambioP: p.tipoCambio ?? 1,
              Monto: money(monto),
            })}>${p.doctos
              .map(
                (d) =>
                  `<pago20:DoctoRelacionado ${attrs({
                    IdDocumento: d.uuid,
                    MonedaDR: d.monedaDR ?? 'MXN',
                    EquivalenciaDR: d.equivalencia ?? 1,
                    NumParcialidad: d.parcialidad ?? 1,
                    ImpSaldoAnt: money(d.saldoAnterior ?? d.impPagado),
                    ImpPagado: money(d.impPagado),
                    ImpSaldoInsoluto: money((d.saldoAnterior ?? d.impPagado) - d.impPagado),
                    ObjetoImpDR: '01',
                  })}/>`,
              )
              .join('')}</pago20:Pago>`;
          })
          .join('')}</pago20:Pagos>`,
      );
    } else {
      complementos.push(
        `<pago10:Pagos xmlns:pago10="http://www.sat.gob.mx/Pagos" Version="1.0">${spec.pagos
          .map((p) => {
            const monto = p.doctos.reduce((a, d) => a + d.impPagado, 0);
            return `<pago10:Pago ${attrs({
              FechaPago: p.fecha,
              FormaDePagoP: p.forma,
              MonedaP: p.moneda ?? 'MXN',
              Monto: money(monto),
            })}>${p.doctos
              .map(
                (d) =>
                  `<pago10:DoctoRelacionado ${attrs({
                    IdDocumento: d.uuid,
                    MonedaDR: d.monedaDR ?? 'MXN',
                    MetodoDePagoDR: 'PPD',
                    NumParcialidad: d.parcialidad ?? 1,
                    ImpSaldoAnt: money(d.saldoAnterior ?? d.impPagado),
                    ImpPagado: money(d.impPagado),
                    ImpSaldoInsoluto: money((d.saldoAnterior ?? d.impPagado) - d.impPagado),
                  })}/>`,
              )
              .join('')}</pago10:Pago>`;
          })
          .join('')}</pago10:Pagos>`,
      );
    }
  }
  if (spec.nomina) {
    const n = spec.nomina;
    const otras = n.otrasDeducciones ?? 0;
    complementos.push(
      `<nomina12:Nomina xmlns:nomina12="http://www.sat.gob.mx/nomina12" ${attrs({
        Version: '1.2',
        TipoNomina: 'O',
        FechaPago: n.fechaPago,
        FechaInicialPago: n.fechaInicial,
        FechaFinalPago: n.fechaFinal,
        NumDiasPagados: '15',
        TotalPercepciones: money(n.percepciones),
        TotalDeducciones: money(n.isr + otras),
      })}><nomina12:Receptor ${attrs({
        Curp: n.curp,
        TipoContrato: '01',
        TipoRegimen: '02',
        NumEmpleado: '0001',
        PeriodicidadPago: '04',
        ClaveEntFed: 'CMX',
      })}/><nomina12:Percepciones ${attrs({
        TotalSueldos: money(n.percepciones),
        TotalGravado: money(n.percepciones),
        TotalExento: '0.00',
      })}><nomina12:Percepcion ${attrs({
        TipoPercepcion: '001',
        Clave: '001',
        Concepto: 'Sueldo',
        ImporteGravado: money(n.percepciones),
        ImporteExento: '0.00',
      })}/></nomina12:Percepciones><nomina12:Deducciones ${attrs({
        TotalOtrasDeducciones: otras ? money(otras) : undefined,
        TotalImpuestosRetenidos: money(n.isr),
      })}><nomina12:Deduccion ${attrs({
        TipoDeduccion: '002',
        Clave: '002',
        Concepto: 'ISR',
        Importe: money(n.isr),
      })}/>${
        otras
          ? `<nomina12:Deduccion ${attrs({ TipoDeduccion: '001', Clave: '001', Concepto: 'Seguridad social', Importe: money(otras) })}/>`
          : ''
      }</nomina12:Deducciones></nomina12:Nomina>`,
    );
  }
  if (spec.leyenda) {
    complementos.push(
      `<leyendasFisc:LeyendasFiscales xmlns:leyendasFisc="http://www.sat.gob.mx/leyendasFiscales" version="1.0"><leyendasFisc:Leyenda textoLeyenda="${esc(spec.leyenda)}"/></leyendasFisc:LeyendasFiscales>`,
    );
  }
  if (spec.donataria) {
    complementos.push(
      `<donat:Donatarias xmlns:donat="http://www.sat.gob.mx/donat" ${attrs({
        version: '1.1',
        noAutorizacion: spec.donataria.noAutorizacion,
        fechaAutorizacion: spec.donataria.fechaAutorizacion,
        leyenda: 'Leyenda de donativo (dato sintético)',
      })}/>`,
    );
  }
  complementos.push(
    `<tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" ${attrs({
      Version: '1.1',
      UUID: spec.uuid,
      FechaTimbrado: spec.fecha,
      RfcProvCertif: 'XIA190128J61',
      SelloCFD: 'SINTETICO',
      NoCertificadoSAT: '00000000000000000000',
      SelloSAT: 'SINTETICO',
    })}/>`,
  );

  const rootAttrs = attrs({
    Version: v4 ? '4.0' : '3.3',
    Serie: spec.serie,
    Folio: spec.folio,
    Fecha: spec.fecha,
    Sello: 'SINTETICO',
    FormaPago: tipo === 'P' || tipo === 'T' ? undefined : (spec.formaPago ?? (tipo === 'N' ? '99' : '03')),
    NoCertificado: '00000000000000000000',
    Certificado: 'SINTETICO',
    SubTotal: money(tipo === 'P' || tipo === 'T' ? 0 : subTotal),
    Descuento: descuentoTotal && tipo !== 'P' ? money(descuentoTotal) : undefined,
    Moneda: moneda,
    TipoCambio: moneda !== 'MXN' && moneda !== 'XXX' ? (spec.tipoCambio ?? 1) : undefined,
    Total: money(total),
    TipoDeComprobante: tipo,
    Exportacion: v4 ? '01' : undefined,
    MetodoPago: tipo === 'P' || tipo === 'T' ? undefined : (spec.metodoPago ?? 'PUE'),
    LugarExpedicion: '06000',
  });
  const schema = v4
    ? 'http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd'
    : 'http://www.sat.gob.mx/cfd/3 http://www.sat.gob.mx/sitio_internet/cfd/3/cfdv33.xsd';
  const receptorAttrs = attrs({
    Rfc: spec.receptor.rfc,
    Nombre: spec.receptor.nombre,
    DomicilioFiscalReceptor: v4 ? (spec.receptor.cp ?? '06000') : undefined,
    RegimenFiscalReceptor: v4 ? spec.receptor.regimen : undefined,
    UsoCFDI: spec.receptor.uso,
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- CFDI SINTETICO: datos ficticios generados para pruebas, sin validez fiscal. -->',
    `<cfdi:Comprobante xmlns:cfdi="${ns}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="${schema}" ${rootAttrs}>`,
    relXml,
    `<cfdi:Emisor ${attrs({ Rfc: spec.emisor.rfc, Nombre: spec.emisor.nombre, RegimenFiscal: spec.emisor.regimen })}/>`,
    `<cfdi:Receptor ${receptorAttrs}/>`,
    `<cfdi:Conceptos>${conceptXml.join('')}</cfdi:Conceptos>`,
    impuestosXml,
    `<cfdi:Complemento>${complementos.join('')}</cfdi:Complemento>`,
    '</cfdi:Comprobante>',
  ].join('\n');
}

/* ------------------------------------------------------------------------------------------ */
/* Generador de conjuntos completos                                                            */
/* ------------------------------------------------------------------------------------------ */

/** PRNG determinista (mulberry32) para que los conjuntos sean reproducibles. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEMO_USER = { rfc: 'CACX7605101P8', nombre: 'PERSONA DE PRUEBA SINTETICA', curp: 'XAXX760510HDFXXX01' };

/** Emisores con RFC de prueba del SAT y nombres inventados. */
export const DEMO_ISSUERS = {
  escuela: { rfc: 'EKU9003173C9', nombre: 'ESCUELA DEMO PRIMARIA Y SECUNDARIA', regimen: '601' },
  super: { rfc: 'IIA040805DZ4', nombre: 'SUPERMERCADO FICTICIO', regimen: '601' },
  gasolinera: { rfc: 'IVD920810GU2', nombre: 'GASOLINERA DE PRUEBA', regimen: '601' },
  telefonia: { rfc: 'JES900109Q90', nombre: 'TELEFONIA EJEMPLO', regimen: '601' },
  restaurante: { rfc: 'KIJ0906199R1', nombre: 'RESTAURANTE SIMULADO', regimen: '601' },
  hospital: { rfc: 'URE180429TM6', nombre: 'HOSPITAL DE PRUEBA', regimen: '601' },
  financiera: { rfc: 'XIA190128J61', nombre: 'GRUPO FINANCIERO FICTICIO', regimen: '601' },
  tecnologia: { rfc: 'EWE1709045U0', nombre: 'COMERCIALIZADORA DEMO DE TECNOLOGIA', regimen: '601' },
  ropa: { rfc: 'H&E951128469', nombre: 'H&E ROPA DE PRUEBA', regimen: '601' },
  funeraria: { rfc: 'L&O950913MSA', nombre: 'L&O FUNERARIA DEMO', regimen: '601' },
  fundacion: { rfc: 'S&S051221SE2', nombre: 'S&S FUNDACION DEMO', regimen: '603' },
  transporte: { rfc: 'IXS7607092R5', nombre: 'TRANSPORTE ESCOLAR DEMO', regimen: '601' },
  dentista: { rfc: 'FUNK671228PH6', nombre: 'DENTISTA FICTICIA', regimen: '612' },
  psicologo: { rfc: 'JUFA7608212V6', nombre: 'PSICOLOGO DE PRUEBA', regimen: '612' },
  optica: { rfc: 'KICR630120NX3', nombre: 'OPTICA SINTETICA', regimen: '612' },
  medico: { rfc: 'XAMA620210DQ5', nombre: 'MEDICO GENERAL DEMO', regimen: '612' },
  farmacia: { rfc: 'WATM640917J45', nombre: 'FARMACIA DE PRUEBA', regimen: '612' },
} satisfies Record<string, SpecParty>;

/** Otro contribuyente de prueba (para facturas emitidas a un RFC que no es el tuyo). */
export const OTHER_PERSON = { rfc: 'KAHO641101B39', nombre: 'OTRA PERSONA DE PRUEBA', regimen: '605' };

const KIDS = [
  { nombreAlumno: 'ALUMNO SINTETICO UNO', curp: 'XAXX150101HDFXXX02', nivelEducativo: 'Primaria', autRVOE: 'RVOE-DEMO-001' },
  { nombreAlumno: 'ALUMNA SINTETICA DOS', curp: 'XAXX120202MDFXXX03', nivelEducativo: 'Secundaria', autRVOE: 'RVOE-DEMO-002' },
];

export interface GeneratedFile {
  name: string;
  xml: string;
}

export interface GenerateOptions {
  count: number;
  year: number;
  seed?: number;
  userRfc?: string;
  /** Porcentaje de archivos repetidos (mismo UUID, otro nombre). */
  duplicateRate?: number;
}

type Template = (ctx: TemplateCtx) => CfdiSpec[];

interface TemplateCtx {
  rand: () => number;
  uuid: () => string;
  date: (month?: number) => string;
  user: SpecParty & { uso: string };
  year: number;
  pickAmount: (min: number, max: number) => number;
  previous: CfdiSpec[];
}

function between(rand: () => number, min: number, max: number): number {
  return Math.round((min + rand() * (max - min)) * 100) / 100;
}

function receptor(ctx: TemplateCtx, uso: string, regimen = '612') {
  return { ...ctx.user, uso, regimen };
}

const TEMPLATES: { weight: number; make: Template }[] = [
  {
    weight: 18,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: c.rand() < 0.7 ? '04' : '28',
        emisor: DEMO_ISSUERS.super,
        receptor: receptor(c, 'G03'),
        conceptos: [
          { clave: '50192100', descripcion: 'Abarrotes', importe: c.pickAmount(250, 2200) },
          { clave: '47131800', descripcion: 'Artículos de limpieza', importe: c.pickAmount(60, 400), iva: true },
        ],
      },
    ],
  },
  {
    weight: 12,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: c.rand() < 0.8 ? '04' : '01',
        emisor: DEMO_ISSUERS.gasolinera,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '15101514', descripcion: 'Gasolina regular', importe: c.pickAmount(450, 1100), iva: true }],
      },
    ],
  },
  {
    weight: 13,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.restaurante,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '90101501', descripcion: 'Consumo de alimentos', importe: c.pickAmount(220, 1600), iva: true }],
      },
    ],
  },
  {
    weight: 5,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.telefonia,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '83111603', descripcion: 'Servicio de telefonía e internet', importe: 516.38, iva: true }],
      },
    ],
  },
  {
    weight: 4,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.tecnologia,
        receptor: receptor(c, c.rand() < 0.5 ? 'I04' : 'G03'),
        conceptos: [{ clave: '43211503', descripcion: 'Equipo de cómputo y accesorios', importe: c.pickAmount(600, 9000), iva: true }],
      },
    ],
  },
  {
    weight: 1,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        moneda: 'USD',
        tipoCambio: between(c.rand, 17.1, 20.4),
        emisor: DEMO_ISSUERS.tecnologia,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '43232408', descripcion: 'Licencia de software (USD)', importe: c.pickAmount(10, 120), iva: true }],
      },
    ],
  },
  {
    weight: 6,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: c.rand() < 0.6 ? '04' : '01',
        emisor: DEMO_ISSUERS.ropa,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '53101602', descripcion: 'Prendas de vestir', importe: c.pickAmount(350, 3200), iva: true }],
      },
    ],
  },
  {
    weight: 5,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: c.rand() < 0.5 ? '03' : '04',
        emisor: DEMO_ISSUERS.dentista,
        receptor: receptor(c, 'D01'),
        conceptos: [{ clave: '85131500', descripcion: 'Consulta y limpieza dental', importe: c.pickAmount(800, 5200) }],
      },
    ],
  },
  {
    weight: 3,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '28',
        emisor: DEMO_ISSUERS.psicologo,
        receptor: receptor(c, 'D01'),
        conceptos: [{ clave: '85121608', descripcion: 'Sesión de psicoterapia', importe: c.pickAmount(700, 1200) }],
      },
    ],
  },
  {
    weight: 2,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '01',
        emisor: DEMO_ISSUERS.medico,
        receptor: receptor(c, 'D01'),
        conceptos: [{ clave: '85121502', descripcion: 'Consulta médica general', importe: c.pickAmount(600, 1100) }],
      },
    ],
  },
  {
    weight: 1,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.farmacia,
        receptor: receptor(c, 'D01'),
        conceptos: [{ clave: '51101500', descripcion: 'Medicamentos', importe: c.pickAmount(150, 1400) }],
      },
    ],
  },
  {
    weight: 0.6,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.optica,
        receptor: receptor(c, 'D01'),
        conceptos: [
          { clave: '42142913', descripcion: 'Lentes oftálmicos graduados, micas antirreflejantes', importe: c.pickAmount(1800, 4200) },
        ],
      },
    ],
  },
  {
    weight: 1.5,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.medico,
        receptor: receptor(c, 'G03'),
        conceptos: [{ clave: '85121502', descripcion: 'Consulta médica de especialidad', importe: c.pickAmount(900, 1800) }],
      },
    ],
  },
  {
    weight: 2,
    make: (c) => {
      // Hospital con pago diferido (PPD) y su complemento de pago.
      const month = 1 + Math.floor(c.rand() * 12);
      const invoice: CfdiSpec = {
        uuid: c.uuid(),
        fecha: c.date(month),
        tipo: 'I',
        formaPago: '99',
        metodoPago: 'PPD',
        emisor: DEMO_ISSUERS.hospital,
        receptor: receptor(c, 'D01'),
        conceptos: [
          { clave: '85101501', descripcion: 'Servicios hospitalarios', importe: c.pickAmount(4000, 26000) },
          { clave: '51101500', descripcion: 'Medicamentos suministrados durante la hospitalización', importe: c.pickAmount(400, 3500) },
        ],
      };
      const total = (invoice.conceptos ?? []).reduce((s, x) => s + x.importe, 0);
      const payYear = month === 12 && c.rand() < 0.5 ? c.year + 1 : c.year;
      const payMonth = payYear === c.year ? Math.min(12, month + (c.rand() < 0.5 ? 0 : 1)) : 1;
      const payDate = `${payYear}-${String(payMonth).padStart(2, '0')}-28T12:00:00`;
      const payment: CfdiSpec = {
        uuid: c.uuid(),
        fecha: payDate,
        tipo: 'P',
        emisor: DEMO_ISSUERS.hospital,
        receptor: receptor(c, 'CP01'),
        pagos: [{ fecha: payDate, forma: '04', doctos: [{ uuid: invoice.uuid, impPagado: total, saldoAnterior: total }] }],
      };
      return [invoice, payment];
    },
  },
  {
    weight: 1,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.financiera,
        receptor: receptor(c, 'D07'),
        conceptos: [{ clave: '84131602', descripcion: 'Prima de seguro de gastos médicos mayores', importe: c.pickAmount(9000, 21000) }],
      },
    ],
  },
  {
    weight: 4,
    make: (c) => {
      const kid = KIDS[Math.floor(c.rand() * KIDS.length)]!;
      const enrollment = c.rand() < 0.08;
      return [
        {
          uuid: c.uuid(),
          fecha: c.date(),
          tipo: 'I',
          formaPago: c.rand() < 0.93 ? '03' : '01',
          emisor: DEMO_ISSUERS.escuela,
          receptor: receptor(c, 'D10'),
          conceptos: [
            {
              clave: '86121501',
              descripcion: `Colegiatura mensual ${kid.nivelEducativo.toLowerCase()}`,
              importe: kid.nivelEducativo === 'Primaria' ? 3650 : 4280,
              iedu: { ...kid, rfcPago: c.user.rfc },
            },
            ...(enrollment ? [{ clave: '86121501', descripcion: 'Cuota de reinscripción', importe: 2500 }] : []),
          ],
        },
      ];
    },
  },
  {
    weight: 1.5,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.transporte,
        receptor: receptor(c, 'D08'),
        conceptos: [{ clave: '78111802', descripcion: 'Transporte escolar mensual', importe: 1250 }],
      },
    ],
  },
  {
    weight: 1,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: c.rand() < 0.8 ? '03' : '01',
        emisor: DEMO_ISSUERS.fundacion,
        receptor: receptor(c, 'D04'),
        conceptos: [{ clave: '84101600', descripcion: 'Donativo', importe: c.pickAmount(500, 4000) }],
        donataria: c.rand() < 0.7 ? { noAutorizacion: 'DEMO-0001', fechaAutorizacion: '2020-01-01' } : undefined,
      },
    ],
  },
  {
    weight: 0.3,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.funeraria,
        receptor: receptor(c, 'D03'),
        conceptos: [{ clave: '85171500', descripcion: 'Servicios funerarios', importe: c.pickAmount(22000, 46000) }],
      },
    ],
  },
  {
    weight: 0.5,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.hospital,
        receptor: receptor(c, 'D02'),
        conceptos: [
          {
            clave: '85121800',
            descripcion:
              c.rand() < 0.6 ? 'Terapia de rehabilitación relacionada con la atención de la discapacidad' : 'Terapia de rehabilitación',
            importe: c.pickAmount(1500, 9000),
          },
        ],
      },
    ],
  },
  {
    weight: 0.4,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.financiera,
        receptor: receptor(c, 'D05'),
        conceptos: [{ clave: '84121500', descripcion: 'Intereses de crédito hipotecario', importe: c.pickAmount(2500, 4500) }],
      },
    ],
  },
  {
    weight: 0.4,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: DEMO_ISSUERS.financiera,
        receptor: receptor(c, c.rand() < 0.5 ? 'D06' : 'D09'),
        conceptos: [{ clave: '84121700', descripcion: 'Aportación voluntaria de ahorro para el retiro', importe: c.pickAmount(1000, 6000) }],
      },
    ],
  },
  {
    weight: 3,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '01',
        emisor: c.rand() < 0.5 ? DEMO_ISSUERS.restaurante : DEMO_ISSUERS.super,
        receptor: { rfc: 'XAXX010101000', nombre: 'PUBLICO EN GENERAL', regimen: '616', uso: 'S01' },
        conceptos: [{ clave: '90101501', descripcion: 'Venta al público en general', importe: c.pickAmount(150, 900), iva: true }],
      },
    ],
  },
  {
    weight: 2,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '04',
        emisor: DEMO_ISSUERS.dentista,
        receptor: { ...OTHER_PERSON, uso: 'D01' },
        conceptos: [{ clave: '85131500', descripcion: 'Tratamiento dental', importe: c.pickAmount(900, 4000) }],
      },
    ],
  },
  {
    weight: 2,
    make: (c) => {
      const candidates = c.previous.filter((p) => p.tipo === 'I' && p.metodoPago !== 'PPD' && p.conceptos?.length && p.fecha.startsWith(String(c.year)));
      const original = candidates[Math.floor(c.rand() * candidates.length)];
      if (!original || !original.conceptos) return [];
      const base = original.conceptos.reduce((s, x) => s + x.importe, 0);
      return [
        {
          uuid: c.uuid(),
          fecha: original.fecha.replace(/T.*/, 'T18:30:00'),
          tipo: 'E',
          formaPago: original.formaPago === '01' ? '01' : '03',
          emisor: original.emisor,
          receptor: original.receptor,
          relacionados: { tipo: '01', uuids: [original.uuid] },
          conceptos: [
            {
              clave: '84111506',
              descripcion: 'Bonificación (nota de crédito)',
              importe: Math.round(base * between(c.rand, 0.05, 0.25) * 100) / 100,
              iva: original.conceptos.some((x) => x.iva),
            },
          ],
        },
      ];
    },
  },
  {
    weight: 2,
    make: (c) => [
      {
        uuid: c.uuid(),
        fecha: c.date(),
        tipo: 'I',
        formaPago: '03',
        emisor: { rfc: c.user.rfc, nombre: c.user.nombre, regimen: '612' },
        receptor: { ...DEMO_ISSUERS.tecnologia, uso: 'G03' },
        conceptos: [{ clave: '80111600', descripcion: 'Servicios profesionales de consultoría', importe: c.pickAmount(8000, 30000), iva: true }],
      },
    ],
  },
];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Genera un conjunto de CFDI sintéticos de un ejercicio, con nómina quincenal, gastos,
 * deducciones personales (válidas, con problemas y por revisar), pagos PPD, notas de crédito,
 * duplicados y facturas a otros RFC.
 */
export function generateDataset(options: GenerateOptions): GeneratedFile[] {
  const rand = rng(options.seed ?? 20251231);
  const year = options.year;
  const userRfc = options.userRfc ?? DEMO_USER.rfc;
  const user = { rfc: userRfc, nombre: DEMO_USER.nombre, regimen: '612', uso: 'G03' };
  const uuid = () => {
    const hex = (len: number) =>
      Array.from({ length: len }, () => Math.floor(rand() * 16).toString(16))
        .join('')
        .toUpperCase();
    return `${hex(8)}-${hex(4)}-4${hex(3)}-${['8', '9', 'A', 'B'][Math.floor(rand() * 4)]}${hex(3)}-${hex(12)}`;
  };
  const date = (month?: number) => {
    const m = month ?? 1 + Math.floor(rand() * 12);
    const d = 1 + Math.floor(rand() * 28);
    const h = 8 + Math.floor(rand() * 13);
    const min = Math.floor(rand() * 60);
    return `${year}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:${pad(Math.floor(rand() * 60))}`;
  };
  const specs: CfdiSpec[] = [];
  const ctx: TemplateCtx = {
    rand,
    uuid,
    date,
    user,
    year,
    pickAmount: (min, max) => between(rand, min, max),
    previous: specs,
  };

  // Nómina quincenal (ingreso, no gasto). Hasta 24 recibos, proporcional al tamaño.
  const payrollCount = Math.min(24, Math.max(2, Math.round(options.count * 0.06)));
  for (let i = 0; i < payrollCount; i++) {
    const month = 1 + Math.floor(i / 2);
    const first = i % 2 === 0;
    const fechaPago = `${year}-${pad(month)}-${first ? '15' : '28'}`;
    specs.push({
      uuid: uuid(),
      fecha: `${fechaPago}T09:00:00`,
      tipo: 'N',
      formaPago: '99',
      emisor: DEMO_ISSUERS.tecnologia,
      receptor: { ...user, regimen: '605', uso: 'CN01' },
      nomina: {
        fechaPago,
        fechaInicial: `${year}-${pad(month)}-${first ? '01' : '16'}`,
        fechaFinal: fechaPago,
        percepciones: 28500,
        isr: 4987.45,
        otrasDeducciones: 712.5,
        curp: DEMO_USER.curp,
      },
    });
  }

  const totalWeight = TEMPLATES.reduce((s, t) => s + t.weight, 0);
  while (specs.length < options.count) {
    let pick = rand() * totalWeight;
    let template = TEMPLATES[0]!;
    for (const t of TEMPLATES) {
      pick -= t.weight;
      if (pick <= 0) {
        template = t;
        break;
      }
    }
    for (const spec of template.make(ctx)) {
      if (specs.length < options.count) specs.push(spec);
    }
  }

  const files: GeneratedFile[] = specs.map((spec) => ({ name: `${spec.uuid}.xml`, xml: buildCfdi(spec) }));
  const dupRate = options.duplicateRate ?? 0.01;
  const dupCount = Math.floor(files.length * dupRate);
  for (let i = 0; i < dupCount; i++) {
    const src = files[Math.floor(rand() * files.length)]!;
    files.push({ name: `copia-${i + 1}-${src.name}`, xml: src.xml });
  }
  return files;
}
