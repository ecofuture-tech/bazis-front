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

// The helpers against the real `RelationPicker`, `RelationListPicker` and the select of Radix in a browser: a page of the components
// (`assets/ui/test/browser/`) served by Vite with the aliases of the components, its backend
// the routes of the test with the delays of a server. What jsdom cannot tell: where Radix
// puts the focus, and that an empty list is not displayed.

import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

import { App } from '../bazis';
import { PRODUCT } from '../generated/product';

const UI = fileURLToPath(new URL('../../ui/', import.meta.url));

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: `${UI}vitest.config.ts`,
    root: `${UI}test/browser`,
    cacheDir: fileURLToPath(new URL('../test-results/.vite', import.meta.url)),
    // the dependencies are bundled before the page loads: no reload in a test
    optimizeDeps: { entries: ['picker.tsx'] },
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

/**
 * Answers the list of the related items: `pages` pages of `size` items (`Item <n>`), each
 * after `delay` ms, with the link of the next page.
 */
async function items(page: Page, { pages, size = 2, delay }: { pages: number; size?: number; delay: number }): Promise<void> {
  await page.route('**/api/test/item/**', async (route) => {
    const offset = Number(new URL(route.request().url()).searchParams.get('page[offset]') ?? '0');
    const number = Math.floor(offset / 20);
    const data = Array.from({ length: size }, (_, index) => {
      const n = number * size + index + 1;
      return { id: `i${String(n)}`, type: 'test.item', attributes: { name: `Item ${String(n)}` } };
    });
    const next = number + 1 < pages ? `/api/test/item/?page%5Blimit%5D=20&page%5Boffset%5D=${String(offset + 20)}` : null;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({ json: { data, links: { next }, meta: {} } });
  });
}

test('a required picker without a search takes the keys while its first page loads', async ({ page }) => {
  await items(page, { pages: 1, delay: 800 });
  await page.goto(`${origin}/?searchable=false&nullable=false`);
  const trigger = page.locator('[data-bz="field:owner"]');
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  // the list has no option yet: it is shown, and it has the focus
  const listbox = page.getByRole('listbox');
  await expect(listbox).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Search Owner' })).toHaveCount(0);
  await expect(listbox.getByRole('option')).toHaveCount(2, { timeout: 5000 });
  // the first item is active; the keys move and select
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('value')).toHaveText('i2');
  await expect(listbox).toHaveCount(0);
  await expect(trigger).toHaveText('Item 2');
});

test('fill reads the pages of a picker without a search until the item is listed', async ({ page }) => {
  test.setTimeout(60_000);
  // more pages than one expectation would wait for: each page is waited for on its own
  await items(page, { pages: 12, delay: 300 });
  await page.goto(`${origin}/?searchable=false&nullable=false`);
  await new App(page, PRODUCT).fill({ owner: 'Item 23' });
  await expect(page.getByTestId('value')).toHaveText('i23');
});

test('fill searches a picker with a search', async ({ page }) => {
  await page.route('**/api/test/item/**', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search');
    const data = search === 'Zed' ? [{ id: 'z', type: 'test.item', attributes: { name: 'Zed' } }] : [];
    await route.fulfill({ json: { data, links: { next: null }, meta: {} } });
  });
  await page.goto(`${origin}/?searchable=true&nullable=false`);
  await new App(page, PRODUCT).fill({ owner: 'Zed' });
  await expect(page.getByTestId('value')).toHaveText('z');
});

test.describe('fill of a to-many relationship', () => {
  test('sets the items of a picker with a search to those of the list', async ({ page }) => {
    // the labels of the items are read by their ids, the search by the label
    await page.route('**/api/test/item/**', async (route) => {
      const params = new URL(route.request().url()).searchParams;
      const all = ['Ann', 'Bob', 'Carl'].map((name, index) => ({ id: `i${String(index + 1)}`, type: 'test.item', attributes: { name } }));
      const search = params.get('search');
      const filter = params.get('filter');
      const data = all.filter(
        (it) => (search === null || it.attributes.name === search) && (filter === null || filter.includes(`pk=${it.id}`)),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({ json: { data, links: { next: null }, meta: {} } });
    });
    await page.goto(`${origin}/?searchable=true&multiple=true&initial=i1`);
    const trigger = page.locator('[data-bz="field:owners"]');
    await expect(trigger).toHaveText('Ann');
    const app = new App(page, PRODUCT);
    await app.fill({ owners: ['Carl', 'Bob'] });
    await expect(page.getByTestId('value')).toHaveText('i3,i2');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(trigger).toHaveText('Carl, Bob');
    await app.fill({ owners: [] });
    await expect(page.getByTestId('value')).toHaveText('');
    await expect(trigger).toHaveText('—');
  });

  test('reads the pages of a picker without a search', async ({ page }) => {
    await items(page, { pages: 3, delay: 200 });
    await page.goto(`${origin}/?searchable=false&multiple=true`);
    await new App(page, PRODUCT).fill({ owners: ['Item 5', 'Item 2'] });
    await expect(page.getByTestId('value')).toHaveText('i5,i2');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  });

  test('refuses a list for the picker of a to-one relationship', async ({ page }) => {
    await items(page, { pages: 1, delay: 0 });
    await page.goto(`${origin}/?searchable=false&nullable=false`);
    await expect(new App(page, PRODUCT).fill({ owner: ['Item 1'] })).rejects.toThrow('the picker of a to-one relationship');
  });
});

test('fill chooses the option of a select of Radix by its label, null by its option of null', async ({ page }) => {
  await page.goto(`${origin}/?select=true`);
  const app = new App(page, PRODUCT);
  const trigger = page.locator('[data-bz="field:priority"]');
  // the option of the whole label, not one that contains it
  await app.fill({ priority: 'High' });
  await expect(page.getByTestId('value')).toHaveText('low');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toHaveText('High');
  await app.fill({ priority: 'High priority' });
  await expect(page.getByTestId('value')).toHaveText('high');
  await app.fill({ priority: null });
  await expect(page.getByTestId('value')).toHaveText('');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});
