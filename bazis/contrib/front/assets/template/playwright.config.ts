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

// The end-to-end tests: those that `manage.py bazis_front e2e` generates from the scenarios of
// the specs (e2e/generated/, never edited) and those of the product (e2e/custom/), both with
// the helpers of e2e/bazis/. They run against the migrated backend with the data of
// `manage.py e2e_data` (the test users of the roles, with the password E2E_PASSWORD); see
// AGENTS.md.

import { defineConfig, devices } from '@playwright/test';

import { LANGUAGE } from './src/bazis/generated/contract';

/** The port of the dev server that the tests start: E2E_PORT, 5173 by default. */
const port = process.env.E2E_PORT ?? '5173';
/** The frontend under test: E2E_BASE_URL (a frontend already running), else that dev server. */
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['generated/**/*.spec.ts', 'custom/**/*.spec.ts'],
  forbidOnly: !!process.env.CI,
  // the scenarios share the database of the backend
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // the same texts on every machine: the times that the scenarios fill and read are in UTC
    // (the default time zone of Bazis, that of the data of `e2e_data`), and the interface is in
    // the default language of the backend (the languages of the browser would choose another)
    timezoneId: 'UTC',
    locale: LANGUAGE,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // the tests start their own dev server, never reuse one: a server already on the port fails
  // the run instead of being tested in place of this frontend (E2E_BASE_URL names a running
  // one). It is ready when the backend of BAZIS_API_URL (as for `npm run dev`) answers its
  // health check through the proxy. It optimizes the dependencies again as it starts
  // (`--force`), from every import of the sources: with the cache of a previous server, a
  // dependency that a screen imports since then (a chart, a board) would be optimized only
  // once a page imports it, and the dev server would reload the pages of the tests then.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort --force`,
        url: `${baseURL}/api/healthcheck`,
        reuseExistingServer: false,
      },
});
