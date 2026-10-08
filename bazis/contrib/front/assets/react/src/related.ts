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

// The related items (the label of a relationship), loaded together: the items of a resource
// requested at the same time are read with one list of it filtered by their primary keys,
// `pk=<id>|pk=<id>|…`. The core has no `pk__in` lookup and compares `pk=<a>,<b>` as one
// value (`bazis.core.utils.query_complex`), and Bazis ignores `include` on a list: without
// this, a page of rows would read every related item with its own retrieve.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { Filter } from '@/bazis/client';

import { useBazis, type Api } from './context.js';
import { keys } from './keys.js';
import { loose, type ListPath, type ListResponse } from './types.js';

/** The most ids of one request: its URL stays short. */
export const RELATED_BATCH = 50;

interface Waiter {
  resolve: (item: unknown) => void;
  reject: (error: unknown) => void;
}

/** The ids of a resource requested since the last read, with those who wait for them. */
type Batch = Map<string, Waiter[]>;

/** The pending batches of each client, by the path of the resource. */
const pending = new WeakMap<Api, Map<string, Batch>>();

async function readChunk(api: Api, path: string, batch: Batch, ids: readonly string[]): Promise<void> {
  try {
    const document = (await loose(api).list(path, {
      filter: Filter.or(...ids.map((id) => Filter.where('pk', id))),
      page: { limit: ids.length },
    })) as { data: readonly { id: string | number }[] };
    // the id of an item of a model with an integer primary key is a number in the documents
    // of the core (a string in the relationships that reference it)
    const items = new Map(document.data.map((item) => [String(item.id), item]));
    for (const id of ids) {
      for (const waiter of batch.get(id) ?? []) waiter.resolve(items.get(id) ?? null);
    }
  } catch (error) {
    for (const id of ids) {
      for (const waiter of batch.get(id) ?? []) waiter.reject(error);
    }
  }
}

function read(api: Api, path: string, batch: Batch): Promise<unknown> {
  const ids = [...batch.keys()];
  const chunks = [];
  for (let start = 0; start < ids.length; start += RELATED_BATCH) {
    chunks.push(readChunk(api, path, batch, ids.slice(start, start + RELATED_BATCH)));
  }
  return Promise.all(chunks);
}

/**
 * The item of a resource by its id, read with the other items of the resource requested
 * before the next task; null when the list does not have it (the user may not view it).
 */
function load(api: Api, path: string, id: string): Promise<unknown> {
  let batches = pending.get(api);
  if (batches === undefined) {
    batches = new Map();
    pending.set(api, batches);
  }
  let batch = batches.get(path);
  if (batch === undefined) {
    const created: Batch = new Map();
    batch = created;
    batches.set(path, created);
    const all = batches;
    // after the queries that mount with this one (the rows of a page) have asked
    setTimeout(() => {
      all.delete(path);
      void read(api, path, created);
    }, 0);
  }
  const waiting = batch;
  return new Promise((resolve, reject) => {
    waiting.set(id, [...(waiting.get(id) ?? []), { resolve, reject }]);
  });
}

/** An item of the list of a resource. */
export type ListItem<P extends ListPath> = ListResponse<P> extends { data: readonly (infer T)[] } ? T : never;

/**
 * A related item, to show its label: an item of the list of the resource (no meta, the
 * fields of the list), read in one request with the other items of the resource that the
 * page asks for at the same time; `null` when the user may not view it. Its key is under
 * the item (`['bazis', path, 'item', id, 'related', session]`): a mutation of the resource
 * refetches it, a destroy removes it.
 */
export function useRelatedItem<P extends ListPath>(
  path: P,
  id: string,
): UseQueryResult<ListItem<P> | null> {
  const { api, session } = useBazis();
  return useQuery({
    queryKey: keys.related(path, id, session),
    // one request reads several items: the signal of one query does not cancel it
    queryFn: () => load(api, path, id) as Promise<ListItem<P> | null>,
  });
}
