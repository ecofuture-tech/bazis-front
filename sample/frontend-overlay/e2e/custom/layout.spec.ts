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

// The layout with the styles of a product (what jsdom does not lay out): the foot of the
// sidebar holds the tools of the sample (the state of the socket and the bell), the
// language, the color mode and the session without pushing any of them out, on a phone
// the filters of the list of the tasks (a date range among them), folded behind their button,
// fit the width of the page once unfolded,
// and a long title (a word without a space among its words) keeps every screen that shows it
// within the width of the page, of a phone and of a desktop (the task stays: `e2e_data`
// only adds, and the manager may not delete it); the table of the tasks fits a desktop with
// the longest date-time of its column, whatever the time of the run.

import { expect, test, type Locator, type Page } from '@playwright/test';

import { bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

/** The elements of `box` that stick out of it, by their `data-bz` or tag. */
async function overflowing(box: Locator): Promise<string[]> {
  return box.evaluate((root) => {
    const outer = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        return rect.left < outer.left - 0.5 || rect.right > outer.right + 0.5;
      })
      .map((element) => element.dataset.bz ?? element.tagName.toLowerCase());
  });
}

/** Whether the page scrolls sideways. */
async function scrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

test('the foot of the sidebar holds the tools and the session', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  const sidebar = page.locator('aside');
  await expect(sidebar.locator(bz('action', 'notifications'))).toBeVisible();
  await expect(sidebar.locator('[data-bz^="socket:"]')).toBeVisible();
  await expect(sidebar.locator(bz('action', 'language'))).toBeVisible();
  await expect(sidebar.locator(bz('action', 'logout'))).toBeVisible();
  expect(await overflowing(sidebar)).toEqual([]);
});

test('a phone shows the filters of a list within its width', async ({ page }) => {
  // the login waits for the logout of the sidebar, in the drawer on a phone
  const app = await loginAs(page, PRODUCT, 'manager');
  await page.setViewportSize({ width: 390, height: 844 });
  await app.open('task-list');
  await app.expectState('loaded');
  const to = page.locator(bz('field', 'dt_created__lte'));
  // folded behind their button on a phone
  await expect(to).toBeHidden();
  const fold = page.locator(bz('action', 'filters'));
  await fold.click();
  await expect(fold).toHaveAttribute('aria-expanded', 'true');
  await expect(to).toBeVisible();
  const box = await to.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(390);
  expect(await overflowing(page.locator('[data-slot="filter-row"]').first())).toEqual([]);
  expect(await scrollsSideways(page)).toBe(false);
});

test('the table of the tasks fits with the longest date', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await app.expectState('loaded');
  // the column of the date is as wide as its values on the page (an hour of two digits is
  // wider): every month at 1:05 AM, 12:37 AM and 10:10 PM in the cells, then their texts back
  const wide = await page.evaluate(() => {
    const scroller = document.querySelector<HTMLElement>('[data-bz^="list:"] [data-slot="table-scroll"]');
    if (scroller === null) return ['no table'];
    const format = new Intl.DateTimeFormat(document.documentElement.lang, { dateStyle: 'medium', timeStyle: 'short' });
    const kept = new Map<Text, string>();
    for (const cell of document.querySelectorAll('[data-bz="cell:dt_created"]')) {
      const texts = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
      for (let node = texts.nextNode(); node !== null; node = texts.nextNode()) {
        if (node instanceof Text && node.data.trim()) kept.set(node, node.data);
      }
    }
    if (kept.size === 0) return ['no date'];
    const failed: string[] = [];
    try {
      for (let month = 0; month < 12; month += 1) {
        // the minutes after midnight of 1:05 AM, 12:37 AM and 10:10 PM
        for (const minutes of [65, 37, 1330]) {
          const text = format.format(new Date(2026, month, 28, 0, minutes));
          for (const node of kept.keys()) node.data = text;
          if (scroller.scrollWidth > scroller.clientWidth + 1) {
            failed.push(`${text}: ${String(scroller.scrollWidth)} px in ${String(scroller.clientWidth)} px`);
          }
        }
      }
    } finally {
      for (const [node, data] of kept) node.data = data;
    }
    return failed;
  });
  expect(wide).toEqual([]);
});

/** A title longer than any column: a word without a space and words. */
const LONG = `Pneumonoultramicroscopicsilicovolcanoconiosis-${'x'.repeat(40)} and the words of a title that goes on past the width of a card`;

test('a long title keeps the screens within the width of the page', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  // added on the calendar, which shows the tasks on the days they are due
  await app.open('task-calendar');
  await app.action('add-task');
  await app.fill({ title: LONG, due: 'today 12:00' });
  await app.submit({ saved: true });
  await app.open('task-list');
  await app.openItem({ where: { title: LONG }, created: true });
  await app.expectScreen('task-card');
  await app.action('add-step');
  await app.fill({ title: LONG });
  await app.submit({ saved: true });
  const wide: string[] = [];
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    // the calendar shows the task on its day, today, and lists it as the selected day
    for (const screen of ['home', 'task-list', 'task-board', 'task-calendar'] as const) {
      await app.open(screen);
      await expect(app.screen().getByText(LONG).first()).toBeAttached();
      await expect(page.locator(bz('state', 'loading'))).toHaveCount(0);
      if (await scrollsSideways(page)) wide.push(`${screen} at ${String(width)}`);
    }
    await app.open('task-list');
    await app.openItem({ where: { title: LONG }, created: true });
    await app.expectScreen('task-card');
    await expect(app.screen().getByText(LONG).first()).toBeAttached();
    await expect(page.locator(bz('state', 'loading'))).toHaveCount(0);
    if (await scrollsSideways(page)) wide.push(`task-card at ${String(width)}`);
    // its step, in the related list of the tab of the steps
    await app.screen().getByRole('tab', { name: 'Steps' }).click();
    await expect(app.screen().getByRole('tabpanel').getByText(LONG).first()).toBeVisible();
    if (await scrollsSideways(page)) wide.push(`the steps of task-card at ${String(width)}`);
  }
  expect(wide).toEqual([]);
});
