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

// The tests of the helpers in this repository, against pages served by the tests themselves.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'test',
  forbidOnly: !!process.env.CI,
  // the negative cases wait for the expectations to fail
  expect: { timeout: 1500 },
  use: { baseURL: 'http://bazis.test' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
