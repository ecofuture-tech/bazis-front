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

const LIGHT: CheckOptions = { phone: false, dark: false, creates: [] };
const PHONE: CheckOptions = { phone: true, dark: false, creates: [] };

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
     <div data-bz="list:task"><table><tr><th>Title</th></tr><tr data-bz="row:1"><td data-bz="cell:title">Write the report</td></tr></table></div>
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

test('what scrolls sideways at the width of a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await show(page, '<div data-bz="list:task" style="width: 600px">Tasks</div>');
  expect(await found(page, PHONE)).toEqual([['V002', '[data-bz="list:task"]']]);
  // the same on a desktop
  expect(await found(page, LIGHT)).toEqual([]);
  // a table that scrolls in its container: the page does not
  await show(page, '<div data-bz="list:task" style="overflow-x: auto"><table style="width: 800px"><tr><td>Tasks</td></tr></table></div>');
  expect(await found(page, PHONE)).toEqual([['V003', '[data-bz="list:task"]']]);
  // the columns of a board scroll in it
  const column = (status: string) => `<div data-bz="column:${status}" style="min-width: 300px; overflow-x: auto"><p style="width: 400px">Tasks</p></div>`;
  await show(page, `<div data-bz="board:task"><div style="display: flex; overflow-x: auto">${column('draft')}${column('done')}</div></div>`);
  expect(await found(page, PHONE)).toEqual([]);
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
});

test('a text cut without its whole text', async ({ page }) => {
  const cut = 'width: 60px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap';
  await show(page, `<div data-bz="cell:title" style="${cut}">Write the report again</div><div title="Write the report again" style="${cut}">Write the report again</div>`);
  expect(await found(page, LIGHT)).toEqual([['V010', '[data-bz="cell:title"]']]);
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
    await shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'light', via: null, creates: [] }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ screen: 'task-list', role: null, mode: 'light', width: 1280, file: 'task-list-nobody-light-1280.png' });
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
    await shoot(page, PRODUCT, { screen: 'task-card', role: null, mode: 'light', via, creates: [] }, info);
    const result = JSON.parse(readFileSync(path.join(directory, 'task-card-nobody-light-1280.json'), 'utf8')) as ShotResult;
    expect(result).toMatchObject({ file: 'task-card-nobody-light-1280.png', issues: [] });
  });

  test('writes V001 when the screen is not reached', async ({ page }, info) => {
    const directory = info.outputPath('shots');
    process.env.BAZIS_SHOTS_DIR = directory;
    await serve(page, { '/tasks': '<!doctype html><html><body>Not found</body></html>' });
    await expect(shoot(page, PRODUCT, { screen: 'task-list', role: null, mode: 'dark', via: null, creates: [] }, info)).rejects.toThrow();
    const result = JSON.parse(readFileSync(path.join(directory, 'task-list-nobody-dark-1280.json'), 'utf8')) as ShotResult;
    expect(result.file).toBeNull();
    expect(result.issues).toMatchObject([{ code: 'V001', severity: 'error', selector: '[data-bz="screen:task-list"]' }]);
  });
});
