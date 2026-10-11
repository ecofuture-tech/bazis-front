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

import { useAction, useActionQuery, useItem, useItemAction, useItemActionQuery, useList } from '../src/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, PARENT, render } from './support.js';

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

describe('useActionQuery', () => {
  it('reads an action of the route set with GET, refetched with its resource', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}report/`, { rows: 2 })
      .on('POST', COUNT, sample.action_count);
    const { result } = render(
      () => ({ report: useActionQuery(PARENT, 'report'), count: useAction(PARENT, 'count') }),
      backend,
    );
    await waitFor(() => {
      expect(result.current.report.data).toEqual({ rows: 2 });
    });
    expect(backend.calls).toEqual([{ method: 'GET', url: `https://api.test${PARENT}report/`, body: undefined }]);

    // an action of the resource changes it: the report is read again
    backend.calls.length = 0;
    backend.on('GET', `${PARENT}report/`, { rows: 3 });
    await act(async () => {
      await result.current.count.mutateAsync({});
    });
    await waitFor(() => {
      expect(result.current.report.data).toEqual({ rows: 3 });
    });
    expect(backend.requests()).toEqual([`POST ${COUNT}`, `GET ${PARENT}report/`]);
  });

  it('sends its query parameters, keyed by them, and reads nothing while they are null', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}check/?code=A1`, { valid: true })
      .on('GET', `${PARENT}check/?code=B2`, { valid: false });
    const { result, rerender, queryClient } = render(
      ({ code }: { code: string | null }) => useActionQuery(PARENT, 'check', { query: code === null ? null : { code } }),
      backend,
      undefined,
      { code: null as string | null },
    );
    // a form not submitted yet: nothing is read
    expect(result.current.fetchStatus).toBe('idle');
    expect(backend.calls).toEqual([]);

    rerender({ code: 'A1' });
    await waitFor(() => {
      expect(result.current.data).toEqual({ valid: true });
    });
    // other parameters are another query
    rerender({ code: 'B2' });
    await waitFor(() => {
      expect(result.current.data).toEqual({ valid: false });
    });
    expect(backend.requests()).toEqual([`GET ${PARENT}check/?code=A1`, `GET ${PARENT}check/?code=B2`]);
    expect(cachedKeys(queryClient)).toEqual([
      ['bazis', PARENT, 'action', 'check', null, 's1'],
      ['bazis', PARENT, 'action', 'check', { code: 'A1' }, 's1'],
      ['bazis', PARENT, 'action', 'check', { code: 'B2' }, 's1'],
    ]);
  });

  it('gives the error of the request', async () => {
    const backend = new Backend().on('GET', `${PARENT}report/`, sample.action_count_403, 403);
    const { result } = render(() => useActionQuery(PARENT, 'report'), backend);
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(403);
  });
});

describe('useItemActionQuery', () => {
  it('reads nothing without an item, then the action of the item', async () => {
    const backend = new Backend().on('GET', `${PARENT}7/summary/`, { total: 3 });
    const { result, rerender } = render(
      ({ id }: { id: string | null }) => useItemActionQuery(PARENT, id, 'summary'),
      backend,
      undefined,
      { id: null as string | null },
    );
    expect(result.current.fetchStatus).toBe('idle');
    expect(backend.calls).toEqual([]);

    rerender({ id: '7' });
    await waitFor(() => {
      expect(result.current.data).toEqual({ total: 3 });
    });
    expect(backend.calls).toEqual([{ method: 'GET', url: `https://api.test${PARENT}7/summary/`, body: undefined }]);
  });

  it('reads nothing while its query parameters are null', async () => {
    const backend = new Backend().on('GET', `${PARENT}7/summary/?currency=RUB`, { total: 3 });
    const loose = useItemActionQuery as unknown as (
      path: string,
      id: string | null,
      name: string,
      options: { query: Record<string, unknown> | null },
    ) => ReturnType<typeof useItemActionQuery>;
    const { result, rerender } = render(
      ({ query }: { query: Record<string, unknown> | null }) => loose(PARENT, '7', 'summary', { query }),
      backend,
      undefined,
      { query: null as Record<string, unknown> | null },
    );
    expect(result.current.fetchStatus).toBe('idle');
    rerender({ query: { currency: 'RUB', detail: undefined } });
    await waitFor(() => {
      expect(result.current.data).toEqual({ total: 3 });
    });
    expect(backend.requests()).toEqual([`GET ${PARENT}7/summary/?currency=RUB`]);
  });

  it('is refetched with its resource', async () => {
    const backend = new Backend()
      .on('GET', `${PARENT}7/summary/`, { total: 3 })
      .on('POST', COUNT, sample.action_count);
    const { result } = render(
      () => ({ summary: useItemActionQuery(PARENT, '7', 'summary'), count: useAction(PARENT, 'count') }),
      backend,
    );
    await waitFor(() => {
      expect(result.current.summary.data).toEqual({ total: 3 });
    });
    backend.calls.length = 0;
    backend.on('GET', `${PARENT}7/summary/`, { total: 4 });
    await act(async () => {
      await result.current.count.mutateAsync({});
    });
    await waitFor(() => {
      expect(result.current.summary.data).toEqual({ total: 4 });
    });
    expect(backend.requests()).toEqual([`POST ${COUNT}`, `GET ${PARENT}7/summary/`]);
  });
});
