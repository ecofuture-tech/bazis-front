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

import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { getToken, logout } from '@/app/session';
import { ApiError, createClient, type BazisClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

export type Api = BazisClient<paths>;

// The API is on the origin of the frontend: the dev server proxies /api (vite.config.ts).
const api: Api = createClient<paths>({ token: getToken });

const ApiContext = createContext<Api>(api);

/** The client of the backend, typed by the generated schema. */
export function useApi(): Api {
  return useContext(ApiContext);
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    // an expired or revoked token ends the session
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) logout();
      },
    }),
    defaultOptions: {
      // an error of the request (4xx) does not change on retry
      queries: {
        retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 3,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <ApiContext value={api}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiContext>
  );
}
