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

// A page with `RelationPicker` for the tests of the helpers of the end-to-end tests in a
// browser (`assets/playwright/test/picker.spec.ts`, served by Vite with the aliases of
// `vitest.config.ts`): the focus of Radix and the display of an empty list, which jsdom does
// not have. The query sets `searchable` and `nullable`; the backend is the route of the test.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';

import { createClient } from '@/bazis/client';
import { LanguageProvider } from '@/bazis/i18n';
import type { paths } from '@/bazis/generated/schema';
import { BazisProvider } from '@/bazis/react';
import { RelationPicker } from '@/bazis/ui/resource';

/** The route set that the test answers. */
const ITEMS = '/api/test/item/';

const query = new URLSearchParams(window.location.search);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const api = createClient<paths>({ baseUrl: window.location.origin, language: 'en' });

function Page() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <RelationPicker
        relation="test.item"
        path={ITEMS}
        data-bz="field:owner"
        aria-label="Owner"
        value={value}
        searchable={query.get('searchable') === 'true'}
        nullable={query.get('nullable') !== 'false'}
        onChange={setValue}
      />
      <output data-testid="value">{value ?? ''}</output>
      <button type="submit" data-bz="action:submit">
        Save
      </button>
    </form>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    // English, the default store of the provider
    <LanguageProvider>
      <QueryClientProvider client={queryClient}>
        <BazisProvider client={api} session="test" language="en">
          <Page />
        </BazisProvider>
      </QueryClientProvider>
    </LanguageProvider>,
  );
}
