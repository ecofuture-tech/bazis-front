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

import { followSessionLanguage, languageStore } from '@/app/language';
import { LANGUAGES } from '@/bazis/generated/contract';
import { createLanguageStore } from '@/bazis/i18n';
import type { Api } from '@/bazis/react';
import { MESSAGES } from '@/i18n';
import { PRODUCT_NAME } from '@/screens/generated/product';

const PROFILE = { path: '/api/v1/users/user/', type: 'users.user' };

/** A session JWT of bazis-users of this username (only its `sub` is read). */
function token(username: string): string {
  return `header.${btoa(JSON.stringify({ sub: username })).replace(/=+$/, '')}.signature`;
}

/** A session of `src/app/session.ts`: the token, changed by `login` and `logout`. */
function session() {
  let current: string | null = null;
  const listeners = new Set<() => void>();
  const change = (value: string | null) => {
    current = value;
    for (const listener of listeners) listener();
  };
  return {
    getToken: () => current,
    onSessionChange: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    login: (username: string) => {
      change(token(username));
    },
    logout: () => {
      change(null);
    },
  };
}

/** A client whose user list has the user of each username, with his language. */
function client(languages: Readonly<Record<string, string | null>>) {
  const list = vi.fn((_path: string, options: { filter: { toString(): string } }) => {
    const username = options.filter.toString().replace('username=', '');
    return Promise.resolve({ data: [{ id: username, attributes: { language: languages[username] ?? null } }] });
  });
  const update = vi.fn<(path: string, id: string, document: unknown) => Promise<unknown>>(() => Promise.resolve({}));
  return { api: { list, update } as unknown as Api, list, update };
}

const store = () =>
  createLanguageStore({
    languages: [
      { code: 'en', name: 'English' },
      { code: 'ru', name: 'Русский' },
    ],
    fallback: 'en',
    storage: null,
    preferred: [],
  });

describe('followSessionLanguage', () => {
  it('does nothing when the users have no language of their own', () => {
    const { api, list } = client({});
    const current = session();
    current.login('manager');
    followSessionLanguage(api, current, null, store())();
    expect(list).not.toHaveBeenCalled();
  });

  it('adopts the language of the profile at every login and saves the changes of the user while the session lasts', async () => {
    const { api, list, update } = client({ manager: 'ru', viewer: null });
    const current = session();
    const languages = store();
    const stop = followSessionLanguage(api, current, PROFILE, languages);
    // no session: nothing is read
    expect(list).not.toHaveBeenCalled();

    current.login('manager');
    await vi.waitFor(() => {
      expect(languages.get()).toBe('ru');
    });
    expect(update).not.toHaveBeenCalled();
    languages.set('en');
    expect(update).toHaveBeenCalledWith(PROFILE.path, 'manager', {
      data: { type: 'users.user', id: 'manager', attributes: { language: 'en' } },
    });

    // the next user has no language: it is not written, his changes are
    current.logout();
    current.login('viewer');
    await vi.waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
    await Promise.resolve();
    expect([languages.get(), update.mock.calls.length]).toEqual(['en', 1]);
    languages.set('ru');
    expect(update.mock.calls.at(-1)?.[1]).toBe('viewer');

    // after a logout the changes are no longer saved
    current.logout();
    languages.set('en');
    stop();
    current.login('manager');
    expect(list).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });
});

describe('the page', () => {
  it('is titled by the name of the product in the language of the interface', () => {
    const before = languageStore.get();
    for (const { code } of LANGUAGES) {
      languageStore.set(code);
      expect(document.documentElement.lang).toBe(code);
      expect(document.title).toBe(MESSAGES[code]?.[PRODUCT_NAME] ?? MESSAGES[languageStore.fallback]?.[PRODUCT_NAME]);
    }
    languageStore.set(before);
  });
});
