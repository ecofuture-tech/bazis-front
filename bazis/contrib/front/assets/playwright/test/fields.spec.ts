// Copyright 2026 EcoFuture Technology Services LLC and contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// The look of the fields with the Tailwind and the theme of a product in a browser: the page of
// the fields (`assets/ui/test/browser/fields.html`) served by Vite with the aliases of the
// components and the Tailwind plugin, its backend the route of the test. What jsdom does not lay
// out: the lines of the filters of a row on one bottom, a field 36px high (44px on a touch
// screen), the line of a group lit while its select, picker or calendar is open, a text of 16px on
// a phone (the browser does not zoom into it), no page scrolled sideways, and Escape in the
// calendar of a dialog closing the calendar alone.

import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const UI = fileURLToPath(new URL('../../ui/', import.meta.url));

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: `${UI}vitest.config.ts`,
    root: `${UI}test/browser`,
    plugins: [tailwindcss()],
    cacheDir: fileURLToPath(new URL('../test-results/.vite-fields', import.meta.url)),
    // the dependencies are bundled before the page loads: no reload in a test
    optimizeDeps: { entries: ['fields.tsx'] },
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    logLevel: 'error',
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (address === null || address === undefined || typeof address === 'string') throw new Error('Vite did not listen.');
  origin = `http://127.0.0.1:${String(address.port)}`;
});

test.afterAll(async () => {
  await server.close();
});

/** Opens the page of the fields at `width`, the related items of the pickers answered. */
async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/test/item/**', async (route) => {
    await route.fulfill({ json: { data: [{ id: 'i1', type: 'test.item', attributes: { name: 'Ann' } }], links: { next: null }, meta: {} } });
  });
  await page.goto(`${origin}/fields.html`);
  // the first page that Vite serves takes it longer
  await expect(page.locator('[data-bz="field:title"]')).toBeVisible({ timeout: 15_000 });
}

/** The group that draws the line of a control of a filter. */
function group(control: Locator): Locator {
  return control.locator('xpath=ancestor::*[@data-slot="field-group"][1]');
}

async function line(element: Locator): Promise<{ color: string; bottom: number }> {
  return element.evaluate((it) => ({ color: getComputedStyle(it).borderBottomColor, bottom: Math.round(it.getBoundingClientRect().bottom) }));
}

for (const width of [390, 768, 1100, 1280, 1422]) {
  test(`the page of the fields at ${String(width)}px does not scroll sideways`, async ({ page }) => {
    await open(page, width);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll).toBeLessThanOrEqual(client);
  });
}

test('the lines of the filters of a row are on one bottom, the fields 36px high', async ({ page }) => {
  await open(page, 1422);
  const groups = page.locator('[data-slot="field-group"]');
  const bottoms = await groups.evaluateAll((all) => all.map((it) => Math.round(it.getBoundingClientRect().bottom)));
  expect(bottoms).toHaveLength(4);
  expect(new Set(bottoms).size).toBe(1);
  for (const it of await groups.all()) expect(Math.round((await it.boundingBox())?.height ?? 0)).toBe(36);
  await page.locator('[data-bz="action:open"]').click();
  for (const name of ['name', 'source', 'responsible', 'due']) {
    expect(Math.round((await page.locator(`[data-bz="field:${name}"]`).boundingBox())?.height ?? 0)).toBe(36);
  }
});

test('a field is 44px high on a touch screen, its text 16px on a phone, the search of a picker too', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await open(page, 390);
  for (const it of await page.locator('[data-slot="field-group"]').all()) expect(Math.round((await it.boundingBox())?.height ?? 0)).toBe(44);
  for (const name of ['state', 'owner', 'day__gte', 'title']) {
    expect(await page.locator(`[data-bz="field:${name}"]`).evaluate((it) => getComputedStyle(it).fontSize)).toBe('16px');
  }
  await page.locator('[data-bz="field:owner"]').click();
  const search = page.getByRole('combobox', { name: /Search/ });
  await expect(search).toBeVisible();
  expect(await search.evaluate((it) => getComputedStyle(it).fontSize)).toBe('16px');
  await context.close();
});

test('the line of a filter is lit while its select, picker or calendar is open', async ({ page }) => {
  await open(page, 1280);
  const title = page.locator('[data-bz="field:title"]');
  const rest = await line(group(title));
  for (const name of ['state', 'owner', 'day__gte']) {
    const control = page.locator(`[data-bz="field:${name}"]`);
    expect((await line(group(control))).color).toBe(rest.color);
    await control.click();
    await expect(control).toHaveAttribute('data-state', 'open');
    const lit = await line(group(control));
    expect(lit.color).not.toBe(rest.color);
    await page.keyboard.press('Escape');
    await expect(control).toHaveAttribute('data-state', 'closed');
  }
});

test('Escape in the calendar of a form closes the calendar alone, the focus back in its field', async ({ page }) => {
  await open(page, 1280);
  await page.locator('[data-bz="action:open"]').click();
  const due = page.locator('[data-bz="field:due"]');
  await due.click();
  const calendar = page.getByRole('dialog', { name: 'Choose a date' });
  await expect(calendar).toBeVisible();
  await expect(due).toBeFocused();
  await expect(calendar.getByRole('grid')).toBeVisible({ timeout: 5000 });
  // the arrow down goes to the days, Escape back to the field
  await page.keyboard.press('ArrowDown');
  await expect(due).not.toBeFocused();
  await page.keyboard.press('Escape');
  await expect(calendar).toHaveCount(0);
  await expect(page.locator('[data-bz="form"]')).toBeVisible();
  await expect(due).toBeFocused();
});
