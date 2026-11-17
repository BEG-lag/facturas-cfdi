import type { Invoice } from './types.ts';

/**
 * Categorías de gasto. Son una agrupación propia (heurística), no una clasificación del SAT.
 * Se basan en el segmento (dos primeros dígitos) de la ClaveProdServ del concepto de mayor importe;
 * el catálogo c_ClaveProdServ del SAT sigue la estructura de segmentos de UNSPSC.
 * Si el UsoCFDI es una deducción personal, manda el uso.
 */
export const CATEGORY_IDS = [
  'salud',
  'educacion',
  'alimentos',
  'restaurantes',
  'transporte',
  'servicios',
  'tecnologia',
  'hogar',
  'ropa',
  'seguros',
  'profesionales',
  'donativos',
  'vivienda',
  'ahorro',
  'otros',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

const BY_USO: Record<string, CategoryId> = {
  D01: 'salud',
  D02: 'salud',
  D03: 'otros',
  D04: 'donativos',
  D05: 'vivienda',
  D06: 'ahorro',
  D07: 'seguros',
  D08: 'educacion',
  D09: 'ahorro',
  D10: 'educacion',
};

const BY_SEGMENT: Record<string, CategoryId> = {
  '42': 'salud',
  '51': 'salud',
  '85': 'salud',
  '86': 'educacion',
  '55': 'educacion',
  '50': 'alimentos',
  '90': 'restaurantes',
  '15': 'transporte',
  '25': 'transporte',
  '78': 'transporte',
  '83': 'servicios',
  '43': 'tecnologia',
  '32': 'tecnologia',
  '81': 'tecnologia',
  '52': 'hogar',
  '56': 'hogar',
  '47': 'hogar',
  '39': 'hogar',
  '72': 'hogar',
  '53': 'ropa',
  '54': 'ropa',
  '84': 'seguros',
  '80': 'profesionales',
  '82': 'profesionales',
  '93': 'otros',
  '95': 'vivienda',
};

/** Clave del concepto con mayor importe (o cadena vacía). */
export function dominantClave(invoice: Invoice): string {
  let best = '';
  let max = -Infinity;
  for (const c of invoice.conceptos) {
    if (c.importe > max) {
      max = c.importe;
      best = c.claveProdServ;
    }
  }
  return best;
}

export function categorize(invoice: Invoice): CategoryId {
  // Pagos, nómina y traslados no son gasto: no se clasifican por producto.
  if (invoice.tipo === 'P' || invoice.tipo === 'N' || invoice.tipo === 'T') return 'otros';
  const byUso = BY_USO[invoice.receptor.usoCfdi];
  if (byUso) return byUso;
  const clave = dominantClave(invoice);
  // Restaurantes (9010) dentro del segmento 90; hoteles y viajes también quedan en "restaurantes y viajes".
  return BY_SEGMENT[clave.slice(0, 2)] ?? 'otros';
}

/** Señales de que un gasto con UsoCFDI no deducible pudo haber sido deducción personal. */
export function looksLikePersonalDeduction(invoice: Invoice): 'salud' | 'educacion' | null {
  for (const c of invoice.conceptos) {
    const seg = c.claveProdServ.slice(0, 2);
    if (seg === '85') return 'salud';
    if (seg === '86' || c.iedu) return 'educacion';
  }
  return null;
}
