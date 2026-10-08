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

import {
  getToken,
  login,
  loginInWindow,
  logout,
  onSessionChange,
  PASSWORD_LOGIN,
  WINDOW_CHECK_INTERVAL,
  WINDOW_CLOSED,
} from '@/app/session';
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

describe.skipIf(!CAPABILITIES.authing?.auth_url)('the login of bazis-authing in a window', () => {
  const authing = CAPABILITIES.authing;
  const GOOGLE = { code: 'google', name: 'Google', method: 'GET', url: '/api/v1/authing/google-auth-init/' };
  const signedOut = (store: string, errors: unknown[] = []) => Promise.resolve({ status: 'signed_out', store, errors });
  const signedIn = (token: string) => Promise.resolve({ status: 'signed_in', user: { token } });

  /** The window of the service: its location, closed by the login or by the user. */
  function openWindow(): { closed: boolean; location: { href: string }; close: () => void } {
    const popup = {
      closed: false,
      location: { href: '' },
      close() {
        popup.closed = true;
      },
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    return popup;
  }

  /** A wait for the store that ends only when it is aborted. */
  function waitForever(_path: string, _store: string, { signal }: { signal: AbortSignal }): Promise<never> {
    return new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        reject(signal.reason as Error);
      });
    });
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    logout();
  });

  it('opens the page of the service with the store and takes the session token', async () => {
    const popup = openWindow();
    const authWait = vi.fn(() => signedIn('google-session'));
    const api = { auth: () => signedOut('store'), authWait } as unknown as Api;
    await loginInWindow(api, GOOGLE);
    expect(popup.location.href).toBe(`${GOOGLE.url}?${authing?.token_param ?? ''}=store`);
    expect(authWait).toHaveBeenCalledWith(authing?.auth_url, 'store', { signal: expect.any(AbortSignal) as unknown });
    expect(getToken()).toBe('google-session');
    expect(popup.closed).toBe(true);
  });

  it('is cancelled by the signal', async () => {
    const popup = openWindow();
    const api = { auth: () => signedOut('store'), authWait: waitForever } as unknown as Api;
    const controller = new AbortController();
    const login = loginInWindow(api, GOOGLE, controller.signal).catch((error: unknown) => error);
    await vi.waitFor(() => {
      expect(popup.location.href).not.toBe('');
    });
    controller.abort();
    expect(await login).toMatchObject({ name: 'AbortError' });
    expect(popup.closed).toBe(true);
    expect(getToken()).toBeNull();
  });

  it('ends when the user closes the window, unless the store was signed in just before', async () => {
    vi.useFakeTimers();
    for (const [last, result] of [
      [signedOut('store'), WINDOW_CLOSED],
      [signedIn('late-session'), undefined],
    ] as const) {
      const popup = openWindow();
      const auth = vi.fn().mockReturnValueOnce(signedOut('store')).mockReturnValueOnce(last);
      const api = { auth, authWait: waitForever } as unknown as Api;
      const login = loginInWindow(api, GOOGLE).then(() => undefined, (error: unknown) => (error as Error).message);
      await vi.advanceTimersByTimeAsync(0);
      popup.closed = true;
      await vi.advanceTimersByTimeAsync(WINDOW_CHECK_INTERVAL);
      expect(await login).toBe(result);
      // the store is asked once more with its token
      expect(auth).toHaveBeenLastCalledWith(authing?.auth_url, { store: 'store' });
    }
    expect(getToken()).toBe('late-session');
  });

  it('fails when the store expires or its login fails', async () => {
    openWindow();
    const expired = { auth: () => signedOut('store'), authWait: () => signedOut('another') } as unknown as Api;
    await expect(loginInWindow(expired, GOOGLE)).rejects.toThrow('The login has expired');

    openWindow();
    const failed = {
      auth: () => signedOut('store'),
      authWait: () => signedOut('store', [{ status: 422, code: 'GOOGLE_AUTH_ERROR', detail: 'Google authentication failed' }]),
    } as unknown as Api;
    await expect(loginInWindow(failed, GOOGLE)).rejects.toThrow('Google authentication failed');
    expect(getToken()).toBeNull();
  });

  it('needs its window', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const auth = vi.fn();
    await expect(loginInWindow({ auth } as unknown as Api, GOOGLE)).rejects.toThrow('blocked the window');
    expect(auth).not.toHaveBeenCalled();
  });
});
