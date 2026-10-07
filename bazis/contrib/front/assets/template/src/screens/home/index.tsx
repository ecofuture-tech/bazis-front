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

import { LOGIN_ENABLED, logout } from '@/app/session';
import { ROUTES } from '@/bazis/generated/contract';

/** The resources of the backend, from the generated contract. */
export function HomeScreen() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Resources</h1>
        {LOGIN_ENABLED && (
          <button type="button" onClick={logout} className="rounded-md border px-3 py-1.5 text-sm">
            Log out
          </button>
        )}
      </header>
      <ul className="divide-y rounded-lg border">
        {Object.entries(ROUTES).map(([type, path]) => (
          <li key={type} className="flex justify-between gap-4 px-4 py-3">
            <span className="font-medium">{type}</span>
            <code className="text-sm text-muted-foreground">{path}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
