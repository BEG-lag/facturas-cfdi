import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

function listFiles(dir: string, root = dir): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(listFiles(full, root));
    else out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

/**
 * Service worker mínimo, sin dependencias: precachea todo el build para que la app funcione
 * sin conexión. Sólo atiende peticiones GET del mismo origen; nunca contacta a terceros.
 */
function swSource(cacheName: string, assets: string[]): string {
  return `/* facturas-cfdi service worker (generado en el build) */
const CACHE = ${JSON.stringify(cacheName)};
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('facturas-cfdi-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || Response.error())),
    );
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
`;
}

export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'facturas-cfdi:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle(_options, bundle) {
      const fromBundle = Object.keys(bundle);
      const publicDir = config.publicDir;
      let fromPublic: string[];
      try {
        fromPublic = listFiles(publicDir);
      } catch {
        fromPublic = [];
      }
      const assets = ['./', ...new Set([...fromBundle, ...fromPublic])]
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map') && !/\.woff$/.test(f))
        .sort();
      const digest = createHash('sha256').update(assets.join('\n'));
      for (const item of Object.values(bundle)) {
        digest.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      const hash = digest.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(`facturas-cfdi-${hash}`, assets) });
    },
  };
}
