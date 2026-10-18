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

// The checks of the screenshots against pages that have what each one finds (a literal color
// without contrast, a snake_case label, a page wider than a phone…), and pages without it;
// `shoot` against a page served by the test.

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { check, shoot, type CheckOptions, type ShotResult } from '../bazis/shots';
import { PRODUCT } from '../generated/product';

const LIGHT: CheckOptions = { phone: false, dark: false, creates: [], searched: false };
const PHONE: CheckOptions = { phone: true, dark: false, creates: [], searched: false };

/** Serves the pages by their path on the base URL of the config. */
async function serve(page: Page, pages: Record<string, string>): Promise<void> {
  await page.route('http://bazis.test/**', async (route) => {
    const body = pages[new URL(route.request().url()).pathname];
    await (body === undefined ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'text/html', body }));
  });
}

/** Shows a page, its body in the styles given. */
async function show(page: Page, body: string, style = ''): Promise<void> {
  await serve(page, { '/': `<!doctype html><html><head><style>${style}</style></head><body>${body}</body></html>` });
  await page.goto('/');
}

/** The codes found on the page, with their selectors. */
async function found(page: Page, options: CheckOptions): Promise<[string, string][]> {
  return (await check(page, options)).map((it) => [it.code, it.selector]);
}

test('a page without issues', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await show(
    page,
    `<h1>Tasks</h1>
     <div data-bz="list:task" style="overflow-x: auto"><table><tr><th>Title</th></tr><tr data-bz="row:1"><td data-bz="cell:title">Write the report</td></tr></table></div>
     <button data-bz="action:create" style="width: 48px; height: 48px">New</button>
     <p>Read the <a href="/help">help</a>.</p>`,
  );
  expect(await found(page, PHONE)).toEqual([]);
});

test('a literal color without contrast', async ({ page }) => {
  await show(page, '<p data-bz="cell:title" style="color: #bbb">Write the report</p><p>Write it again</p>');
  const [issue, ...others] = await check(page, LIGHT);
  expect(others).toEqual([]);
  expect(issue).toMatchObject({ code: 'V006', severity: 'error', selector: '[data-bz="cell:title"]' });
  expect(issue?.message).toContain('1.92:1');
  // a large text needs 3:1
  await show(page, '<h1 style="color: #888; font-size: 32px">Tasks</h1>');
  expect(await found(page, LIGHT)).toEqual([]);
  // a text that only a screen reader reads has no contrast to keep
  const srOnly = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0)';
  await show(page, `<p>Report <span style="color: #ccc; ${srOnly}">(read-only)</span></p>`);
  expect(await found(page, LIGHT)).toEqual([]);
});

test('the contrast over the backgrounds of the ancestors, in the dark mode', async ({ page }) => {
  // a literal dark text on the dark surface of a token
  await show(page, '<main style="background: #111"><p style="color: #333">Write the report</p><p style="color: #eee">Done</p></main>');
  expect(await found(page, { ...LIGHT, dark: true })).toEqual([['V006', 'p']]);
});

test('the raw names of the labels', async ({ page }) => {
  await show(
    page,
    `<h1>nav.tasks</h1>
     <div data-bz="list:task"><table><tr><th>due_date</th><th>Title</th></tr></table></div>
     <dl><dt>assignee</dt><dd>Mary</dd></dl>
     <label data-bz="field:title">Title</label>`,
  );
  expect(await found(page, LIGHT)).toEqual([
    ['V004', 'h1'],
    ['V004', '[data-bz="list:task"] th'],
    ['V004', 'dt'],
  ]);
});

test('a UUID on the screen', async ({ page }) => {
  await show(page, '<table><tr data-bz="row:1"><td data-bz="cell:assignee">3f2b8c1e-7a4d-4e2b-9c1f-0a1b2c3d4e5f</td></tr></table>');
  const [issue] = await check(page, LIGHT);
  expect(issue).toMatchObject({ code: 'V005', selector: '[data-bz="cell:assignee"]' });
});

test('what scrolls sideways at the width of a phone', async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await show(page, '<div data-bz="list:task" style="width: 600px">Tasks</div>');
  expect(await found(page, PHONE)).toEqual([['V002', '[data-bz="list:task"]']]);
  // a mobile browser (the phone of the shots), whose window grows to the page
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await show(mobile, '<meta name="viewport" content="width=device-width, initial-scale=1.0"><div data-bz="list:task" style="width: 600px">Tasks</div>');
  expect(await found(mobile, PHONE)).toEqual([['V002', '[data-bz="list:task"]']]);
  await mobile.close();
  // the same on a desktop, where it fits, and wider than a desktop
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await found(page, LIGHT)).toEqual([]);
  await show(page, '<div data-bz="list:task" style="width: 1600px">Tasks</div>');
  expect(await found(page, LIGHT)).toEqual([['V014', '[data-bz="list:task"]']]);
  await page.setViewportSize({ width: 390, height: 844 });
  // a table that scrolls in its container: the page does not
  await show(page, '<div data-bz="list:task" style="overflow-x: auto"><table style="width: 800px"><tr><td>Tasks</td></tr></table></div>');
  expect(await found(page, PHONE)).toEqual([['V003', '[data-bz="list:task"]']]);
  // the columns of a board scroll in it
  const column = (status: string) => `<div data-bz="column:${status}" style="min-width: 300px; overflow-x: auto"><p style="width: 400px">Tasks</p></div>`;
  await show(page, `<div data-bz="board:task"><div style="display: flex; overflow-x: auto">${column('draft')}${column('done')}</div></div>`);
  expect(await found(page, PHONE)).toEqual([]);
});

test('what scrolls sideways once the texts of the items are long', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // a grid whose implicit column grows to its longest word, and one whose column does not
  const card = (grid: string) =>
    `<div style="display: grid; ${grid}"><article data-bz="row:1"><h3 data-bz="cell:title"><span data-text>Write the report</span></h3>` +
    `<dl><dt>Place</dt><dd data-bz="cell:place" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap"><span data-text>Room 1</span></dd></dl></article></div>`;
  await show(page, card(''));
  const [issue, ...others] = await check(page, PHONE);
  expect(others).toEqual([]);
  expect(issue).toMatchObject({ code: 'V015', selector: '[data-bz="row:1"]' });
  expect(issue?.message).toMatch(/^The page is \d+ px wide at 390 px with a text of 120 characters/);
  // the texts are those of the page again
  await expect(page.locator('[data-bz="cell:title"]')).toHaveText('Write the report');
  await expect(page.locator('[data-bz="cell:place"]')).toHaveText('Room 1');
  await show(page, card('grid-template-columns: minmax(0, 1fr); overflow-wrap: anywhere'));
  expect(await found(page, PHONE)).toEqual([]);
  // on a desktop too, and never in a form, whose fields hold what the user types
  await page.setViewportSize({ width: 1280, height: 800 });
  const nowrap = 'margin-left: 900px; white-space: nowrap';
  await show(page, `<p data-bz="field:title" style="${nowrap}"><span data-text>Write the report</span></p>`);
  expect(await found(page, LIGHT)).toEqual([['V015', '[data-bz="field:title"] span']]);
  await show(page, `<form><p data-bz="field:title" style="${nowrap}"><span data-text>Write the report</span></p></form>`);
  expect(await found(page, LIGHT)).toEqual([]);
  // a value short by its nature (a date, a number, the label of a choice or of a status, a
  // filter): not a text of the item
  await show(
    page,
    `<p data-bz="cell:due" style="${nowrap}">Oct 18, 2026</p><p data-bz="cell:status" style="${nowrap}"><span data-bz="status:draft">Draft</span></p>` +
      `<button data-bz="field:priority" style="${nowrap}">All</button>`,
  );
  expect(await found(page, LIGHT)).toEqual([]);
});

test('a table that grows sideways once the texts of the items are long', async ({ page }) => {
  // the page does not grow: the table scrolls in its own area, wider than it was
  const table = (cell: string) =>
    `<div data-bz="list:visit" style="overflow-x: auto; width: 600px"><table style="width: 100%"><tr data-bz="row:1">` +
    `<td data-bz="cell:client">Mary</td><td data-bz="cell:subscription" style="${cell}"><span data-text>Mary, 8 lessons</span></td></tr></table></div>`;
  await show(page, table('white-space: nowrap'));
  const [issue, ...others] = await check(page, LIGHT);
  expect(others).toEqual([]);
  expect(issue).toMatchObject({ code: 'V018', severity: 'warning', selector: '[data-bz="list:visit"]' });
  expect(issue?.message).toMatch(/^It is \d+ px wide in 600 px with a text of 120 characters in the cells\.$/);
  await expect(page.locator('[data-bz="cell:subscription"]')).toHaveText('Mary, 8 lessons');
  // a text that wraps, and a table that was wider already (its columns, not its texts)
  await show(page, table('white-space: normal; overflow-wrap: anywhere'));
  expect(await found(page, LIGHT)).toEqual([]);
  await show(page, `<div style="overflow-x: auto; width: 300px"><table style="width: 800px"><tr><td style="white-space: nowrap"><span data-text>Mary</span></td></tr></table></div>`);
  expect(await found(page, LIGHT)).toEqual([]);
});

test('a light surface in the dark mode', async ({ page }) => {
  await show(page, '<div data-bz="list:task" style="background: #fff; height: 100px"></div>', 'html { background: #111 }');
  expect(await found(page, { ...LIGHT, dark: true })).toEqual([['V007', '[data-bz="list:task"]']]);
  // the light mode, and an image
  expect(await found(page, LIGHT)).toEqual([]);
});

test('the empty states', async ({ page }) => {
  await show(page, '<div data-bz="state:empty"></div>');
  expect(await found(page, LIGHT)).toEqual([['V008', '[data-bz="state:empty"]']]);
  // the user may create an item, and the empty state does not offer it
  const creates = { ...LIGHT, creates: ['create', 'import'] };
  await show(page, '<div data-bz="state:empty">No tasks yet</div><button data-bz="action:create">New</button>');
  const [issue] = await check(page, creates);
  expect(issue?.message).toBe('The empty state does not offer action:create.');
  await show(page, '<div data-bz="state:empty">No tasks yet <button data-bz="action:create">New</button></div>');
  expect(await found(page, creates)).toEqual([]);
  // the user may not create one
  await show(page, '<div data-bz="state:empty">No tasks yet</div>');
  expect(await found(page, creates)).toEqual([]);
});

test('the parts of the items that show none', async ({ page }) => {
  const parts = (rows: string) =>
    `<div data-bz="list:task"><div data-bz="state:loaded">${rows}</div></div>` +
    `<div data-bz="board:task"><div data-bz="state:loaded"><section data-bz="column:draft">Draft</section></div></div>` +
    `<div data-bz="calendar:task"><div data-bz="state:empty">No tasks this month</div></div>` +
    `<section data-bz="recent:last-tasks"><p data-bz="state:empty">None yet</p></section>` +
    `<div data-bz="list:step"><div data-bz="state:forbidden">Not allowed</div></div>`;
  await show(page, parts('<p data-bz="row:1">Write the report</p>'));
  expect(await found(page, LIGHT)).toEqual([
    ['V016', '[data-bz="board:task"]'],
    ['V016', '[data-bz="calendar:task"]'],
    ['V016', '[data-bz="recent:last-tasks"]'],
  ]);
  await show(page, parts(''));
  expect((await found(page, LIGHT)).map(([, selector]) => selector)).toContain('[data-bz="list:task"]');
  // a calendar whose month has items, none on the day it lists
  await show(
    page,
    '<div data-bz="calendar:task"><div data-bz="state:loaded"><button data-bz="day:2030-01-01" data-count="0">1</button>' +
      '<button data-bz="day:2030-01-02" data-count="2">2</button><p>Nothing on this day</p></div></div>',
  );
  expect(await found(page, LIGHT)).toEqual([]);
  // the list searched for nothing
  await show(page, '<div data-bz="list:task"><div data-bz="state:empty">No task matches</div></div>');
  expect(await found(page, { ...LIGHT, searched: true })).toEqual([]);
});

test('the controls too small to touch on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await show(
    page,
    `<button data-bz="action:edit" style="width: 24px; height: 24px">E</button>
     <button style="position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0; overflow: hidden; clip: rect(0, 0, 0, 0)">Read only by a screen reader</button>
     <p>A <a href="/help">link</a> in a text.</p>`,
  );
  const [issue, ...others] = await check(page, PHONE);
  expect(others).toEqual([]);
  expect(issue).toMatchObject({
    code: 'V009',
    severity: 'warning',
    selector: '[data-bz="action:edit"]',
    message: '1 controls are smaller than 44×44 px: [data-bz="action:edit"] 24×24.',
  });
  expect(await found(page, LIGHT)).toEqual([]);
  // one issue for every small control of the screenshot, the first five named
  await show(page, '<button style="width: 32px; height: 32px">B</button>'.repeat(7));
  const issues = await check(page, PHONE);
  expect(issues).toHaveLength(1);
  expect(issues[0]?.message).toBe(`7 controls are smaller than 44×44 px: ${Array(5).fill('button 32×32').join(', ')}, and 2 more.`);
  // a wide, short label is not the target of a checkbox touched through its own wider area
  await show(
    page,
    `<style>.wide::after { content: ''; position: absolute; inset: -14px }</style>
     <label style="display: flex; width: 200px; height: 20px">
       <input type="checkbox" class="wide" style="position: relative; width: 16px; height: 16px; margin: 2px" /> All
     </label>`,
  );
  expect(await check(page, PHONE)).toEqual([]);
  // the area is measured from inside the borders of the control: 16 - 2 + 2 × 14 is 42
  const bordered = (inset: number) =>
    `<style>.area::after { content: ''; position: absolute; inset: -${String(inset)}px }</style>
     <button class="area" style="position: relative; box-sizing: border-box; width: 16px; height: 16px; padding: 0; border: 1px solid">B</button>`;
  await show(page, bordered(14));
  expect((await check(page, PHONE)).map((it) => it.message)).toEqual(['1 controls are smaller than 44×44 px: button 42×42.']);
  await show(page, bordered(15));
  expect(await check(page, PHONE)).toEqual([]);
});

test('a text cut without its whole text', async ({ page }) => {
  const cut = 'width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap';
  await show(page, `<div data-bz="cell:title" style="${cut}">Write the report again</div><div title="Write the report again" style="${cut}">Write the report again</div>`);
  expect(await found(page, LIGHT)).toEqual([['V010', '[data-bz="cell:title"]']]);
});

test('a text cut to a few characters', async ({ page }) => {
  // the items of the narrow days of a calendar: the fields of an item share its width
  const cut = (width: string) => `width: ${width}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px`;
  await show(
    page,
    `<div data-bz="row:1"><span data-bz="cell:group" title="Bachata for beginners" style="${cut('40px')}; display: inline-block">Bachata for beginners</span></div>` +
      `<div data-bz="row:2"><span data-bz="cell:group" title="Bachata for beginners" style="${cut('60px')}; display: inline-block">Bachata for beginners</span></div>`,
  );
  const [issue, ...others] = await check(page, LIGHT);
  expect(others).toEqual([]);
  expect(issue).toMatchObject({ code: 'V017', severity: 'warning', selector: '[data-bz="cell:group"]', message: 'The text "Bachata for beginners" is cut to 40 px.' });
});

test('a value of a card of a board beside a long term', async ({ page }) => {
  // the field of a card of `ResourceBoard` (its width in a column): its term kept whole squeezes
  // its value to nothing; the value that moves under a term that leaves it less than 6rem keeps its width
  const truncate = 'min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap';
  const card = (row: string, term: string, value: string) =>
    `<dl data-bz="row:1" style="width: 240px; font-size: 14px"><div style="display: flex; align-items: baseline; ${row}"><dt style="${term}">Inventory number of the equipment</dt><dd data-bz="cell:inventory_number" style="margin: 0; ${value}">PRN-0042</dd></div></dl>`;
  await show(page, card('gap: 8px', 'flex-shrink: 0', truncate));
  expect(await found(page, LIGHT)).toEqual([
    ['V017', '[data-bz="cell:inventory_number"]'],
    ['V010', '[data-bz="cell:inventory_number"]'],
  ]);
  await show(page, card('flex-wrap: wrap; column-gap: 8px', 'min-width: 0', `flex: 1 1 6rem; ${truncate}`));
  expect(await found(page, LIGHT)).toEqual([]);
});

test('at most ten issues of a code', async ({ page }) => {
  await show(page, '<p style="color: #ccc">Faint</p>'.repeat(12));
  const issues = await check(page, LIGHT);
  expect(issues).toHaveLength(10);
  expect(issues[9]?.message).toMatch(/\(and 2 more\)$/);
});

test.describe('shoot', () => {
  const screen = `<section data-bz="screen:task-list"><div data-bz="state:loaded"><h1>tasks</h1></div></section>`;

  test('writes the screenshot and its result', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    await serve(page, { '/tasks': `<!doctype html><html><body>${screen}</body></html>` });
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ screen: 'task-list', role: null, mode: 'light', width: 1280, retried: false, file: 'task-list-nobody-light-1280.png' });
    expect(result.issues.map((it) => [it.code, it.severity])).toEqual([['V004', 'error']]);
    expect(readFileSync(path.join(directory, 'task-list-nobody-light-1280.png')).length).toBeGreaterThan(0);
  });

  test('opens the screen of an item from the part of a dashboard that opens it', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    const recent = (id: string, href: string) => `<section data-bz="recent:${id}"><a data-bz="row:1" href="${href}">An item</a></section>`;
    const loaded = (id: string, body: string) =>
      `<!doctype html><html><body><section data-bz="screen:${id}"><div data-bz="state:loaded">${body}</div></section></body></html>`;
    // the first row of the screen opens another card, not served
    await serve(page, {
      '/': loaded('home', `<h1>Home</h1>${recent('notes', '/notes/1')}${recent('last-tasks', '/tasks/1')}`),
      '/tasks/1': loaded('task-card', '<h1>Write the report</h1>'),
    });
    const via = { screen: 'home', part: 'recent:last-tasks' } as const;
    await shoot(page, PRODUCT, { screen: 'task-card', role: null, mode: 'light', via, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-card-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ file: 'task-card-nobody-light-1280.png', issues: [] });
  });

  test('reports the errors of the page, of its console and of its requests to the API', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    const script = `<script>
      console.error('Each child in a list should have a unique "key" prop.');
      fetch('/api/v1/tasks/task/');
      fetch('/api/v1/tasks/task/1/');
      fetch('/api/v1/tasks/task/', { method: 'POST' });
      fetch('/api/v1/tasks/step/route_filter_fields/');
      fetch('/api/v1/tasks/step/schema_list/');
      fetch('/other/missing');
      setTimeout(() => { throw new Error('Cannot read properties of undefined'); });
    </script>`;
    await serve(page, { '/tasks': `<!doctype html><html><body>${screen}${script}</body></html>` });
    await page.route('http://bazis.test/api/**', async (route) => {
      const request = route.request();
      const { pathname } = new URL(request.url());
      // the proxy of the dev server that did not reach the backend: a 500 without a body
      if (pathname.endsWith('/schema_list/')) {
        await route.fulfill({ status: 500, contentType: 'text/plain', body: '' });
        return;
      }
      // a list that fails, an item refused (the screen shows it as its state), a create
      // refused, the fields of the filters of a route set that does not route them
      const status = request.method() === 'POST' ? 403 : pathname.endsWith('/1/') || pathname.endsWith('/route_filter_fields/') ? 404 : 500;
      await route.fulfill({ status, contentType: 'application/vnd.api+json', body: '{"errors": []}' });
    });
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result.issues.map((it) => [it.code, it.selector]).sort()).toEqual(
      [
        ['V004', '[data-bz="state:loaded"] h1'],
        ['V011', 'page'],
        ['V012', 'console'],
        ['V013', 'GET /api/v1/tasks/task/'],
        ['V013', 'POST /api/v1/tasks/task/'],
        ['V013', 'GET /api/v1/tasks/step/route_filter_fields/'],
        ['V013', 'GET /api/v1/tasks/step/schema_list/'],
      ].sort(),
    );
    const message = (selector: string) => result.issues.find((it) => it.selector === selector)?.message;
    expect(message('GET /api/v1/tasks/task/')).toBe('500 Internal Server Error');
    expect(message('GET /api/v1/tasks/step/route_filter_fields/')).toBe('404 Not Found');
    expect(message('GET /api/v1/tasks/step/schema_list/')).toMatch(/^500 Internal Server Error: the proxy of the dev server did not reach the backend/);
  });

  test('shoots a list searched for nothing and with its create form open', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    // a list that marks its search and shows its empty state; a create action that opens a form
    const list = `<section data-bz="screen:task-list"><div data-bz="state:loaded"><h1>Tasks</h1>
      <div data-bz="list:task"><input data-bz="field:$search" aria-label="Search"><div data-bz="row:1">Write the report</div></div>
      <button data-bz="action:create">New task</button></div></section>
      <script>
        const list = document.querySelector('[data-bz="list:task"]');
        list.querySelector('input').addEventListener('input', (event) => {
          list.setAttribute('data-search', event.target.value);
          list.querySelector('[data-bz="row:1"]').outerHTML = '<p data-bz="state:empty">Nothing found</p>';
        });
        document.querySelector('[data-bz="action:create"]').addEventListener('click', () => {
          document.body.insertAdjacentHTML('beforeend', '<form><label>Title <input></label><button data-bz="action:submit">Create</button></form>');
        });
      </script>`;
    await serve(page, { '/tasks': `<!doctype html><html><body>${list}</body></html>` });
    const shot = { screen: 'task-list', role: null, mode: 'light', via: null, creates: ['create'] } as const;
    await shoot(page, PRODUCT, { ...shot, variant: 'empty' }, info);
    const empty = JSON.parse(readFileSync(path.join(directory, 'task-list.empty-nobody-light-1280.json'), 'utf8')) as ShotResult;
    // the empty state of a search offers no creation: no V008
    expect(empty).toMatchObject({ variant: 'empty', file: 'task-list.empty-nobody-light-1280.png', issues: [] });
    await shoot(page, PRODUCT, { ...shot, variant: 'form' }, info);
    const form = JSON.parse(readFileSync(path.join(directory, 'task-list.form-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(form).toMatchObject({ variant: 'form', issues: [] });
    expect(readFileSync(path.join(directory, 'task-list.form-nobody-light-1280.png')).length).toBeGreaterThan(0);
  });

  /**
   * A screen whose list renders its state once the API answers it, and the API: its proxy that
   * does not reach the backend for the first `failures` requests (a 500 without a body), then the list.
   */
  async function proxied(page: Page, failures: number): Promise<string[]> {
    const answered: string[] = [];
    const list = `<section data-bz="screen:task-list"></section><script>
      fetch('/api/v1/tasks/task/').then((response) => {
        const screen = document.querySelector('[data-bz="screen:task-list"]');
        if (response.ok) screen.innerHTML = '<div data-bz="state:loaded"><h1>Tasks</h1></div>';
      });
    </script>`;
    await serve(page, { '/tasks': `<!doctype html><html><body>${list}</body></html>` });
    await page.route('http://bazis.test/api/**', async (route) => {
      const failed = answered.length < failures;
      answered.push(failed ? '500' : '200');
      await (failed
        ? route.fulfill({ status: 500, contentType: 'text/plain', body: '' })
        : route.fulfill({ contentType: 'application/vnd.api+json', body: '{"data": [], "meta": {}}' }));
    });
    return answered;
  }

  test('shoots a screen again once when the proxy of the dev server did not reach the backend', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    const answered = await proxied(page, 1);
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    // the first time the screen renders no state: no V001, no V013, the result of the second time
    expect(result).toMatchObject({ retried: true, file: 'task-list-nobody-light-1280.png', issues: [] });
    expect(answered).toEqual(['500', '200']);
  });

  test('reports the proxy of the dev server that did not reach the backend twice', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    const answered = await proxied(page, 2);
    await expect(shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info)).rejects.toThrow();
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ retried: true, file: null });
    expect(result.issues.map((it) => [it.code, it.selector])).toEqual([
      ['V001', '[data-bz="screen:task-list"]'],
      ['V013', 'GET /api/v1/tasks/task/'],
    ]);
    expect(result.issues[1]?.message).toMatch(/did not reach the backend .*also when the screen was shot again$/);
    expect(answered).toEqual(['500', '500']);
  });

  /**
   * A screen that loads again once it has been checked (as the dev server of Vite reloads the
   * pages): its texts made long by the check and put back (V015), the first `reloads` times
   * that it is shown; gives the times it was served.
   */
  async function reloading(page: Page, reloads: number): Promise<string[]> {
    const served: string[] = [];
    const list = `<section data-bz="screen:task-list"><div data-bz="state:loaded"><h1>Tasks</h1>
      <p data-bz="cell:title"><span data-text>Write the report</span></p></div></section>
      <script>
        let changes = 0;
        new MutationObserver((records) => {
          changes += records.length;
          if (changes === 2 && Number(sessionStorage.getItem('reloads') ?? 0) < ${String(reloads)}) {
            sessionStorage.setItem('reloads', String(Number(sessionStorage.getItem('reloads') ?? 0) + 1));
            location.reload();
          }
        }).observe(document.querySelector('[data-text]'), { characterData: true, subtree: true });
      </script>`;
    await page.route('http://bazis.test/tasks', async (route) => {
      served.push('/tasks');
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><body>${list}</body></html>` });
    });
    return served;
  }

  test('shoots a screen again once when the page loaded again after its check', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    const served = await reloading(page, 1);
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ retried: true, file: 'task-list-nobody-light-1280.png', issues: [] });
    // shown, loaded again, shown again
    expect(served).toHaveLength(3);
  });

  test('reports V019 when the page loaded again after its check twice', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    await reloading(page, 2);
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [], variant: null }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ retried: true, file: 'task-list-nobody-light-1280.png' });
    expect(result.issues.map((it) => [it.code, it.severity, it.selector])).toEqual([['V019', 'error', '[data-bz="screen:task-list"]']]);
  });

  test('writes V001 when the screen is not reached', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    await serve(page, { '/tasks': '<!doctype html><html><body>Not found</body></html>' });
    await expect(shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'dark', via: null, creates: [], variant: null }, info)).rejects.toThrow();
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-dark-1280.json'), 'utf8')) as ShotResult;
    expect(result.file).toBeNull();
    expect(result.issues).toMatchObject([{ code: 'V001', severity: 'error', selector: '[data-bz="screen:task-list"]' }]);
  });

  test('writes V001 when the screen renders no state', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    await serve(page, { '/tasks': '<!doctype html><html><body><main data-bz="screen:task-list">Hand-written</main></body></html>' });
    await expect(shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'dark', via: null, creates: [], variant: null }, info)).rejects.toThrow();
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-dark-1280.json'), 'utf8')) as ShotResult;
    expect(result.issues).toMatchObject([{ code: 'V001', message: expect.stringContaining('renders no state') }]);
  });
});
