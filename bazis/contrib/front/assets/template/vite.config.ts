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

/// <reference types="vitest/config" />

import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type ProxyOptions } from 'vite';

import { CAPABILITIES } from './src/bazis/generated/contract';

// The npm libraries that every page loads, in chunks of their own (by the name of their
// package): the chunk of the entry keeps the code of the product, no chunk nears the limit of
// 500 kB of the warning of Vite, and the libraries stay cached across the releases of the
// product. Only the packages of the layout are listed: React with the router, TanStack Query,
// and the Radix primitives of the shell (the dialog of the sheet of the navigation, the
// popover of the notifications, the slot of the buttons) with what they use. Any other
// library (Leaflet, another Radix primitive, @tanstack/react-table) stays in the chunks of
// the screens that import it.
const RADIX = [
  'primitive',
  'react-compose-refs',
  'react-context',
  'react-dialog',
  'react-dismissable-layer',
  'react-focus-guards',
  'react-focus-scope',
  'react-id',
  'react-popover',
  'react-popper',
  'react-portal',
  'react-presence',
  'react-primitive',
  'react-slot',
  'react-use-callback-ref',
  'react-use-controllable-state',
  'react-use-effect-event',
  'react-use-escape-keydown',
  'react-use-layout-effect',
  'react-use-size',
];
const VENDOR_CHUNKS: [string, readonly string[]][] = [
  ['react', ['react', 'react-dom', 'scheduler', 'react-router', 'cookie', 'set-cookie-parser']],
  ['query', ['@tanstack/react-query', '@tanstack/query-core']],
  [
    'radix',
    [
      'radix-ui',
      ...RADIX.map((name) => `@radix-ui/${name}`),
      '@floating-ui/core',
      '@floating-ui/dom',
      '@floating-ui/react-dom',
      '@floating-ui/utils',
      'react-remove-scroll',
      'react-remove-scroll-bar',
      'react-style-singleton',
      'use-callback-ref',
      'use-sidecar',
      'aria-hidden',
      'get-nonce',
      'detect-node-es',
      'tslib',
    ],
  ],
];

function vendorChunk(id: string): string | undefined {
  const name = /.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1];
  return name === undefined ? undefined : VENDOR_CHUNKS.find(([, packages]) => packages.includes(name))?.[0];
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'BAZIS_');
  const backend = { target: env.BAZIS_API_URL ?? 'http://localhost:8000', changeOrigin: true };
  const proxy: Record<string, ProxyOptions> = { '/api': backend, '/media': backend };
  if (CAPABILITIES.ws?.path) proxy[CAPABILITIES.ws.path] = { ...backend, ws: true };
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: { proxy },
    preview: { proxy },
    build: { rollupOptions: { output: { manualChunks: vendorChunk } } },
    // e2e/ is Playwright (`npm run e2e`)
    test: { environment: 'jsdom', exclude: ['**/node_modules/**', 'dist/**', '.bazis/**', 'e2e/**'] },
    // the cache of the optimized dependencies: node_modules/.vite, but that of the dev server of
    // the end-to-end tests (BAZIS_VITE_CACHE_DIR of playwright.config.ts)
    cacheDir: env.BAZIS_VITE_CACHE_DIR,
  };
});
