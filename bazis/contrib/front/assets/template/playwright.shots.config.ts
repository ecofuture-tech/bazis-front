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

// The screenshots of the screens: e2e/generated/shots.ts, generated and run by
// `manage.py bazis_front shots`, which gathers their checks into .scratch/shots/report.json;
// see AGENTS.md. The frontend, the backend and the test users are those of the end-to-end
// tests (playwright.config.ts): the screens are only read, so the shots run in parallel.

import { defineConfig, devices } from '@playwright/test';

import e2e from './playwright.config';

export default defineConfig({
  ...e2e,
  testDir: 'e2e/generated',
  testMatch: 'shots.ts',
  workers: undefined,
  // a login of up to 15 s on the cold server of Vite (`loginAs`), then the screen and its checks
  timeout: 60_000,
  reporter: 'list',
  // the screenshots are the output: no trace of the runs
  use: { ...e2e.use, trace: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'phone',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
});
