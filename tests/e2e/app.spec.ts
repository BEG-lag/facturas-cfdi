import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { loadDemo, ready } from './helpers.ts';

test.describe('flujo principal con datos de ejemplo', () => {
  test('resumen, deducciones, tabla, detalle y teclado', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemo(page);

    await expect(page.locator('#rfc')).toHaveValue('CACX7605101P8');
    await expect(page.getByTestId('net-spending')).toContainText('$');
    await expect(page.getByTestId('likely-total')).toContainText('$');

    // Pestañas con flechas del teclado.
    await page.locator('#tab-summary').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-deductions')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-deductions')).toBeVisible();
    await expect(page.getByText('Avance contra el tope global')).toBeVisible();
    await expect(page.locator('[role="meter"]')).toHaveAttribute('aria-valuetext', /de/);

    // "Ver en la tabla" filtra por estatus.
    await page.locator('[data-filter-status="review"]').click();
    await expect(page.locator('#tab-invoices')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#f-status')).toHaveValue('review');
    const chips = page.locator('#inv-body .chip');
    await expect(chips.first()).toContainText('Requiere revisión');

    // Búsqueda y orden.
    await page.locator('#f-status').selectOption('all');
    await page.locator('#q').fill('ESCUELA DEMO');
    await expect(page.locator('#inv-body tr').first()).toContainText('ESCUELA DEMO');
    await page.locator('[data-sort="total"]').click();
    await expect(page.locator('th.c-total')).toHaveAttribute('aria-sort', /descending|ascending/);

    // Detalle accesible: abre con Enter, cierra con Escape y regresa el foco.
    const opener = page.locator('.row-open').first();
    await opener.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('D10');
    await expect(dialog.getByRole('link', { name: /Verificar CFDI en el SAT/ })).toHaveAttribute(
      'href',
      'https://verificacfdi.facturaelectronica.sat.gob.mx/',
    );
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('ingresos opcionales cambian el tope global', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemo(page);
    await page.locator('#tab-deductions').click();
    await expect(page.locator('.cap-legend')).toContainText('$206,367.60');
    await page.locator('#income').fill('300000');
    await page.locator('#income').press('Tab');
    // 15% de 300,000 = 45,000, menor que 5 UMA.
    await expect(page.locator('.cap-legend')).toContainText('$45,000.00');
  });

  test('exporta CSV y CSV para Excel', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemo(page);
    await page.locator('#tab-invoices').click();
    const [plain] = await Promise.all([page.waitForEvent('download'), page.locator('#export-csv').click()]);
    expect(plain.suggestedFilename()).toBe('facturas-2025.csv');
    const plainText = readFileSync((await plain.path())!, 'utf8');
    expect(plainText.startsWith('UUID,Fecha')).toBe(true);
    const [excel] = await Promise.all([page.waitForEvent('download'), page.locator('#export-excel').click()]);
    expect(excel.suggestedFilename()).toBe('facturas-2025-excel.csv');
    const excelBytes = readFileSync((await excel.path())!);
    expect([...excelBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  test('cambia a inglés', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await page.locator('#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Sort your invoices');
    await loadDemo(page);
    await expect(page.locator('.card.accent h3')).toHaveText('Possibly deductible');
  });

  test('resumen imprimible para el contador', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemo(page);
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator('#tab-invoices').click();
    await page.locator('#print-btn').click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#print-summary h1')).toHaveText('Resumen de facturas 2025');
    await expect(page.locator('#print-summary')).toBeVisible();
    await expect(page.locator('.app')).toBeHidden();
  });
});

test.describe('archivos con problemas', () => {
  test('reporta XML truncados, documentos que no son CFDI y archivos no soportados', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    const truncated = '<?xml version="1.0"?><cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" Version="4.0" TipoDeComprobante="I"><cfdi:Emisor Rfc="EKU9003173C9"';
    await page.locator('#file-input').setInputFiles([
      { name: 'truncado.xml', mimeType: 'text/xml', buffer: Buffer.from(truncated) },
      { name: 'nota.xml', mimeType: 'text/xml', buffer: Buffer.from('<?xml version="1.0"?><nota>hola</nota>') },
      { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    ]);
    await expect(page.locator('#results')).toBeVisible();
    await expect(page.locator('#notices')).toContainText('2 archivo(s) no se pudieron leer como CFDI.');
    await expect(page.locator('#notices')).toContainText('1 archivo(s) se omitieron');
    await page.locator('#notices details').first().locator('summary').click();
    await expect(page.locator('#notices')).toContainText('truncado.xml: XML mal formado');
  });
});

test.describe('persistencia opcional', () => {
  test('no guarda nada por omisión; guarda sólo si se activa y "Borrar todo" lo elimina', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemo(page);
    const dbNames = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(await dbNames()).toEqual([]);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);

    await page.locator('#persist').check();
    await expect.poll(dbNames).toEqual(['facturas-cfdi']);
    await expect.poll(async () => {
      await page.reload();
      await ready(page, { serviceWorker: false });
      return page.locator('#app').getAttribute('class');
    }).toContain('is-loaded');
    await expect(page.locator('#rfc')).toHaveValue('CACX7605101P8');

    page.once('dialog', (d) => void d.accept());
    await page.locator('#clear-all').click();
    await expect(page.locator('#results')).toBeHidden();
    await expect.poll(dbNames).toEqual([]);
    await page.reload();
    await ready(page, { serviceWorker: false });
    await expect(page.locator('#results')).toBeHidden();
  });
});

test.describe('PWA', () => {
  test('funciona sin conexión después de la primera visita', async ({ page, context }) => {
    await page.goto('./');
    await ready(page);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('html[data-ready="true"]');
    await loadDemo(page);
    await expect(page.getByTestId('net-spending')).toContainText('$');
    await context.setOffline(false);
  });
});

test.describe('accesibilidad (axe)', () => {
  test('sin violaciones en la portada ni con datos cargados', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    const landing = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(landing.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await loadDemo(page);
    for (const tab of ['summary', 'deductions', 'invoices']) {
      await page.locator(`#tab-${tab}`).click();
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${tab} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    }
  });
});
