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

import { aggregateGroups, aggregateValues } from '../src/index.js';

describe('aggregates', () => {
  it('reads the values of a list asked for without a group, the groups of one with it', () => {
    const values = { count: 4, 'sum(price)': '60.50' };
    const groups = [
      { group: '2026-01-01', values: { count: 2 } },
      { group: null, values: { count: 1 } },
    ];
    expect(aggregateValues({ meta: { aggregates: values } })).toEqual(values);
    expect(aggregateGroups({ meta: { aggregates: values } })).toBeNull();
    expect(aggregateGroups({ meta: { aggregates: groups } })).toEqual(groups);
    expect(aggregateValues({ meta: { aggregates: groups } })).toBeNull();
    // over no object: no group
    expect(aggregateGroups({ meta: { aggregates: [] } })).toEqual([]);
    expect(aggregateValues({ meta: null })).toBeNull();
    expect(aggregateGroups({})).toBeNull();
  });
});
