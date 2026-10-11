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

import {
  ApiError,
  type CollectionSchemaKind,
  type CustomActionName,
  type ItemSchemaKind,
  type PermitMeta,
} from '@/bazis/client';

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
  const { api, scope } = useBazis();
  const options = (query ?? {}) as QueryOptions;
  return useQuery({
    queryKey: keys.list(path, options, scope),
    queryFn: ({ signal }) => loose(api).list(path, { ...options, signal }) as Promise<ListResponse<P>>,
    // the previous page of this list in this scope, never data of another list, user or language
    placeholderData: (previous, previousQuery) => {
      const key = previousQuery?.queryKey;
      return key?.[1] === path && key.at(-1) === scope ? previous : undefined;
    },
  });
}

/** The query of an item, shared by `useItem` and the hooks that read its meta. */
export function retrieveQuery<Data>(api: Api, path: string, id: string, query: QueryOptions, scope: string) {
  return queryOptions({
    queryKey: keys.retrieve(path, id, query, scope),
    queryFn: ({ signal }) => loose(api).retrieve(path, id, { ...query, signal }) as Promise<Data>,
  });
}

/** An item: `include`, `fields` and `meta` as in `api.retrieve`. */
export function useItem<P extends ItemPath>(
  path: P,
  id: string,
  query?: ItemQuery<P>,
): UseQueryResult<ItemResponse<P>> {
  const { api, scope } = useBazis();
  return useQuery(
    retrieveQuery<ItemResponse<P>>(api, path, id, (query ?? {}) as QueryOptions, scope),
  );
}

/** The runtime schema of an action on a route set for the current user. */
export function schemaQuery(
  api: Api,
  path: string,
  kind: CollectionSchemaKind | ItemSchemaKind,
  id: string | undefined,
  scope: string,
) {
  return queryOptions({
    queryKey:
      id === undefined
        ? keys.collectionSchema(path, kind, scope)
        : keys.itemSchema(path, id, kind, scope),
    queryFn: ({ signal }) =>
      (id === undefined
        ? loose(api).schema(path, kind, { signal })
        : loose(api).schema(path, kind, id, { signal })) as Promise<JsonSchema>,
    // a schema changes with the user (the session), the language (its titles) or the item (a mutation)
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
  const { api, scope } = useBazis();
  return useQuery(schemaQuery(api, path, kind, id, scope));
}

/** What a user may do on a route set: view its items (its list), add one, call a custom action of the collection. */
export type Can = 'view' | 'add' | CustomActionName;

/** The query of the list that tells the custom actions of the collection the user may call. */
const ACTIONS_QUERY: QueryOptions = { page: { limit: 1 }, meta: ['custom_actions'] };

/**
 * Whether the backend lets the current user view the items of a route set (`view`) or add
 * one (`add`): the runtime schema of the list or of the create, which bazis-permit refuses
 * with 403 without a permission of the model for the action (`<app>.<model>.item.view|add.*`
 * of his role). It is the query of `useSchema`, so a screen that shows the list or the form
 * of the resource makes no request of its own. A custom action of the collection
 * (`'action_<name>'`, `action` of `x-bazis`: the button of an export) is in `custom_actions` of
 * the list (bazis-permit 2.11, a list of one item with that meta), by what the action
 * declares (`public`, `access_action`; a check in its own code is not reflected); without the
 * meta (no bazis-permit) it is allowed: the backend checks the call. Undefined until the
 * backend answers, false when it refuses, true when it answers anything else (an error is
 * shown by the screen).
 */
export function useCan(path: SchemaPath<'list'>, action: 'view'): boolean | undefined;
export function useCan(path: SchemaPath<'create'>, action: 'add'): boolean | undefined;
export function useCan(path: ListPath, action: CustomActionName): boolean | undefined;
export function useCan(path: string, action: Can): boolean | undefined {
  const { api, scope } = useBazis();
  const custom = action !== 'view' && action !== 'add';
  // one query whatever the action: the list of the custom actions has the shape of the
  // query of a schema for this hook, which reads only its error and its meta
  const options = custom
    ? (queryOptions({
        queryKey: keys.list(path, ACTIONS_QUERY, scope),
        queryFn: ({ signal }) => loose(api).list(path, { ...ACTIONS_QUERY, signal }),
      }) as unknown as ReturnType<typeof schemaQuery>)
    : schemaQuery(api, path, action === 'view' ? 'list' : 'create', undefined, scope);
  const query = useQuery(options);
  if (query.isPending) return undefined;
  if (query.error instanceof ApiError && query.error.status === 403) return false;
  if (!custom) return true;
  const meta = (query.data as { meta?: PermitMeta | null } | undefined)?.meta;
  return meta?.custom_actions == null || meta.custom_actions.includes(action);
}

/** The fields a list can be filtered by (`route_filter_fields/`), with their types. */
export function useFilterFields<P extends FilterFieldsPath>(
  path: P,
): UseQueryResult<FilterFields<P>> {
  const { api, scope } = useBazis();
  return useQuery({
    queryKey: keys.filterFields(path, scope),
    queryFn: ({ signal }) => loose(api).filterFields(path, { signal }) as Promise<FilterFields<P>>,
    staleTime: Infinity,
  });
}
