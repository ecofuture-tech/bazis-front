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

// The sessions of `sessionAs` are closed as their test ends, before the next one starts:
// Playwright records the trace of a test on every context of the browser (as in the products,
// `trace` of their playwright.config.ts) and fails it on a context still closing.

import { expect, type BrowserContext } from '@playwright/test';

import { App, sessionAs, test } from '../bazis';
import { PRODUCT } from '../generated/product';

test.use({ trace: 'retain-on-failure' });
test.describe.configure({ mode: 'serial' });

let opened: BrowserContext | null = null;

/** The test after one with a session: only its own context is open. */
function closedBefore(name: string): void {
  test(`the sessions of ${name} are closed before the next test starts`, ({ page }) => {
    expect(opened).not.toBeNull();
    expect(page.context().browser()?.contexts()).toEqual([page.context()]);
    opened = null;
  });
}

test('the sessions of a test are open while it runs', async ({ page }) => {
  const visitor = await sessionAs(new App(page, PRODUCT), 'visitor');
  opened = visitor.page.context();
  expect(page.context().browser()?.contexts()).toEqual([page.context(), opened]);
});
closedBefore('a test');

test('the sessions of a failed test are closed too', async ({ page }) => {
  test.fail();
  opened = (await sessionAs(new App(page, PRODUCT), 'visitor')).page.context();
  throw new Error('the test fails');
});
closedBefore('a failed test');
