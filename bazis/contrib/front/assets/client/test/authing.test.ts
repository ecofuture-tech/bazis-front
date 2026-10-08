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

import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, AUTH_POLL_INTERVAL, createClient } from '../src/index.js';
import type { paths } from './fixtures/schema.js';

const BASE = 'https://api.test';
const AUTH = '/api/v1/authing/auth/';
const PASSWORD = '/api/v1/authing/password/';
const ACCEPT = 'application/vnd.api+json, application/json';

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
  // the session token of the client is never sent to the auth endpoint
  const api = createClient<paths>({ baseUrl: BASE, fetch, token: 'session' });
  return { api, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ACTIONS = [{ code: 'password', name: 'Login/Password', url: PASSWORD, method: 'POST' }];

/** The answer of the auth endpoint to a store that is not signed in, with the errors of its logins. */
function signedOut(store: string, ...errors: { code: string; detail: string }[]) {
  return json(
    {
      errors: [
        { status: 401, code: 'UNAUTHORIZED', title: 'User is not authorized.', meta: { actions: ACTIONS, token: store } },
        ...errors.map((it) => ({ status: 422, title: 'Authentication error', ...it })),
      ],
    },
    400,
  );
}

const USER = {
  user_id: 'ea27a753-f6a9-442e-b7b6-bf03bee9339a',
  username: 'manager',
  first_name: '',
  last_name: '',
  email: '',
  token: 'session-jwt',
  logout_actions: null,
};

describe('auth', () => {
  it('starts a store without cookies and without the session token', async () => {
    const { api, calls } = setup([signedOut('store-1')]);
    await expect(api.auth(AUTH)).resolves.toEqual({ status: 'signed_out', store: 'store-1', errors: [] });
    expect(calls).toEqual([{ url: `${BASE}${AUTH}`, init: { method: 'GET', headers: { Accept: ACCEPT }, credentials: 'omit' } }]);
  });

  it('reads the state of a store with its token', async () => {
    const { api, calls } = setup([json(USER)]);
    await expect(api.auth(AUTH, { store: 'store-1' })).resolves.toEqual({ status: 'signed_in', user: USER });
    expect(calls[0]?.init.headers).toEqual({ Accept: ACCEPT, Authorization: 'Bearer store-1' });
  });

  it('throws the other errors', async () => {
    const { api } = setup([json({ errors: [{ status: 500, detail: 'Server error' }] }, 500)]);
    await expect(api.auth(AUTH)).rejects.toBeInstanceOf(ApiError);
  });
});

describe('authLogin', () => {
  it('posts the body in the store and reads the state its redirect answers', async () => {
    const { api, calls } = setup([json(USER)]);
    const credentials = { username: 'manager', password: 'secret' };
    await expect(api.authLogin(PASSWORD, 'store-1', credentials)).resolves.toEqual({ status: 'signed_in', user: USER });
    expect(calls).toEqual([
      {
        url: `${BASE}${PASSWORD}`,
        init: {
          method: 'POST',
          headers: { Accept: ACCEPT, Authorization: 'Bearer store-1', 'Content-Type': 'application/json' },
          credentials: 'omit',
          body: JSON.stringify(credentials),
        },
      },
    ]);
  });

  it('returns the errors of the login', async () => {
    const { api } = setup([signedOut('store-1', { code: 'USERNAME_PASSWORD_ERROR', detail: 'Credentials are invalid' })]);
    await expect(api.authLogin(PASSWORD, 'store-1', {})).resolves.toEqual({
      status: 'signed_out',
      store: 'store-1',
      errors: [
        { status: 422, title: 'Authentication error', code: 'USERNAME_PASSWORD_ERROR', detail: 'Credentials are invalid' },
      ],
    });
  });

  it('throws when the store has expired', async () => {
    const { api } = setup([json({ errors: [{ status: 401, detail: 'Token has been expired' }] }, 401)]);
    await expect(api.authLogin(PASSWORD, 'store-1', {})).rejects.toMatchObject({ status: 401 });
  });
});

describe('authWait', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks the auth endpoint until the store is signed in', async () => {
    vi.useFakeTimers();
    const { api, calls } = setup([signedOut('store-1'), signedOut('store-1'), json(USER)]);
    const waiting = api.authWait(AUTH, 'store-1');
    await vi.advanceTimersByTimeAsync(AUTH_POLL_INTERVAL - 1);
    expect(calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(3 * AUTH_POLL_INTERVAL);
    await expect(waiting).resolves.toEqual({ status: 'signed_in', user: USER });
    expect(calls).toHaveLength(3);
    expect(calls.every((it) => (it.init.headers as Record<string, string>).Authorization === 'Bearer store-1')).toBe(true);
  });

  it('stops at an error of a login and when the store has expired', async () => {
    vi.useFakeTimers();
    const failed = setup([signedOut('store-1', { code: 'GOOGLE_AUTH_ERROR', detail: 'Google authentication failed' })]);
    const waiting = failed.api.authWait(AUTH, 'store-1', { interval: 10 });
    await vi.advanceTimersByTimeAsync(10);
    await expect(waiting).resolves.toMatchObject({ status: 'signed_out', errors: [{ code: 'GOOGLE_AUTH_ERROR' }] });

    const expired = setup([signedOut('store-2')]);
    const again = expired.api.authWait(AUTH, 'store-1', { interval: 10 });
    await vi.advanceTimersByTimeAsync(10);
    await expect(again).resolves.toEqual({ status: 'signed_out', store: 'store-2', errors: [] });
  });

  it('rejects when aborted', async () => {
    vi.useFakeTimers();
    const { api, calls } = setup([]);
    const controller = new AbortController();
    const waiting = api.authWait(AUTH, 'store-1', { signal: controller.signal }).catch((error: unknown) => error);
    controller.abort();
    expect(await waiting).toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });
});
