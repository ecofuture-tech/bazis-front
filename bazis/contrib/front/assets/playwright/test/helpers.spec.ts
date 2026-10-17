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

import { App, bz, loginAs, routePattern, stubForeignImages } from '../bazis';
import { PRODUCT } from '../generated/product';

/** Serves the pages by their path on the base URL of the config. */
async function serve(page: Page, pages: Record<string, string>): Promise<void> {
  await page.route('http://bazis.test/**', async (route) => {
    const body = pages[new URL(route.request().url()).pathname];
    await (body === undefined ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'text/html', body }));
  });
}

/** Shows a page at a path (the route of a screen of the specs). */
async function show(page: Page, path: string, body: string): Promise<void> {
  await serve(page, { [path]: body });
  await page.goto(path);
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
  <tr data-bz="row:1" onclick="document.body.dataset.opened = '1'"><td data-bz="cell:title">Write the report again</td></tr>
  <tr data-bz="row:2" onclick="document.body.dataset.opened = '2'"><td data-bz="cell:title"> Write the report </td></tr>
</tbody></table></div></div>`;

test.describe('expectScreen', () => {
  test('expects the route of the screen, not only its mark', async ({ page }) => {
    // a list next to its card: both screens are on the page, at the route of the card
    const both = html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
       <section data-bz="screen:task-card"><div data-bz="state:loaded">Task</div></section>`,
    );
    await show(page, '/tasks/1', both);
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await expect(app.expectScreen('task-list')).rejects.toThrow('the route of the screen task-list');
    await show(page, '/tasks/', both);
    await app.expectScreen('task-list');
  });

  test('matches the parameters of a route', () => {
    expect(routePattern('/tasks/:id').test('/tasks/7c1e/')).toBe(true);
    expect(routePattern('/tasks/:id').test('/tasks/7c1e/edit')).toBe(false);
    expect(routePattern('/').test('/')).toBe(true);
    expect(routePattern('/').test('/tasks')).toBe(false);
    expect(routePattern('/a.b').test('/aXb')).toBe(false);
  });
});

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

test('openItem finds a row by a cell of a hidden column', async ({ page }) => {
  // a list next to an open card shows its first columns only: the other cells are hidden
  const list = `<div data-bz="list:task"><div data-bz="state:loaded"><table><tbody>
    <tr data-bz="row:1" onclick="document.body.dataset.opened = '1'"><td data-bz="cell:title">A</td><td data-bz="cell:assignee" hidden>viewer</td></tr>
    <tr data-bz="row:2" onclick="document.body.dataset.opened = '2'"><td data-bz="cell:title">A</td><td data-bz="cell:assignee" hidden>manager</td></tr>
  </tbody></table></div></div>`;
  await serve(page, { '/tasks': loading('task-list', list) });
  const app = new App(page, PRODUCT);
  await app.open('task-list');
  await app.openItem({ where: { title: 'A', assignee: 'manager' } });
  await expect(page.locator('body')).toHaveAttribute('data-opened', '2');
});

test('openItem waits for the labels of the related items of the rows', async ({ page }) => {
  // `RelationLabel` reads the label after the rows are shown: a skeleton marked
  // `state:loading` until then, in a list without a search
  const list = `<div data-bz="list:task"><div data-bz="state:loaded"><table><tbody>
    <tr data-bz="row:1" onclick="document.body.dataset.opened = '1'"><td data-bz="cell:title">A</td>
      <td data-bz="cell:assignee"><span id="label" data-bz="state:loading"></span></td></tr>
  </tbody></table></div></div>`;
  await serve(page, {
    '/tasks': html(
      `<section data-bz="screen:task-list">${list}</section>`,
      `setTimeout(() => { document.getElementById('label').outerHTML = 'Mary Manager'; }, 800);`,
    ),
  });
  const app = new App(page, PRODUCT);
  await app.open('task-list');
  await app.openItem({ where: { title: 'A', assignee: 'Mary Manager' } });
  await expect(page.locator('body')).toHaveAttribute('data-opened', '1');
});

/**
 * The list of the tasks as `ResourceList` renders it, over items `[title, assignee]`: pages of
 * two rows (`action:next-page`), a search of the titles (`field:$search`) applied after the
 * typing, busy (`aria-busy`) until its rows are loaded, the search of its rows in
 * `data-search`. The page records the searches and the pages read in the dataset of the body.
 */
function pagedList(items: readonly (readonly [string, string])[], { search = true } = {}): string {
  return html(
    `<section data-bz="screen:task-list"><div data-bz="list:task" id="list">
      ${search ? '<input type="search" data-bz="field:$search" id="search">' : ''}
      <div data-bz="state:loaded"><table><tbody id="rows"></tbody></table></div>
      <button data-bz="action:next-page" id="next">Next</button>
    </div></section>`,
    `const items = ${JSON.stringify(items)};
     const list = document.getElementById('list');
     const next = document.getElementById('next');
     const input = document.getElementById('search');
     const body = document.body.dataset;
     let offset = 0;
     let query = '';
     function render() {
       const found = items.map(([title, assignee], id) => ({ id, title, assignee })).filter((it) => it.title.includes(query));
       document.getElementById('rows').innerHTML = found.slice(offset, offset + 2).map((it) =>
         '<tr data-bz="row:' + it.id + '"><td data-bz="cell:title">' + it.title + '</td><td data-bz="cell:assignee">' + it.assignee + '</td></tr>').join('');
       next.disabled = offset + 2 >= found.length;
       list.removeAttribute('aria-busy');
     }
     function load(change) {
       list.setAttribute('aria-busy', 'true');
       setTimeout(() => { change(); render(); }, 200);
     }
     document.getElementById('rows').onclick = (event) => { body.opened = event.target.closest('tr').dataset.bz.slice(4); };
     next.onclick = () => { body.pages = String(Number(body.pages || 0) + 1); load(() => { offset += 2; }); };
     if (input) input.oninput = () => {
       list.setAttribute('aria-busy', 'true');
       clearTimeout(window.typing);
       window.typing = setTimeout(() => {
         const text = input.value.trim();
         body.searches = (body.searches || '') + '|' + text;
         if (text) list.dataset.search = text; else delete list.dataset.search;
         load(() => { offset = 0; query = text; });
       }, 300);
     };
     render();`,
  );
}

test.describe('openItem in a list of several pages', () => {
  const others = [['A', 'viewer'], ['B', 'viewer'], ['C', 'viewer'], ['D', 'viewer']] as const;

  test('reads the next pages of a list without a search', async ({ page }) => {
    await show(page, '/tasks', pagedList([...others, ['Target', 'manager']], { search: false }));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.openItem({ where: { title: 'Target' } });
    await expect(page.locator('body')).toHaveAttribute('data-opened', '4');
    await expect(page.locator('body')).toHaveAttribute('data-pages', '2');
  });

  test('searches a list with a search, with each text in turn, and reads no page', async ({ page }) => {
    // the search has the titles only: the assignee finds nothing, the title the two rows
    await show(page, '/tasks', pagedList([...others, ['Target', 'viewer'], ['Target', 'manager']]));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.openItem({ where: { assignee: 'manager', title: 'Target' } });
    await expect(page.locator('body')).toHaveAttribute('data-opened', '5');
    await expect(page.locator('body')).toHaveAttribute('data-searches', '|manager|Target');
    await expect(page.locator('body')).not.toHaveAttribute('data-pages');
  });

  test('opens a row of the page shown without a search', async ({ page }) => {
    await show(page, '/tasks', pagedList([['Target', 'manager'], ...others]));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.openItem({ where: { title: 'Target' } });
    await expect(page.locator('body')).toHaveAttribute('data-opened', '0');
    await expect(page.locator('body')).not.toHaveAttribute('data-searches');
  });

  test('fails when no page has the row, after the searches and the pages', async ({ page }) => {
    await show(page, '/tasks', pagedList(others));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await expect(app.openItem({ where: { title: 'Missing' } })).rejects.toThrow('No row of the list');
    // the search, then the list without it, page after page
    await expect(page.locator('body')).toHaveAttribute('data-searches', '|Missing|');
    await expect(page.locator('body')).toHaveAttribute('data-pages', '1');
    await expect(page.locator('body')).not.toHaveAttribute('data-opened');
  });
});

test('fill fills the open form only, waiting for the options of a select', async ({ page }) => {
  const form = `<form><input data-bz="field:title"><textarea data-bz="field:report"></textarea>
    <select data-bz="field:assignee" id="assignee"><option value="">—</option></select>
    <input type="checkbox" data-bz="field:urgent"><button type="submit" data-bz="action:submit">Create</button></form>`;
  await show(page, '/tasks',
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

test('fill refuses a list for a field that is not the picker of a relationship', async ({ page }) => {
  await show(page, '/tasks', formPage(''));
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  await expect(app.fill({ title: ['A'] })).rejects.toThrow('The field title is not the picker of a to-many relationship.');
});

test.describe('fill of a date-time', () => {
  // as the browser of the end-to-end tests of a product (`timezoneId` of its config)
  test.use({ timezoneId: 'UTC' });

  test('takes the local date-time of the input, sent in UTC', async ({ page }) => {
    // `FieldInput`: an `<input type="datetime-local">`, its value sent as
    // `new Date(value).toISOString()` (`fromLocalDateTime`)
    const form = `<form><input type="datetime-local" data-bz="field:dt_start">
      <button type="submit" data-bz="action:submit">Save</button></form>`;
    await show(page, '/tasks', html(`<section data-bz="screen:task-list"><div data-bz="state:loaded">${form}</div></section>`));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.fill({ dt_start: '2030-03-04T10:00' });
    const input = page.locator(bz('field', 'dt_start'));
    await expect(input).toHaveValue('2030-03-04T10:00');
    expect(await input.evaluate((element: HTMLInputElement) => new Date(element.value).toISOString())).toBe(
      '2030-03-04T10:00:00.000Z',
    );
  });
});

test('fill chooses the item of a combobox by its label, null by the option that clears it', async ({ page }) => {
  // the picker of a relationship: its popup (`aria-controls`) opens after a delay, and the
  // backend answers the search after another one
  const option = (value: string, label: string) => `<li role="option" data-value="${value}">${label}</li>`;
  await show(page, '/tasks',
    html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
       <form><button type="button" role="combobox" data-bz="field:assignee" aria-controls="popup" data-value="">—</button>
       <button type="submit" data-bz="action:submit">Create</button></form>`,
      `const trigger = document.querySelector('[role="combobox"]');
       trigger.addEventListener('click', () => setTimeout(() => {
         document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(
           `<div id="popup"><input role="combobox" aria-label="Search"><ul role="listbox">${option('', '—')}</ul></div>`,
         )});
         const popup = document.getElementById('popup');
         popup.querySelector('input').addEventListener('input', () => setTimeout(() => {
           popup.querySelector('ul').insertAdjacentHTML('beforeend', ${JSON.stringify(
             option('u2', 'manager 2') + option('u1', 'manager'),
           )});
         }, 300));
         popup.addEventListener('click', (event) => {
           const chosen = event.target.closest('[role="option"]');
           trigger.dataset.value = chosen.dataset.value;
           trigger.textContent = chosen.textContent;
           popup.remove();
         });
       }, 200));`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  const trigger = page.locator(bz('field', 'assignee'));
  await app.fill({ assignee: 'manager' });
  await expect(trigger).toHaveAttribute('data-value', 'u1');
  await expect(page.locator('#popup')).toHaveCount(0);
  await app.fill({ assignee: null });
  await expect(trigger).toHaveAttribute('data-value', '');
});

test('fill chooses the option of a select of Radix by its label, null by the option that clears it', async ({ page }) => {
  // the select of Radix (`Select` of shadcn/ui): a combobox whose popup, named by
  // `aria-controls` once open, is the listbox of all its options, without a search; its
  // option of null is `data-value=""` (the other options have no `data-value`)
  const option = (value: string, label: string, mark = '') => `<div role="option" data-v="${value}"${mark}>${label}</div>`;
  const listbox = `<div id="choices" role="listbox">${
    option('', 'All', ' data-value=""') + option('high', 'High priority') + option('low', 'High')
  }</div>`;
  await show(page, '/tasks',
    html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
       <form><button type="button" role="combobox" data-bz="field:priority" data-v="">All</button>
       <button type="submit" data-bz="action:submit">Create</button></form>`,
      `const trigger = document.querySelector('[role="combobox"]');
       trigger.addEventListener('click', () => setTimeout(() => {
         document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(listbox)});
         trigger.setAttribute('aria-controls', 'choices');
         const popup = document.getElementById('choices');
         popup.addEventListener('click', (event) => {
           const chosen = event.target.closest('[role="option"]');
           trigger.dataset.v = chosen.dataset.v;
           trigger.textContent = chosen.textContent;
           trigger.removeAttribute('aria-controls');
           popup.remove();
         });
       }, 200));`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  const trigger = page.locator(bz('field', 'priority'));
  // the option of the whole label, not one that contains it
  await app.fill({ priority: 'High' });
  await expect(trigger).toHaveAttribute('data-v', 'low');
  await expect(page.locator('#choices')).toHaveCount(0);
  await app.fill({ priority: null });
  await expect(trigger).toHaveAttribute('data-v', '');
});

test('fill sets a checkbox and a switch of Radix', async ({ page }) => {
  // buttons with the role and `aria-checked`, as `Checkbox` and `Switch` of shadcn/ui
  const toggle = (name: string, role: string) =>
    `<button type="button" role="${role}" aria-checked="false" data-bz="field:${name}"
      onclick="this.setAttribute('aria-checked', String(this.getAttribute('aria-checked') !== 'true'))"></button>`;
  await show(page, '/tasks',
    html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
       <form>${toggle('urgent', 'checkbox')}${toggle('public', 'switch')}<button type="submit" data-bz="action:submit">Save</button></form>`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  await app.fill({ urgent: true, public: true });
  await expect(page.locator(bz('field', 'urgent'))).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator(bz('field', 'public'))).toHaveAttribute('aria-checked', 'true');
  await app.fill({ public: false });
  await expect(page.locator(bz('field', 'public'))).toHaveAttribute('aria-checked', 'false');
  await expect(page.locator(bz('field', 'urgent'))).toHaveAttribute('aria-checked', 'true');
});

test('fill reads the pages of a combobox without a search until the item is listed', async ({ page }) => {
  // a route set without search fields: the popup has no search, the next page is the option
  // without `data-value`, and it loads after a delay
  const option = (value: string, label: string) => `<li role="option" data-value="${value}">${label}</li>`;
  await show(page, '/tasks',
    html(
      `<section data-bz="screen:task-list"><div data-bz="state:loaded">Tasks</div></section>
       <form><button type="button" role="combobox" data-bz="field:assignee" aria-controls="popup" data-value="">—</button>
       <button type="submit" data-bz="action:submit">Create</button></form>`,
      `const trigger = document.querySelector('[role="combobox"]');
       const more = '<li role="option">Load more</li>';
       const pages = [${JSON.stringify(option('u3', 'viewer'))}, ${JSON.stringify(option('u2', 'manager 2'))}, ${JSON.stringify(option('u1', 'manager'))}];
       trigger.addEventListener('click', () => setTimeout(() => {
         document.body.insertAdjacentHTML('beforeend', '<div id="popup"><ul role="listbox" tabindex="0"></ul></div>');
         const popup = document.getElementById('popup');
         const list = popup.querySelector('ul');
         list.insertAdjacentHTML('beforeend', pages.shift() + more);
         popup.addEventListener('click', (event) => {
           const chosen = event.target.closest('[role="option"]');
           if (!chosen.hasAttribute('data-value')) {
             chosen.remove();
             setTimeout(() => list.insertAdjacentHTML('beforeend', pages.shift() + (pages.length ? more : '')), 300);
             return;
           }
           trigger.dataset.value = chosen.dataset.value;
           trigger.textContent = chosen.textContent;
           popup.remove();
         });
       }, 200));`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-list');
  await app.fill({ assignee: 'manager' });
  await expect(page.locator(bz('field', 'assignee'))).toHaveAttribute('data-value', 'u1');
  await expect(page.locator('#popup')).toHaveCount(0);
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
    await show(page, '/tasks', formPage('form.remove();'));
    const app = new App(page, PRODUCT);
    await app.submit();
    expect(await page.locator('form').count()).toBe(0);
  });

  test('does not take the error of a previous submit for its own', async ({ page }) => {
    // the error stays until the next submit is sent, and the form is closed later
    await show(page, '/tasks',
      formPage('form.remove();').replace(
        '<button type="submit"',
        '<p data-bz="error:title">Required.</p><button type="submit"',
      ),
    );
    await page.evaluate(() => {
      document.getElementById('form')?.addEventListener('submit', () => {
        setTimeout(() => document.querySelector('[data-bz="error:title"]')?.remove(), 50);
      });
    });
    const app = new App(page, PRODUCT);
    await app.submit();
    expect(await page.locator('form').count()).toBe(0);
  });

  test('returns when the form shows an error', async ({ page }) => {
    await show(page, '/tasks',
      formPage(`form.insertAdjacentHTML('beforeend', '<p data-bz="error:title">Required.</p>');`),
    );
    const app = new App(page, PRODUCT);
    await app.submit();
    await app.expectError('title');
    expect(await page.locator('form').count()).toBe(1);
  });

  test('passes a submit that must save once the form is closed', async ({ page }) => {
    await show(page, '/tasks', formPage('form.remove();'));
    await new App(page, PRODUCT).submit({ saved: true });
    expect(await page.locator('form').count()).toBe(0);
  });

  test('fails a submit that must save with the error that the form shows', async ({ page }) => {
    // the state of a 422 with the error of the item, as `ResourceForm` shows it
    await show(page, '/tasks',
      formPage(`form.insertAdjacentHTML('afterbegin', '<div data-bz="state:invalid">Add a step to a draft task only.</div>');`),
    );
    const app = new App(page, PRODUCT);
    await expect(app.submit({ saved: true })).rejects.toThrow('The form was not saved: Add a step to a draft task only.');
  });
});

/** A card with an open form and its file field, whose upload ends after a delay with `onUpload`. */
function uploadPage(onUpload: string): string {
  return html(
    `<section data-bz="screen:task-card"><div data-bz="state:loaded">Task</div></section>
     <form id="form"><div data-bz="upload:attachment">Drop a file here
       <input type="file" data-bz="field:attachment"></div>
       <button type="submit" data-bz="action:submit">Save</button></form>`,
    `const zone = document.querySelector('[data-bz="upload:attachment"]');
     document.querySelector('input').addEventListener('change', (event) => {
       const name = event.target.files[0].name;
       zone.setAttribute('aria-busy', 'true');
       zone.firstChild.textContent = name + ' 0%';
       setTimeout(() => { ${onUpload} }, 300);
     });`,
  );
}

test.describe('upload', () => {
  test('waits until the file is uploaded', async ({ page }) => {
    await show(page, '/tasks/1', uploadPage(`zone.removeAttribute('aria-busy'); zone.firstChild.textContent = name + ' 23 B';`));
    const app = new App(page, PRODUCT);
    await app.upload('attachment', 'brief.txt');
    await expect(page.locator(bz('upload', 'attachment'))).not.toHaveAttribute('aria-busy');
    expect(await page.locator(bz('upload', 'attachment')).innerText()).toContain('brief.txt 23 B');
  });

  test('takes aria-busy="false" as not busy', async ({ page }) => {
    // the upload control of a product may keep the attribute, set to false
    await show(page, '/tasks/1', uploadPage(`zone.setAttribute('aria-busy', 'false'); zone.firstChild.textContent = name + ' 23 B';`));
    const app = new App(page, PRODUCT);
    await app.upload('attachment', 'brief.txt');
    expect(await page.locator(bz('upload', 'attachment')).innerText()).toContain('brief.txt 23 B');
  });

  test('returns when the upload shows an error', async ({ page }) => {
    await show(page, '/tasks/1',
      uploadPage(`zone.removeAttribute('aria-busy'); zone.firstChild.textContent = 'Drop a file here';
        form.insertAdjacentHTML('beforeend', '<p data-bz="error:attachment">Too large.</p>');`)
        .replace("const zone", "const form = document.getElementById('form'); const zone"),
    );
    const app = new App(page, PRODUCT);
    await app.upload('attachment', 'brief.txt');
    await app.expectError('attachment');
  });

  test('fails when the file is never uploaded', async ({ page }) => {
    await show(page, '/tasks/1', uploadPage(''));
    const app = new App(page, PRODUCT);
    await expect(app.upload('attachment', 'brief.txt')).rejects.toThrow('the file brief.txt is uploaded into attachment');
  });
});

test.describe('expectValues', () => {
  const card = `<article data-bz="state:loaded"><dl>
    <dd data-bz="field:title">Attach the brief</dd>
    <dd data-bz="field:attachment"><a href="/media/brief.txt">brief.txt</a> <span>23 B</span></dd>
  </dl></article>`;

  test('waits for the screen to load and reads the texts of the fields', async ({ page }) => {
    await show(page, '/tasks/1', loading('task-card', card));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectValues({ title: 'Attach the brief', attachment: 'brief.txt' });
  });

  test('fails when a field shows another text', async ({ page }) => {
    await show(page, '/tasks/1', loading('task-card', card));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await expect(app.expectValues({ attachment: 'report.pdf' })).rejects.toThrow();
  });
});

test.describe('expectNotification', () => {
  // the bell of a layout with a hidden copy (the sidebar on a phone); the list it opens, closed
  // by Escape, gets the notification after a delay
  const bell = html(
    `<section data-bz="screen:task-card"><div data-bz="state:loaded">Task</div></section>
     <button data-bz="action:notifications" style="display: none"></button>
     <button data-bz="action:notifications" id="bell">Notifications</button>`,
    `document.getElementById('bell').onclick = () => {
       const list = document.createElement('ul');
       list.dataset.bz = 'list:notifications';
       list.innerHTML = '<li data-bz="notification:1">Task finished Plan the week</li>';
       document.body.append(list);
       setTimeout(() => { list.insertAdjacentHTML('afterbegin', '<li data-bz="notification:2">Task finished Write the report</li>'); }, 300);
     };
     document.addEventListener('keydown', (event) => {
       if (event.key === 'Escape') document.querySelector('[data-bz="list:notifications"]')?.remove();
     });`,
  );

  test('opens the list of the notifications and waits for the text', async ({ page }) => {
    await show(page, '/tasks/1', bell);
    const app = new App(page, PRODUCT);
    await app.expectNotification('Write the report');
    await expect(page.locator(bz('list', 'notifications'))).toHaveCount(0);
  });

  test('fails when no notification has the text', async ({ page }) => {
    await show(page, '/tasks/1', bell);
    const app = new App(page, PRODUCT);
    await expect(app.expectNotification('Archive the task')).rejects.toThrow();
  });
});

test.describe('language', () => {
  // the button of the layout (and its hidden copy of a phone), which goes to the next language
  // after a delay
  const layout = html(
    `<section data-bz="screen:home"><div data-bz="state:loaded">Home</div></section>
     <button data-bz="action:language" data-value="en" style="display: none"></button>
     <button data-bz="action:language" data-value="en" id="language">EN</button>`,
    `const languages = ['en', 'ru', 'kk'];
     const button = document.getElementById('language');
     button.onclick = () => setTimeout(() => {
       button.dataset.value = languages[(languages.indexOf(button.dataset.value) + 1) % languages.length];
     }, 200);`,
  );

  test('goes through the languages to the one asked for', async ({ page }) => {
    await show(page, '/', layout);
    const app = new App(page, PRODUCT);
    await app.language('kk');
    await expect(page.locator('#language')).toHaveAttribute('data-value', 'kk');
    await app.language('kk');
    await app.language('ru');
    await expect(page.locator('#language')).toHaveAttribute('data-value', 'ru');
  });

  test('fails for a language that the backend does not have', async ({ page }) => {
    test.setTimeout(30_000);
    await show(page, '/', layout);
    const app = new App(page, PRODUCT);
    await expect(app.language('de')).rejects.toThrow();
  });
});

test('transit fills its payload and waits until it is done', async ({ page }) => {
  await show(page, '/tasks/1',
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

test('openItem opens a row of the last items of a dashboard', async ({ page }) => {
  const recent = (id: string) => `<div data-bz="recent:${id}"><table><tbody>
    <tr data-bz="row:${id}" onclick="document.body.dataset.opened = '${id}'"><td data-bz="cell:title">Plan</td></tr>
  </tbody></table></div>`;
  await serve(page, { '/': loading('home', `<div data-bz="state:loaded">${recent('other')}${recent('last-tasks')}</div>`) });
  const app = new App(page, PRODUCT);
  await app.open('home');
  await app.openItem({ where: { title: 'Plan' }, in: 'last-tasks' });
  await expect(page.locator('body')).toHaveAttribute('data-opened', 'last-tasks');
});

test.describe('select and bulk', () => {
  /** A list whose bulk action, once confirmed, ends after a delay with `done`. */
  function list(done: string): string {
    return html(
      `<section data-bz="screen:task-list"><div data-bz="list:task"><div data-bz="state:loaded">
        <button id="bulk" data-bz="bulk:start-all" hidden>Start</button><table><tbody>
        <tr data-bz="row:1"><td><input type="checkbox" data-bz="select:1"></td><td data-bz="cell:title">A</td></tr>
        <tr data-bz="row:2"><td><input type="checkbox" data-bz="select:2"></td><td data-bz="cell:title">B</td></tr>
      </tbody></table></div></div></section>`,
      `const bulk = document.getElementById('bulk');
       document.querySelector('tbody').addEventListener('change', () => { bulk.hidden = !document.querySelector('input:checked'); });
       bulk.addEventListener('click', () => {
         document.body.insertAdjacentHTML('beforeend', '<div role="alertdialog"><button id="confirm" data-bz="action:confirm-bulk">Start 1</button></div>');
         document.getElementById('confirm').addEventListener('click', () => {
           document.body.dataset.started = [...document.querySelectorAll('input:checked')].map((it) => it.dataset.bz).join(' ');
           document.querySelector('[role=alertdialog]').remove();
           setTimeout(() => { ${done} }, 300);
         });
       });`,
    );
  }

  test('select checks the box of the row, and bulk waits until the selection is cleared', async ({ page }) => {
    await show(page, '/tasks', list("bulk.remove();"));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.select({ where: { title: 'B' } });
    await expect(page.locator(bz('select', '2'))).toBeChecked();
    await expect(page.locator(bz('select', '1'))).not.toBeChecked();
    await app.bulk('start-all');
    await expect(page.locator('body')).toHaveAttribute('data-started', 'select:2');
    expect(await page.locator(bz('bulk', 'start-all')).count()).toBe(0);
  });

  test('bulk returns when the action shows an error', async ({ page }) => {
    await show(page, '/tasks', list(`document.body.insertAdjacentHTML('beforeend', '<p data-bz="error:bulk">Not allowed</p>');`));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await app.select({ where: { title: 'A' } });
    await app.bulk('start-all');
    await app.expectError('bulk');
  });
});

test('move moves an item by its menu and waits until it is in its column', async ({ page }) => {
  await show(page, '/board',
    html(
      `<section data-bz="screen:task-board"><div data-bz="state:loaded">
        <div data-bz="column:draft"><div data-bz="row:1"><span data-bz="cell:title">A</span><button id="menu" data-bz="action:move">Move</button></div></div>
        <div data-bz="column:in_progress"></div></div></section>`,
      `document.getElementById('menu').addEventListener('click', () => {
         document.body.insertAdjacentHTML('beforeend', '<div role="menu"><button id="to" data-bz="move:in_progress">In progress</button></div>');
         document.getElementById('to').addEventListener('click', () => {
           document.querySelector('[role=menu]').remove();
           setTimeout(() => { document.querySelector('[data-bz="column:in_progress"]').append(document.querySelector('[data-bz="row:1"]')); }, 300);
         });
       });`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-board');
  await app.move({ where: { title: 'A' }, to: 'in_progress' });
  expect(await page.locator(`${bz('column', 'in_progress')} ${bz('row', '1')}`).count()).toBe(1);
});

test('move fails at once with the refusal of the move', async ({ page }) => {
  await show(page, '/board',
    html(
      `<section data-bz="screen:task-board"><div data-bz="state:loaded">
        <div data-bz="column:draft"><div data-bz="row:1"><span data-bz="cell:title">A</span><button id="menu" data-bz="action:move">Move</button></div></div>
        <div data-bz="column:in_progress"></div></div></section>`,
      `document.getElementById('menu').addEventListener('click', () => {
         document.body.insertAdjacentHTML('beforeend', '<div role="menu"><button id="to" data-bz="move:in_progress">In progress</button></div>');
         document.getElementById('to').addEventListener('click', () => {
           document.querySelector('[role=menu]').remove();
           setTimeout(() => {
             document.querySelector('[data-bz="screen:task-board"]').insertAdjacentHTML('afterbegin',
               '<div data-bz="error:move"><div data-bz="state:forbidden">You may not start it.</div></div>');
           }, 300);
         });
       });`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-board');
  const started = Date.now();
  await expect(app.move({ where: { title: 'A' }, to: 'in_progress' })).rejects.toThrow(
    'The item row:1 was not moved to in_progress: You may not start it.',
  );
  // not after the timeout of the expectations
  expect(Date.now() - started).toBeLessThan(3000);
});

test.describe('expectTile', () => {
  const tiles = loading('home', '<div data-bz="state:loaded"><div data-bz="tile:review" data-value="3">Review 3</div></div>');

  test('waits for the count of the tile', async ({ page }) => {
    await serve(page, { '/': tiles });
    const app = new App(page, PRODUCT);
    await app.open('home');
    await app.expectTile('review', 3);
  });

  test('fails for another count', async ({ page }) => {
    await serve(page, { '/': tiles });
    const app = new App(page, PRODUCT);
    await app.open('home');
    await expect(app.expectTile('review', 2)).rejects.toThrow();
  });
});

test('expectDay moves the calendar to the period of the day', async ({ page }) => {
  // the month shown, and the one before it once the calendar goes back
  const october = '<div data-bz="day:2026-10-07" data-count="1"><a data-bz="row:1"><span data-bz="cell:title">A</span></a></div>';
  const september = '<div data-bz="day:2026-09-15" data-count="2"></div>';
  await show(page, '/calendar',
    html(
      `<section data-bz="screen:task-calendar"><div data-bz="state:loaded"><div data-bz="calendar:task" data-from="2026-10-01" data-to="2026-10-31">
        <button id="previous" data-bz="action:previous-period">Previous</button><button data-bz="action:next-period">Next</button>
        <div id="days">${october}</div></div></div></section>`,
      `document.getElementById('previous').addEventListener('click', () => {
         setTimeout(() => {
           const calendar = document.querySelector('[data-bz="calendar:task"]');
           calendar.dataset.from = '2026-09-01';
           calendar.dataset.to = '2026-09-30';
           document.getElementById('days').innerHTML = ${JSON.stringify(september)};
         }, 300);
       });`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-calendar');
  await app.expectDay('2026-10-07', 1);
  await app.expectDay('2026-09-15', 2);
  await expect(app.expectDay('2026-09-16', 1)).rejects.toThrow();
});

test('the steps show the tab of the card that has what they act on', async ({ page }) => {
  // the panels of the tabs stay in the page, hidden; a tab shows its panel
  await show(page, '/tasks/1',
    html(
      `<section data-bz="screen:task-card"><article data-bz="state:loaded"><div role="tablist">
        <button role="tab" id="t1" aria-controls="p1" aria-selected="true" data-bz="tab:details">Details</button>
        <button role="tab" id="t2" aria-controls="p2" aria-selected="false" data-bz="tab:steps">Steps</button></div>
        <div role="tabpanel" id="p1"><dd data-bz="field:title">Plan</dd></div>
        <div role="tabpanel" id="p2" hidden><dd data-bz="field:report">Done</dd>
          <button data-bz="action:add-step" onclick="document.body.dataset.added = '1'">Add</button></div></article></section>`,
      `for (const tab of document.querySelectorAll('[role=tab]')) {
         tab.addEventListener('click', () => {
           for (const other of document.querySelectorAll('[role=tab]')) {
             other.setAttribute('aria-selected', String(other === tab));
             document.getElementById(other.getAttribute('aria-controls')).hidden = other !== tab;
           }
         });
       }`,
    ),
  );
  const app = new App(page, PRODUCT);
  await app.expectScreen('task-card');
  await app.action('add-step');
  await expect(page.locator('body')).toHaveAttribute('data-added', '1');
  await app.expectValues({ title: 'Plan' });
  await expect(page.locator('#t1')).toHaveAttribute('aria-selected', 'true');
  await app.expectValues({ report: 'Done' });
});

test.describe('expectActionAbsent', () => {
  const loaded = `<div data-bz="state:loaded"><button data-bz="action:create">Create</button></div>`;

  test('waits for the screen to load', async ({ page }) => {
    await show(page, '/tasks', html('<section data-bz="screen:task-list"><div data-bz="state:empty">Nothing here yet.</div></section>'));
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
    await show(page, '/tasks/1', card());
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectFieldReadonly('title');
  });

  test('opens and cancels the edit of a card', async ({ page }) => {
    await show(page, '/tasks/1', card('<input data-bz="field:title" readonly value="Write the report">'));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectFieldReadonly('title');
    expect(await page.locator('form').count()).toBe(0);
  });

  test('fails when the edit can change the field', async ({ page }) => {
    await show(page, '/tasks/1', card('<input data-bz="field:title" value="Write the report">'));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await expect(app.expectFieldReadonly('title')).rejects.toThrow();
  });

  test('reads the open form', async ({ page }) => {
    await show(page, '/tasks',
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

test.describe('expectFieldAbsent', () => {
  const CARD = '<article data-bz="state:loaded"><dl><dt>Title</dt><dd data-bz="field:title">Write the report</dd></dl></article>';

  test('waits for the screen to load', async ({ page }) => {
    // the field is shown once the card is loaded: the expectation must fail then
    await show(page, '/tasks/1', loading('task-card', CARD));
    const app = new App(page, PRODUCT);
    await expect(page.locator(bz('screen', 'task-card'))).toBeVisible();
    await app.expectScreen('task-card');
    await expect(app.expectFieldAbsent('title')).rejects.toThrow();
  });

  test('passes when the loaded screen does not show the field', async ({ page }) => {
    await show(page, '/tasks/1', loading('task-card', CARD));
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-card');
    await app.expectFieldAbsent('report');
  });

  test('reads the cells of a list and the open form', async ({ page }) => {
    await show(page, '/tasks',
      html(`<section data-bz="screen:task-list">${LIST}</section>
        <form><input data-bz="field:report"><button type="submit" data-bz="action:submit">Create</button></form>`),
    );
    const app = new App(page, PRODUCT);
    await app.expectScreen('task-list');
    await expect(app.expectFieldAbsent('title')).rejects.toThrow();
    await expect(app.expectFieldAbsent('report')).rejects.toThrow();
    await app.expectFieldAbsent('assignee');
  });
});

test.describe('stubForeignImages', () => {
  test('answers the images of another origin with a blank image, never those of the page', async ({ page }) => {
    let reached = false;
    await page.route('https://tiles.example.test/**', async (route) => {
      reached = true;
      await route.abort();
    });
    await stubForeignImages(page);
    await show(
      page,
      '/map',
      html('<img id="tile" src="https://tiles.example.test/1/0/0.png"><img id="own" src="/missing.png">'),
    );
    const loaded = (id: string) =>
      page.locator(`#${id}`).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0);
    await expect.poll(() => loaded('tile')).toBe(true);
    expect(reached).toBe(false);
    // an image of the page itself is served by it (here: none, a 404)
    await expect.poll(() => page.locator('#own').evaluate((image: HTMLImageElement) => image.complete)).toBe(true);
    expect(await loaded('own')).toBe(false);
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
    // never reached: the stub of loginAs answers first
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    process.env.E2E_PASSWORD = 'secret';
    await loginAs(page, PRODUCT, 'manager');
    await expect(page.locator(bz('action', 'logout'))).toBeVisible();
    // the images of other origins are stubbed for the test
    await page.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<img id="tile" src="https://tile.openstreetmap.org/1/0/0.png">');
    });
    await expect
      .poll(() => page.locator('#tile').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
      .toBe(true);
  });

  test('reports a failed login', async ({ page }) => {
    await serve(page, { '/login': login });
    process.env.E2E_PASSWORD = 'wrong';
    await expect(loginAs(page, PRODUCT, 'manager')).rejects.toThrow('manager cannot log in: Wrong password.');
  });

  test('needs the password', async ({ page }) => {
    await expect(loginAs(page, PRODUCT, 'viewer')).rejects.toThrow('Set E2E_PASSWORD');
  });

  test('does not log in as an anonymous role', async ({ page }) => {
    // the guests of `anonymous: true`: no login screen, no password; the images still stubbed
    const product = { ...PRODUCT, roles: { ...PRODUCT.roles, guest: { username: null, anonymous: true } } };
    // never reached: the stub of loginAs answers first
    await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
    const app = await loginAs(page, product, 'guest');
    expect(app).toBeInstanceOf(App);
    expect(page.url()).toBe('about:blank');
    await show(page, '/map', html('<img id="tile" src="https://tile.openstreetmap.org/1/0/0.png">'));
    await expect
      .poll(() => page.locator('#tile').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
      .toBe(true);
  });
});
