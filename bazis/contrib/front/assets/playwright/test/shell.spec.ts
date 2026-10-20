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

// The top bar of the real `AppShell` with the Tailwind of a product in a browser: the page of
// the components (`assets/ui/test/browser/shell.html`) served by Vite with the aliases of the
// components and the Tailwind plugin, its backend the routes of the test. What jsdom does not
// lay out: the links that the row has no room for go to its menu `nav:more`, and the page
// never scrolls sideways, whatever the number of the links.

import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { expect, test, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

const UI = fileURLToPath(new URL('../../ui/', import.meta.url));

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: `${UI}vitest.config.ts`,
    root: `${UI}test/browser`,
    plugins: [tailwindcss()],
    // a cache of its own: the page of the pickers bundles other dependencies
    cacheDir: fileURLToPath(new URL('../test-results/.vite-shell', import.meta.url)),
    // the dependencies are bundled before the page loads: no reload in a test
    optimizeDeps: { entries: ['shell.tsx'] },
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

/** The links of the page with the group (`group=true`) in their order. */
const LINKS = [...Array.from({ length: 10 }, (_, index) => `s${String(index + 1)}`), 'report', 's11', 's12'];

/**
 * Opens the page of the top bar at `width` with `links` links: the backend lets the user view
 * the items of the route set of the test (the link `report` of the group), not add one
 * (`item-new`), and the page is laid out once it answered.
 */
async function open(page: Page, { width, links, group = false, path = '/' }: { width: number; links: number; group?: boolean; path?: string }) {
  await page.setViewportSize({ width, height: 800 });
  await page.route('**/api/test/item/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    // `add` reads `for_create` of a list of one item
    await route.fulfill({ json: pathname.endsWith('/schema_list/') ? { title: 'list' } : { data: [], meta: { for_create: false } } });
  });
  const answer = (pathname: string) => page.waitForResponse((response) => new URL(response.url()).pathname === pathname);
  const answered = group ? Promise.all([answer('/api/test/item/schema_list/'), answer('/api/test/item/')]) : null;
  await page.goto(`${origin}/shell.html?links=${String(links)}&group=${String(group)}&path=${encodeURIComponent(path)}`);
  await answered;
  await expect(page.getByTestId('path')).toHaveText(path);
}

/** The screens of the links of the row of the top bar, but its menu, in their order. */
async function row(page: Page): Promise<string[]> {
  return page
    .getByRole('navigation', { name: 'Main' })
    .locator('[data-bz^="nav:"]:not([data-bz="nav:more"])')
    .evaluateAll((links) => links.map((it) => (it as HTMLElement).dataset.bz?.slice(4) ?? ''));
}

/** The screens of the links of the menu of the top bar, opened by a click, in their order. */
async function menu(page: Page): Promise<string[]> {
  await page.locator('[data-bz="nav:more"]').click();
  const opened = page.getByRole('menu');
  await expect(opened).toBeVisible();
  return opened.locator('[data-bz^="nav:"]').evaluateAll((links) => links.map((it) => (it as HTMLElement).dataset.bz?.slice(4) ?? ''));
}

/** Whether the page scrolls sideways. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

for (const width of [900, 1280, 1920]) {
  test(`the row keeps the page within ${String(width)} px and the menu has the other links`, async ({ page }) => {
    await open(page, { width, links: 12, group: true });
    await expect.poll(() => scrollsSideways(page)).toBe(false);
    // the session at the end of the bar is within the page
    const logout = await page.locator('[data-bz="action:logout"]').boundingBox();
    expect(logout && logout.x + logout.width).toBeLessThanOrEqual(width);
    const shown = await row(page);
    const rest = await menu(page);
    // every link once, in its order: the row the first ones, the menu the others; the link
    // that the backend does not allow in neither
    expect(shown.length).toBeGreaterThan(0);
    expect(rest.length).toBeGreaterThan(0);
    expect([...shown, ...rest]).toEqual(LINKS);
    // the group near the end in the menu, under its heading
    await expect(page.getByRole('menu').getByRole('group', { name: 'Reports' }).locator('[data-bz="nav:report"]')).toBeVisible();
    await page.getByRole('menu').locator('[data-bz="nav:s12"]').click();
    await expect(page.getByTestId('path')).toHaveText('/s12');
    await expect(page.getByRole('menu')).toHaveCount(0);
    // the current link is in the menu: its button is shown as the current link
    await expect(page.locator('[data-bz="nav:more"]')).toHaveAttribute('data-current', '');
  });

  test(`a few links stay in the row at ${String(width)} px, without a menu`, async ({ page }) => {
    await open(page, { width, links: 4 });
    await expect.poll(() => row(page)).toEqual(['s1', 's2', 's3', 's4']);
    await expect(page.locator('[data-bz="nav:more"]')).toHaveCount(0);
    expect(await scrollsSideways(page)).toBe(false);
  });
}

test('the current link in the menu marks its button, a current link of the row does not', async ({ page }) => {
  await open(page, { width: 1280, links: 12, path: '/s12' });
  const more = page.locator('[data-bz="nav:more"]');
  await expect(more).toHaveAttribute('data-current', '');
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('[aria-current="page"]')).toHaveCount(0);
  await more.click();
  await expect(page.getByRole('menu').locator('[data-bz="nav:s12"]')).toHaveAttribute('aria-current', 'page');
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'Main' }).locator('[data-bz="nav:s1"]').click();
  await expect(page.getByTestId('path')).toHaveText('/s1');
  await expect(page.locator('[data-bz="nav:s1"]')).toHaveAttribute('aria-current', 'page');
  await expect(more).not.toHaveAttribute('data-current');
});

test('the menu is used with the keys', async ({ page }) => {
  await open(page, { width: 1280, links: 12 });
  const more = page.locator('[data-bz="nav:more"]');
  await expect(more).toHaveAttribute('aria-haspopup', 'menu');
  await more.focus();
  await page.keyboard.press('Enter');
  const items = page.getByRole('menu').getByRole('menuitem');
  // the first link has the focus, the arrows move it, Enter follows the link
  await expect(items.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(items.nth(1)).toBeFocused();
  const second = await items.nth(1).getAttribute('href');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('path')).toHaveText(second ?? '');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(more).toBeFocused();
  // Escape closes it
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(more).toBeFocused();
});

test('the links move between the row and the menu as the page is resized', async ({ page }) => {
  await open(page, { width: 1920, links: 12 });
  await expect(page.locator('[data-bz="nav:more"]')).toBeVisible();
  const wide = (await row(page)).length;
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(async () => (await row(page)).length).toBeLessThan(wide);
  expect(await scrollsSideways(page)).toBe(false);
  await page.setViewportSize({ width: 1920, height: 800 });
  await expect.poll(async () => (await row(page)).length).toBe(wide);
});

test('a phone has every link in the drawer, without the menu of the top bar', async ({ page }) => {
  await open(page, { width: 390, links: 12 });
  await expect(page.locator('[data-bz="nav:more"]')).toHaveCount(0);
  expect(await scrollsSideways(page)).toBe(false);
  await page.getByRole('button', { name: 'Open the menu' }).click();
  await expect(page.getByRole('dialog').locator('[data-bz^="nav:"]')).toHaveCount(12);
});
