import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { allKeys, hasKey, t } from '../../src/lib/i18n.ts';
import { reasonText } from '../../src/lib/reasons.ts';
import { RULES } from '../../src/lib/rules.ts';

describe('i18n', () => {
  it('español e inglés tienen las mismas llaves', () => {
    expect(allKeys('en').sort()).toEqual(allKeys('es').sort());
  });

  it('cada código de razón del clasificador tiene texto y cada regla citada existe', () => {
    const source = readFileSync(join(import.meta.dirname, '../../src/lib/classifier.ts'), 'utf8');
    const reasonCodes = new Set(Array.from(source.matchAll(/code: '([a-z0-9-]+)'/g), (m) => m[1]!));
    const notApplicable = Array.from(source.matchAll(/notApplicable\('([a-z0-9-]+)'/g), (m) => m[1]!);
    for (const c of notApplicable) reasonCodes.add(c);
    for (const code of ['payroll-issued', 'uso-mismatch-40', 'uso-mismatch-33']) reasonCodes.add(code);
    expect(reasonCodes.size).toBeGreaterThan(30);
    for (const code of reasonCodes) {
      expect(hasKey(`r.${code}`, 'es'), `falta r.${code}`).toBe(true);
    }
    const rules = Array.from(source.matchAll(/rule: '([a-z0-9.-]+)'/g), (m) => m[1]!);
    const rulesTs = readFileSync(join(import.meta.dirname, '../../src/lib/rules.ts'), 'utf8');
    for (const r of Array.from(rulesTs.matchAll(/^\s+([A-Z0-9_]+): '([a-z0-9.-]+)',$/gm), (m) => m[2]!)) rules.push(r);
    for (const rule of rules) expect(RULES[rule], `falta regla ${rule}`).toBeDefined();
  });

  it('interpola parámetros y formatea montos', () => {
    expect(t('table.showing', { from: 1, to: 50, total: 200 }, 'es')).toBe('1 a 50 de 200');
    expect(reasonText({ code: 'lenses', level: 'review', params: { limit: 2500 } }, 'es')).toContain('$2,500.00');
    expect(reasonText({ code: 'uso-mismatch-40', level: 'review', params: { uso: 'G03', area: 'salud' } }, 'en')).toContain('health');
  });

  it('ningún texto usa el guion largo', () => {
    for (const lang of ['es', 'en'] as const) {
      for (const key of allKeys(lang)) expect(t(key, undefined, lang)).not.toContain('\u2014');
    }
  });
});
