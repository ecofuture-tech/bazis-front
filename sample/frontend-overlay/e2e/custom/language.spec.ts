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

// The language of the interface (not a step of the scenarios): the manager switches the
// sample to Russian with the button of the layout. The texts of the components and of the
// screens, the names of the statuses (contract.json has them in every language) and the
// `lang` of the page follow it, the queries are read again from the backend in it
// (`Accept-Language`), and it is kept in the browser; English again at the end, also when a
// check fails, so that the language saved to the profile does not fail the next tests.

import { expect, test, type Page } from '@playwright/test';

import { CAPABILITIES } from '@/bazis/generated/contract';

import { bz, loginAs, type App } from '../bazis';
import { PRODUCT } from '../generated/product';

/**
 * The interface in English again, whatever failed before: the language is also saved to the
 * profile of the manager (bazis-users 2.7.0), which the next tests would sign in with; waited
 * for, so that the page does not close before.
 */
async function backToEnglish(page: Page, app: App<typeof PRODUCT>) {
  const toggle = page.locator(bz('action', 'language')).filter({ visible: true }).first();
  if ((await toggle.getAttribute('data-value')) === 'en') return;
  const saved = CAPABILITIES.users?.profile_language
    ? page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/api/v1/users/user/') &&
          (response.request().postDataJSON() as { data?: { attributes?: { language?: string } } }).data?.attributes
            ?.language === 'en',
      )
    : undefined;
  await app.language('en');
  await saved;
}

test('the manager switches the interface to Russian', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  const logout = page.locator(bz('action', 'logout')).filter({ visible: true }).first();
  try {
    await app.open('task-list');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(logout).toHaveText('Log out');

    // the tasks are read again, in Russian
    const russian = page.waitForRequest(
      (request) => request.url().includes('/api/v1/tasks/task/') && request.headers()['accept-language'] === 'ru',
    );
    await app.language('ru');
    await russian;
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(logout).toHaveText('Выйти');
    await expect(page.locator(bz('nav', 'task-list')).filter({ visible: true }).first()).toHaveText('Задачи');
    await expect(app.screen().getByRole('heading', { name: 'Задачи' })).toBeVisible();
    // the name of a status, from the contract
    await expect(app.screen().getByText('Черновик').first()).toBeVisible();
    await app.expectState('loaded');

    // kept in the browser
    await page.reload();
    await app.expectScreen('task-list');
    await expect(logout).toHaveText('Выйти');
  } finally {
    await backToEnglish(page, app);
  }
  await expect(logout).toHaveText('Log out');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
