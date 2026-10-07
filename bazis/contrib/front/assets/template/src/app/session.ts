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

import type { BazisClient } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import type { paths } from '@/bazis/generated/schema';

/** The key of the token in localStorage: the session survives a reload. */
const STORAGE_KEY = 'bazis.token';

const listeners = new Set<() => void>();
let token: string | null = readStored();

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setToken(value: string | null): void {
  token = value;
  try {
    if (value === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // no storage (private mode): the token lives in memory until the page is closed
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
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
  return useSyncExternalStore(subscribe, getToken);
}

/** Gets a token from the token endpoint of bazis-users and starts the session. */
export async function login(
  api: BazisClient<paths>,
  credentials: { username: string; password: string },
): Promise<void> {
  const { access_token } = await api.login(credentials, { path: CAPABILITIES.users.token_url });
  setToken(access_token);
}

/** Ends the session; the router sends the user to the login screen. */
export function logout(): void {
  setToken(null);
}
