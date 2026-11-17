import { expect, test, type Request } from '@playwright/test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BIG_COUNT, BIG_ZIP, LOOSE_DIR } from './global-setup.ts';
import { ready } from './helpers.ts';

test.describe('privacidad: cero peticiones de red al cargar facturas', () => {
  test('carga un ZIP con 2,500 XML y 30 XML sueltos sin una sola petición HTTP', async ({ page, context }) => {
    await page.goto('./');
    await ready(page);

    // A partir de aquí registramos TODA petición del contexto (página, workers y service worker).
    const requests: Request[] = [];
    context.on('request', (r) => requests.push(r));

    const loose = readdirSync(LOOSE_DIR).map((f) => join(LOOSE_DIR, f));
    await page.locator('#file-input').setInputFiles([BIG_ZIP]);
    await expect(page.locator('#results')).toBeVisible();
    await expect.poll(() => page.locator('#app').getAttribute('data-invoice-count')).toBe(String(BIG_COUNT));
    const ms = Number(await page.locator('#app').getAttribute('data-last-load-ms'));
    test.info().annotations.push({ type: 'perf', description: `${BIG_COUNT} XML (+1% duplicados) en ${ms} ms` });
    console.info(`[perf chromium] ZIP con ${BIG_COUNT} XML + duplicados procesado en ${ms} ms`);
    expect(ms).toBeLessThan(15_000);

    await page.locator('#file-input').setInputFiles(loose);
    await expect.poll(() => page.locator('#app').getAttribute('data-invoice-count')).toBe(String(BIG_COUNT + loose.length));

    // Interactuar con todo: RFC, pestañas, filtros, detalle y exportación.
    await page.locator('#infer-yes').click();
    await page.locator('#tab-deductions').click();
    await expect(page.getByTestId('ded-estimated')).toBeVisible();
    await page.locator('#tab-invoices').click();
    await page.locator('#q').fill('hospital');
    await page.locator('.row-open').first().click();
    await expect(page.locator('#detail')).toBeVisible();
    await page.keyboard.press('Escape');
    const download = page.waitForEvent('download');
    await page.locator('#export-excel').click();
    await download;

    const http = requests.filter((r) => /^https?:/.test(r.url()));
    expect(http.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  });

  test('la CSP bloquea cualquier intento de fetch desde la página', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("connect-src 'none'");
    const outcome = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/');
        return 'sent';
      } catch {
        return 'blocked';
      }
    });
    expect(outcome).toBe('blocked');
  });

  test('sin analítica ni recursos de terceros al cargar la página', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.hostname !== 'localhost') external.push(r.url());
    });
    await page.goto('./');
    await ready(page);
    expect(external).toEqual([]);
    const cookies = await page.context().cookies();
    expect(cookies).toEqual([]);
  });
});
