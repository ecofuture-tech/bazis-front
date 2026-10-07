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

import { describe, expect, it } from 'vitest';

import { LOGIN_ENABLED, login, logout, onSessionChange } from '@/app/session';
import type { Api } from '@/bazis/react';

// a client whose token endpoint answers with the given token
const api = (token: string) =>
  ({ login: () => Promise.resolve({ access_token: token, token_type: 'bearer' }) }) as unknown as Api;
const credentials = { username: 'user', password: 'password' };

describe.skipIf(!LOGIN_ENABLED)('the session', () => {
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
