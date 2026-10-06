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

import { nextPage, pagination, prevPage } from '../src/index.js';

// links as the core builds them from the request URL (starlette include_query_params)
const URL_ = 'http://backend:8000/api/v1/entity/parent_entity/?filter=name%3Dx';

describe('pagination', () => {
  it('reads the next and the previous page from the links', () => {
    const document = {
      links: {
        first: `${URL_}&page%5Blimit%5D=20`,
        last: `${URL_}&page%5Blimit%5D=20&page%5Boffset%5D=80`,
        prev: `${URL_}&page%5Blimit%5D=20&page%5Boffset%5D=20`,
        next: `${URL_}&page%5Blimit%5D=20&page%5Boffset%5D=60`,
      },
    };
    expect(nextPage(document)).toEqual({ offset: 60, limit: 20 });
    expect(prevPage(document)).toEqual({ offset: 20, limit: 20 });
  });

  it('reads the first page from a link without an offset or a limit', () => {
    expect(prevPage({ links: { prev: URL_ } })).toEqual({ offset: 0 });
    expect(prevPage({ links: { prev: '/api/v1/entity/parent_entity/?page[limit]=5' } })).toEqual({
      offset: 0,
      limit: 5,
    });
  });

  it('returns null without a link', () => {
    expect(nextPage({ links: { next: null } })).toBeNull();
    expect(nextPage({ links: {} })).toBeNull();
    expect(prevPage({})).toBeNull();
  });

  it('reads the pagination meta when it was requested', () => {
    const meta = { count: 95, limit: 20, offset: 40 };
    expect(pagination({ meta: { pagination: meta } })).toEqual(meta);
    expect(pagination({ meta: null })).toBeNull();
    expect(pagination({})).toBeNull();
  });
});
