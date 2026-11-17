import type { Page } from '@playwright/test';

/** Espera a que la app termine de cargar (fuentes y, en producción, el service worker). */
export async function ready(page: Page, { serviceWorker = true } = {}): Promise<void> {
  await page.waitForSelector('html[data-ready="true"]');
  if (serviceWorker) {
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') {
        await new Promise<void>((resolve) => reg.active?.addEventListener('statechange', () => resolve()));
      }
    });
  }
}

export async function loadDemo(page: Page, confirmRfc = true): Promise<void> {
  await page.getByRole('button', { name: /Probar con datos de ejemplo|Try with sample data/ }).click();
  await page.waitForSelector('#results:not([hidden])');
  if (confirmRfc) await page.locator('#infer-yes').click();
}
