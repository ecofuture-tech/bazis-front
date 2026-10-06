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

import { Filter } from '../src/index.js';

describe('Filter', () => {
  it('renders conditions of every value type', () => {
    expect(String(Filter.where('name', 'apple'))).toBe('name=apple');
    expect(String(Filter.where('price__gte', 10.5))).toBe('price__gte=10.5');
    expect(String(Filter.where('is_active', false))).toBe('is_active=false');
    expect(String(Filter.where('price__isnull', true))).toBe('price__isnull=true');
    expect(String(Filter.where('parent', null))).toBe('parent=null');
    expect(String(Filter.where('$search', 'big apple'))).toBe('$search=big%2520apple');
  });

  it('renders lists of values', () => {
    expect(String(Filter.where('field', ['first_field', 'second_field']))).toBe(
      'field=first_field,second_field',
    );
    expect(String(Filter.where('entity.child_entity', ['a b', 1]))).toBe(
      'entity.child_entity=a%2520b,1',
    );
  });

  it('encodes every reserved character of a value twice', () => {
    expect(String(Filter.where('name', `a&b|c(d)~e'f"g%h,i=j[k]+l m!*`))).toBe(
      'name=a%2526b%257Cc%2528d%2529%257Ee%2527f%2522g%2525h%252Ci%253Dj%255Bk%255D' +
        '%252Bl%2520m%2521%252A',
    );
    expect(String(Filter.where('name', 'Ünïcode'))).toBe('name=%25C3%259Cn%25C3%25AFcode');
  });

  it('combines conditions with & and |', () => {
    const a = Filter.where('a', 1);
    const b = Filter.where('b', 2);
    const c = Filter.where('c', 3);
    expect(String(Filter.and(a, b, c))).toBe('a=1&b=2&c=3');
    expect(String(Filter.or(a, b))).toBe('a=1|b=2');
    expect(String(Filter.and(a, Filter.or(b, c)))).toBe('a=1&(b=2|c=3)');
    expect(String(Filter.or(Filter.and(a, b), Filter.and(b, c)))).toBe('(a=1&b=2)|(b=2&c=3)');
    expect(String(Filter.and(a))).toBe('a=1');
  });

  it('negates conditions and groups', () => {
    const a = Filter.where('state', 'one');
    const b = Filter.where('state', 'two');
    expect(String(Filter.not(a))).toBe('~state=one');
    expect(String(Filter.not(Filter.or(a, b)))).toBe('~(state=one|state=two)');
    expect(String(Filter.and(Filter.not(a), Filter.not(Filter.or(a, b))))).toBe(
      '~state=one&~(state=one|state=two)',
    );
    expect(String(Filter.not(Filter.not(a)))).toBe('state=one');
    expect(String(Filter.not(Filter.not(Filter.or(a, b))))).toBe('state=one|state=two');
  });

  it('rejects what the grammar cannot express', () => {
    expect(() => Filter.and()).toThrow(RangeError);
    expect(() => Filter.or()).toThrow(RangeError);
    expect(() => Filter.where('name=x', 1)).toThrow(TypeError);
    expect(() => Filter.where('a&b', 1)).toThrow(TypeError);
    expect(() => Filter.where('', 1)).toThrow(TypeError);
    expect(() => Filter.where('tags', [])).toThrow(RangeError);
    expect(() => Filter.where('tags', ['a,b'])).toThrow(RangeError);
  });
});
