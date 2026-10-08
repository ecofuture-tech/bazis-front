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

import { describe, expect, it } from 'vitest';

import { login, logout, onSessionChange, PASSWORD_LOGIN } from '@/app/session';
import { ApiError } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import type { Api } from '@/bazis/react';

// a client whose token endpoint (bazis-users) and password service (bazis-authing) answer
// with the given token
const api = (token: string) =>
  ({
    login: () => Promise.resolve({ access_token: token, token_type: 'bearer' }),
    auth: () => Promise.resolve({ status: 'signed_out', store: 'store', errors: [] }),
    authLogin: () => Promise.resolve({ status: 'signed_in', user: { token } }),
  }) as unknown as Api;
const credentials = { username: 'user', password: 'password' };

describe.skipIf(!PASSWORD_LOGIN)('the session', () => {
  it('changes only when the token changes', async () => {
    let changes = 0;
    const unsubscribe = onSessionChange(() => {
      changes += 1;
    });

    // no session yet: a logout (a 401 of an anonymous request) changes nothing
    logout();
    expect(changes).toBe(0);

    await login(api('a'), credentials);
    await login(api('a'), credentials);
    expect(changes).toBe(1);
    await login(api('b'), credentials);
    expect(changes).toBe(2);

    logout();
    logout();
    expect(changes).toBe(3);
    unsubscribe();
  });
});

describe.skipIf(!PASSWORD_LOGIN || !CAPABILITIES.authing?.auth_url)('the password login of bazis-authing', () => {
  it('logs in in a new store, and fails with the errors of the store', async () => {
    const calls: unknown[][] = [];
    const failing = {
      auth: (...args: unknown[]) => {
        calls.push(['auth', ...args]);
        return Promise.resolve({ status: 'signed_out', store: 'store', errors: [] });
      },
      authLogin: (...args: unknown[]) => {
        calls.push(['authLogin', ...args]);
        return Promise.resolve({
          status: 'signed_out',
          store: 'store',
          errors: [{ status: 422, code: 'USERNAME_PASSWORD_ERROR', detail: 'Credentials are invalid' }],
        });
      },
    } as unknown as Api;
    const error = await login(failing, credentials).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: 'Credentials are invalid' });
    const password = CAPABILITIES.authing?.actions.find((it) => it.code === 'password');
    expect(calls).toEqual([
      ['auth', CAPABILITIES.authing?.auth_url],
      ['authLogin', password?.url, 'store', credentials],
    ]);
  });
});
