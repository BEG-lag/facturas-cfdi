import { expect, test } from '@playwright/test';
import { loadDemo, ready } from './helpers.ts';

const noHorizontalScroll = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('sin desplazamiento horizontal a 375 px', async ({ page }) => {
  await page.goto('./');
  await ready(page, { serviceWorker: false });
  expect(page.viewportSize()?.width).toBe(375);
  expect(await noHorizontalScroll(page)).toBe(true);
  await loadDemo(page);
  for (const tab of ['summary', 'deductions', 'invoices']) {
    await page.locator(`#tab-${tab}`).click();
    expect(await noHorizontalScroll(page), `pestaña ${tab}`).toBe(true);
  }
  await page.locator('.row-open').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
