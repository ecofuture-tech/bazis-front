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

// The router of the template with the public screen of the sample (`public-tasks`, of the
// anonymous role `visitor`): a user without a session opens it with its link only and the
// sign-in, after which he is at home; a screen of a session sends him to the login, `/` the
// first public link; the layout stays mounted between a public screen and a screen of a session.

import { expect, test } from '@playwright/test';

import { App, bz, LOGIN_ROUTE, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a guest opens the public screen and signs in from it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const app = await loginAs(page, PRODUCT, 'visitor');
  await app.open('public-tasks');
  const sidebar = page.locator('aside');
  await expect(sidebar.locator(bz('nav', 'public-tasks'))).toBeVisible();
  await expect(sidebar.locator(bz('nav', 'task-list'))).toHaveCount(0);
  await expect(sidebar.locator(bz('action', 'logout'))).toHaveCount(0);

  await sidebar.locator(bz('action', 'sign-in')).click();
  await expect(page).toHaveURL(LOGIN_ROUTE);
  const password = process.env.E2E_PASSWORD;
  if (!password) throw new Error('Set E2E_PASSWORD, the password of the test users.');
  await new App(page, PRODUCT).fill({ username: PRODUCT.roles.manager.username, password });
  await page.locator(bz('action', 'submit')).click();
  // at home, with every link and the session
  await expect(page.locator(bz('screen', 'home'))).toBeVisible();
  await expect(sidebar.locator(bz('action', 'logout'))).toBeVisible();
  await expect(sidebar.locator(bz('action', 'sign-in'))).toHaveCount(0);

  // the layout is the same between a public screen and a screen of a session
  await sidebar.evaluate((element) => {
    (window as { shell?: Element }).shell = element;
  });
  await sidebar.locator(bz('nav', 'task-list')).click();
  await expect(page.locator(bz('screen', 'task-list'))).toBeVisible();
  const kept = await page.evaluate(() => (window as { shell?: Element }).shell === document.querySelector('aside'));
  expect(kept).toBe(true);
});

test('a screen of a session sends a guest to the login', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'visitor');
  await page.goto('/tasks');
  await expect(page).toHaveURL(LOGIN_ROUTE);
  await expect(app.form().locator(bz('action', 'submit'))).toBeVisible();
});

test('the home of a session sends a guest to the first public link of the navigation', async ({ page }) => {
  await loginAs(page, PRODUCT, 'visitor');
  await page.goto('/');
  await expect(page).toHaveURL('/suggest');
  await expect(page.locator(bz('screen', 'suggest-task'))).toBeVisible();
});
