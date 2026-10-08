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
// is logged in: adopted at the login, saved at every change.

import { getToken, onSessionChange } from '@/app/session';
import { CAPABILITIES, LANGUAGE, LANGUAGES, ROUTES } from '@/bazis/generated/contract';
import { createLanguageStore, followProfileLanguage, type ProfileResource } from '@/bazis/i18n';
import type { Api } from '@/bazis/react';

export const languageStore = createLanguageStore({ languages: LANGUAGES, fallback: LANGUAGE });

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
const PROFILE: ProfileResource | null = (() => {
  const users = CAPABILITIES.users;
  if (!users?.profile_language) return null;
  const path = (ROUTES as Readonly<Record<string, string | undefined>>)[users.user_resource];
  return path === undefined ? null : { path, type: users.user_resource };
})();

/**
 * Makes the language follow the profile of the user who is logged in, from now and at every
 * login (nothing without a language of the users); returns the unsubscribe function.
 */
export function followSessionLanguage(api: Api): () => void {
  if (PROFILE === null) return () => undefined;
  const profile = PROFILE;
  let stop: () => void = () => undefined;
  const follow = () => {
    stop();
    const token = getToken();
    stop = token === null ? () => undefined : followProfileLanguage(languageStore, api, profile, token);
  };
  follow();
  const unsubscribe = onSessionChange(follow);
  return () => {
    unsubscribe();
    stop();
  };
}
