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

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { getToken, logout, useSession } from '@/app/session';
import { ApiError, createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider, type Api } from '@/bazis/react';

// The API is on the origin of the frontend: the dev server proxies /api (vite.config.ts).
const api: Api = createClient<paths>({ token: getToken });

// an expired or revoked token ends the session, whether a query or a mutation finds it out
function endSessionOn401(error: Error): void {
  if (error instanceof ApiError && error.status === 401) logout();
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: endSessionOn401 }),
    mutationCache: new MutationCache({ onError: endSessionOn401 }),
    defaultOptions: {
      // an error of the request (4xx) does not change on retry
      queries: {
        retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 3,
      },
    },
  });
}

/**
 * The query cache and the client of the backend for the hooks of `@/bazis/react` (`useApi()`
 * reads the client). The cached data belongs to the user who loaded it: every query key of
 * the hooks ends with the session, which changes when a user logs in or out.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const session = useSession();
  return (
    <QueryClientProvider client={queryClient}>
      <BazisProvider client={api} session={session}>
        {children}
      </BazisProvider>
    </QueryClientProvider>
  );
}
