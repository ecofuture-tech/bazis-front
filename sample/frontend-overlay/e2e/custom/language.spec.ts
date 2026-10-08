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
// (`Accept-Language`), and it is kept in the browser.

import { expect, test } from '@playwright/test';

import { bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('the manager switches the interface to Russian', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const logout = page.locator(bz('action', 'logout')).filter({ visible: true }).first();
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

  await app.language('en');
  await expect(logout).toHaveText('Log out');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
