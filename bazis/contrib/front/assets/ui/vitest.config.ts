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

import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The components import the other assets as a product does (`@/bazis/...`, the shadcn/ui
// components of `@/components/ui/`, `@/lib/utils` of the template): here they are the
// assets next to them, and the contract and the theme of the sample of this repository
// (test/fixtures).
export default defineConfig({
  resolve: {
    alias: [
      { find: '@/bazis/client', replacement: here('../client/src/index.ts') },
      { find: '@/bazis/react/statusy', replacement: here('../react/src/statusy/index.ts') },
      { find: '@/bazis/react/uploadable', replacement: here('../react/src/uploadable/index.ts') },
      { find: '@/bazis/react/ws', replacement: here('../react/src/ws/index.ts') },
      { find: '@/bazis/react/async', replacement: here('../react/src/async/index.ts') },
      { find: '@/bazis/react/bg', replacement: here('../react/src/bg/index.ts') },
      { find: '@/bazis/react', replacement: here('../react/src/index.ts') },
      { find: '@/bazis/generated/contract', replacement: here('./test/fixtures/contract.ts') },
      { find: '@/bazis/generated/theme', replacement: here('./test/fixtures/theme.ts') },
      { find: /^@\/bazis\/ui\/(.*)$/, replacement: here('./$1') },
      { find: /^@\/components\/ui\/(.*)$/, replacement: here('./shadcn/$1') },
      { find: '@/lib/utils', replacement: here('../template/src/lib/utils.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
  },
});
