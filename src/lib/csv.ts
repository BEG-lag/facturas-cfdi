import type { Row } from './aggregate.ts';
import type { Lang } from './format.ts';
import { t } from './i18n.ts';
import { reasonText } from './reasons.ts';

export interface CsvOptions {
  lang: Lang;
  /** Variante para Excel: BOM UTF-8 para acentos y protección contra fórmulas. */
  excel: boolean;
}

const HEADERS: Record<Lang, string[]> = {
  es: [
    'UUID',
    'Fecha',
    'Tipo',
    'Version',
    'RFC emisor',
    'Nombre emisor',
    'RFC receptor',
    'Uso CFDI',
    'Forma de pago',
    'Metodo de pago',
    'Moneda',
    'Tipo de cambio',
    'Subtotal',
    'Descuento',
    'Impuestos trasladados',
    'Impuestos retenidos',
    'Total',
    'Total MXN',
    'Categoria',
    'Estatus deduccion',
    'Clave deduccion',
    'Monto del ejercicio MXN',
    'Razones',
    'Archivo',
  ],
  en: [
    'UUID',
    'Date',
    'Type',
    'Version',
    'Issuer RFC',
    'Issuer name',
    'Receiver RFC',
    'CFDI use',
    'Payment form',
    'Payment method',
    'Currency',
    'Exchange rate',
    'Subtotal',
    'Discount',
    'Taxes transferred',
    'Taxes withheld',
    'Total',
    'Total MXN',
    'Category',
    'Deduction status',
    'Deduction key',
    'Amount for the year MXN',
    'Reasons',
    'File',
  ],
};

function cell(value: string | number, excel: boolean): string {
  if (typeof value === 'number') return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '';
  let text = value;
  // Evita que Excel interprete texto como fórmula (inyección CSV).
  if (excel && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows: Row[], options: CsvOptions): string {
  const { lang, excel } = options;
  const lines: string[] = [HEADERS[lang].map((h) => cell(h, excel)).join(',')];
  for (const { invoice: i, category, deduction: d } of rows) {
    const values: (string | number)[] = [
      i.uuid,
      i.fecha,
      t(`type.${i.tipo}`, undefined, lang),
      i.version,
      i.emisor.rfc,
      i.emisor.nombre,
      i.receptor.rfc,
      i.receptor.usoCfdi,
      i.formaPago,
      i.metodoPago,
      i.moneda,
      i.tipoCambio,
      i.subTotal,
      i.descuento,
      i.totalTrasladados,
      i.totalRetenidos,
      i.total,
      i.totalMxn,
      t(`cat.${category}`, undefined, lang),
      t(`status.${d.status}`, undefined, lang),
      d.key ?? '',
      d.amount,
      d.reasons.map((r) => reasonText(r, lang)).join(' | '),
      i.fileName,
    ];
    lines.push(values.map((v) => cell(v, excel)).join(','));
  }
  const body = lines.join('\r\n') + '\r\n';
  return excel ? `\uFEFF${body}` : body;
}
