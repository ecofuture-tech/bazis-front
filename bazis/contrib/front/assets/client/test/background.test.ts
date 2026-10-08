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

import { describe, expect, it, vi } from 'vitest';

import { ApiError, BACKGROUND_HEADER, createClient } from '../src/index.js';
import type { paths } from './fixtures/schema.js';

const BASE = 'https://api.test';
const ITEM = '/api/v1/tasks/task/7f1c/';
const RESULT = '/api/v1/async_background_response/1b2c/';
const ACCEPT = 'application/vnd.api+json, application/json';
const TASK = '1b2c';

interface Call {
  url: string;
  init: RequestInit;
}

function setup(responses: Response[]) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init: init ?? {} });
    return Promise.resolve(responses.shift() ?? new Response(null, { status: 500 }));
  });
  const api = createClient<paths>({ baseUrl: BASE, fetch, token: 'session' });
  return { api, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const DOCUMENT = { data: { type: 'tasks.task', id: '7f1c', attributes: { title: 'Later' } } };

describe('background', () => {
  it('sends the request with the header and takes the task of a 202', async () => {
    const { api, calls } = setup([
      json({ data: null, meta: { async_request_id: TASK, async_background_id: TASK } }, 202),
    ]);
    await expect(api.background('PATCH', ITEM, { body: DOCUMENT })).resolves.toEqual({ status: 'queued', taskId: TASK });
    expect(BACKGROUND_HEADER).toBe('X-Async-Background');
    expect(calls).toEqual([
      {
        url: `${BASE}${ITEM}`,
        init: {
          method: 'PATCH',
          headers: {
            Accept: ACCEPT,
            'X-Async-Background': 'true',
            Authorization: 'Bearer session',
            'Content-Type': 'application/vnd.api+json',
          },
          body: JSON.stringify(DOCUMENT),
        },
      },
    ]);
  });

  it('takes the response of a request run at once (no Kafka)', async () => {
    const { api } = setup([json(DOCUMENT), new Response(null, { status: 204 })]);
    await expect(api.background('PATCH', ITEM, { body: DOCUMENT })).resolves.toEqual({ status: 'done', response: DOCUMENT });
    await expect(api.background('DELETE', ITEM)).resolves.toEqual({ status: 'done', response: undefined });
  });

  it('takes a 200 that looks like a queued task as a response', async () => {
    const body = { data: null, meta: { async_request_id: TASK } };
    const { api } = setup([json(body)]);
    await expect(api.background('POST', ITEM)).resolves.toEqual({ status: 'done', response: body });
  });

  it('sends no body without one', async () => {
    const { api, calls } = setup([json({ data: null, meta: { async_request_id: TASK } }, 202)]);
    await api.background('GET', ITEM);
    expect(calls[0]?.init).toEqual({
      method: 'GET',
      headers: { Accept: ACCEPT, 'X-Async-Background': 'true', Authorization: 'Bearer session' },
    });
  });

  it('throws the 401 of a request without a channel', async () => {
    const { api } = setup([json({ detail: 'No valid token found in request for channel name resolution.' }, 401)]);
    const error: unknown = await api.background('PATCH', ITEM, { body: DOCUMENT }).catch((it: unknown) => it);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });
});

describe('backgroundResult', () => {
  it('reads the status and the response of the task', async () => {
    const replayed = { task_id: TASK, endpoint: ITEM, status: 200, headers: [], response: DOCUMENT };
    const { api, calls } = setup([
      json({ status: 'pending', channel_name: 'user_ws::1', response: null }),
      json({ status: 'completed', channel_name: 'user_ws::1', response: replayed }),
    ]);
    await expect(api.backgroundResult(RESULT)).resolves.toEqual({ status: 'pending', response: null });
    await expect(api.backgroundResult(RESULT)).resolves.toEqual({ status: 'completed', response: replayed });
    expect(calls[0]).toEqual({
      url: `${BASE}${RESULT}?full_response=true`,
      init: { method: 'GET', headers: { Accept: ACCEPT, Authorization: 'Bearer session' } },
    });
  });

  it('throws the 404 of an unknown task and the 403 of another channel', async () => {
    const { api } = setup([
      json({ errors: [{ status: 404, code: 'ERR_TASK_NOT_FOUND', detail: 'Unknown task ID' }] }, 404),
      json({ errors: [{ status: 403, code: 'ERR_REQUEST' }] }, 403),
    ]);
    await expect(api.backgroundResult(RESULT)).rejects.toMatchObject({ status: 404 });
    await expect(api.backgroundResult(RESULT)).rejects.toMatchObject({ status: 403 });
  });
});
