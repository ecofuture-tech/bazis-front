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
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/bazis/client';

import { ASYNC_POLL_INTERVAL, replayedResponse, resultPath, useAsyncRequest, useAsyncTask } from '../src/async/index.js';
import sample from './fixtures/sample.json' with { type: 'json' };
import { Backend, cachedKeys, PARENT, render } from './support.js';

// the result path of the contract of the sample, and the task of its request
const RESULT = '/api/v1/async_background_response/{task_id}/';
const TASK = sample.async_request_queued.meta.async_request_id;
const READ = `/api/v1/async_background_response/${TASK}/?full_response=true`;
const ITEM = `${PARENT}7/`;
const DOCUMENT = { data: { type: 'entity.parent_entity', id: '7', attributes: { name: 'Later' } } };

afterEach(() => {
  vi.useRealTimers();
});

describe('useAsyncRequest', () => {
  it('sends the request with the header: its task when it is queued', async () => {
    const backend = new Backend().on('PATCH', ITEM, sample.async_request_queued, 202);
    const { result } = render(() => useAsyncRequest(), backend);
    let start: unknown;
    await act(async () => {
      start = await result.current.mutateAsync({ method: 'PATCH', path: ITEM, body: DOCUMENT });
    });
    expect(start).toEqual({ status: 'queued', taskId: TASK });
    expect(backend.calls).toEqual([{ method: 'PATCH', url: `https://api.test${ITEM}`, body: DOCUMENT }]);
  });

  it('takes the response of a request run at once', async () => {
    const backend = new Backend().on('PATCH', ITEM, DOCUMENT);
    const { result } = render(() => useAsyncRequest(), backend);
    await act(async () => {
      await result.current.mutateAsync({ method: 'PATCH', path: ITEM, body: DOCUMENT });
    });
    expect(result.current.data).toEqual({ status: 'done', response: DOCUMENT });
  });
});

describe('useAsyncTask', () => {
  it('reads the task until it is done', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const backend = new Backend().on('GET', READ, sample.async_result_pending);
    const { result, queryClient } = render(() => useAsyncTask(RESULT, TASK), backend);
    await vi.waitFor(() => {
      expect(result.current.status).toBe('pending');
    });
    expect(result.current).toEqual({ status: 'pending', response: null, done: false, error: null });
    expect(cachedKeys(queryClient)).toEqual([['bazis', 'async_background', TASK, 's1']]);
    backend.on('GET', READ, sample.async_result_completed);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_POLL_INTERVAL);
    });
    expect(result.current).toEqual({
      status: 'completed',
      response: sample.async_result_completed.response,
      done: true,
      error: null,
    });
    // done: no longer read
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ASYNC_POLL_INTERVAL * 3);
    });
    expect(backend.requests('GET')).toHaveLength(2);
    expect(replayedResponse(result.current.response)).toMatchObject({ status: 200 });
  });

  it('reads nothing without a task, and reports an unknown task', async () => {
    const backend = new Backend().on('GET', READ, { errors: [{ status: 404, code: 'ERR_TASK_NOT_FOUND' }] }, 404);
    const { result, rerender } = render(({ id }: { id: string | null }) => useAsyncTask(RESULT, id), backend, undefined, {
      id: null as string | null,
    });
    expect(result.current).toEqual({ status: null, response: null, done: false, error: null });
    expect(backend.calls).toEqual([]);
    rerender({ id: TASK });
    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(ApiError);
    });
    expect((result.current.error as ApiError).status).toBe(404);
  });

  it('puts the id in the result path', () => {
    expect(resultPath(RESULT, 'a/b')).toBe('/api/v1/async_background_response/a%2Fb/');
  });
});

describe('replayedResponse', () => {
  it('reads the response of a replayed request, an HTTP error too', () => {
    const replayed = sample.async_result_completed.response;
    expect(replayedResponse(replayed)).toEqual(replayed);
    expect(replayedResponse({ ...replayed, status: 403 })?.status).toBe(403);
    expect(replayedResponse({ count: 1 })).toBeNull();
    expect(replayedResponse(null)).toBeNull();
  });
});
