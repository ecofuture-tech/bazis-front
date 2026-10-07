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

// The query keys of the hooks. A key starts with `['bazis', path]`, so that a change of a
// resource invalidates all its queries, and ends with the session, so that the cached data
// of a user is never read in the session of another one.

import type { Filter } from '@/bazis/client';

/** The options of a list or a retrieve, as they are in a key. */
export interface QueryOptions {
  filter?: Filter | undefined;
  search?: string | undefined;
  sort?: readonly string[] | undefined;
  page?: { limit?: number; offset?: number } | undefined;
  fields?: Readonly<Record<string, readonly string[] | undefined>> | undefined;
  include?: readonly string[] | undefined;
  meta?: readonly string[] | undefined;
}

// a filter is in a key as its expression; absent options are left out
function options({ filter, ...rest }: QueryOptions): Record<string, unknown> {
  const result: Record<string, unknown> = filter ? { filter: filter.toString() } : {};
  for (const [name, value] of Object.entries(rest as Record<string, unknown>)) {
    if (value !== undefined) result[name] = value;
  }
  return result;
}

export const keys = {
  /** Every query of a resource. */
  resource: (path: string) => ['bazis', path] as const,
  /** Every query of an item: its retrieves, its schemas. */
  item: (path: string, id: string) => ['bazis', path, 'item', id] as const,
  list: (path: string, query: QueryOptions, session: string) =>
    ['bazis', path, 'list', options(query), session] as const,
  retrieve: (path: string, id: string, query: QueryOptions, session: string) =>
    ['bazis', path, 'item', id, options(query), session] as const,
  collectionSchema: (path: string, kind: string, session: string) =>
    ['bazis', path, 'schema', kind, session] as const,
  itemSchema: (path: string, id: string, kind: string, session: string) =>
    ['bazis', path, 'item', id, 'schema', kind, session] as const,
  filterFields: (path: string, session: string) =>
    ['bazis', path, 'filter-fields', session] as const,
};
