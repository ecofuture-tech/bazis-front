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

import { MutationObserver, QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { clearOnLanguageChange, clearOnSessionChange } from '@/app/providers';
import { login, logout, PASSWORD_LOGIN } from '@/app/session';
import { createLanguageStore } from '@/bazis/i18n';
import type { Api } from '@/bazis/react';

// the token endpoint of bazis-users and the password service of bazis-authing
const api = {
  login: () => Promise.resolve({ access_token: 't', token_type: 'bearer' }),
  auth: () => Promise.resolve({ status: 'signed_out', store: 'store', errors: [] }),
  authLogin: () => Promise.resolve({ status: 'signed_in', user: { token: 't' } }),
} as unknown as Api;

describe.skipIf(!PASSWORD_LOGIN)('clearOnSessionChange', () => {
  it('drops the queries and the mutations when the user changes', async () => {
    const queryClient = new QueryClient();
    const unsubscribe = clearOnSessionChange(queryClient);
    const fill = async () => {
      // a query of the product's own, not keyed by the session
      queryClient.setQueryData(['me'], { username: 'user' });
      const mutation = new MutationObserver(queryClient, {
        mutationFn: (variables: { password: string }) => Promise.resolve(variables.password.length),
      });
      await mutation.mutate({ password: 'secret' });
    };

    await fill();
    // no session to end: nothing is dropped
    logout();
    expect(queryClient.getQueryData(['me'])).toEqual({ username: 'user' });

    await login(api, { username: 'user', password: 'password' });
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);

    await fill();
    logout();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(queryClient.getMutationCache().getAll()).toEqual([]);
    unsubscribe();
  });
});

describe('clearOnLanguageChange', () => {
  it('drops the queries when the language changes: the texts of the backend are in the language they were read in', () => {
    const store = createLanguageStore({
      languages: [
        { code: 'en', name: 'English' },
        { code: 'ru', name: 'Русский' },
      ],
      fallback: 'en',
      storage: null,
      preferred: [],
    });
    const queryClient = new QueryClient();
    const unsubscribe = clearOnLanguageChange(queryClient, store);
    queryClient.setQueryData(['schema'], { title: 'Title' });
    // the same language: nothing is dropped
    store.set('en');
    expect(queryClient.getQueryData(['schema'])).toEqual({ title: 'Title' });
    store.set('ru');
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    unsubscribe();
  });
});
