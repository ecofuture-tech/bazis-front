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

// A page of a board in the shell, with the theme of a product (`board.html`,
// `theme-lifted.css`), for the tests in a browser (`assets/playwright/test/shell.spec.ts`,
// served by Vite with the aliases of `vitest.config.ts` and the Tailwind of a product), what
// jsdom does not lay out: the widths of its columns. The query: `columns`, their number (of
// five statuses), `navigation=topbar` the top bar instead of the sidebar, `move=true` the drag
// and drop of `BoardDnd`; the backend is the route of the test.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';

import { createClient } from '@/bazis/client';
import { LanguageProvider } from '@/bazis/i18n';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';
import { AppShell, Screen } from '@/bazis/ui/app-shell';
import { BoardDnd } from '@/bazis/ui/board-dnd';
import { ResourceBoard } from '@/bazis/ui/resource-board';

/** The route set that the test answers. */
const ITEMS = '/api/test/item/' as never;

const query = new URLSearchParams(window.location.search);
const COLUMNS = ['draft', 'review', 'approved', 'done', 'archived'].slice(0, Number(query.get('columns') ?? '4'));
const move = query.get('move') === 'true';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

const board = <ResourceBoard path={ITEMS} entity="item" columns={COLUMNS} title="title" move={move} />;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test" language="en">
          <MemoryRouter initialEntries={['/board']}>
            <AppShell
              title="Product"
              navigation={query.get('navigation') === 'topbar' ? 'topbar' : 'sidebar'}
              items={[{ screen: 'item-board', label: 'Board', to: '/board' }]}
            >
              <Screen id="item-board" title="Board">
                {move ? <BoardDnd>{board}</BoardDnd> : board}
              </Screen>
            </AppShell>
          </MemoryRouter>
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
