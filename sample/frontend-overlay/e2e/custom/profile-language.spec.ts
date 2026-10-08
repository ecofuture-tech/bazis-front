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

// The language of the profile (bazis-users 2.7.0, `CAPABILITIES.users.profile_language`):
// the language the manager chooses is saved to his profile, and adopted at his next sign-in
// in a browser that kept nothing. Skipped with an older bazis-users: the language is kept in
// the browser only then. `manage.py e2e_data` clears the language of the test users.

import { expect, test, type Page } from '@playwright/test';

import { CAPABILITIES } from '@/bazis/generated/contract';

import { bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

/** The PATCH of the language of the user to his profile. */
function saved(page: Page, language: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/api/v1/users/user/') &&
      (response.request().postDataJSON() as { data?: { attributes?: { language?: string } } }).data?.attributes
        ?.language === language,
  );
}

test.skip(!CAPABILITIES.users?.profile_language, 'the users have no language of their own (bazis-users 2.7.0)');

test('the language of the manager follows his profile', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  const logout = page.locator(bz('action', 'logout')).filter({ visible: true }).first();
  // the language of the profile, or (none chosen) that of the browser: never written at a sign-in
  await expect(logout).toHaveText('Log out');

  // the choice of the user is saved to his profile
  const russian = saved(page, 'ru');
  await app.language('ru');
  expect((await russian).ok()).toBe(true);

  // another browser: nothing kept, the language of the profile is adopted at the sign-in
  await logout.click();
  await page.evaluate(() => {
    localStorage.clear();
  });
  const again = await loginAs(page, PRODUCT, 'manager');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(logout).toHaveText('Выйти');

  // back to English, saved too
  const english = saved(page, 'en');
  await again.language('en');
  expect((await english).ok()).toBe(true);
  await expect(logout).toHaveText('Log out');
});
