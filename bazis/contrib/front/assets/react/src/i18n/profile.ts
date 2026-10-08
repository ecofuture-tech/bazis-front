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

// The language of the profile of the user: with a text attribute `language` of the user
// resource (`profile_language` of the capability `users` of the contract), the language of
// the interface follows the user from device to device. At a login the interface adopts the
// language of the profile (or saves its own when the profile has none), and a change of the
// language is saved to the profile. Without it the language is kept in the browser only.
// The user is found by the username of the session token (`sub` of the JWT of bazis-users):
// a user who is not staff reads and changes only himself.

import { Filter } from '@/bazis/client';
import type { Api } from '@/bazis/react';

import { matchLanguage, type LanguageStore } from './language.js';

/** The operations of the client used here, with plain paths: the only cast of the profile. */
interface ProfileClient {
  list(
    path: string,
    options: { filter: Filter; page: { limit: number } },
  ): Promise<{ data: readonly { id: string | number; attributes?: Readonly<Record<string, unknown>> }[] }>;
  update(path: string, id: string, document: unknown): Promise<unknown>;
}

/** The user resource of the profile: its route set and its JSON:API type. */
export interface ProfileResource {
  path: string;
  type: string;
}

/** The profile of the user: the id of his item and his language (null: none chosen). */
export interface Profile {
  id: string;
  language: string | null;
}

/** The username of a session token of bazis-users (`sub` of its JWT); null for another token. */
export function tokenSubject(token: string): string | null {
  const payload = token.split('.')[1];
  if (payload === undefined) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub ? sub : null;
  } catch {
    return null;
  }
}

/** The profile of the user of this username; null when the user is not found. */
export async function readProfile(api: Api, resource: ProfileResource, username: string): Promise<Profile | null> {
  const client = api as unknown as ProfileClient;
  const { data } = await client.list(resource.path, { filter: Filter.where('username', username), page: { limit: 1 } });
  const item = data[0];
  if (item === undefined) return null;
  const language = item.attributes?.language;
  return { id: String(item.id), language: typeof language === 'string' && language ? language : null };
}

/** Saves the language to the profile: a PATCH of the attribute `language` of the user. */
export async function saveProfileLanguage(
  api: Api,
  resource: ProfileResource,
  id: string,
  language: string,
): Promise<void> {
  const client = api as unknown as ProfileClient;
  await client.update(resource.path, id, { data: { type: resource.type, id, attributes: { language } } });
}

/**
 * Makes the language of the store follow the profile of the user of the session token
 * while it lasts: adopts the language of the profile (or saves the current one when the
 * profile has none), then saves every change of the language. Returns the function that
 * stops it (a logout). A failure of the backend leaves the language in the browser only.
 */
export function followProfileLanguage(
  store: LanguageStore,
  api: Api,
  resource: ProfileResource,
  token: string,
): () => void {
  let stopped = false;
  let profile: Profile | null = null;
  let adopting = false;
  const save = (language: string) => {
    if (profile !== null) void saveProfileLanguage(api, resource, profile.id, language).catch(() => undefined);
  };
  const unsubscribe = store.subscribe(() => {
    if (!adopting) save(store.get());
  });
  const username = tokenSubject(token);
  if (username !== null) {
    readProfile(api, resource, username)
      .then((found) => {
        if (stopped || found === null) return;
        profile = found;
        const language = matchLanguage(store.languages, found.language);
        if (language === null) {
          save(store.get());
          return;
        }
        adopting = true;
        try {
          store.set(language);
        } finally {
          adopting = false;
        }
      })
      .catch(() => undefined);
  }
  return () => {
    stopped = true;
    unsubscribe();
  };
}
