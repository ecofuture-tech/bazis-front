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

import { describe, expect, it } from 'vitest';

import { can } from '../src/index.js';

describe('can', () => {
  const list = { for_change: ['1', '2'], for_delete: ['2'], for_create: true };

  it('checks the items of a list page by id', () => {
    expect(can(list, 'change', '1')).toBe(true);
    expect(can(list, 'delete', '1')).toBe(false);
    expect(can(list, 'delete', '2')).toBe(true);
    expect(can(list, 'change', '3')).toBe(false);
  });

  it('checks creation on a list', () => {
    expect(can(list, 'add')).toBe(true);
    expect(can({ ...list, for_create: false }, 'add')).toBe(false);
    expect(can(list, 'change')).toBe(false);
  });

  it('checks the actions of an item', () => {
    const item = { crud_actions: ['view', 'change', 'check'] };
    expect(can(item, 'view')).toBe(true);
    expect(can(item, 'change')).toBe(true);
    expect(can(item, 'check')).toBe(true);
    expect(can(item, 'delete')).toBe(false);
    expect(can(item, 'add')).toBe(false);
  });

  it('denies when the meta was not requested', () => {
    expect(can(undefined, 'view')).toBe(false);
    expect(can(null, 'change', '1')).toBe(false);
    expect(can({}, 'add')).toBe(false);
    expect(can({ for_change: null }, 'change', '1')).toBe(false);
  });
});
