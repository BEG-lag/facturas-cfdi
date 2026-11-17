/** Tipos de comprobante del catálogo c_TipoDeComprobante (Anexo 20). */
export type TipoComprobante = 'I' | 'E' | 'P' | 'N' | 'T';

export type CfdiVersion = '4.0' | '3.3';

export interface Party {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
}

export interface Receptor extends Party {
  usoCfdi: string;
  domicilioFiscal: string;
}

/** Complemento concepto "Instituciones Educativas Privadas" (iedu 1.0). */
export interface Iedu {
  nombreAlumno: string;
  curp: string;
  nivelEducativo: string;
  autRvoe: string;
  rfcPago: string;
}

export interface Concepto {
  claveProdServ: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
  descuento: number;
  iedu: Iedu | null;
}

export interface DocRelacionadoPago {
  idDocumento: string;
  monedaDR: string;
  /** EquivalenciaDR (Pagos 2.0) o TipoCambioDR (Pagos 1.0); 1 si no viene. */
  equivalenciaDR: number;
  numParcialidad: number;
  impPagado: number;
}

export interface Pago {
  fechaPago: string;
  formaDePago: string;
  moneda: string;
  tipoCambio: number;
  monto: number;
  doctos: DocRelacionadoPago[];
}

export interface Nomina {
  tipoNomina: string;
  fechaPago: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  totalPercepciones: number;
  totalDeducciones: number;
  totalOtrosPagos: number;
  /** ISR retenido: deducciones con TipoDeduccion 002. */
  isrRetenido: number;
}

export interface CfdiRelacionados {
  tipoRelacion: string;
  uuids: string[];
}

export interface Invoice {
  /** Clave interna estable: UUID en mayúsculas o, si falta, nombre de archivo. */
  key: string;
  fileName: string;
  version: CfdiVersion;
  uuid: string;
  fechaTimbrado: string;
  serie: string;
  folio: string;
  /** Fecha de emisión tal como viene (AAAA-MM-DDThh:mm:ss, hora local del emisor). */
  fecha: string;
  year: number;
  /** AAAA-MM */
  month: string;
  tipo: TipoComprobante;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  tipoCambio: number;
  subTotal: number;
  descuento: number;
  total: number;
  /** Total convertido a MXN con TipoCambio (0 para Moneda XXX). */
  totalMxn: number;
  emisor: Party;
  receptor: Receptor;
  conceptos: Concepto[];
  totalTrasladados: number;
  totalRetenidos: number;
  relacionados: CfdiRelacionados[];
  pagos: Pago[];
  nomina: Nomina | null;
  impuestosLocales: { retenciones: number; traslados: number } | null;
  leyendas: string[];
  donataria: { noAutorizacion: string; fechaAutorizacion: string } | null;
  /** Nombres locales de los complementos encontrados. */
  complementos: string[];
}

export interface ParseFailure {
  fileName: string;
  /** Código de error traducible. */
  code: 'malformed' | 'not-cfdi' | 'unsupported-version' | 'retenciones' | 'empty';
  detail: string;
}

export type ParseResult = { ok: true; invoice: Invoice } | { ok: false; error: ParseFailure };

export type DeductionStatus = 'likely' | 'review' | 'no' | 'na';

export type ReasonLevel = 'info' | 'review' | 'no';

export interface Reason {
  /** Código traducible (ver i18n). */
  code: string;
  /** "no" descarta, "review" pide revisión, "info" sólo informa. */
  level: ReasonLevel;
  params?: Record<string, string | number>;
  /** Id de la regla en rules.ts que sustenta la razón. */
  rule?: string;
}

export interface DeductionResult {
  status: DeductionStatus;
  /** Clave D01 a D10 si aplica. */
  key: string | null;
  /** Monto en MXN atribuible al ejercicio seleccionado (antes de topes). */
  amount: number;
  reasons: Reason[];
  /** CURP y nivel para colegiaturas. */
  students: { curp: string; nombre: string; nivel: string; amount: number }[];
}

export type Role = 'received' | 'issued' | 'other';
