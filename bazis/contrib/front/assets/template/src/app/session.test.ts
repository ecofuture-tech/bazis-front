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

import { t } from '@/app/language';
import { getToken, login, loginInWindow, logout, onSessionChange, PASSWORD_LOGIN, signOut } from '@/app/session';
import { ApiError, type AuthAction } from '@/bazis/client';
import { CAPABILITIES, type Capabilities } from '@/bazis/generated/contract';
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

describe.skipIf(!PASSWORD_LOGIN)('the sign-out', () => {
  it('ends the session at once and posts to the logout endpoint of bazis-authing', async () => {
    const authLogout = vi.fn(() => Promise.reject(new TypeError('offline')));
    await login(api('signed-in'), credentials);
    signOut({ authLogout } as unknown as Api);
    // the token is dropped whatever the endpoint answers
    expect(getToken()).toBeNull();
    const url = CAPABILITIES.authing?.logout_url ?? null;
    expect(authLogout.mock.calls).toEqual(url === null ? [] : [[url]]);
    await Promise.resolve();
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
  const GOOGLE = { code: 'google', name: 'Google', method: 'POST', url: '/api/v1/authing/google-auth-init/' };
  /** The answer of the init of the service: the URL of the window with a ticket, not the store. */
  const WINDOW = `${GOOGLE.url}?ticket=ticket`;
  const authInit = () => Promise.resolve({ ticket: 'ticket', url: WINDOW });
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
    logout();
  });

  it('opens the window at the URL of the init of the store and takes the session token', async () => {
    const popup = openWindow();
    const init = vi.fn(authInit);
    const authWait = vi.fn(() => signedIn('google-session'));
    const api = { auth: () => signedOut('store'), authInit: init, authWait } as unknown as Api;
    await loginInWindow(api, GOOGLE);
    expect(init).toHaveBeenCalledWith(GOOGLE.url, 'store', {});
    expect(popup.location.href).toBe(WINDOW);
    expect(authWait).toHaveBeenCalledWith(authing?.auth_url, 'store', {});
    expect(getToken()).toBe('google-session');
    expect(popup.closed).toBe(true);
  });

  it('is cancelled by the signal', async () => {
    const popup = openWindow();
    const api = { auth: () => signedOut('store'), authInit, authWait: waitForever } as unknown as Api;
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

  it('keeps asking the store when the window looks closed (Cross-Origin-Opener-Policy)', async () => {
    const popup = openWindow();
    let finish: (state: unknown) => void = () => undefined;
    const authWait = vi.fn(() => new Promise((resolve) => (finish = resolve)));
    const api = { auth: () => signedOut('store'), authInit, authWait } as unknown as Api;
    const login = loginInWindow(api, GOOGLE);
    await vi.waitFor(() => {
      expect(authWait).toHaveBeenCalled();
    });
    // the page of Google severs the window from the opener: it looks closed meanwhile
    popup.closed = true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    finish({ status: 'signed_in', user: { token: 'google-session' } });
    await login;
    expect(getToken()).toBe('google-session');
  });

  it('is stopped by the cancel only, also when the window is closed', async () => {
    const popup = openWindow();
    const api = { auth: () => signedOut('store'), authInit, authWait: waitForever } as unknown as Api;
    const controller = new AbortController();
    let settled = false;
    const login = loginInWindow(api, GOOGLE, controller.signal).catch((error: unknown) => {
      settled = true;
      return error;
    });
    await vi.waitFor(() => {
      expect(popup.location.href).not.toBe('');
    });
    popup.closed = true;
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(settled).toBe(false);
    controller.abort();
    expect(await login).toMatchObject({ name: 'AbortError' });
    expect(getToken()).toBeNull();
  });

  it('fails when the store expires or its login fails', async () => {
    openWindow();
    const expired = {
      auth: () => signedOut('store'),
      authInit,
      authWait: () => signedOut('another'),
    } as unknown as Api;
    await expect(loginInWindow(expired, GOOGLE)).rejects.toThrow(t('login.expired'));

    openWindow();
    const failed = {
      auth: () => signedOut('store'),
      authInit,
      authWait: () =>
        signedOut('store', [{ status: 422, code: 'GOOGLE_AUTH_ERROR', detail: 'Google authentication failed' }]),
    } as unknown as Api;
    await expect(loginInWindow(failed, GOOGLE)).rejects.toThrow('Google authentication failed');
    expect(getToken()).toBeNull();
  });

  it('closes the window when the init fails', async () => {
    const popup = openWindow();
    const authWait = vi.fn();
    const api = {
      auth: () => signedOut('store'),
      authInit: () => Promise.reject(new ApiError(401, [{ status: 401, detail: 'Token has been expired' }])),
      authWait,
    } as unknown as Api;
    await expect(loginInWindow(api, GOOGLE)).rejects.toMatchObject({ status: 401 });
    expect(popup.location.href).toBe('');
    expect(popup.closed).toBe(true);
    expect(authWait).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });

  it('needs its window', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const auth = vi.fn();
    await expect(loginInWindow({ auth } as unknown as Api, GOOGLE)).rejects.toThrow(t('login.blocked'));
    expect(auth).not.toHaveBeenCalled();
  });
});

describe('the logins in a window', () => {
  /** The codes of `WINDOW_LOGINS` of a backend with bazis-authing and these login actions. */
  async function windowLogins(actions: AuthAction[]): Promise<string[]> {
    vi.resetModules();
    vi.doMock('@/bazis/generated/contract', async (importOriginal) => {
      const contract = await importOriginal<{ CAPABILITIES: Capabilities }>();
      const users = { token_url: '/api/openapi-token/', user_resource: 'users.user', profile_language: false };
      const authing = { auth_url: '/api/v1/authing/auth/', logout_url: null, actions };
      return { ...contract, CAPABILITIES: { ...contract.CAPABILITIES, users, authing } };
    });
    const { WINDOW_LOGINS } = await import('@/app/session');
    return WINDOW_LOGINS.map((it) => it.code);
  }
  const action = (code: string, method: string) => ({ code, name: code, method, url: `/api/v1/authing/${code}/` });

  afterEach(() => {
    vi.doUnmock('@/bazis/generated/contract');
    vi.resetModules();
  });

  it('are the Google init of bazis-authing 2.8, not the GET of an older one nor an own service', async () => {
    expect(await windowLogins([action('password', 'POST'), action('google', 'POST'), action('own', 'POST')])).toEqual([
      'google',
    ]);
    expect(await windowLogins([action('password', 'POST'), action('google', 'GET')])).toEqual([]);
  });
});
