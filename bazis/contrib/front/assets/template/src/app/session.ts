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

import { useSyncExternalStore } from 'react';

import { t } from '@/app/language';
import { ApiError, type AuthAction, type AuthState } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import type { Api } from '@/bazis/react';

/** The key of the token in localStorage: the session survives a reload. */
const STORAGE_KEY = 'bazis.token';

/**
 * Users log in when the backend has bazis-users; without it there is no login and every
 * request is anonymous.
 */
export const LOGIN_ENABLED = CAPABILITIES.users !== null;

/** bazis-authing, when the backend routes its auth endpoint: its services log the users in. */
const AUTHING = CAPABILITIES.authing?.auth_url ? CAPABILITIES.authing : null;

/** The service `password` of bazis-authing. */
const PASSWORD_ACTION = AUTHING?.actions.find((it) => it.code === 'password' && it.method === 'POST') ?? null;

/**
 * Whether users log in with a username and a password: through the token endpoint of
 * bazis-users, or the service `password` of bazis-authing when the backend has it.
 */
export const PASSWORD_LOGIN = LOGIN_ENABLED && (AUTHING === null || PASSWORD_ACTION !== null);

/**
 * The logins of bazis-authing in a window of their service: Google, whose action is the
 * `POST` of its init (bazis-authing 2.8; the `GET` of an older one is not offered), a button
 * on the login screen. The services with another body than the password are not offered.
 */
export const WINDOW_LOGINS: readonly AuthAction[] = LOGIN_ENABLED
  ? (AUTHING?.actions.filter((it) => it.code === 'google' && it.method === 'POST') ?? [])
  : [];

const listeners = new Set<() => void>();
let token: string | null = LOGIN_ENABLED ? readStored() : null;
/** The number of the session in this page: every login and logout starts another one. */
let session = 0;

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setToken(value: string | null): void {
  // the same token is the same session: a logout without a session (an anonymous request
  // answered with 401) changes nothing, so that it does not refetch every query
  if (value === token) return;
  token = value;
  session += 1;
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // no storage (private mode): the token lives in memory until the page is closed
  }
  for (const listener of listeners) listener();
}

/** Calls the listener when the user logs in or out; returns the unsubscribe function. */
export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The token of the current session; the client reads it on every request. */
export function getToken(): string | null {
  return token;
}

/** The token of the current session; re-renders when the user logs in or out. */
export function useToken(): string | null {
  return useSyncExternalStore(onSessionChange, getToken);
}

function getSession(): string {
  return String(session);
}

/**
 * The current session, for `BazisProvider`: the query keys of the hooks end with it, so that
 * what one user loaded is never shown to the next one. It is not the token.
 */
export function useSession(): string {
  return useSyncExternalStore(onSessionChange, getSession);
}

/**
 * The session token of a store of bazis-authing that is signed in; else the errors of its
 * logins, as the error of the login.
 */
function sessionToken(state: AuthState): string {
  if (state.status === 'signed_in') return state.user.token;
  throw new ApiError(401, state.errors.length ? state.errors : [{ status: 401, detail: t('login.failed') }]);
}

/**
 * Logs in with the username and the password and starts the session: the service
 * `password` of bazis-authing (in a new store of its auth endpoint), else the token endpoint
 * of bazis-users.
 */
export async function login(api: Api, credentials: { username: string; password: string }): Promise<void> {
  const { users } = CAPABILITIES;
  if (users === null) throw new Error('The backend has no login: bazis-users is not installed.');
  if (AUTHING?.auth_url) {
    if (PASSWORD_ACTION === null) throw new Error('bazis-authing has no service password.');
    const start = await api.auth(AUTHING.auth_url);
    const state =
      start.status === 'signed_in' ? start : await api.authLogin(PASSWORD_ACTION.url, start.store, credentials);
    setToken(sessionToken(state));
    return;
  }
  const { access_token } = await api.login(credentials, { path: users.token_url });
  setToken(access_token);
}

/**
 * Logs in with a service of bazis-authing in a window (Google): a new store of its auth
 * endpoint, the init of the service in the store (`api.authInit`: a one-time ticket bound to
 * this browser by a cookie), the window at the URL of the ticket, then the auth endpoint is
 * asked until the store is signed in (the window is closed then), a login of the store fails
 * or the store expires (BAZIS_AUTH_COOKIE_LIFETIME). The signal aborts it: the cancel of the
 * login screen, which is also how a user who closed the window stops it. The window is
 * opened at once, before the init gives its URL: a browser blocks a window that a click does
 * not open. A failed init closes it.
 *
 * `popup.closed` is not read: the sign-in pages of Google send Cross-Origin-Opener-Policy,
 * after which the opener sees the window as closed while the user still signs in there.
 */
export async function loginInWindow(api: Api, action: AuthAction, signal?: AbortSignal): Promise<void> {
  if (AUTHING?.auth_url == null) throw new Error('The backend has no auth endpoint of bazis-authing.');
  const popup = window.open('', 'bazis-login', 'popup,width=520,height=680');
  if (popup === null) throw new Error(t('login.blocked'));
  try {
    const { auth_url: authUrl } = AUTHING;
    const options = signal ? { signal } : {};
    const start = await api.auth(authUrl, options);
    if (start.status === 'signed_in') {
      setToken(start.user.token);
      return;
    }
    const { url } = await api.authInit(action.url, start.store, options);
    popup.location.href = url;
    const state = await api.authWait(authUrl, start.store, options);
    if (state.status === 'signed_out' && !state.errors.length) {
      throw new Error(t('login.expired'));
    }
    setToken(sessionToken(state));
  } finally {
    popup.close();
  }
}

/**
 * Ends the session; the router sends the user to the login screen. Also the end of a session
 * that the backend no longer takes (a 401): nothing is sent.
 */
export function logout(): void {
  setToken(null);
}

/**
 * The sign-out of the user: ends the session at once and, with bazis-authing, posts to its
 * logout endpoint (`logout_url`), which deletes the stores and the store cookie that a login
 * may leave in the browser. The session token is stateless: the sign-out never waits for the
 * endpoint, and its failure changes nothing.
 */
export function signOut(api: Api): void {
  const url = CAPABILITIES.authing?.logout_url ?? null;
  logout();
  if (url !== null) void api.authLogout(url).catch(() => undefined);
}
