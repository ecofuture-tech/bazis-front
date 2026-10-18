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
    // the to-many relationship starts without related items
    expect(result.current.values).toEqual({
      price: null, is_active: true, state: 'new', parent: null, child_entities: [],
    });
    expect(result.current.dirty).toEqual([]);

    act(() => {
      result.current.setValue('name', 'Bike');
      result.current.setValue('parent', 'p1');
      result.current.setValue('child_entities', ['c1', 'c2']);
      result.current.setValue('is_active', true); // the default: not a change
    });
    expect(result.current.dirty).toEqual(['name', 'parent', 'child_entities']);

    let saved: unknown;
    await act(async () => {
      saved = await result.current.submit();
    });
    expect(saved).toEqual(created);
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({
      data: {
        type: 'entity.parent_entity',
        attributes: { name: 'Bike' },
        // a to-many relationship with every related item
        relationships: {
          parent: { data: { type: 'entity.parent_entity', id: 'p1' } },
          child_entities: {
            data: [
              { type: 'entity.child_entity', id: 'c1' },
              { type: 'entity.child_entity', id: 'c2' },
            ],
          },
        },
      },
    });
    // saved: the form starts again
    expect(result.current.dirty).toEqual([]);
    expect(result.current.values.name).toBeUndefined();
  });

  it('gives the validation errors of a 422 by field and keeps the changes', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, parentSchema('create'))
      // the errors of a create of the sample without a title (their messages replaced)
      .on('POST', PARENT, sample.create_422, 422);
    const { result, session, rerender } = render(() => useResourceForm(PARENT), backend);
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
      expect(result.current.errors).toEqual({ title: ['<detail>'] });
    });
    expect(result.current.submitError?.message).toBe('<detail>');
    expect(result.current.values.price).toBe(5);
    expect(result.current.dirty).toEqual(['price']);
    // in the language of the interface: `errorMessage` of the provider
    session.errorMessage = (error) => `${error.code ?? ''}:${error.title ?? ''}`;
    rerender();
    expect(result.current.errors).toEqual({ title: ['ERR_VALIDATE:missing'] });
  });
});

describe('useResourceForm with fixed values', () => {
  it('creates the item with the fixed relationship, whatever is set', async () => {
    // an item added from the card of its parent: the screen fixes the parent
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, parentSchema('create'))
      .on('POST', PARENT, { data: { ...item('Bike', 'p1').data, id: '8' } }, 201);
    const { result, rerender } = render(
      ({ parent }: { parent: string }) => useResourceForm(PARENT, { fixed: { parent } }),
      backend,
      undefined,
      { parent: 'p1' },
    );
    await ready(result);
    expect(result.current.values.parent).toBe('p1');
    expect(result.current.dirty).toEqual(['parent']);
    act(() => {
      result.current.setValue('name', 'Bike');
      result.current.setValue('parent', 'p9');
    });
    // a new object of the same values at every render keeps the form as it is
    rerender({ parent: 'p1' });
    expect(result.current.values).toMatchObject({ name: 'Bike', parent: 'p1' });
    await act(async () => {
      await result.current.submit();
    });
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({
      data: {
        type: 'entity.parent_entity',
        attributes: { name: 'Bike' },
        relationships: { parent: { data: { type: 'entity.parent_entity', id: 'p1' } } },
      },
    });
  });

  it('does not send a fixed value that the item already has, nor a read-only field', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}7/schema_update/`, parentSchema('update'))
      .on('GET', `${PARENT}7/`, item('Bike', 'p1'))
      .on('PATCH', `${PARENT}7/`, item('Car', 'p1'));
    const { result } = render(
      () => useResourceForm(PARENT, { id: '7', fixed: { parent: 'p1', dt_created: '2000-01-01T00:00:00Z' } }),
      backend,
    );
    await ready(result);
    act(() => {
      result.current.setValue('name', 'Car');
    });
    expect(result.current.dirty).toEqual(['name', 'dt_created']);
    await act(async () => {
      await result.current.submit();
    });
    expect(backend.calls.find((it) => it.method === 'PATCH')?.body).toEqual({
      data: { type: 'entity.parent_entity', id: '7', attributes: { name: 'Car' }, relationships: {} },
    });
  });
});

describe('useResourceForm with initial values', () => {
  it('starts a create with them, sends them as changes and lets the user change them', async () => {
    // a create from the day of a calendar: the screen gives the value, the user may change it
    const backend = new Backend()
      .on('GET', `${PARENT}schema_create/`, parentSchema('create'))
      .on('POST', PARENT, { data: { ...item('Bike', null).data, id: '8' } }, 201);
    const { result, rerender } = render(
      ({ price }: { price: number }) => useResourceForm(PARENT, { initial: { price, is_active: true } }),
      backend,
      undefined,
      { price: 20 },
    );
    await ready(result);
    expect(result.current.values).toMatchObject({ price: 20, is_active: true });
    // the default of the schema is no change
    expect(result.current.dirty).toEqual(['price']);
    act(() => {
      result.current.setValue('price', 25);
    });
    // a new object of the same values at every render keeps the change of the user
    rerender({ price: 20 });
    expect(result.current.values.price).toBe(25);
    // forgetting the changes of the user starts again with the initial values
    act(() => {
      result.current.reset();
    });
    expect(result.current.values.price).toBe(20);
    act(() => {
      result.current.setValue('name', 'Bike');
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(backend.calls.find((it) => it.method === 'POST')?.body).toEqual({
      data: { type: 'entity.parent_entity', attributes: { price: 20, name: 'Bike' }, relationships: {} },
    });
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
      child_entities: ['c1'],
    });
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'item', '7', 'schema', 'update', 's1'],
      ['bazis', PARENT, 'item', '7', {}, 's1'],
    ]);

    act(() => {
      result.current.setValue('name', 'Car');
      result.current.setValue('parent', null);
      // every related item removed: an empty list
      result.current.setValue('child_entities', []);
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
          relationships: { parent: { data: null }, child_entities: { data: [] } },
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

  it('does not send a to-many relationship that the user did not change', async () => {
    // the relationship is sent with all its items only when it changed: the items linked
    // meanwhile by others stay
    const server = backend().on('PATCH', `${PARENT}7/`, item('Car', 'p1'));
    const { result } = render(() => useResourceForm(PARENT, { id: '7' }), server);
    await ready(result);
    expect(result.current.type).toBe('entity.parent_entity');
    act(() => {
      result.current.setValue('name', 'Car');
      // the same items: not a change
      result.current.setValue('child_entities', ['c1']);
    });
    expect(result.current.dirty).toEqual(['name']);
    await act(async () => {
      await result.current.submit();
    });
    expect(server.calls.find((it) => it.method === 'PATCH')?.body).toEqual({
      data: { type: 'entity.parent_entity', id: '7', attributes: { name: 'Car' }, relationships: {} },
    });
  });

  it('gives the errors of an update that the schema refuses by field', async () => {
    // the sample (bazis 2.11): `/data/attributes/title` with the id and type of the item
    const server = backend().on('PATCH', `${PARENT}7/`, sample.update_422, 422);
    const { result } = render(() => useResourceForm(PARENT, { id: '7' }), server);
    await ready(result);
    act(() => {
      result.current.setValue('name', 'Car');
    });
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => {
      expect(result.current.errors).toEqual({ title: ['<detail>'] });
    });
    expect(result.current.dirty).toEqual(['name']);
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

  it('forgets the errors of a submit on reset and for another item', async () => {
    const invalid = { errors: [{ status: 422, detail: 'Too long', source: { pointer: '/data/attributes/name' } }] };
    const server = backend()
      .on('PATCH', `${PARENT}7/`, invalid, 422)
      .on('GET', `${PARENT}8/schema_update/`, parentSchema('update'))
      .on('GET', `${PARENT}8/`, { data: { ...item('Boat', null).data, id: '8' } });
    const { result, rerender } = render(
      ({ id }: { id: string }) => useResourceForm(PARENT, { id }),
      server,
      undefined,
      { id: '7' },
    );
    const failed = async () => {
      await ready(result);
      act(() => {
        result.current.setValue('name', 'x'.repeat(300));
      });
      await act(async () => {
        await result.current.submit();
      });
      await waitFor(() => {
        expect(result.current.errors).toEqual({ name: ['Too long'] });
      });
    };

    await failed();
    act(() => {
      result.current.reset();
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.submitError).toBeNull();

    await failed();
    rerender({ id: '8' });
    // not even for one render
    expect(result.current.errors).toEqual({});
    expect(result.current.submitError).toBeNull();
    await ready(result);
    // nor when coming back to the item
    rerender({ id: '7' });
    expect(result.current.errors).toEqual({});
    expect(result.current.submitError).toBeNull();
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
