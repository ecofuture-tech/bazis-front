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

// The screens and the roles of the helpers are those of the specs (`generated/product.ts`
// of the sample): checked by `npm run typecheck`, never run.

import type { Page } from '@playwright/test';

import { App, loginAs, sessionAs } from '../bazis';
import { PRODUCT } from '../generated/product';

declare const page: Page;

const app = new App(page, PRODUCT);
void app.open('task-list');
void app.expectScreen('task-card');
// @ts-expect-error: not a screen of the specs
void app.open('task-lst');
void loginAs(page, PRODUCT, 'viewer');
// @ts-expect-error: not a role of the specs
void loginAs(page, PRODUCT, 'admin');
void sessionAs(app, 'visitor');
// @ts-expect-error: not a role of the specs
void sessionAs(app, 'admin');
const answered: Promise<string> = app.answer('task');
void answered;
// a to-many relationship is filled with the labels of its items
void app.fill({ watchers: ['Mary Manager'] });
// @ts-expect-error: the labels are texts
void app.fill({ watchers: [1] });
// @ts-expect-error: the values of the fields that an item is found by are scalars
void app.openItem({ where: { title: ['Write the report'] } });
