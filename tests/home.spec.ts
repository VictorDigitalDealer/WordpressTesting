import { test, expect } from '@playwright/test';

test('la home carga con 200 y muestra contenido', async ({ page }) => {
  const resp = await page.goto('/', { waitUntil: 'domcontentloaded' });

  // 1) Respuesta OK (no 4xx/5xx)
  expect(resp && resp.ok()).toBeTruthy();

  // 2) Cierra banner de cookies si aparece (best effort)
  const accept = page.getByRole('button', { name: /Accept|agree|consent|aceptar|de acuerdo/i });
  await accept.first().click({ timeout: 2000 }).catch(() => {});

  // 3) Título no vacío
  const title = await page.title();
  expect(title?.length || 0).toBeGreaterThan(0);

  // 4) Algún contenido visible (main o al menos el body con texto)
  const main = page.locator('main');
  if (await main.count()) {
    await expect(main).toBeVisible();
  } else {
    await expect(page.locator('body :is(h1,h2,p,section,article)')).toBeVisible();
  }
});
