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

// The custom actions are offered as the backend reports them (`custom_actions` of bazis-permit
// 2.11, `useCan(path, 'action_count')`): the count of the tasks, which needs a user, is offered
// to the manager once the list of the actions is read.

import { expect, test } from '@playwright/test';

import { bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

test('the manager is offered the count of the tasks that the backend lets him call', async ({ page }) => {
  const actions = page.waitForResponse(
    (response) => response.url().includes('meta=custom_actions') && response.request().method() === 'GET',
  );
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  const answer = (await (await actions).json()) as { meta?: { custom_actions?: string[] } };
  expect(answer.meta?.custom_actions).toContain('action_count');
  await expect(page.locator(bz('action', 'count')).filter({ visible: true })).toHaveCount(1);
});
