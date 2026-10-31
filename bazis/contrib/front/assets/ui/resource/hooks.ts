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

// The hooks of `@/bazis/react` with plain paths and options, for the bodies of the
// components: a component is generic over the resources of any product, whose screens pass
// it the typed paths of their contract. The casts of these hooks are here: the signatures
// below, with the documents of Bazis that the components read. A component that uses a hook
// of a package (`useUpload` of `file-field`, `useBgTask` of `task-progress`) or does not
// require this asset (`app-shell`, `task-progress`) casts the hooks it uses itself.

import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';

import type { AggregatesMeta, PaginationLinks, PaginationMeta, PermitMeta } from '@/bazis/client';
import {
  useAction,
  useActionFile,
  useDownload,
  useDownloadUrl,
  useFilterFields,
  useItem,
  useItemAction,
  useList,
  useLists,
  useRelatedItem,
  useResourceForm,
  useSchema,
  type ActionMutation,
  type FixedValues,
  type JsonSchema,
  type QueryOptions,
  type ResourceForm,
  type SavedFile,
} from '@/bazis/react';

import type { ResourceObject } from './fields.js';

/**
 * A list: its items, its pages and its meta (`pagination`, the permission meta, the transits
 * of its items, `for_transit` of bazis-statusy, and its `aggregates`).
 */
export interface ListDocument {
  data: readonly ResourceObject[];
  links?: PaginationLinks | null;
  meta?:
    | (PermitMeta & {
        pagination?: PaginationMeta | null;
        for_transit?: Readonly<Record<string, readonly string[]>> | null;
        aggregates?: AggregatesMeta | null;
      })
    | null;
}

/** An item and its meta (`crud_actions`). */
export interface ItemDocument {
  data: ResourceObject;
  meta?: PermitMeta | null;
}

/**
 * The meta of the retrieve of an item that its card reads (`ResourceCard`) and the transits
 * of the card (`TransitBar`): one request for both. The core leaves out a name that the route
 * set does not have (`state_actions` of a model that is not statusy).
 */
export const ITEM_META: readonly string[] = ['crud_actions', 'custom_actions', 'state_actions'];

/** The document that a create or an update returns. */
export interface SavedDocument {
  data: ResourceObject;
}

/** The fields a list can be filtered by (`route_filter_fields/`). */
export interface FilterFieldsDocument {
  fields: readonly { name: string; py_type: string }[];
}

/** `useList(path, query)`. */
export const useAnyList = useList as unknown as (
  path: string,
  query?: Omit<QueryOptions, 'include'>,
) => UseQueryResult<ListDocument>;

/** `useLists(path, queries)`: several lists of a route set, a query each. */
export const useAnyLists = useLists as unknown as (
  path: string,
  queries: readonly Omit<QueryOptions, 'include'>[],
) => UseQueryResult<ListDocument>[];

/** `useItem(path, id, query)`. */
export const useAnyItem = useItem as unknown as (
  path: string,
  id: string,
  query?: Pick<QueryOptions, 'include' | 'fields' | 'meta'>,
) => UseQueryResult<ItemDocument>;

/** `useRelatedItem(path, id)`: null when the user may not view the item. */
export const useAnyRelated = useRelatedItem as unknown as (
  path: string,
  id: string,
) => UseQueryResult<ResourceObject | null>;

/** `useSchema(path, kind)` of the route set, `useSchema(path, kind, id)` of an item. */
export const useAnySchema = useSchema as unknown as (
  path: string,
  kind: 'list' | 'create' | 'retrieve' | 'update' | 'transit',
  id?: string,
) => UseQueryResult<JsonSchema>;

/** `useAction(path, name)`: a custom action of the route set (POST), `mutateAsync(body)`. */
export const useAnyAction = useAction as unknown as (
  path: string,
  name: string,
) => ActionMutation<unknown, Readonly<Record<string, unknown>>>;

/** `useActionFile(path, name)`: a custom action of the route set that answers a file, saved; resolves to its name and its meta. */
export const useAnyActionFile = useActionFile as unknown as (
  path: string,
  name: string,
) => ActionMutation<SavedFile, Readonly<Record<string, unknown>>>;

/** `useItemAction(path, name)`: a custom action of an item (POST), `mutateAsync({id, body})`. */
export const useAnyItemAction = useItemAction as unknown as (
  path: string,
  name: string,
) => ActionMutation<unknown, { id: string; body: Readonly<Record<string, unknown>> }>;

/** `useFilterFields(path)`. */
export const useAnyFilterFields = useFilterFields as unknown as (
  path: string,
) => UseQueryResult<FilterFieldsDocument>;

/** `useResourceForm(path, {id, fixed, initial})`: a create without an id. */
export const useAnyResourceForm = useResourceForm as unknown as (
  path: string,
  options: { id?: string; fixed?: FixedValues; initial?: Readonly<Record<string, unknown>> },
) => ResourceForm<SavedDocument>;

/** `useDownload(path)`: `mutate(id)` saves the file of the item. */
export const useAnyDownload = useDownload as unknown as (path: string) => UseMutationResult<string | null, Error, string>;

/** `useDownloadUrl(path, id)`: the content of the file of the item as an object URL. */
export const useAnyDownloadUrl = useDownloadUrl as unknown as (path: string, id: string | null) => string | null;

/** A value as text: a JSON value that is not a string, a number or a boolean as JSON. */
export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value === undefined ? '' : JSON.stringify(value);
}
