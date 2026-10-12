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

import { vi } from 'vitest';

/** The base URL of the clients of the tests. */
export const BASE = 'https://api.test';

/** A request that the mocked fetch received. */
export interface Call {
  url: string;
  init: RequestInit;
}

/**
 * A mocked fetch that records its calls and answers with the responses in their order, then
 * with an empty response of the status `rest`.
 */
export function recordingFetch(responses: Response[], rest = 500) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), init: init ?? {} });
    return Promise.resolve(responses.shift() ?? new Response(null, { status: rest }));
  });
  return { fetch, calls };
}
