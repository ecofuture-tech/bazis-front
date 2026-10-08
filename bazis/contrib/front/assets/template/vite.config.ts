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
import { defineConfig, loadEnv } from 'vite';

// The dev server proxies `/api` to the backend: BAZIS_API_URL from the environment or from
// `.env.local`, http://localhost:8000 by default; and `/media`, the files of bazis-uploadable
// in the file system storage (MEDIA_URL), which the backend redirects to MEDIA_HOST_URL. The
// built frontend is served from the origin of the API. The tests run in jsdom (the contract
// tests of the components render them); the pristine copies of the assets in `.bazis/` are
// not tests of the product.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'BAZIS_');
  const backend = { target: env.BAZIS_API_URL ?? 'http://localhost:8000', changeOrigin: true };
  const proxy = { '/api': backend, '/media': backend };
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    server: { proxy },
    preview: { proxy },
    // e2e/ is Playwright (`npm run e2e`)
    test: { environment: 'jsdom', exclude: ['**/node_modules/**', 'dist/**', '.bazis/**', 'e2e/**'] },
  };
});
