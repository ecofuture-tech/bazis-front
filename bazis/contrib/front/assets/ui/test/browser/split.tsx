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


// A page of a list with its card beside it in the shell, with the theme of a product
// (`split.html`, `theme-lifted.css`), for the tests in a browser
// (`assets/playwright/test/shell.spec.ts`, served by Vite with the aliases of
// `vitest.config.ts` and the Tailwind of a product), what jsdom does not lay out: the rows of
// the list beside the card, Escape that closes it, the dialog of a changed form, the soft
// tones of the statuses, the row of the filters that keeps its lines, an unavailable primary button, the widths of the sidebar. The query: `path` shown first, `mode=dark` the dark mode, `filters` those of the list; the backend
// is the route of the test.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router';

import { createClient } from '@/bazis/client';
import type { Tone } from '@/bazis/generated/theme';
import { LanguageProvider } from '@/bazis/i18n';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';
import { AppShell, ListCardLayout, Screen } from '@/bazis/ui/app-shell';
import { SOFT_TONES } from '@/bazis/ui/resource';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

/** The route set that the test answers. */
const ITEMS = '/api/test/item/' as never;

const query = new URLSearchParams(window.location.search);
/** The filters of the list beside its search (`filters`: their fields, by commas). */
const FILTERS = query.get('filters')?.split(',');
if (query.get('mode') === 'dark') document.documentElement.classList.add('dark');
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

function List() {
  const navigate = useNavigate();
  return (
    <Screen id="item-list" title="Items">
      <ResourceList
        path={ITEMS}
        entity="item"
        columns={['title', 'note', 'place']}
        layout="table"
        {...(FILTERS === undefined ? {} : { search: true, filters: FILTERS })}
        onOpen={(id) => void navigate(`/items/${id}`)}
      />
    </Screen>
  );
}

function Card() {
  const [editing, setEditing] = useState(false);
  return (
    <Screen id="item-card" title="Item" parent={{ screen: 'item-list', label: 'Items', to: '/items' }}>
      <Button
        type="button"
        data-bz="action:edit"
        onClick={() => {
          setEditing(true);
        }}
      >
        Edit
      </Button>
      <FormSurface
        mode="dialog"
        open={editing}
        title="New item"
        onClose={() => {
          setEditing(false);
        }}
      >
        <ResourceForm path={ITEMS} fields={['title']} />
      </FormSurface>
    </Screen>
  );
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
          <MemoryRouter initialEntries={[query.get('path') ?? '/items']}>
            <AppShell title="Product" navigation="sidebar" items={[{ screen: 'item-list', label: 'Items', to: '/items' }]}>
              <Path />
              <div data-testid="tones" className="flex gap-2 bg-card p-2">
                {(Object.keys(SOFT_TONES) as Tone[]).map((tone) => (
                  <Badge key={tone} variant="soft" data-tone={tone} className={SOFT_TONES[tone]}>
                    {tone}
                  </Badge>
                ))}
                <Button type="button" disabled data-testid="unavailable">
                  Confirm
                </Button>
                <span data-testid="muted" className="bg-muted" />
              </div>
              <Routes>
                <Route path="/items" element={<ListCardLayout mode="split" list={<List />} />}>
                  <Route path=":id" element={<Card />} />
                </Route>
              </Routes>
            </AppShell>
          </MemoryRouter>
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
