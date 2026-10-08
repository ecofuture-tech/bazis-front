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

import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RELATED_BATCH, useRelatedItem } from '../src/index.js';
import { Backend, cachedKeys, CHILD, PARENT, render } from './support.js';

const item = (id: string) => ({ id, type: 'entity.parent_entity', attributes: { name: `Item ${id}` }, relationships: {} });

/** The query of the list of the items of these ids, as the client encodes it. */
function byIds(ids: readonly string[]): string {
  return `?filter=${ids.map((id) => `pk%3D${id}`).join('%7C')}&page%5Blimit%5D=${String(ids.length)}`;
}

describe('useRelatedItem', () => {
  it('reads the items asked for together with one list filtered by their primary keys', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}${byIds(['1', '2', '3'])}`, { data: [item('2'), item('1')] })
      .on('GET', `${CHILD}${byIds(['1'])}`, { data: [{ ...item('1'), type: 'entity.child_entity' }] });
    const { result, queryClient } = render(
      () => [
        useRelatedItem(PARENT, '1'),
        useRelatedItem(PARENT, '2'),
        useRelatedItem(PARENT, '1'),
        useRelatedItem(PARENT, '3'),
        useRelatedItem(CHILD, '1'),
      ],
      backend,
    );

    await waitFor(() => {
      expect(result.current.every((it) => it.isSuccess)).toBe(true);
    });
    // one request per resource; an id asked twice is read once
    expect(backend.requests().sort()).toEqual([
      `GET ${CHILD}${byIds(['1'])}`,
      `GET ${PARENT}${byIds(['1', '2', '3'])}`,
    ]);
    expect(result.current.map((it) => it.data?.id ?? null)).toEqual(['1', '2', '1', null, '1']);
    // an item the list does not have (the user may not view it) is null
    expect(result.current[3]?.data).toBeNull();
    expect(cachedKeys(queryClient)).toContainEqual(['bazis', PARENT, 'item', '3', 'related', 's1']);
  });

  it(`reads at most ${String(RELATED_BATCH)} ids with one request`, async () => {
    const ids = Array.from({ length: RELATED_BATCH + 1 }, (_, index) => String(index + 1));
    const first = ids.slice(0, RELATED_BATCH);
    const backend = new Backend()
      .on('GET', `${PARENT}${byIds(first)}`, { data: first.map(item) })
      .on('GET', `${PARENT}${byIds([String(RELATED_BATCH + 1)])}`, { data: [] });
    const { result } = render(() => ids.map((id) => useRelatedItem(PARENT, id)), backend);

    await waitFor(() => {
      expect(result.current.every((it) => it.isSuccess)).toBe(true);
    });
    expect(backend.requests()).toHaveLength(2);
    expect(result.current.at(-1)?.data).toBeNull();
    expect(result.current[0]?.data?.id).toBe('1');
  });

  it('finds an item whose id is a number in the list (an integer primary key)', async () => {
    const backend = new Backend().on('GET', `${PARENT}${byIds(['7'])}`, { data: [{ ...item('7'), id: 7 }] });
    const { result } = render(() => useRelatedItem(PARENT, '7'), backend);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toMatchObject({ id: 7, attributes: { name: 'Item 7' } });
  });

  it('fails the items of a request that fails', async () => {
    const backend = new Backend().on('GET', `${PARENT}${byIds(['1', '2'])}`, { errors: [{ status: 403 }] }, 403);
    const { result } = render(() => [useRelatedItem(PARENT, '1'), useRelatedItem(PARENT, '2')], backend);

    await waitFor(() => {
      expect(result.current.every((it) => it.isError)).toBe(true);
    });
    expect(backend.requests()).toEqual([`GET ${PARENT}${byIds(['1', '2'])}`]);
  });
});
