/**
 * Extractos de los catálogos del SAT para CFDI 4.0 (y 3.3 donde difiere).
 * Fuente: catCFDI_V_4_20261106.xls, enlazado desde
 * http://omawww.sat.gob.mx/tramitesyservicios/Paginas/anexo_20.htm (consultado 2026-11-17).
 * La descripción en español es la oficial; la inglesa es una traducción libre.
 */

export interface CatalogEntry {
  es: string;
  en: string;
}

export const USO_CFDI: Record<string, CatalogEntry> = {
  G01: { es: 'Adquisición de mercancías', en: 'Purchase of goods' },
  G02: { es: 'Devoluciones, descuentos o bonificaciones', en: 'Returns, discounts or rebates' },
  G03: { es: 'Gastos en general', en: 'General expenses' },
  I01: { es: 'Construcciones', en: 'Construction' },
  I02: { es: 'Mobiliario y equipo de oficina por inversiones', en: 'Office furniture and equipment (investment)' },
  I03: { es: 'Equipo de transporte', en: 'Transport equipment' },
  I04: { es: 'Equipo de computo y accesorios', en: 'Computer equipment and accessories' },
  I05: { es: 'Dados, troqueles, moldes, matrices y herramental', en: 'Dies, molds and tooling' },
  I06: { es: 'Comunicaciones telefónicas', en: 'Telephone communications' },
  I07: { es: 'Comunicaciones satelitales', en: 'Satellite communications' },
  I08: { es: 'Otra maquinaria y equipo', en: 'Other machinery and equipment' },
  D01: { es: 'Honorarios médicos, dentales y gastos hospitalarios', en: 'Medical, dental and hospital expenses' },
  D02: { es: 'Gastos médicos por incapacidad o discapacidad', en: 'Medical expenses for incapacity or disability' },
  D03: { es: 'Gastos funerales', en: 'Funeral expenses' },
  D04: { es: 'Donativos', en: 'Donations' },
  D05: {
    es: 'Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)',
    en: 'Real interest paid on mortgage loans (home)',
  },
  D06: { es: 'Aportaciones voluntarias al SAR', en: 'Voluntary retirement (SAR) contributions' },
  D07: { es: 'Primas por seguros de gastos médicos', en: 'Health insurance premiums' },
  D08: { es: 'Gastos de transportación escolar obligatoria', en: 'Mandatory school transport' },
  D09: {
    es: 'Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones',
    en: 'Deposits in savings accounts or pension-plan premiums',
  },
  D10: { es: 'Pagos por servicios educativos (colegiaturas)', en: 'School tuition (colegiaturas)' },
  S01: { es: 'Sin efectos fiscales', en: 'No tax effects' },
  CP01: { es: 'Pagos', en: 'Payments' },
  CN01: { es: 'Nómina', en: 'Payroll' },
  P01: { es: 'Por definir (solo CFDI 3.3)', en: 'To be defined (CFDI 3.3 only)' },
};

export const DEDUCTION_KEYS = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10'] as const;
export type DeductionKey = (typeof DEDUCTION_KEYS)[number];

export function isDeductionKey(value: string): value is DeductionKey {
  return (DEDUCTION_KEYS as readonly string[]).includes(value);
}

/** Regímenes del receptor admitidos para D01 a D10 según la columna del catálogo c_UsoCFDI 4.0. */
export const REGIMENES_DEDUCCION_PERSONAL = ['605', '606', '608', '611', '612', '614', '607', '615', '625'];

export const FORMA_PAGO: Record<string, CatalogEntry> = {
  '01': { es: 'Efectivo', en: 'Cash' },
  '02': { es: 'Cheque nominativo', en: 'Nominative check' },
  '03': { es: 'Transferencia electrónica de fondos', en: 'Electronic funds transfer' },
  '04': { es: 'Tarjeta de crédito', en: 'Credit card' },
  '05': { es: 'Monedero electrónico', en: 'Electronic wallet' },
  '06': { es: 'Dinero electrónico', en: 'Electronic money' },
  '08': { es: 'Vales de despensa', en: 'Grocery vouchers' },
  '12': { es: 'Dación en pago', en: 'Payment in kind' },
  '13': { es: 'Pago por subrogación', en: 'Payment by subrogation' },
  '14': { es: 'Pago por consignación', en: 'Payment by consignment' },
  '15': { es: 'Condonación', en: 'Debt forgiveness' },
  '17': { es: 'Compensación', en: 'Set-off' },
  '23': { es: 'Novación', en: 'Novation' },
  '24': { es: 'Confusión', en: 'Merger of obligations' },
  '25': { es: 'Remisión de deuda', en: 'Debt remission' },
  '26': { es: 'Prescripción o caducidad', en: 'Prescription or expiry' },
  '27': { es: 'A satisfacción del acreedor', en: 'To the creditor’s satisfaction' },
  '28': { es: 'Tarjeta de débito', en: 'Debit card' },
  '29': { es: 'Tarjeta de servicios', en: 'Service card' },
  '30': { es: 'Aplicación de anticipos', en: 'Application of advances' },
  '31': { es: 'Intermediario pagos', en: 'Payment intermediary' },
  '99': { es: 'Por definir', en: 'To be defined' },
};

/**
 * Formas de pago que coinciden con los medios que enumera la LISR art. 151 fr. I y VII
 * y el Decreto de 26-12-2013 art. 1.9: cheque nominativo, transferencia electrónica,
 * tarjeta de crédito, de débito o de servicios.
 */
export const FORMAS_PAGO_LEGALES = ['02', '03', '04', '28', '29'];

export const METODO_PAGO: Record<string, CatalogEntry> = {
  PUE: { es: 'Pago en una sola exhibición', en: 'Single payment' },
  PPD: { es: 'Pago en parcialidades o diferido', en: 'Installments or deferred payment' },
};

export const TIPO_COMPROBANTE: Record<string, CatalogEntry> = {
  I: { es: 'Ingreso', en: 'Income (invoice)' },
  E: { es: 'Egreso (nota de crédito)', en: 'Expense (credit note)' },
  P: { es: 'Pago', en: 'Payment' },
  N: { es: 'Nómina', en: 'Payroll' },
  T: { es: 'Traslado', en: 'Transfer (shipping)' },
};

export const REGIMEN_FISCAL: Record<string, CatalogEntry> = {
  '601': { es: 'General de Ley Personas Morales', en: 'General regime, legal entities' },
  '603': { es: 'Personas Morales con Fines no Lucrativos', en: 'Non-profit legal entities' },
  '605': { es: 'Sueldos y Salarios e Ingresos Asimilados a Salarios', en: 'Wages and salaries' },
  '606': { es: 'Arrendamiento', en: 'Rental income' },
  '607': { es: 'Régimen de Enajenación o Adquisición de Bienes', en: 'Sale or acquisition of goods' },
  '608': { es: 'Demás ingresos', en: 'Other income' },
  '609': { es: 'Consolidación', en: 'Consolidation' },
  '610': {
    es: 'Residentes en el Extranjero sin Establecimiento Permanente en México',
    en: 'Non-residents without permanent establishment',
  },
  '611': { es: 'Ingresos por Dividendos (socios y accionistas)', en: 'Dividend income' },
  '612': {
    es: 'Personas Físicas con Actividades Empresariales y Profesionales',
    en: 'Individuals with business and professional activities',
  },
  '614': { es: 'Ingresos por intereses', en: 'Interest income' },
  '615': { es: 'Régimen de los ingresos por obtención de premios', en: 'Prize income' },
  '616': { es: 'Sin obligaciones fiscales', en: 'No tax obligations' },
  '620': {
    es: 'Sociedades Cooperativas de Producción que optan por diferir sus ingresos',
    en: 'Production cooperatives deferring income',
  },
  '621': { es: 'Incorporación Fiscal', en: 'Tax incorporation regime' },
  '622': {
    es: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras',
    en: 'Agriculture, livestock, forestry and fishing',
  },
  '623': { es: 'Opcional para Grupos de Sociedades', en: 'Optional regime for corporate groups' },
  '624': { es: 'Coordinados', en: 'Coordinated' },
  '625': {
    es: 'Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas',
    en: 'Business income through digital platforms',
  },
  '626': { es: 'Régimen Simplificado de Confianza', en: 'Simplified trust regime (RESICO)' },
  '628': { es: 'Hidrocarburos', en: 'Hydrocarbons' },
  '629': {
    es: 'De los Regímenes Fiscales Preferentes y de las Empresas Multinacionales',
    en: 'Preferential regimes and multinationals',
  },
  '630': { es: 'Enajenación de acciones en bolsa de valores', en: 'Sale of listed shares' },
};

/** RFC genéricos del Anexo 20. */
export const RFC_PUBLICO_GENERAL = 'XAXX010101000';
export const RFC_EXTRANJERO = 'XEXX010101000';

export function describe(catalog: Record<string, CatalogEntry>, code: string, lang: 'es' | 'en'): string {
  const entry = catalog[code];
  return entry ? `${code} · ${entry[lang]}` : code || '-';
}
