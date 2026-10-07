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

// The helpers against pages that render the `data-bz` marks of the components, with the
// delays of a backend: each step must wait for what it acts on, and the expectations must
// not pass before the screen is loaded. The roles and screens are those of the sample
// (`generated/product.ts`, which `manage.py bazis_front e2e` renders from its specs).

import { expect, test, type Page } from '@playwright/test';

import { App, bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

/** Serves the pages by their path on the base URL of the config. */
async function serve(page: Page, pages: Record<string, string>): Promise<void> {
  await page.route('http://bazis.test/**', async (route) => {
    const body = pages[new URL(route.request().url()).pathname];
    await (body === undefined ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'text/html', body }));
  });
}

/** A page: its body, and a script that runs after it is parsed. */
function html(body: string, script = ''): string {
  return `<!doctype html><html><body>${body}<script>${script}</script></body></html>`;
}

/** A screen at a state, replaced after a delay by its loaded content. */
function loading(screen: string, loaded: string, delay = 300): string {
  return html(
    `<section data-bz="screen:${screen}"><div id="content" data-bz="state:loading">Loading…</div></section>`,
    `setTimeout(() => { document.getElementById('content').outerHTML = ${JSON.stringify(loaded)}; }, ${String(delay)});`,
  );
}

const LIST = `<div data-bz="list:task"><div data-bz="state:loaded"><table><tbody>
  <tr data-bz="row:1" onclick="document.body.dataset.opened = '1'"><td data-bz="field:title">Write the report again</td></tr>
  <tr data-bz="row:2" onclick="document.body.dataset.opened = '2'"><td data-bz="field:title"> Write the report </td></tr>
</tbody></table></div></div>`;

test.describe('open', () => {
  test('goes to the route of the screen and waits for its state', async ({ page }) => {
    await serve(page, { '/tasks': loading('task-list', LIST) });
    const app = new App(page, PRODUCT);
    await app.open('task-list');
    expect(await page.locator(bz('state', 'loaded')).count()).toBe(1);
    expect(page.url()).toBe('http://bazis.test/tasks');
  });

  test('refuses a screen of an item', async ({ page }) => {
    await expect(new App(page, PRODUCT).open('task-card')).rejects.toThrow('reach it with openItem');
  });
});

test('openItem opens the row whose cells are the texts', async ({ page }) => {
  await serve(page, { '/tasks': loading('task-list', LIST) });
  const app = new App(page, PRODUCT);
  await app.open('task-list');
  await app.openItem({ where: { title: 'Write the report' } });
  await expect(page.locator('body')).toHaveAttribute('data-opened', '2');
});

test('fill fills the open form only, waiting for the options of a select', async ({ page }) => {
  const form = `<form><input data-bz="field:title"><textarea data-bz="field:report"></textarea>
    <select data-bz="field:assignee" id="assignee"><option value="">—</option></select>
    <input type="checkbox" data-bz="field:urgent"><button type="submit" data-bz="action:submit">Create</button></form>`;
  await page.setContent(
    html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">
        <select data-bz="field:assignee"><option value="">—</option><option value="u1">manager</option></select>
      </div></section><div role="dialog">${form}</div>`,
      `setTimeout(() => { document.getElementById('assignee').add(new Option('manager', 'u1')); }, 300);`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  await app.fill({ title: 'Write the report', report: 'Done', assignee: 'manager', urgent: true });
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator(bz('field', 'title'))).toHaveValue('Write the report');
  await expect(dialog.locator(bz('field', 'report'))).toHaveValue('Done');
  await expect(dialog.locator(bz('field', 'assignee'))).toHaveValue('u1');
  await expect(dialog.locator(bz('field', 'urgent'))).toBeChecked();
  await expect(page.locator(`section ${bz('field', 'assignee')}`)).toHaveValue('');
  await app.fill({ assignee: null, urgent: false });
  await expect(dialog.locator(bz('field', 'assignee'))).toHaveValue('');
  await expect(dialog.locator(bz('field', 'urgent'))).not.toBeChecked();
});

/** A list screen with a form whose submit runs `onSubmit` after a delay. */
function formPage(onSubmit: string): string {
  return html(
    `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
     <form id="form"><input data-bz="field:title"><button type="submit" data-bz="action:submit">Save</button></form>`,
    `document.getElementById('form').addEventListener('submit', (event) => {
       event.preventDefault();
       const form = event.target;
       setTimeout(() => { ${onSubmit} }, 300);
     });`,
  );
}

test.describe('submit', () => {
  test('waits until the form is closed', async ({ page }) => {
    await page.setContent(formPage('form.remove();'));
    const app = new App(page, PRODUCT);
    await app.submit();
    expect(await page.locator('form').count()).toBe(0);
  });

  test('returns when the form shows an error', async ({ page }) => {
    await page.setContent(
      formPage(`form.insertAdjacentHTML('beforeend', '<p data-bz="error:title">Required.</p>');`),
    );
    const app = new App(page, PRODUCT);
    await app.submit();
    await app.expectError('title');
    expect(await page.locator('form').count()).toBe(1);
  });
});

test('transit fills its payload and waits until it is done', async ({ page }) => {
  await page.setContent(
    html(
      `<section data-bz="screen:task-card"><article data-bz="state:loaded">
        <span data-bz="status:in_progress">In progress</span>
        <button id="finish" data-bz="transit:finish">Finish</button></article></section>`,
      `document.getElementById('finish').addEventListener('click', () => {
         document.body.insertAdjacentHTML('beforeend', '<div role="dialog"><form id="payload"><textarea data-bz="field:report"></textarea><button type="submit" data-bz="action:submit">Finish</button></form></div>');
         document.getElementById('payload').addEventListener('submit', (event) => {
           event.preventDefault();
           document.body.dataset.report = event.target.querySelector('textarea').value;
           setTimeout(() => { document.querySelector('[role=dialog]').remove(); }, 100);
           setTimeout(() => {
             document.getElementById('finish').remove();
             document.querySelector('[data-bz^="status:"]').outerHTML = '<span data-bz="status:done">Done</span>';
           }, 300);
         });
       });`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-card');
  await app.transit('finish', { report: 'Done' });
  expect(await page.locator(bz('transit', 'finish')).count()).toBe(0);
  await expect(page.locator('body')).toHaveAttribute('data-report', 'Done');
  await app.expectStatus('done');
});

test.describe('expectActionAbsent', () => {
  const loaded = `<div data-bz="state:loaded"><button data-bz="action:create">Create</button></div>`;

  test('waits for the screen to load', async ({ page }) => {
    await page.setContent(html('<section data-bz="screen:task-list"><div data-bz="state:empty">Nothing here yet.</div></section>'));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    // the list loads again, and then offers the action
    await page.evaluate((html) => {
      const section = document.querySelector('section');
      if (section === null) return;
      section.innerHTML = '<div data-bz="state:loading">Loading…</div>';
      setTimeout(() => {
        section.innerHTML = html;
      }, 300);
    }, loaded);
    await expect(app.expectActionAbsent('create')).rejects.toThrow();
  });

  test('passes when the loaded screen has no such action', async ({ page }) => {
    await serve(page, { '/tasks': loading('task-list', '<div data-bz="state:empty">Nothing here yet.</div>') });
    const app = new App(page, PRODUCT);
    await app.open('task-list');
    await app.expectActionAbsent('create');
    await app.expectState('empty');
    await app.expectRows(0);
  });
});

test.describe('expectFieldReadonly', () => {
  /** A card whose edit (when `edit` is given) opens a form with this control of the title. */
  function card(edit?: string): string {
    const button = edit === undefined ? '' : '<button id="edit" data-bz="action:edit">Edit</button>';
    return html(
      `<section data-bz="screen:task-card"><article data-bz="state:loaded">${button}
        <dl><dt>Title</dt><dd data-bz="field:title">Write the report</dd></dl></article></section>`,
      edit === undefined
        ? ''
        : `document.getElementById('edit').addEventListener('click', () => {
             setTimeout(() => {
               document.querySelector('article').insertAdjacentHTML('beforeend', ${JSON.stringify(
                 `<form>${edit}<button type="button" data-bz="action:cancel">Cancel</button><button type="submit" data-bz="action:submit">Save</button></form>`,
               )});
               document.querySelector('[data-bz="action:cancel"]').addEventListener('click', (event) => event.target.form.remove());
             }, 200);
           });`,
    );
  }

  test('passes on a card without an edit', async ({ page }) => {
    await page.setContent(card());
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectFieldReadonly('title');
  });

  test('opens and cancels the edit of a card', async ({ page }) => {
    await page.setContent(card('<input data-bz="field:title" readonly value="Write the report">'));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectFieldReadonly('title');
    expect(await page.locator('form').count()).toBe(0);
  });

  test('fails when the edit can change the field', async ({ page }) => {
    await page.setContent(card('<input data-bz="field:title" value="Write the report">'));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await expect(app.expectFieldReadonly('title')).rejects.toThrow();
  });

  test('reads the open form', async ({ page }) => {
    await page.setContent(
      html(`<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
        <form><select data-bz="field:assignee" disabled><option>—</option></select>
        <button type="submit" data-bz="action:submit">Create</button></form>`),
    );
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.expectFieldReadonly('assignee');
    // a field that the form does not show cannot be changed either
    await app.expectFieldReadonly('report');
  });
});

test.describe('loginAs', () => {
  const login = html(
    `<main data-bz="screen:login"><form id="login"><input data-bz="field:username"><input type="password" data-bz="field:password">
      <button type="submit" data-bz="action:submit">Log in</button></form></main>`,
    `document.getElementById('login').addEventListener('submit', (event) => {
       event.preventDefault();
       const ok = event.target.querySelector('[data-bz="field:password"]').value === 'secret';
       setTimeout(() => {
         if (ok) document.body.innerHTML = '<button data-bz="action:logout">Log out</button>';
         else event.target.insertAdjacentHTML('afterbegin', '<p data-bz="state:error">Wrong password.</p>');
       }, 200);
     });`,
  );

  test.afterEach(() => {
    delete process.env.E2E_PASSWORD;
  });

  test('logs in as the test user of the role', async ({ page }) => {
    await serve(page, { '/login': login });
    process.env.E2E_PASSWORD = 'secret';
    await loginAs(page, PRODUCT, 'manager');
    await expect(page.locator(bz('action', 'logout'))).toBeVisible();
  });

  test('reports a failed login', async ({ page }) => {
    await serve(page, { '/login': login });
    process.env.E2E_PASSWORD = 'wrong';
    await expect(loginAs(page, PRODUCT, 'manager')).rejects.toThrow('manager cannot log in: Wrong password.');
  });

  test('needs the password', async ({ page }) => {
    await expect(loginAs(page, PRODUCT, 'viewer')).rejects.toThrow('Set E2E_PASSWORD');
  });
});
