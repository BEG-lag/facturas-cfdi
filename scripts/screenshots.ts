/**
 * Capturas reales de la app con datos SINTÉTICOS para el README.
 * Uso: npm run build && npm run screenshots
 */
import { chromium, type Page } from '@playwright/test';
import { join } from 'node:path';
import { preview } from 'vite';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs', 'screenshots');
const PORT = 4179;

const server = await preview({ root, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/facturas-cfdi/`;

async function prepare(page: Page): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('html[data-ready="true"]');
  await page.locator('#demo-btn').click();
  await page.waitForSelector('#results:not([hidden])');
  await page.locator('#infer-yes').click();
  await page.locator('#income').fill('684000');
  await page.locator('#income').press('Tab');
}

async function scrollToTabs(page: Page, offset = 76): Promise<void> {
  await page.evaluate((off) => {
    const tabs = document.querySelector<HTMLElement>('.tabs');
    if (tabs) window.scrollTo(0, tabs.getBoundingClientRect().top + window.scrollY - off);
  }, offset);
}

const browser = await chromium.launch();

// Escritorio
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForSelector('html[data-ready="true"]');
  await page.screenshot({ path: join(outDir, 'desktop-inicio.png') });
  await prepare(page);
  await scrollToTabs(page);
  await page.screenshot({ path: join(outDir, 'desktop-resumen.png') });
  await page.locator('#tab-deductions').click();
  await scrollToTabs(page);
  await page.screenshot({ path: join(outDir, 'desktop-deducciones.png') });
  await page.locator('#tab-invoices').click();
  await page.locator('#f-type').selectOption('I');
  await page.locator('#q').fill('HOSPITAL');
  await page.waitForTimeout(300);
  await scrollToTabs(page);
  await page.locator('.row-open').first().click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, 'desktop-detalle.png') });
  await page.close();
}

// Móvil (375 px)
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(url);
  await page.waitForSelector('html[data-ready="true"]');
  await page.screenshot({ path: join(outDir, 'mobile-inicio.png') });
  await prepare(page);
  await scrollToTabs(page, 64);
  await page.screenshot({ path: join(outDir, 'mobile-resumen.png') });
  await page.locator('#tab-deductions').click();
  await scrollToTabs(page, 64);
  await page.screenshot({ path: join(outDir, 'mobile-deducciones.png') });
  await page.locator('#tab-invoices').click();
  await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.table-wrap');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 70);
  });
  await page.screenshot({ path: join(outDir, 'mobile-facturas.png') });
  await page.close();
}

await browser.close();
await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
console.log(`Capturas en ${outDir}`);
