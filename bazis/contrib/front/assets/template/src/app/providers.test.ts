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

import { clearOnSessionChange } from '@/app/providers';
import { LOGIN_ENABLED, login, logout } from '@/app/session';
import type { Api } from '@/bazis/react';

const api = { login: () => Promise.resolve({ access_token: 't', token_type: 'bearer' }) } as unknown as Api;

describe.skipIf(!LOGIN_ENABLED)('clearOnSessionChange', () => {
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
