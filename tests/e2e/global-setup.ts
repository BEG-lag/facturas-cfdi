import { zipSync } from 'fflate';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateDataset } from '../../src/lib/synthetic.ts';

export const GENERATED = join(import.meta.dirname, '..', '.generated');
export const BIG_ZIP = join(GENERATED, 'descarga-masiva-sintetica-2500.zip');
export const LOOSE_DIR = join(GENERATED, 'sueltos');
export const BIG_COUNT = 2500;

/** Genera los XML sintéticos que usan las pruebas de punta a punta. */
export default function globalSetup(): void {
  rmSync(GENERATED, { recursive: true, force: true });
  mkdirSync(LOOSE_DIR, { recursive: true });
  const enc = new TextEncoder();
  const big = generateDataset({ count: BIG_COUNT, year: 2025, seed: 99, duplicateRate: 0.01 });
  const entries: Record<string, Uint8Array> = {};
  for (const f of big) entries[`2025/${f.name}`] = enc.encode(f.xml);
  writeFileSync(BIG_ZIP, zipSync(entries, { level: 6 }));
  const loose = generateDataset({ count: 30, year: 2024, seed: 5, duplicateRate: 0 });
  for (const f of loose) writeFileSync(join(LOOSE_DIR, f.name), f.xml);
}
