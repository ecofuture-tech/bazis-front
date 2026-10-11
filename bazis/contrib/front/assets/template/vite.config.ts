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
// product. A library that only a lazy chunk imports (Leaflet) is in none of them.
const VENDOR_CHUNKS: [string, RegExp][] = [
  ['react', /^(react|react-dom|scheduler|react-router|cookie|set-cookie-parser)$/],
  ['query', /^@tanstack\//],
  [
    'radix',
    /^(radix-ui|@radix-ui\/.*|@floating-ui\/.*|react-remove-scroll.*|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|get-nonce|detect-node-es|tslib)$/,
  ],
];

function vendorChunk(id: string): string | undefined {
  const name = /.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(id)?.[1];
  return name === undefined ? undefined : VENDOR_CHUNKS.find(([, packages]) => packages.test(name))?.[0];
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
  };
});
