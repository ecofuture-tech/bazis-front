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

import { act, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCreate, useDestroy, useItem, useList, useRelationship, useUpdate } from '../src/index.js';
import { Backend, cachedKeys, CHILD, PARENT, render } from './support.js';

const item = (id: string, name: string) => ({
  data: { id, type: 'entity.parent_entity', attributes: { name }, relationships: {} },
});
const list = { data: [], links: {}, meta: {} };

// a list and an item of PARENT and a list of CHILD on screen
function screen(backend: Backend) {
  backend.on('GET', PARENT, list).on('GET', `${PARENT}7/`, item('7', 'old')).on('GET', CHILD, list);
  return () => ({
    list: useList(PARENT),
    item: useItem(PARENT, '7'),
    children: useList(CHILD),
    create: useCreate(PARENT),
    update: useUpdate(PARENT),
    destroy: useDestroy(PARENT),
    relationship: useRelationship(PARENT),
  });
}

async function loaded(backend: Backend) {
  const rendered = render(screen(backend), backend);
  await waitFor(() => {
    const { list: a, item: b, children: c } = rendered.result.current;
    expect(a.isSuccess && b.isSuccess && c.isSuccess).toBe(true);
  });
  backend.calls.length = 0;
  return rendered;
}

describe('mutations', () => {
  it('create posts the document and refetches the queries of the resource', async () => {
    const backend = new Backend().on('POST', PARENT, item('8', 'new'), 201);
    const { result } = await loaded(backend);
    const document = {
      data: { type: 'entity.parent_entity', attributes: { name: 'new' }, relationships: {} },
    };

    let created: unknown;
    await act(async () => {
      created = await result.current.create.mutateAsync(document);
    });
    expect(created).toEqual(item('8', 'new'));
    expect(backend.calls[0]).toMatchObject({ method: 'POST', body: document });
    // pending until the active queries of the resource are refetched; not the other resources
    expect(backend.requests()).toEqual([`POST ${PARENT}`, `GET ${PARENT}`, `GET ${PARENT}7/`]);
  });

  it('update patches the item and refetches it', async () => {
    const backend = new Backend();
    const { result } = await loaded(backend);
    const document = {
      data: { type: 'entity.parent_entity', id: '7', attributes: { name: 'new' }, relationships: {} },
    };
    backend.on('PATCH', `${PARENT}7/`, item('7', 'new')).on('GET', `${PARENT}7/`, item('7', 'new'));

    await act(async () => {
      await result.current.update.mutateAsync({ id: '7', document });
    });
    expect(backend.calls[0]).toMatchObject({ method: 'PATCH', body: document });
    expect(backend.requests()).toEqual([`PATCH ${PARENT}7/`, `GET ${PARENT}`, `GET ${PARENT}7/`]);
    await waitFor(() => {
      expect(result.current.item.data?.data.attributes.name).toBe('new');
    });
  });

  it('destroy removes the queries of the item instead of refetching them', async () => {
    const backend = new Backend();
    const { result, queryClient } = await loaded(backend);
    backend.on('DELETE', `${PARENT}7/`, undefined, 204);

    await act(async () => {
      await result.current.destroy.mutateAsync('7');
    });
    expect(backend.requests()).toEqual([`DELETE ${PARENT}7/`, `GET ${PARENT}`]);
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'list', {}, 's1'],
      ['bazis', CHILD, 'list', {}, 's1'],
    ]);
  });

  it('relationship changes a relationship through its endpoint', async () => {
    const backend = new Backend();
    const { result } = await loaded(backend);
    backend.on('POST', `${PARENT}7/relationships/child_entities`, undefined, 204);
    const data = [{ type: 'entity.child_entity', id: '3' }];

    await act(async () => {
      await result.current.relationship.mutateAsync({
        id: '7',
        field: 'child_entities',
        operation: 'add',
        data,
      });
    });
    expect(backend.calls[0]).toMatchObject({ method: 'POST', body: { data } });
    expect(backend.requests()).toEqual([
      `POST ${PARENT}7/relationships/child_entities`,
      `GET ${PARENT}`,
      `GET ${PARENT}7/`,
    ]);
  });

  it('a failed mutation refetches nothing', async () => {
    const backend = new Backend();
    const { result } = await loaded(backend);
    backend.on('PATCH', `${PARENT}7/`, { errors: [{ status: 403, detail: 'No' }] }, 403);

    const document = {
      data: { type: 'entity.parent_entity', id: '7', attributes: {}, relationships: {} },
    };

    act(() => {
      result.current.update.mutate({ id: '7', document });
    });
    await waitFor(() => {
      expect(result.current.update.error?.message).toBe('No');
    });
    expect(backend.requests()).toEqual([`PATCH ${PARENT}7/`]);
  });
});
