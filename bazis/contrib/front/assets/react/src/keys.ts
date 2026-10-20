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
// resource invalidates all its queries, and ends with the scope (the session and the
// language of `BazisProvider`), so that the cached data of a user is never read in the
// session of another one, nor the texts of the backend in another language.

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
  aggregate?: readonly string[] | undefined;
  group?: string | undefined;
}

// a filter is in a key as its expression; absent options are left out
function options({ filter, ...rest }: QueryOptions): Record<string, unknown> {
  const result: Record<string, unknown> = filter ? { filter: filter.toString() } : {};
  for (const [name, value] of Object.entries(rest as Record<string, unknown>)) {
    if (value !== undefined) result[name] = value;
  }
  return result;
}

/** Query parameters of a custom action; null for those not known yet (no request). */
type ActionParams = Readonly<Record<string, unknown>> | null | undefined;

/** The query parameters of a custom action, as they are in a key: those the client sends. */
function parameters(query: ActionParams): Record<string, unknown> | null {
  if (query === null) return null;
  const result: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) result[name] = value;
  }
  return result;
}

/** The second item of the keys of the tasks of bazis-async-background: not a path. */
const ASYNC_TASKS = 'async_background';

/**
 * The first item of the keys of the content of the files (`useDownloadUrl`): not under
 * `['bazis']`, so that no invalidation of the hooks reads a file again (a file of an item is
 * not changed: another file is another item).
 */
const FILES = 'bazis-files';

export const keys = {
  /** Every query of the hooks. */
  all: ['bazis'] as const,
  /** Every query of a resource. */
  resource: (path: string) => ['bazis', path] as const,
  /** Every query of an item: its retrieves, its schemas. */
  item: (path: string, id: string) => ['bazis', path, 'item', id] as const,
  list: (path: string, query: QueryOptions, scope: string) =>
    ['bazis', path, 'list', options(query), scope] as const,
  retrieve: (path: string, id: string, query: QueryOptions, scope: string) =>
    ['bazis', path, 'item', id, options(query), scope] as const,
  collectionSchema: (path: string, kind: string, scope: string) =>
    ['bazis', path, 'schema', kind, scope] as const,
  itemSchema: (path: string, id: string, kind: string, scope: string) =>
    ['bazis', path, 'item', id, 'schema', kind, scope] as const,
  /** An item read with others of its resource (`useRelatedItem`). */
  related: (path: string, id: string, scope: string) =>
    ['bazis', path, 'item', id, 'related', scope] as const,
  /** The response of a custom action read with GET (`useActionQuery`), by its query parameters. */
  action: (path: string, name: string, query: ActionParams, scope: string) =>
    ['bazis', path, 'action', name, parameters(query), scope] as const,
  /** The response of a custom action of an item read with GET (`useItemActionQuery`), by its query parameters. */
  itemAction: (path: string, id: string, name: string, query: ActionParams, scope: string) =>
    ['bazis', path, 'item', id, 'action', name, parameters(query), scope] as const,
  filterFields: (path: string, scope: string) =>
    ['bazis', path, 'filter-fields', scope] as const,
  /** The state of a task of bazis-async-background (`useAsyncTask`). */
  asyncTask: (taskId: string, scope: string) => ['bazis', ASYNC_TASKS, taskId, scope] as const,
  /** The content of the file of an item (`useDownloadUrl`), outside `keys.all`. */
  download: (path: string, id: string, scope: string) => [FILES, path, id, scope] as const,
  /** Every query of the state of a task, whatever the scope. */
  asyncTasks: (taskId: string) => ['bazis', ASYNC_TASKS, taskId] as const,
};
