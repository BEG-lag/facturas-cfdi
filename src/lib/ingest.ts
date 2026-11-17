import { unzipSync } from 'fflate';
import { parseCfdiXml } from './parser.ts';
import type { ParseResult } from './types.ts';

export interface XmlSource {
  name: string;
  text: string;
}

export interface IngestIssue {
  name: string;
  code: 'unsupported-file' | 'zip-error' | 'too-large';
  detail: string;
}

export interface IngestOutput {
  sources: XmlSource[];
  issues: IngestIssue[];
}

/** Tamaño máximo por XML descomprimido (defensa ante archivos anómalos). */
const MAX_XML_BYTES = 20 * 1024 * 1024;
const MAX_ZIP_DEPTH = 2;

/** Decodifica bytes de un XML respetando la declaración de codificación (UTF-8 por omisión). */
export function decodeXml(bytes: Uint8Array): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 256));
  const match = /encoding\s*=\s*["']([^"']+)["']/i.exec(head);
  const declared = match?.[1]?.toLowerCase() ?? '';
  if (declared.includes('8859') || declared.includes('latin') || declared === 'windows-1252') {
    return new TextDecoder('windows-1252').decode(bytes);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

function isZipName(name: string): boolean {
  return /\.zip$/i.test(name);
}

function isXmlName(name: string): boolean {
  return /\.xml$/i.test(name);
}

/** Extrae los XML de un ZIP (incluidos ZIP anidados hasta dos niveles). */
export function extractZip(bytes: Uint8Array, zipName: string, depth = 0): IngestOutput {
  const out: IngestOutput = { sources: [], issues: [] };
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (f) =>
        !f.name.startsWith('__MACOSX/') &&
        (isXmlName(f.name) || (isZipName(f.name) && depth < MAX_ZIP_DEPTH)) &&
        f.originalSize <= MAX_XML_BYTES * 10,
    });
  } catch (err) {
    out.issues.push({ name: zipName, code: 'zip-error', detail: err instanceof Error ? err.message : String(err) });
    return out;
  }
  for (const [name, data] of Object.entries(entries)) {
    const fullName = `${zipName}/${name}`;
    if (isZipName(name)) {
      const nested = extractZip(data, fullName, depth + 1);
      out.sources.push(...nested.sources);
      out.issues.push(...nested.issues);
    } else if (data.byteLength > MAX_XML_BYTES) {
      out.issues.push({ name: fullName, code: 'too-large', detail: String(data.byteLength) });
    } else {
      out.sources.push({ name: fullName, text: decodeXml(data) });
    }
  }
  return out;
}

/** Lee archivos elegidos o arrastrados por la persona. Todo ocurre en memoria, sin red. */
export async function readFiles(files: Iterable<File>): Promise<IngestOutput> {
  const out: IngestOutput = { sources: [], issues: [] };
  for (const file of files) {
    const isZip = isZipName(file.name) || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isXml = isXmlName(file.name) || file.type === 'text/xml' || file.type === 'application/xml';
    if (!isZip && !isXml) {
      out.issues.push({ name: file.name, code: 'unsupported-file', detail: file.type });
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip) {
      const res = extractZip(bytes, file.name);
      out.sources.push(...res.sources);
      out.issues.push(...res.issues);
    } else if (bytes.byteLength > MAX_XML_BYTES) {
      out.issues.push({ name: file.name, code: 'too-large', detail: String(bytes.byteLength) });
    } else {
      out.sources.push({ name: file.name, text: decodeXml(bytes) });
    }
  }
  return out;
}

const yieldToBrowser = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Parsea en lotes para no congelar la interfaz. DOMParser no existe dentro de Web Workers,
 * así que el parseo corre en el hilo principal cediendo el control cada ~12 ms.
 */
export async function parseSources(
  sources: XmlSource[],
  onProgress?: (done: number, total: number) => void,
): Promise<ParseResult[]> {
  const parser = new DOMParser();
  const results: ParseResult[] = [];
  let lastYield = performance.now();
  for (let i = 0; i < sources.length; i++) {
    const src = sources[i]!;
    results.push(parseCfdiXml(src.text, src.name, parser));
    if (performance.now() - lastYield > 12) {
      onProgress?.(i + 1, sources.length);
      await yieldToBrowser();
      lastYield = performance.now();
    }
  }
  onProgress?.(sources.length, sources.length);
  return results;
}
