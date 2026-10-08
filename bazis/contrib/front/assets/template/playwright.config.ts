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

/** The frontend under test; without E2E_BASE_URL, the dev server (`/api` goes to BAZIS_API_URL). */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'e2e',
  testMatch: ['generated/**/*.spec.ts', 'custom/**/*.spec.ts'],
  forbidOnly: !!process.env.CI,
  // the scenarios share the database of the backend
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev -- --port 5173 --strictPort', url: baseURL, reuseExistingServer: true },
});
