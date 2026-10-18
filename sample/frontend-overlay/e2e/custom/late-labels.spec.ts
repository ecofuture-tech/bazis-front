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

// The labels of the related items are read after the rows of a list (`RelationLabel`): a row
// is found by the label of its assignee in a list without a search (the drafts), the users
// answered late as by a slow backend. The helpers wait for the labels (`state:loading`).

import { test } from '@playwright/test';

import { loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a row is found by the label of a related item read after the rows', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await app.action('create');
  await app.fill({ title: 'Read the labels late', assignee: 'Mary Manager' });
  await app.submit({ saved: true });
  // the labels of the users, read by their ids
  await page.route('**/api/v1/users/user/?filter=**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await app.open('draft-tasks');
  await app.openItem({ where: { title: 'Read the labels late', assignee: 'Mary Manager' }, created: true });
  await app.expectScreen('task-card');
});
