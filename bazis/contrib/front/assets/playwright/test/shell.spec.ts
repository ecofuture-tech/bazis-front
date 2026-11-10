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
// never scrolls sideways, whatever the number of the links; the name of a file on a touch
// screen is as large as a finger (V009 of the screenshots). And the surfaces with the theme of
// a product (`surfaces-<surface>.html`): what the layer `surface` computes for a card, the
// summary of a card, an outline button and an input. And a list with its card beside it
// (`split.html`): its rows within the list, Escape, the dialog of a changed form, the focus ring of
// a filled button, the soft tones of the statuses and an unavailable primary button in both modes,
// the widths of the sidebar from the tokens and less motion.

import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { expect, test, type Page } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

import { check } from '../bazis/shots';

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
    optimizeDeps: { entries: ['shell.tsx', 'surfaces.tsx', 'focus.tsx', 'split.tsx'] },
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

/** The links of the page with the group (`group=true`) and `count` links in their order. */
function expectedLinks(count: number): string[] {
  const screens = Array.from({ length: count }, (_, index) => `s${String(index + 1)}`);
  return [...screens.slice(0, 10), 'report', ...screens.slice(10)];
}

/**
 * Opens the page of the top bar at `width` with `links` links: the backend lets the user view
 * the items of the route set of the test (the link `report` of the group and `more` others),
 * not add one (`item-new`), and the page is laid out once it answered; `file`: the name of a
 * file that the screen shows.
 */
async function open(
  page: Page,
  { width, links, group = false, more = 0, path = '/', file }: { width: number; links: number; group?: boolean; more?: number; path?: string; file?: string },
) {
  await page.setViewportSize({ width, height: 800 });
  await page.route('**/api/test/item/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    // `add` reads `for_create` of a list of one item
    await route.fulfill({ json: pathname.endsWith('/schema_list/') ? { title: 'list' } : { data: [], meta: { for_create: false } } });
  });
  const answer = (pathname: string) => page.waitForResponse((response) => new URL(response.url()).pathname === pathname);
  const answered = group ? Promise.all([answer('/api/test/item/schema_list/'), answer('/api/test/item/')]) : null;
  await page.goto(`${origin}/shell.html?links=${String(links)}&group=${String(group)}&more=${String(more)}&path=${encodeURIComponent(path)}${file === undefined ? '' : `&file=${encodeURIComponent(file)}`}`);
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

for (const width of [768, 900, 1280, 1920]) {
  test(`the row keeps the page within ${String(width)} px and the menu has the other links`, async ({ page }) => {
    // more links than the row of the wide window has room for
    const count = width >= 1920 ? 30 : 12;
    await open(page, { width, links: count, group: true });
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
    expect([...shown, ...rest]).toEqual(expectedLinks(count));
    // the group, where the row has no room for it, in the menu under its heading
    if (!shown.includes('report')) {
      await expect(page.getByRole('menu').getByRole('group', { name: 'Reports' }).locator('[data-bz="nav:report"]')).toBeVisible();
    }
    await page.getByRole('menu').locator(`[data-bz="nav:s${String(count)}"]`).click();
    await expect(page.getByTestId('path')).toHaveText(`/s${String(count)}`);
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

test('a group is shared by the row and the menu, link by link, under its heading on both sides', async ({ page }) => {
  // the links of the group, as many as no width of the test has room for
  const group = ['report', ...Array.from({ length: 11 }, (_, index) => `report-${String(index + 2)}`)];
  await open(page, { width: 1280, links: 3, group: true, more: 11 });
  await expect(page.locator('[data-bz="nav:more"]')).toBeVisible();
  const shown = await row(page);
  // the links of the group in the row, under its heading, but not all of them
  expect(shown.slice(0, 3)).toEqual(['s1', 's2', 's3']);
  expect(shown.length).toBeGreaterThan(3);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByText('Reports')).toBeVisible();
  await expect(nav.getByRole('list', { name: 'Reports' }).locator('[data-bz^="nav:"]')).toHaveCount(shown.length - 3);
  // the others in the menu, under the same heading
  const rest = await menu(page);
  expect(rest.length).toBeGreaterThan(0);
  expect([...shown, ...rest]).toEqual(['s1', 's2', 's3', ...group]);
  await expect(page.getByRole('menu').getByRole('group', { name: 'Reports' }).locator('[data-bz^="nav:"]')).toHaveCount(rest.length);
  expect(await scrollsSideways(page)).toBe(false);
});

test('the header uses the whole window, the page stays within its width', async ({ page }) => {
  await open(page, { width: 1920, links: 12 });
  const logout = await page.locator('[data-bz="action:logout"]').boundingBox();
  const brand = await page.locator('header').getByText('Product').boundingBox();
  // the brand at the left edge, the session at the right one, not at the edges of the page
  expect(brand?.x ?? 1920).toBeLessThan(80);
  expect(logout ? logout.x + logout.width : 0).toBeGreaterThan(1840);
  expect(await scrollsSideways(page)).toBe(false);
});

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
  await open(page, { width: 1920, links: 30 });
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

test('the name of a file is as large as a finger on a touch screen, not for a mouse', async ({ page, browser }) => {
  // a short name: narrower than a finger too
  const name = 'a.pdf';
  const phone = await browser.newPage({ isMobile: true, hasTouch: true });
  await open(phone, { width: 390, links: 0, file: name });
  const touched = await phone.getByRole('button', { name }).boundingBox();
  expect(touched?.width).toBeGreaterThanOrEqual(44);
  expect(touched?.height).toBeGreaterThanOrEqual(44);
  expect((await check(phone, { phone: true, dark: false, creates: [], searched: false })).filter((it) => it.code === 'V009')).toEqual([]);
  await phone.close();

  await open(page, { width: 1280, links: 0, file: name });
  const clicked = await page.getByRole('button', { name }).boundingBox();
  expect(clicked?.height).toBeLessThan(44);
});

/**
 * The computed borders, background and shadow of an element of the page of the surfaces; the
 * shadow without the empty rings that the shadows of Tailwind carry.
 */
async function look(page: Page, selector: string) {
  return page.locator(selector).evaluate((it) => {
    const style = getComputedStyle(it);
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    return {
      colors: sides.map((side) => style.getPropertyValue(`border-${side}-color`)),
      widths: sides.map((side) => style.getPropertyValue(`border-${side}-width`)),
      background: style.backgroundColor,
      clip: style.backgroundClip,
      image: style.backgroundImage,
      shadow: style.boxShadow.replaceAll(/rgba\(0, 0, 0, 0\) 0px 0px 0px 0px(, )?/g, ''),
      radius: style.borderRadius,
    };
  });
}

const TRANSPARENT = 'rgba(0, 0, 0, 0)';

test('lifted: a card and an outline button are lifted by a shadow without a contour, an input is its bottom line', async ({ page }) => {
  await page.goto(`${origin}/surfaces-lifted.html`);
  for (const selector of ['[data-slot="card"]', 'button[data-variant="outline"]']) {
    const lifted = await look(page, selector);
    expect(lifted.colors).toEqual(Array(4).fill(TRANSPARENT));
    expect(lifted.shadow).not.toBe('none');
  }
  // the summary: one surface, no other color under its transparent border, a line between its parts
  const summary = await look(page, '[data-slot="card-summary"]');
  expect(summary).toMatchObject({ colors: Array(4).fill(TRANSPARENT), background: (await look(page, '[data-slot="card"]')).background, clip: 'border-box' });
  expect(summary.shadow).not.toBe('none');
  const part = await look(page, '[data-slot="card-summary"] > :first-child');
  expect(part).toMatchObject({ background: TRANSPARENT, widths: ['0px', '1px', '0px', '0px'] });
  expect(part.colors[1]).not.toBe(TRANSPARENT);
  const field = await look(page, '[data-slot="input"]');
  expect(field.widths).toEqual(['0px', '0px', '1px', '0px']);
  expect(field.colors[2]).not.toBe(TRANSPARENT);
  expect(field.shadow).toBe('none');
  // the focus ring over the lift of the button, not in place of it (read without its transition)
  await page.addStyleTag({ content: '* { transition: none !important; }' });
  const button = page.locator('button[data-variant="outline"]');
  const resting = await look(page, 'button[data-variant="outline"]');
  await page.keyboard.press('Tab');
  await button.focus();
  await expect(button).toBeFocused();
  const focused = await look(page, 'button[data-variant="outline"]');
  expect(focused.shadow).not.toBe(resting.shadow);
  expect(focused.shadow.endsWith(resting.shadow)).toBe(true);
});

test('elevated: a card and an outline button look as in 0.12, an input is a bottom line of the muted text', async ({ page }) => {
  await page.goto(`${origin}/surfaces-elevated.html`);
  // the classes of a block and of an outline button of 0.12
  expect(await look(page, '[data-slot="card"]')).toEqual(await look(page, '[data-testid="was-card"]'));
  expect(await look(page, '[data-slot="card-summary"]')).toEqual(await look(page, '[data-testid="was-card"]'));
  expect(await look(page, 'button[data-variant="outline"]')).toEqual(await look(page, '[data-testid="was-button"]'));
  const field = await look(page, '[data-slot="input"]');
  expect(field.widths).toEqual(['0px', '0px', '1px', '0px']);
  // the muted text at 60%, a grey line about 2.7:1 on the card, not the pale input of 0.12
  const line = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'));
    probe.style.color = 'color-mix(in srgb, var(--muted-foreground) 60%, transparent)';
    return getComputedStyle(probe).color;
  });
  expect(field.colors[2]).toBe(line);
  expect(field.colors[2]).not.toBe((await look(page, '[data-testid="was-input"]')).colors[2]);
});

/**
 * Opens the dashboard in focus (`focus.html`) at `width` with `query`: the backend forbids the
 * route set `hidden`, answers the others.
 */
async function openFocus(page: Page, width: number, query: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/test/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.startsWith('/api/test/hidden/')) await route.fulfill({ status: 403, json: { errors: [{ status: 403, code: 'ERR_FORBIDDEN' }] } });
    else if (pathname.endsWith('/schema_list/')) await route.fulfill({ json: { title: 'list' } });
    else await route.fulfill({ json: { data: [], meta: { aggregates: { count: 2 } } } });
  });
  await page.goto(`${origin}/focus.html?${query}`);
}

/**
 * The rows of the dashboard in focus whose part `hide` the user may not view: for each row
 * shown, the widths of the parts shown and the room of the row they leave.
 */
async function focusRows(page: Page, width: number, hide: string) {
  await openFocus(page, width, `hide=${hide}`);
  await expect(page.locator('[data-bz="state:loading"]')).toHaveCount(0);
  await expect(page.locator('[data-bz^="tile:"], [data-testid="focus"]').first()).toBeVisible();
  return page.locator('[data-bz="screen:home"] .xl\\:flex-row').evaluateAll((rows) =>
    rows
      .filter((row) => getComputedStyle(row).display !== 'none')
      .map((row) => {
        const shown = [...row.children].filter((it) => getComputedStyle(it).display !== 'none');
        const gap = parseFloat(getComputedStyle(row).columnGap);
        const widths = shown.map((it) => it.getBoundingClientRect().width);
        const across = getComputedStyle(row).flexDirection === 'row';
        // the room that the parts leave in the row: none when they fill it
        const room = across ? row.getBoundingClientRect().width - widths.reduce((sum, it) => sum + it, 0) - gap * (shown.length - 1) : Math.max(...widths.map((it) => row.getBoundingClientRect().width - it));
        return { parts: shown.length, widths: widths.map(Math.round), room: Math.round(room) };
      }),
  );
}

for (const width of [1280, 390]) {
  test(`a dashboard in focus at ${String(width)} px: a part that the user may not view leaves its place to the others of its row`, async ({ page }) => {
    const all = await focusRows(page, width, 'none');
    expect(all.map((it) => [it.parts, it.room])).toEqual([
      [2, 0],
      [2, 0],
    ]);
    if (width === 1280) {
      // the chart in focus two thirds of its row, the rail one; the charts one third, the last items two
      const [first, second] = all.map((it) => it.widths);
      expect(Math.abs((first?.[0] ?? 0) - 2 * (first?.[1] ?? 0))).toBeLessThan(2);
      expect(Math.abs(2 * (second?.[0] ?? 0) - (second?.[1] ?? 0))).toBeLessThan(2);
    }
    for (const hide of ['focus', 'tiles', 'charts', 'recent']) {
      const rows = await focusRows(page, width, hide);
      expect(rows.map((it) => [it.parts, it.room]), hide).toEqual(hide === 'focus' || hide === 'tiles' ? [[1, 0], [2, 0]] : [[2, 0], [1, 0]]);
    }
  });
}

for (const width of [768, 390]) {
  test(`a long label of a quick link of a dashboard is cut at ${String(width)} px, the page never widened`, async ({ page }) => {
    await openFocus(page, width, `link=${encodeURIComponent('A quick link whose label is longer than any column of the dashboard has room for '.repeat(2))}`);
    const link = page.locator('[data-bz="link:long"]');
    await expect(link).toBeVisible();
    expect(await scrollsSideways(page)).toBe(false);
    const box = await link.boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(width);
  });
}

/** A runtime schema of the item of the test with these attributes (`required`: those required), of a list or not. */
function itemSchema(names: readonly string[], { list = false, required = [] as string[] } = {}) {
  const item = {
    type: 'object',
    properties: {
      type: { type: 'string', default: 'test.item' },
      attributes: { type: 'object', properties: Object.fromEntries(names.map((name) => [name, { type: 'string', title: name }])), required },
      relationships: { type: 'object', properties: {} },
    },
  };
  return { type: 'object', properties: { data: list ? { type: 'array', items: { anyOf: [item] } } : item } };
}

/** A text of `words` long words: a row that would widen its table unless it wraps. */
const LONG = (words: number) => Array.from({ length: words }, (_, index) => `Longword${String(index)}`).join(' ');

/** Opens the list and its card (`split.html`) at `width` on `path`, its rows long texts; `dark`: the dark mode. */
async function openSplit(page: Page, width: number, path = '/items', dark = false, filters: readonly string[] = []) {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/test/item/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (pathname.endsWith('/schema_list/')) await route.fulfill({ json: itemSchema(['title', 'note', 'place'], { list: true }) });
    else if (pathname.endsWith('/route_filter_fields/')) await route.fulfill({ json: { fields: filters.map((name) => ({ name, py_type: 'string' })) } });
    else if (pathname.endsWith('/schema_create/')) await route.fulfill({ json: itemSchema(['title'], { required: ['title'] }) });
    else {
      const rows = ['a', 'b', 'c'].map((id) => ({
        id,
        type: 'test.item',
        attributes: { title: `Item ${id} ${LONG(4)}`, note: LONG(12), place: `${LONG(3)}\n${LONG(3)}` },
        relationships: {},
      }));
      await route.fulfill({ json: { data: rows, links: { next: null }, meta: { pagination: { count: 3, limit: 20, offset: 0 } } } });
    }
  });
  const query = `${dark ? '&mode=dark' : ''}${filters.length > 0 ? `&filters=${filters.join(',')}` : ''}`;
  await page.goto(`${origin}/split.html?path=${encodeURIComponent(path)}${query}`);
  await expect(page.locator('[data-bz="row:a"]')).toBeVisible();
}

/** How far the table of the list passes its area: 0 when its rows wrap within it. */
async function tableOverflow(page: Page): Promise<number> {
  return page.locator('[data-bz="list:item"] table').evaluate((table) => table.scrollWidth - (table.parentElement?.clientWidth ?? 0));
}

for (const [width, path] of [
  [1280, '/items/a'],
  [768, '/items'],
] as const) {
  test(`the rows of a list wrap within it at ${String(width)} px (${path}), the page never widened`, async ({ page }) => {
    await openSplit(page, width, path);
    expect(await tableOverflow(page)).toBeLessThanOrEqual(0);
    expect(await scrollsSideways(page)).toBe(false);
    if (path !== '/items') await expect(page.locator('[data-bz="screen:item-card"]')).toBeVisible();
  });
}

for (const width of [1100, 1280, 1422]) {
  test(`the row of the filters keeps its lines when the user filters at ${String(width)} px: the reset has its place`, async ({ page }) => {
    await openSplit(page, width, '/items', false, ['title', 'note', 'place', 'code', 'city']);
    const plate = page.locator('[data-slot="filter-row"]');
    const layout = () =>
      plate.evaluate((row) => [
        row.getBoundingClientRect().height,
        ...[...row.querySelectorAll('input')].map((it) => `${String(it.getBoundingClientRect().x)},${String(it.getBoundingClientRect().y)}`),
      ]);
    const before = await layout();
    await page.locator('[data-bz="field:$search"]').fill('Item');
    await expect(page.locator('[data-bz="action:reset-filters"]')).toBeVisible();
    expect(await layout()).toEqual(before);
  });
}

for (const dark of [false, true]) {
  test(`the line under a row runs under its sticky first cell as under the others, at rest, hovered and selected (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await openSplit(page, 1280, '/items/a', dark);
    const lines = () =>
      page.locator('[data-bz^="row:"]').evaluateAll((rows) =>
        rows.map((row) => {
          const [first, second] = [...row.children].map((cell) => getComputedStyle(cell));
          return [getComputedStyle(row).borderBottomWidth, first.borderBottomWidth, first.borderBottomColor === second.borderBottomColor, first.position];
        }),
      );
    // the selected row, one at rest (then hovered), the last one without a line
    const expected = [
      ['0px', '1px', true, 'sticky'],
      ['0px', '1px', true, 'sticky'],
      ['0px', '0px', true, 'sticky'],
    ];
    expect(await lines()).toEqual(expected);
    await page.locator('[data-bz="row:b"]').hover();
    expect(await lines()).toEqual(expected);
  });
}

test('Escape closes the card beside its list, the focus back on its row', async ({ page }) => {
  await openSplit(page, 1280);
  await page.locator('[data-bz="row:a"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('path')).toHaveText('/items/a');
  await expect(page.getByRole('heading', { level: 2, name: 'Item' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('path')).toHaveText('/items');
  await expect(page.locator('[data-bz="row:a"]')).toBeFocused();
});

test('a changed form asks before it closes, never closed by a click beside it, and gives the focus back', async ({ page }) => {
  await openSplit(page, 1280, '/items/a');
  const edit = page.locator('[data-bz="action:edit"]');
  await edit.click();
  const title = page.locator('[data-bz="field:title"]');
  await expect(title).toBeFocused();
  await title.fill('Report');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-bz="state:discard"]')).toBeVisible();
  await page.mouse.click(5, 450);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('[data-bz="action:discard"]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(edit).toBeFocused();
  // the card stays: Escape closed the dialog, not the card
  await expect(page.getByTestId('path')).toHaveText('/items/a');
});

test('the focus ring of a filled button: a gap of the page and a solid ring', async ({ page }) => {
  await openSplit(page, 1280, '/items/a');
  await page.addStyleTag({ content: '* { transition: none !important; }' });
  const edit = page.locator('[data-bz="action:edit"]');
  await edit.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(edit).toBeFocused();
  const { shadow, background, ring } = await edit.evaluate((element) => {
    const style = getComputedStyle(document.documentElement);
    const probe = document.createElement('i');
    document.body.append(probe);
    const color = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const colors = { background: color(style.getPropertyValue('--background')), ring: color(style.getPropertyValue('--ring')) };
    probe.remove();
    return { shadow: getComputedStyle(element).boxShadow, ...colors };
  });
  expect(shadow).toContain(`${background} 0px 0px 0px 2px`);
  expect(shadow).toContain(`${ring} 0px 0px 0px 4px`);
});

/** The color of a CSS color as [r, g, b] (0–255), read by a canvas. */
function rgbOf(page: Page, selector: string, property: 'color' | 'background-color'): Promise<number[]> {
  return page.locator(selector).evaluate((element, name) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas.');
    context.fillStyle = getComputedStyle(element).getPropertyValue(name);
    context.fillRect(0, 0, 1, 1);
    return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }, property);
}

/** The contrast of two colors (WCAG). */
function contrast(a: number[], b: number[]): number {
  const luminance = (rgb: number[]) => {
    const [r = 0, g = 0, bl = 0] = rgb.map((it) => {
      const value = it / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

for (const dark of [false, true]) {
  test(`the soft tones of the statuses are read on their backgrounds and differ (${dark ? 'dark' : 'light'})`, async ({ page }) => {
    await openSplit(page, 1280, '/items', dark);
    const tones = await page.locator('[data-testid="tones"] [data-tone]').evaluateAll((badges) => badges.map((it) => (it as HTMLElement).dataset.tone ?? ''));
    expect(tones).toHaveLength(6);
    const inks: number[][] = [];
    for (const tone of tones) {
      const selector = `[data-testid="tones"] [data-tone="${tone}"]`;
      const ink = await rgbOf(page, selector, 'color');
      expect(contrast(ink, await rgbOf(page, selector, 'background-color')), tone).toBeGreaterThanOrEqual(4.5);
      inks.push(ink);
    }
    // no two tones the same color
    for (const [index, ink] of inks.entries()) {
      for (const other of inks.slice(index + 1)) {
        expect(Math.hypot(...ink.map((it, channel) => it - (other[channel] ?? 0)))).toBeGreaterThan(20);
      }
    }
    // an unavailable primary button: a pale fill of the primary, apart from the page, its text read on it
    const unavailable = '[data-testid="unavailable"]';
    const fill = await rgbOf(page, unavailable, 'background-color');
    expect(contrast(await rgbOf(page, unavailable, 'color'), fill)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(fill, await rgbOf(page, 'body', 'background-color'))).toBeGreaterThan(1.1);
  });
}

test('the sidebar as wide as `size.sidebar`, a rail as `size.sidebar-rail` below the breakpoint lg', async ({ page }) => {
  const width = () => page.locator('aside[data-slot="sidebar"]').evaluate((it) => it.getBoundingClientRect().width);
  await openSplit(page, 1280);
  expect(await width()).toBe(240);
  await page.addStyleTag({ content: ':root { --size-sidebar: 17rem; }' });
  expect(await width()).toBe(272);
  await openSplit(page, 900);
  await expect(page.locator('aside[data-slot="sidebar"]')).toHaveAttribute('data-state', 'collapsed');
  expect(await width()).toBe(68);
});

test('less motion when the system asks for it: the transitions end at once', async ({ page }) => {
  await openSplit(page, 1280, '/items/a');
  const edit = page.locator('[data-bz="action:edit"]');
  expect(await edit.evaluate((element) => getComputedStyle(element).transitionDuration)).not.toBe('1e-05s');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await edit.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('1e-05s');
});
