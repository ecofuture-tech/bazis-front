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

// The card follows its related items: the steps of a task are drawn after the card (a related
// section that follows the fields), and a step added there reads the task again (its
// computed fields and its transits would change), as in the children of the card.

import { expect, test } from '@playwright/test';

import { loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('a step added after the card reads the task of the card again', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await app.action('create');
  await app.fill({ title: 'Follow the steps' });
  await app.submit({ saved: true });
  await app.expectScreen('task-card');
  const id = new URL(page.url()).pathname.split('/').filter(Boolean).at(-1) ?? '';
  // the requests of the step added and of the retrieve of the task, in their order
  const events: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (request.method() === 'POST' && pathname === '/api/v1/tasks/step/') events.push('add');
    if (request.method() === 'GET' && pathname === `/api/v1/tasks/task/${id}/`) events.push('read');
  });
  await app.action('add-step');
  await app.fill({ title: 'Book the room' });
  await app.submit({ saved: true });
  await expect
    .poll(() => {
      const added = events.indexOf('add');
      return added >= 0 && events.slice(added + 1).includes('read');
    })
    .toBe(true);
});
