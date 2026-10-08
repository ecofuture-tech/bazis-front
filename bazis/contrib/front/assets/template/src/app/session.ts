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
 * The logins of bazis-authing in a page of their service (`GET`: Google), opened in a window:
 * a button each on the login screen. The services with another body than the password are
 * not offered.
 */
export const WINDOW_LOGINS: readonly AuthAction[] = LOGIN_ENABLED
  ? (AUTHING?.actions.filter((it) => it.method === 'GET') ?? [])
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
  throw new ApiError(401, state.errors.length ? state.errors : [{ status: 401, detail: 'The login did not succeed.' }]);
}

/**
 * Logs in with the username and the password and starts the session: the service
 * `password` of bazis-authing (in a new store of its auth endpoint), else the token endpoint
 * of bazis-users.
 */
export async function login(
  api: Api,
  credentials: { username: string; password: string },
): Promise<void> {
  const { users } = CAPABILITIES;
  if (users === null) throw new Error('The backend has no login: bazis-users is not installed.');
  if (AUTHING?.auth_url) {
    if (PASSWORD_ACTION === null) throw new Error('bazis-authing has no service password.');
    const start = await api.auth(AUTHING.auth_url);
    const state = start.status === 'signed_in' ? start : await api.authLogin(PASSWORD_ACTION.url, start.store, credentials);
    setToken(sessionToken(state));
    return;
  }
  const { access_token } = await api.login(credentials, { path: users.token_url });
  setToken(access_token);
}

/** How often the login in a window checks whether the user closed it, in milliseconds. */
export const WINDOW_CHECK_INTERVAL = 500;

/** The error of a login whose window the user closed before it ended. */
export const WINDOW_CLOSED = 'The window of the login was closed.';

/**
 * Logs in with a service of bazis-authing whose page is opened in a window (Google): a new
 * store of its auth endpoint, the page of the service with the store token, then the auth
 * endpoint is asked until the store is signed in (the window is closed then), a login of the
 * store fails, the store expires or the user closes the window (the store is asked once
 * more: the login may have ended just before). The signal aborts it (the cancel of the login
 * screen). The window is opened at once: a browser blocks a window that a click does not
 * open.
 */
export async function loginInWindow(api: Api, action: AuthAction, signal?: AbortSignal): Promise<void> {
  if (AUTHING?.auth_url == null) throw new Error('The backend has no auth endpoint of bazis-authing.');
  const popup = window.open('', 'bazis-login', 'popup,width=520,height=680');
  if (popup === null) throw new Error('The browser blocked the window of the login: allow it and try again.');
  const closed = new Error(WINDOW_CLOSED);
  const stop = new AbortController();
  const cancel = () => {
    stop.abort(signal?.reason);
  };
  if (signal?.aborted) cancel();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setInterval(() => {
    if (popup.closed) stop.abort(closed);
  }, WINDOW_CHECK_INTERVAL);
  try {
    const { auth_url: authUrl, token_param: param } = AUTHING;
    const start = await api.auth(authUrl, { signal: stop.signal });
    if (start.status === 'signed_in') {
      setToken(start.user.token);
      return;
    }
    popup.location.href = `${action.url}?${new URLSearchParams({ [param]: start.store }).toString()}`;
    let state: AuthState;
    try {
      state = await api.authWait(authUrl, start.store, { signal: stop.signal });
    } catch (error) {
      if (stop.signal.reason !== closed) throw error;
      state = await api.auth(authUrl, { store: start.store });
      if (state.status !== 'signed_in') throw closed;
    }
    if (state.status === 'signed_out' && !state.errors.length) {
      throw new Error('The login has expired: try again.');
    }
    setToken(sessionToken(state));
  } finally {
    clearInterval(timer);
    signal?.removeEventListener('abort', cancel);
    popup.close();
  }
}

/** Ends the session; the router sends the user to the login screen. */
export function logout(): void {
  setToken(null);
}
