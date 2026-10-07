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

import { useItem, useList } from '../src/index.js';
import { transits, useTransit, useTransits } from '../src/statusy/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, PARENT, render } from './support.js';

const META = `?meta=state_actions`;

// the retrieve of the sample in `draft`: the transit `start`, without a payload
const draft = sample.retrieve_draft;
// in `in_progress`: `finish`, whose action takes a typed payload
const inProgress = sample.retrieve_in_progress;

describe('transits', () => {
  it('reads the transits of state_actions', () => {
    expect(transits(draft)).toEqual([
      {
        id: 'start',
        allowed: true,
        restricts: [],
        payload: null,
        hint: null,
        hintTitle: null,
        hintAction: null,
        resource: { type: 'tasks.task', id: draft.data.id },
        related: [],
      },
    ]);
    const [finish] = transits(inProgress);
    expect(finish?.id).toBe('finish');
    // standalone: its definitions come with it
    expect(finish?.payload).toMatchObject({
      properties: { report: { title: 'Report', type: 'string' } },
      required: ['report'],
      type: 'object',
      $defs: expect.any(Object) as unknown,
    });
  });

  it('reads the restrictions and the transits of related items', () => {
    const [action] = draft.meta.state_actions;
    const restricted = {
      ...action,
      restricts: [{ title: 'Not paid', code: 'ERR_TRANSIT', detail: 'The order is not paid', meta: null }],
    };
    const child = { ...action, resource: { type: 'tasks.subtask', id: '9' } };
    const [first] = transits({ meta: { state_actions: [[restricted, child]] } });
    expect(first).toMatchObject({ id: 'start', allowed: false, restricts: restricted.restricts });
    expect(first?.related).toMatchObject([{ id: 'start', resource: { type: 'tasks.subtask', id: '9' } }]);
    expect(transits({ data: {} } as never)).toEqual([]);
  });
});

describe('useTransits', () => {
  it('reads them from the retrieve with meta state_actions, shared with useItem', async () => {
    const backend = new Backend().on('GET', `${PARENT}7/${META}`, draft);
    const { result, queryClient } = render(
      () => ({
        transits: useTransits(PARENT, '7'),
        item: useItem(PARENT, '7', { meta: ['state_actions'] as never }),
      }),
      backend,
    );
    await waitFor(() => {
      expect(result.current.transits.isSuccess).toBe(true);
    });
    expect(result.current.transits.data?.map((it) => it.id)).toEqual(['start']);
    expect(backend.requests()).toEqual([`GET ${PARENT}7/${META}`]);
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'item', '7', { meta: ['state_actions'] }, 's1'],
    ]);
  });
});

describe('useTransit', () => {
  const useScreen = () => ({
    list: useList(PARENT),
    transits: useTransits(PARENT, '7'),
    transit: useTransit(PARENT, '7'),
  });

  async function loaded(backend: Backend) {
    backend.on('GET', PARENT, { data: [], links: {}, meta: {} }).on('GET', `${PARENT}7/${META}`, draft);
    const rendered = render(useScreen, backend);
    await waitFor(() => {
      expect(rendered.result.current.transits.isSuccess).toBe(true);
    });
    backend.calls.length = 0;
    return rendered;
  }

  it('posts the transit and refetches the resource', async () => {
    const backend = new Backend();
    const { result } = await loaded(backend);
    backend.on('POST', `${PARENT}7/transit/`, inProgress).on('GET', `${PARENT}7/${META}`, inProgress);

    let item: unknown;
    await act(async () => {
      item = await result.current.transit.mutateAsync({ transit: 'finish', payload: { report: 'Done' } });
    });
    expect(item).toEqual(inProgress);
    expect(backend.calls[0]).toMatchObject({
      method: 'POST',
      body: { transit: 'finish', payload: { report: 'Done' } },
    });
    expect(backend.requests()).toEqual([
      `POST ${PARENT}7/transit/`,
      `GET ${PARENT}`,
      `GET ${PARENT}7/${META}`,
    ]);
    await waitFor(() => {
      expect(result.current.transits.data?.map((it) => it.id)).toEqual(['finish']);
    });
  });

  it('resolves to null and removes the item when the user can no longer view it (204)', async () => {
    const backend = new Backend();
    const { result, queryClient } = await loaded(backend);
    backend.on('POST', `${PARENT}7/transit/`, undefined, 204);

    let item: unknown;
    await act(async () => {
      item = await result.current.transit.mutateAsync({ transit: 'start' });
    });
    expect(item).toBeNull();
    expect(backend.calls[0]?.body).toEqual({ transit: 'start' });
    expect(backend.requests()).toEqual([`POST ${PARENT}7/transit/`, `GET ${PARENT}`]);
    expect(cachedKeys(queryClient)).toEqual([['bazis', PARENT, 'list', {}, 's1']]);
  });
});
