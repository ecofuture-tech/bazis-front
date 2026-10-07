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

import { queryOptions, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { CollectionSchemaKind, ItemSchemaKind } from '@/bazis/client';

import { useBazis, type Api } from './context.js';
import { keys, type QueryOptions } from './keys.js';
import {
  loose,
  type FilterFields,
  type FilterFieldsPath,
  type ItemPath,
  type ItemQuery,
  type ItemResponse,
  type JsonSchema,
  type ListPath,
  type ListQuery,
  type ListResponse,
  type SchemaPath,
} from './types.js';

/**
 * A page of a list: `filter`, `search`, `sort`, `page`, `fields` and `meta` as in
 * `api.list`. While the next page (or another filter) loads, `data` keeps the previous page
 * of the same list (`isPlaceholderData`). Read the pages with `nextPage`, `prevPage` and
 * `pagination` of the client (`meta: ['pagination']` for the count).
 */
export function useList<P extends ListPath>(
  path: P,
  query?: ListQuery<P>,
): UseQueryResult<ListResponse<P>> {
  const { api, session } = useBazis();
  const options = (query ?? {}) as QueryOptions;
  return useQuery({
    queryKey: keys.list(path, options, session),
    queryFn: ({ signal }) => loose(api).list(path, { ...options, signal }) as Promise<ListResponse<P>>,
    // the previous page of this list in this session, never data of another list or user
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey;
      return key?.[1] === path && key.at(-1) === session ? previous : undefined;
    },
  });
}

/** The query of an item, shared by `useItem` and the hooks that read its meta. */
export function retrieveQuery<Data>(api: Api, path: string, id: string, query: QueryOptions, session: string) {
  return queryOptions({
    queryKey: keys.retrieve(path, id, query, session),
    queryFn: ({ signal }) => loose(api).retrieve(path, id, { ...query, signal }) as Promise<Data>,
  });
}

/** An item: `include`, `fields` and `meta` as in `api.retrieve`. */
export function useItem<P extends ItemPath>(
  path: P,
  id: string,
  query?: ItemQuery<P>,
): UseQueryResult<ItemResponse<P>> {
  const { api, session } = useBazis();
  return useQuery(
    retrieveQuery<ItemResponse<P>>(api, path, id, (query ?? {}) as QueryOptions, session),
  );
}

/** The runtime schema of an action on a route set for the current user. */
export function schemaQuery(
  api: Api,
  path: string,
  kind: CollectionSchemaKind | ItemSchemaKind,
  id: string | undefined,
  session: string,
) {
  return queryOptions({
    queryKey:
      id === undefined
        ? keys.collectionSchema(path, kind, session)
        : keys.itemSchema(path, id, kind, session),
    queryFn: ({ signal }) =>
      (id === undefined
        ? loose(api).schema(path, kind, { signal })
        : loose(api).schema(path, kind, id, { signal })) as Promise<JsonSchema>,
    // a schema changes with the user (the session) or with the item (a mutation)
    staleTime: Infinity,
  });
}

/**
 * The runtime schema of an action for the current user: `list` and `create` of the route
 * set, `retrieve`, `update` and `transit` (bazis-statusy) of an item. It is what the user
 * may see or change now: the fields, which are required, read-only or nullable.
 */
export function useSchema<K extends CollectionSchemaKind>(
  path: SchemaPath<K>,
  kind: K,
): UseQueryResult<JsonSchema>;
export function useSchema<K extends ItemSchemaKind>(
  path: SchemaPath<K>,
  kind: K,
  id: string,
): UseQueryResult<JsonSchema>;
export function useSchema(
  path: string,
  kind: CollectionSchemaKind | ItemSchemaKind,
  id?: string,
): UseQueryResult<JsonSchema> {
  const { api, session } = useBazis();
  return useQuery(schemaQuery(api, path, kind, id, session));
}

/** The fields a list can be filtered by (`route_filter_fields/`), with their types. */
export function useFilterFields<P extends FilterFieldsPath>(
  path: P,
): UseQueryResult<FilterFields<P>> {
  const { api, session } = useBazis();
  return useQuery({
    queryKey: keys.filterFields(path, session),
    queryFn: ({ signal }) => loose(api).filterFields(path, { signal }) as Promise<FilterFields<P>>,
    staleTime: Infinity,
  });
}
