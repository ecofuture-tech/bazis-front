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

import { useResourceForm } from '../src/index.js';
import { parentSchema } from './fixtures/parent.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, PARENT, render } from './support.js';

const item = (name: string, parent: string | null) => ({
  data: {
    id: '7',
    type: 'entity.parent_entity',
    attributes: { name, price: 10, is_active: true, state: 'new', dt_created: '2026-10-07T10:00:00Z' },
    relationships: {
      parent: { data: parent === null ? null : { id: parent, type: 'entity.parent_entity' } },
      child_entities: { data: [{ id: 'c1', type: 'entity.child_entity' }] },
    },
  },
});

async function ready(result: { current: { status: string } }) {
  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });
}

describe('useResourceForm without an id: a create', () => {
  it('starts with the defaults of schema_create and posts the changed fields', async () => {
    const created = { data: { ...item('Bike', 'p1').data, id: '8' } };
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, parentSchema('create'))
      .on('POST', PARENT, created, 201);
    const { result } = render(() => useResourceForm(PARENT), backend);
    expect(result.current.status).toBe('loading');
    await ready(result);

    expect(result.current.fields.map((it) => it.name)).toEqual([
      'name', 'price', 'is_active', 'state', 'dt_created', 'parent', 'child_entities',
    ]);
    // the to-many relationship has no value: it is changed through useRelationship
    expect(result.current.values).toEqual({ price: null, is_active: true, state: 'new', parent: null });
    expect(result.current.dirty).toEqual([]);

    act(() => {
      result.current.setValue('name', 'Bike');
      result.current.setValue('parent', 'p1');
      result.current.setValue('is_active', true); // the default: not a change
    });
    expect(result.current.dirty).toEqual(['name', 'parent']);

    let saved: unknown;
    await act(async () => {
      saved = await result.current.submit();
    });
    expect(saved).toEqual(created);
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({
      data: {
        type: 'entity.parent_entity',
        attributes: { name: 'Bike' },
        relationships: { parent: { data: { type: 'entity.parent_entity', id: 'p1' } } },
      },
    });
    // saved: the form starts again
    expect(result.current.dirty).toEqual([]);
    expect(result.current.values.name).toBeUndefined();
  });

  it('gives the validation errors of a 422 by field and keeps the changes', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, parentSchema('create'))
      // the errors of a create of the sample without a title
      .on('POST', PARENT, sample.create_422, 422);
    const { result } = render(() => useResourceForm(PARENT), backend);
    await ready(result);
    act(() => {
      result.current.setValue('price', 5);
    });

    let saved: unknown;
    await act(async () => {
      saved = await result.current.submit();
    });
    expect(saved).toBeNull();
    await waitFor(() => {
      expect(result.current.errors).toEqual({ title: ['Field required'] });
    });
    expect(result.current.submitError?.message).toBe('Field required');
    expect(result.current.values.price).toBe(5);
    expect(result.current.dirty).toEqual(['price']);
  });
});

describe('useResourceForm with an id: an update', () => {
  function backend() {
    return new Backend()
      .on('GET', `${PARENT}7/schema_update/`, parentSchema('update'))
      .on('GET', `${PARENT}7/`, item('Bike', 'p1'));
  }

  it('starts with the item and patches only the changed fields', async () => {
    const server = backend().on('PATCH', `${PARENT}7/`, item('Car', null));
    const { result, queryClient } = render(() => useResourceForm(PARENT, { id: '7' }), server);
    await ready(result);
    expect(result.current.values).toEqual({
      name: 'Bike', price: 10, is_active: true, state: 'new', dt_created: '2026-10-07T10:00:00Z', parent: 'p1',
    });
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'item', '7', 'schema', 'update', 's1'],
      ['bazis', PARENT, 'item', '7', {}, 's1'],
    ]);

    act(() => {
      result.current.setValue('name', 'Car');
      result.current.setValue('parent', null);
      result.current.setValue('dt_created', '2000-01-01T00:00:00Z'); // read-only: never sent
    });
    server.on('GET', `${PARENT}7/`, item('Car', null));
    server.calls.length = 0;
    await act(async () => {
      await result.current.submit();
    });

    expect(server.calls[0]).toEqual({
      method: 'PATCH',
      url: `https://api.test${PARENT}7/`,
      body: {
        data: {
          type: 'entity.parent_entity',
          id: '7',
          attributes: { name: 'Car' },
          relationships: { parent: { data: null } },
        },
      },
    });
    // the item and its schema are refetched before the submit resolves
    expect(server.requests('GET').sort()).toEqual([`GET ${PARENT}7/`, `GET ${PARENT}7/schema_update/`]);
    await waitFor(() => {
      expect(result.current.values.name).toBe('Car');
    });
    expect(result.current.dirty).toEqual([]);
  });

  it('forgets the changes on reset and for another item', async () => {
    const server = backend()
      .on('GET', `${PARENT}8/schema_update/`, parentSchema('update'))
      .on('GET', `${PARENT}8/`, { data: { ...item('Boat', null).data, id: '8' } });
    const { result, rerender } = render(
      ({ id }: { id: string }) => useResourceForm(PARENT, { id }),
      server,
      undefined,
      { id: '7' },
    );
    await ready(result);
    act(() => {
      result.current.setValue('name', 'Car');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.values.name).toBe('Bike');

    act(() => {
      result.current.setValue('name', 'Car');
    });
    rerender({ id: '8' });
    await waitFor(() => {
      expect(result.current.values.name).toBe('Boat');
    });
    expect(result.current.dirty).toEqual([]);
  });

  it('reports the error of loading the item', async () => {
    const server = new Backend()
      .on('GET', `${PARENT}7/schema_update/`, parentSchema('update'))
      .on('GET', `${PARENT}7/`, { errors: [{ status: 404, detail: 'Not found' }] }, 404);
    const { result } = render(() => useResourceForm(PARENT, { id: '7' }), server);
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error?.message).toBe('Not found');
  });
});
