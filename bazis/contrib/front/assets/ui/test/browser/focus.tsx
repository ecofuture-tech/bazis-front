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

// A page of a dashboard in focus for the tests of its layout in a browser
// (`assets/playwright/test/shell.spec.ts`, served by Vite with the aliases of
// `vitest.config.ts` and the Tailwind of a product), what jsdom does not lay out: the chart in
// focus, the rail of the tiles, the charts and the last items, each of the route set of the test
// or, the part named by the query `hide`, of a route set that the backend does not let the user
// view (the test answers both).

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { createClient } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';
import { LanguageProvider } from '@/bazis/i18n';
import { BazisProvider } from '@/bazis/react';
import { Dashboard, Viewable } from '@/bazis/ui/dashboard';

const hide = new URLSearchParams(window.location.search).get('hide');
/** The route set of a part: one that the user may not view for the part `hide`. */
const path = (part: string) => (part === hide ? '/api/test/hidden/' : '/api/test/item/') as never;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test" language="en">
          <MemoryRouter>
            <Dashboard
              hero={false}
              links={[]}
              focus={
                <Viewable path={path('focus')}>
                  <div data-testid="focus" className="h-80" />
                </Viewable>
              }
              tiles={['a', 'b', 'c'].map((id) => ({ id, path: path('tiles'), label: id }))}
              charts={['d', 'e'].map((id) => (
                <Viewable key={id} path={path('charts')}>
                  <div data-testid={`chart-${id}`} className="h-40" />
                </Viewable>
              ))}
              recent={[{ id: 'items', path: path('recent'), label: 'Items', columns: ['title'] }]}
            />
          </MemoryRouter>
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
