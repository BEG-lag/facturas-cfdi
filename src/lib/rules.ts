/**
 * Reglas y valores oficiales que usa el clasificador. Cada regla lleva su fuente.
 * Fecha de consulta de todas las fuentes: 2026-11-17. Detalle y citas en docs/reglas.md.
 */

export const CONSULTED_ON = '2026-11-17';

export const SOURCES = {
  lisr: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/LISR.pdf',
  rlisr: 'https://www.diputados.gob.mx/LeyesBiblio/regley/Reg_LISR_060516.pdf',
  decretoColegiaturas: 'https://dof.gob.mx/nota_detalle.php?codigo=5328028&fecha=26/12/2013',
  desindexacion: 'https://dof.gob.mx/nota_detalle.php?codigo=5423663&fecha=27/01/2016',
  anexo20: 'http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm',
  guia40: 'http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Anexo_20_Guia_de_llenado_CFDI.pdf',
  faq40: 'http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/PregFrecCFDIVer4_0.pdf',
  faq33: 'http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/pregfreccfdiver3_3_07092017.pdf',
  faqAnual2025:
    'https://www.sat.gob.mx/minisitio/DeclaracionAnual/Personas/documentos/PreguntasFrecuentes_AnualPF2025.pdf',
  satColegiaturas: 'https://www.sat.gob.mx/minisitio/DeduccionesPersonales/colegiaturas.html',
  satGastosMedicos: 'https://www.sat.gob.mx/minisitio/DeduccionesPersonales/gastos_medicos.html',
  satMinisitio: 'https://www.sat.gob.mx/minisitio/DeduccionesPersonales/gastos_funerarios.html',
  verificaCfdi: 'https://verificacfdi.facturaelectronica.sat.gob.mx/',
  donatarias: 'https://www.sat.gob.mx/minisitio/DonatariasAutorizadas/padron_directorio.html',
  guiaPagos: 'http://omawww.sat.gob.mx/tramitesyservicios/Paginas/documentos/Guia_llenado_pagos.pdf',
} as const;

export interface RuleRef {
  /** Cita corta, p. ej. "LISR art. 151, fr. I". */
  cite: string;
  url: string;
}

/** Catálogo de reglas citables. Los ids se usan en Reason.rule. */
export const RULES: Record<string, RuleRef> = {
  'lisr-151-I': { cite: 'LISR art. 151, fr. I', url: SOURCES.lisr },
  'lisr-151-I-medios': { cite: 'LISR art. 151, fr. I, primer párrafo (medios de pago)', url: SOURCES.lisr },
  'lisr-151-I-incapacidad': { cite: 'LISR art. 151, fr. I, párrafos tercero a quinto', url: SOURCES.lisr },
  'lisr-151-II': { cite: 'LISR art. 151, fr. II', url: SOURCES.lisr },
  'lisr-151-III': { cite: 'LISR art. 151, fr. III', url: SOURCES.lisr },
  'lisr-151-IV': { cite: 'LISR art. 151, fr. IV', url: SOURCES.lisr },
  'lisr-151-V': { cite: 'LISR art. 151, fr. V', url: SOURCES.lisr },
  'lisr-151-VI': { cite: 'LISR art. 151, fr. VI', url: SOURCES.lisr },
  'lisr-151-VII': { cite: 'LISR art. 151, fr. VII', url: SOURCES.lisr },
  'lisr-151-pagadas': {
    cite: 'LISR art. 151, párrafo posterior a la fr. VIII (pagos efectivamente realizados en el año)',
    url: SOURCES.lisr,
  },
  'lisr-151-tope': { cite: 'LISR art. 151, último párrafo (tope global)', url: SOURCES.lisr },
  'lisr-185': { cite: 'LISR art. 185, fr. I', url: SOURCES.lisr },
  'rlisr-264': { cite: 'RLISR art. 264', url: SOURCES.rlisr },
  'rlisr-269': { cite: 'RLISR art. 269', url: SOURCES.rlisr },
  'decreto-1.8': { cite: 'Decreto DOF 26-12-2013, art. 1.8', url: SOURCES.decretoColegiaturas },
  'decreto-1.9': { cite: 'Decreto DOF 26-12-2013, art. 1.9', url: SOURCES.decretoColegiaturas },
  'decreto-1.10': { cite: 'Decreto DOF 26-12-2013, art. 1.10', url: SOURCES.decretoColegiaturas },
  'sat-colegiaturas': { cite: 'SAT, minisitio Deducciones personales: colegiaturas', url: SOURCES.satColegiaturas },
  'sat-gastos-medicos': {
    cite: 'SAT, minisitio Deducciones personales: gastos médicos',
    url: SOURCES.satGastosMedicos,
  },
  'anexo20-receptor': { cite: 'Anexo 20 CFDI 4.0, nodo Receptor (RFC genérico)', url: SOURCES.anexo20 },
  'catalogo-uso': { cite: 'Catálogo c_UsoCFDI 4.0 (columna Régimen Fiscal Receptor)', url: SOURCES.anexo20 },
  'guia40-forma': { cite: 'SAT, Guía de llenado CFDI 4.0 (FormaPago y MetodoPago)', url: SOURCES.guia40 },
  'faq40-uso': { cite: 'SAT, Preguntas frecuentes CFDI 4.0, pregunta 1', url: SOURCES.faq40 },
  'faq33-uso': { cite: 'SAT, Preguntas frecuentes CFDI 3.3, pregunta 1', url: SOURCES.faq33 },
  'guia-pagos': { cite: 'SAT, Guía de llenado del complemento de pagos (FechaPago)', url: SOURCES.guiaPagos },
  'faq-anual-2025': { cite: 'SAT, Preguntas frecuentes Declaración Anual PF 2025', url: SOURCES.faqAnual2025 },
  'sat-donatarias': { cite: 'SAT, directorio de donatarias autorizadas', url: SOURCES.donatarias },
  'sat-minisitio': {
    cite: 'SAT, minisitio Deducciones personales (criterio informativo, no ley)',
    url: SOURCES.satMinisitio,
  },
  'lisr-151-exclusion-147': {
    cite: 'LISR art. 151, párrafo posterior a la fr. VIII (no aplican requisitos del Capítulo X)',
    url: SOURCES.lisr,
  },
  'sat-verifica': { cite: 'SAT, verificación de CFDI', url: SOURCES.verificaCfdi },
};

/**
 * Valor anual de la UMA publicado por el INEGI en el DOF. Vigente del 1 de febrero de cada año
 * al 31 de enero del siguiente. Para el tope global de un ejercicio usamos el valor de ese año,
 * que coincide con la cifra que publica el SAT para el ejercicio 2025 (5 UMA = $206,367.36,
 * FAQ Declaración Anual 2025, sección D, pregunta 3). Es una inferencia: el SAT no lo dice como regla.
 */
export interface UmaValue {
  year: number;
  daily: number;
  monthly: number;
  annual: number;
  dof: string;
  url: string;
}

export const UMA: Record<number, UmaValue> = {
  2023: {
    year: 2023,
    daily: 103.74,
    monthly: 3153.7,
    annual: 37844.4,
    dof: '2023-01-10',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5676670&fecha=10/01/2023',
  },
  2024: {
    year: 2024,
    daily: 108.57,
    monthly: 3300.53,
    annual: 39606.36,
    dof: '2024-01-10',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5714085&fecha=10/01/2024',
  },
  2025: {
    year: 2025,
    daily: 113.14,
    monthly: 3439.46,
    annual: 41273.52,
    dof: '2025-01-10',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5746930&fecha=10/01/2025',
  },
  2026: {
    year: 2026,
    daily: 117.31,
    monthly: 3566.22,
    annual: 42794.64,
    dof: '2026-01-09',
    url: 'https://dof.gob.mx/nota_detalle.php?codigo=5778072&fecha=09/01/2026',
  },
};

export function umaFor(year: number): UmaValue | null {
  return UMA[year] ?? null;
}

/** Topes anuales por nivel educativo, Decreto DOF 26-12-2013 art. 1.10 (por alumno). */
export const COLEGIATURA_LIMITS: Record<string, number> = {
  preescolar: 14200,
  primaria: 12900,
  secundaria: 19900,
  'profesional tecnico': 17100,
  bachillerato: 24500,
};

/** Normaliza el atributo nivelEducativo del complemento iedu a una llave de COLEGIATURA_LIMITS. */
export function normalizeNivel(nivel: string): string | null {
  const n = nivel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (n.startsWith('preescolar')) return 'preescolar';
  if (n.startsWith('primaria')) return 'primaria';
  if (n.startsWith('secundaria')) return 'secundaria';
  if (n.startsWith('profesional tecnico')) return 'profesional tecnico';
  if (n.startsWith('bachillerato')) return 'bachillerato';
  return null;
}

/** Lentes ópticos graduados: hasta $2,500 por persona en el ejercicio (RLISR art. 264). */
export const LENTES_LIMIT = 2500;

/** Cuentas especiales para el ahorro: hasta $152,000 en el año (LISR art. 185 fr. I). */
export const AHORRO_185_LIMIT = 152000;

/** Tope global: menor entre 5 UMA anuales y 15% de los ingresos (LISR art. 151, último párrafo). */
export const GLOBAL_CAP_UMAS = 5;
export const GLOBAL_CAP_INCOME_RATE = 0.15;

/** Donativos: 7% de los ingresos acumulables del ejercicio anterior (LISR art. 151 fr. III). */
export const DONATIVOS_RATE = 0.07;

/** Aportaciones voluntarias: 10% de ingresos acumulables, sin exceder 5 UMA anuales (LISR art. 151 fr. V). */
export const RETIRO_RATE = 0.1;
export const RETIRO_UMAS = 5;

/**
 * Claves cuyo monto entra al tope global. Fuera del tope: D02 (fr. I, párrafo de incapacidad),
 * D06 (fr. V, excepción expresa), D09 (art. 185, fuera del art. 151) y D10 (Decreto art. 1.10).
 * Los donativos (D04) sí están sujetos al tope desde el ejercicio 2022 (FAQ Anual 2025).
 */
export const SUBJECT_TO_GLOBAL_CAP = ['D01', 'D03', 'D04', 'D05', 'D07', 'D08'];

/**
 * Claves para las que la ley exige pago con cheque nominativo, transferencia o tarjeta:
 * D01 (LISR 151 fr. I), D08 (fr. VII) y D10 (Decreto art. 1.9).
 */
export const BANKED_PAYMENT_REQUIRED: Record<string, string> = {
  D01: 'lisr-151-I-medios',
  D08: 'lisr-151-VII',
  D10: 'decreto-1.9',
};
