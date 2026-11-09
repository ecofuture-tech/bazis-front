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

// A page of a card, the summary of a card, an outline button and an input for the tests of the
// surfaces in a browser
// (`assets/playwright/test/shell.spec.ts`, served by Vite with the aliases of
// `vitest.config.ts` and the Tailwind of a product): what the theme of the page
// (`surfaces-lifted.html`, `surfaces-elevated.html`) computes for them, beside the classes of a
// block, of a control and of a field of 0.12 (`data-testid="was-*"`).

import { createRoot } from 'react-dom/client';

import { LanguageProvider } from '@/bazis/i18n';
import type { Fields } from '@/bazis/ui/resource';
import { Summary } from '@/bazis/ui/resource-card/summary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

/** The fields of the summary: every one shown, its title its name. */
const FIELDS: Fields = { fields: new Map(), title: (name) => name, ready: true, loaded: true, has: () => true };

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <main className="grid max-w-xl gap-6 bg-background p-8">
      <Card className="p-6">Card</Card>
      <LanguageProvider>
        <Summary
          summary={{ figure: 'total', meta: ['note'] }}
          item={{ id: '1', type: 'test.item' }}
          fields={FIELDS}
          values={{ total: () => '3600', note: () => 'Two tents' }}
          display={{}}
        />
      </LanguageProvider>
      <div data-testid="was-card" className="rounded-xl border bg-card p-6 shadow-xs">
        Card
      </div>
      <Button variant="outline">Button</Button>
      <button type="button" data-testid="was-button" className="h-9 rounded-md border bg-background px-4 shadow-xs">
        Button
      </button>
      <Input aria-label="Input" />
      <input aria-label="Was" data-testid="was-input" className="h-9 rounded-md border border-input px-3 shadow-xs" />
    </main>,
  );
}
