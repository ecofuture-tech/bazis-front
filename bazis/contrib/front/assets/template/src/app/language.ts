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

// The language of the interface: one of `LANGUAGES` of the backend, chosen by the user
// (`LanguageToggle` of the layout), kept in the browser, else that of the browser, else the
// default language of the backend (`LANGUAGE`). The client sends it to the backend
// (`Accept-Language`), the query keys of the hooks end with it, and a change clears the
// cache (`src/app/providers.tsx`). When the users have a language of their own
// (`CAPABILITIES.users.profile_language`), the language follows the profile of the user who
// is logged in: adopted at the login, saved when the user changes it.

import { CAPABILITIES, LANGUAGE, LANGUAGES, ROUTES } from '@/bazis/generated/contract';
import {
  createLanguageStore,
  followProfileLanguage,
  translator,
  type LanguageStore,
  type ProfileResource,
} from '@/bazis/i18n';
import type { Api } from '@/bazis/react';
import { MESSAGES } from '@/i18n';

export const languageStore = createLanguageStore({ languages: LANGUAGES, fallback: LANGUAGE });

/** The texts of the current language outside the components: the errors of a login. */
export const t = translator(languageStore, MESSAGES);

/** The current language; the client reads it on every request. */
export function getLanguage(): string {
  return languageStore.get();
}

/** The `lang` of the page follows the language, for the screen readers and the hyphenation. */
function markPage(): void {
  document.documentElement.lang = languageStore.get();
}
markPage();
languageStore.subscribe(markPage);

/** The user resource that has the language of its users; null when they have none. */
export const PROFILE: ProfileResource | null = (() => {
  const users = CAPABILITIES.users;
  if (!users?.profile_language) return null;
  const path = (ROUTES as Readonly<Record<string, string | undefined>>)[users.user_resource];
  return path === undefined ? null : { path, type: users.user_resource };
})();

/** The session that the language follows: `getToken` and `onSessionChange` of `src/app/session.ts`. */
export interface LanguageSession {
  getToken: () => string | null;
  onSessionChange: (listener: () => void) => () => void;
}

/**
 * Makes the language follow the profile of the user who is logged in, from now and at every
 * login (nothing without a language of the users): `followProfileLanguage` for each
 * session, stopped at its end. Returns the unsubscribe function.
 */
export function followSessionLanguage(
  api: Api,
  session: LanguageSession,
  profile: ProfileResource | null = PROFILE,
  store: LanguageStore = languageStore,
): () => void {
  if (profile === null) return () => undefined;
  let stop: () => void = () => undefined;
  const follow = () => {
    stop();
    const token = session.getToken();
    stop = token === null ? () => undefined : followProfileLanguage(store, api, profile, token);
  };
  follow();
  const unsubscribe = session.onSessionChange(follow);
  return () => {
    unsubscribe();
    stop();
  };
}
