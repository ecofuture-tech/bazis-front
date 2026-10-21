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

// A page with the top bar of `AppShell` for the tests of its row in a browser
// (`assets/playwright/test/shell.spec.ts`, served by Vite with the aliases of
// `vitest.config.ts` and the Tailwind of a product): the links that the row has no room for
// in its menu, what jsdom does not lay out. The query sets the number of the links `links`
// (`s<n>`, at `/s<n>`), the group `reports` after the tenth link (`group=true`: `report`,
// which requires to view the route set of the test, and `item-new`, to add to it), the number
// of the other links of the group that the backend allows, `more` (`report-<n>`), and the
// path shown first, `path`; the backend is the route of the test.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';

import { createClient } from '@/bazis/client';
import { LanguageProvider } from '@/bazis/i18n';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';
import { AppShell, Screen, type NavEntry } from '@/bazis/ui/app-shell';

/** The route set that the test answers. */
const ITEMS = '/api/test/item/';

const query = new URLSearchParams(window.location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

const links: NavEntry[] = Array.from({ length: Number(query.get('links') ?? '0') }, (_, index) => ({
  screen: `s${String(index + 1)}`,
  label: `Screen ${String(index + 1)}`,
  to: `/s${String(index + 1)}`,
}));
if (query.get('group') === 'true') {
  const more = Array.from({ length: Number(query.get('more') ?? '0') }, (_, index) => ({
    screen: `report-${String(index + 2)}`,
    label: `Report ${String(index + 2)}`,
    to: `/report-${String(index + 2)}`,
    requires: { path: ITEMS },
  }));
  links.splice(10, 0, {
    group: 'reports',
    label: 'Reports',
    items: [
      { screen: 'report', label: 'Report', to: '/report', requires: { path: ITEMS } },
      { screen: 'item-new', label: 'New item', to: '/items/new', requires: { path: ITEMS, can: 'add' } },
      ...more,
    ],
  });
}

/** The path that the router shows. */
function Path() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test" language="en">
          <MemoryRouter initialEntries={[query.get('path') ?? '/']}>
            <AppShell title="Product" navigation="topbar" items={links} session={{ user: 'manager', onLogout: () => undefined }}>
              <Screen id="page" title="Page">
                <Path />
              </Screen>
            </AppShell>
          </MemoryRouter>
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
