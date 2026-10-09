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

import { ApiError } from '@/bazis/client';

import { useAction, useItem, useItemAction, useList } from '../src/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, PARENT, render } from './support.js';

// the custom action `count` of the route set of the tasks of the sample: its response (the
// id of the task of bazis-bg it queued) and its errors, as the backend returns them
const COUNT = `${PARENT}count/`;

function screen(backend: Backend, invalidate?: boolean) {
  backend.on('GET', PARENT, { data: [], links: {}, meta: {} }).on('GET', `${PARENT}7/`, {
    data: { id: '7', type: 'entity.parent_entity', attributes: {}, relationships: {} },
  });
  return () => ({
    list: useList(PARENT),
    item: useItem(PARENT, '7'),
    count: useAction(PARENT, 'count', invalidate === undefined ? {} : { invalidate }),
    summary: useItemAction(PARENT, 'summary', { method: 'get', invalidate: false }),
  });
}

async function loaded(backend: Backend, invalidate?: boolean) {
  const rendered = render(screen(backend, invalidate), backend);
  await waitFor(() => {
    expect(rendered.result.current.list.isSuccess && rendered.result.current.item.isSuccess).toBe(true);
  });
  backend.calls.length = 0;
  return rendered;
}

describe('useAction', () => {
  it('posts the body, resolves to the response and refetches the resource', async () => {
    const backend = new Backend().on('POST', COUNT, sample.action_count);
    const { result } = await loaded(backend);
    let started: unknown;
    await act(async () => {
      started = await result.current.count.mutateAsync({ priority: 'high' });
    });
    // the id of the task of bazis-bg, for `TaskProgress`
    expect(started).toEqual({ task: '00000000-0000-0000-0000-000000000000' });
    expect(backend.calls[0]).toMatchObject({ method: 'POST', body: { priority: 'high' } });
    expect(backend.requests()).toEqual([`POST ${COUNT}`, `GET ${PARENT}`, `GET ${PARENT}7/`]);
    expect(result.current.count.errors).toEqual({});
  });

  it('refetches nothing with invalidate: false', async () => {
    const backend = new Backend().on('POST', COUNT, sample.action_count);
    const { result } = await loaded(backend, false);
    await act(async () => {
      await result.current.count.mutateAsync({});
    });
    expect(backend.requests()).toEqual([`POST ${COUNT}`]);
  });

  it('gives the errors of the body by field, and the error of the request', async () => {
    const backend = new Backend().on('POST', COUNT, sample.action_count_422, 422);
    const { result } = await loaded(backend);
    act(() => {
      result.current.count.mutate({ priority: null });
    });
    await waitFor(() => {
      expect(result.current.count.isError).toBe(true);
    });
    expect(result.current.count.errors).toEqual({ priority: ['<detail>'] });
    expect(backend.requests()).toEqual([`POST ${COUNT}`]);

    // an anonymous user: an error of the request, of no field
    backend.on('POST', COUNT, sample.action_count_403, 403);
    act(() => {
      result.current.count.mutate({});
    });
    await waitFor(() => {
      expect((result.current.count.error as ApiError | null)?.status).toBe(403);
    });
    expect(result.current.count.error).toBeInstanceOf(ApiError);
    expect(result.current.count.errors).toEqual({});
  });

  it('calls an action of an item with its method', async () => {
    const backend = new Backend().on('GET', `${PARENT}7/summary/`, { total: 3 });
    const { result } = await loaded(backend);
    let summary: unknown;
    await act(async () => {
      summary = await result.current.summary.mutateAsync({ id: '7' });
    });
    expect(summary).toEqual({ total: 3 });
    expect(backend.calls).toEqual([{ method: 'GET', url: `https://api.test${PARENT}7/summary/`, body: undefined }]);
  });
});
