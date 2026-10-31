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

// The files are read with the token from their download route, never from the URL of the
// media host: the attachment of a task (bazis-uploadable `/{id}/download/`) is saved under
// its name with its content, and its name is no link to the media URL. The export of the
// tasks, a custom action that answers a file, is saved under the name the action gives it.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { bz, loginAs } from '../bazis';
import { PRODUCT } from '../generated/product';

const BRIEF = path.join(import.meta.dirname, '..', 'fixtures', 'brief.txt');

test('the manager downloads the attachment of a task', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('task-list');
  await app.action('create');
  await app.fill({ title: 'Download the brief' });
  await app.submit({ saved: true });
  await app.expectScreen('task-card');
  await app.action('edit');
  await app.upload('attachment', 'brief.txt');
  await app.submit({ saved: true });
  await app.expectValues({ attachment: 'brief.txt' });

  const field = page.locator(bz('field', 'attachment')).filter({ visible: true }).first();
  await expect(field.locator('a[href*="/media/"]')).toHaveCount(0);
  const downloaded = page.waitForEvent('download');
  const request = page.waitForRequest((it) => it.url().includes('/download/'));
  await field.getByRole('button', { name: 'brief.txt' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('brief.txt');
  expect(await readFile(await download.path(), 'utf8')).toBe(await readFile(BRIEF, 'utf8'));
  // with the token of the session
  expect((await request).headers().authorization).toMatch(/^Bearer /);
});

test('the manager exports the tasks to the file the action names', async ({ page }) => {
  const app = await loginAs(page, PRODUCT, 'manager');
  await app.open('export-tasks');
  const downloaded = page.waitForEvent('download');
  await app.submit({ saved: true });
  const download = await downloaded;
  // the name of `Content-Disposition`, which the result shows
  expect(download.suggestedFilename()).toBe('tasks.csv');
  const lines = (await readFile(await download.path(), 'utf8')).split('\r\n').filter(Boolean);
  expect(lines[0]).toBe('title,status,priority');
  expect(await app.answer('filename')).toBe('tasks.csv');
  // the meta of the file (`X-Bazis-Meta`): the number of its tasks, next to its name
  expect(await app.answer('count')).toBe(String(lines.length - 1));
});
