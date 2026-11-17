import { defineConfig } from 'vitest/config';
import { cspPlugin } from './plugins/csp.ts';
import { serviceWorkerPlugin } from './plugins/service-worker.ts';

export default defineConfig({
  base: '/facturas-cfdi/',
  build: {
    target: 'es2022',
    // Nada en línea como data: URI; todo se sirve desde el mismo origen y se precachea.
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  plugins: [cspPlugin(), serviceWorkerPlugin()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
