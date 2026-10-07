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

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Filter } from '@/bazis/client';

import { useFilterFields, useItem, useList, useSchema } from '../src/index.js';
import { Backend, cachedKeys, PARENT, render } from './support.js';

const page = (ids: string[], offset = 0) => ({
  data: ids.map((id) => ({ id, type: 'entity.parent_entity', attributes: {}, relationships: {} })),
  links: { next: `https://api.test${PARENT}?page%5Blimit%5D=2&page%5Boffset%5D=${String(offset + 2)}` },
  meta: { pagination: { count: 5, limit: 2, offset } },
});

describe('useList', () => {
  it('requests the page and keys it by path, options and session', async () => {
    const url = `${PARENT}?filter=is_active%3Dtrue&sort=-dt_created&page%5Blimit%5D=2&meta=pagination`;
    const backend = new Backend().on('GET', url, page(['1', '2']));
    const { result, queryClient } = render(
      () =>
        useList(PARENT, {
          filter: Filter.where('is_active', true),
          sort: ['-dt_created'],
          page: { limit: 2 },
          meta: ['pagination'],
        }),
      backend,
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.data.map((it) => it.id)).toEqual(['1', '2']);
    expect(backend.requests()).toEqual([`GET ${url}`]);
    expect(cachedKeys(queryClient)).toEqual([
      [
        'bazis',
        PARENT,
        'list',
        { filter: 'is_active=true', sort: ['-dt_created'], page: { limit: 2 }, meta: ['pagination'] },
        's1',
      ],
    ]);
  });

  it('keeps the previous page of the list while the next one loads', async () => {
    const first = `${PARENT}?page%5Blimit%5D=2&page%5Boffset%5D=0`;
    const second = `${PARENT}?page%5Blimit%5D=2&page%5Boffset%5D=2`;
    const backend = new Backend().on('GET', first, page(['1', '2'])).on('GET', second, page(['3', '4'], 2));
    const { result, rerender } = render(
      ({ offset }: { offset: number }) => useList(PARENT, { page: { limit: 2, offset } }),
      backend,
      undefined,
      { offset: 0 },
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const release = backend.hold('GET', second);
    rerender({ offset: 2 });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.data.map((it) => it.id)).toEqual(['1', '2']);
    release();
    await waitFor(() => {
      expect(result.current.isPlaceholderData).toBe(false);
    });
    expect(result.current.data?.data.map((it) => it.id)).toEqual(['3', '4']);
  });

  it('never shows the data of another session', async () => {
    const backend = new Backend().on('GET', PARENT, page(['1']));
    const { result, rerender, session, queryClient } = render(() => useList(PARENT), backend);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const release = backend.hold('GET', PARENT);
    session.value = 's2';
    rerender();
    // the list of the previous user is not a placeholder of the next one
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);
    release();
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(backend.requests()).toEqual([`GET ${PARENT}`, `GET ${PARENT}`]);
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'list', {}, 's1'],
      ['bazis', PARENT, 'list', {}, 's2'],
    ]);
  });
});

describe('useItem', () => {
  it('requests the item with its options', async () => {
    const url = `${PARENT}a%2Fb/?include=child_entities&meta=crud_actions`;
    const item = { data: { id: 'a/b', type: 'entity.parent_entity', attributes: {}, relationships: {} } };
    const backend = new Backend().on('GET', url, item);
    const { result, queryClient } = render(
      () => useItem(PARENT, 'a/b', { include: ['child_entities'], meta: ['crud_actions'] }),
      backend,
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.data.id).toBe('a/b');
    expect(backend.requests()).toEqual([`GET ${url}`]);
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'item', 'a/b', { include: ['child_entities'], meta: ['crud_actions'] }, 's1'],
    ]);
  });
});

describe('useSchema and useFilterFields', () => {
  it('keeps the schemas for the session', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, { title: 'create' })
      .on('GET', `${PARENT}7/schema_update/`, { title: 'update' })
      .on('GET', `${PARENT}route_filter_fields/`, { fields: [{ name: 'name', py_type: 'string' }] });
    const useHooks = () => ({
      create: useSchema(PARENT, 'create'),
      update: useSchema(PARENT, 'update', '7'),
      filters: useFilterFields(PARENT),
    });
    const { result, queryClient, unmount } = render(useHooks, backend);
    await waitFor(() => {
      expect(result.current.filters.isSuccess && result.current.update.isSuccess).toBe(true);
    });
    expect(result.current.create.data).toEqual({ title: 'create' });
    expect(result.current.filters.data?.fields[0]?.name).toBe('name');
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'schema', 'create', 's1'],
      ['bazis', PARENT, 'item', '7', 'schema', 'update', 's1'],
      ['bazis', PARENT, 'filter-fields', 's1'],
    ]);
    unmount();

    // mounted again in the same session: not requested again
    const again = render(useHooks, backend, queryClient);
    expect(again.result.current.create.data).toEqual({ title: 'create' });
    expect(backend.requests()).toEqual([
      `GET ${PARENT}schema_create/`,
      `GET ${PARENT}7/schema_update/`,
      `GET ${PARENT}route_filter_fields/`,
    ]);
  });
});

describe('BazisProvider', () => {
  it('is required by the hooks', () => {
    expect(() => renderHook(() => useList(PARENT))).toThrow('The hooks of Bazis need a <BazisProvider>.');
  });
});
