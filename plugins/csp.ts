import type { Plugin } from 'vite';

/**
 * Política de seguridad de contenido que se inyecta sólo en el build de producción.
 * connect-src 'none' impide que el código de la página haga peticiones de red (fetch, XHR,
 * WebSocket, sendBeacon): las facturas no pueden salir del navegador aunque alguien lo intente.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

export function cspPlugin(): Plugin {
  return {
    name: 'facturas-cfdi:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}
