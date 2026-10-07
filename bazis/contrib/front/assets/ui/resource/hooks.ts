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
// it the typed paths of their contract. The only casts of the components are here.

import type { UseQueryResult } from '@tanstack/react-query';

import {
  useFilterFields,
  useItem,
  useList,
  useResourceForm,
  useSchema,
  type JsonSchema,
  type ResourceForm,
} from '@/bazis/react';

/** `useList(path, query)`. */
export const useAnyList = useList as unknown as (path: string, query?: object) => UseQueryResult;

/** `useItem(path, id, query)`. */
export const useAnyItem = useItem as unknown as (path: string, id: string, query?: object) => UseQueryResult;

/** `useSchema(path, kind)` of the route set, `useSchema(path, kind, id)` of an item. */
export const useAnySchema = useSchema as unknown as (
  path: string,
  kind: 'list' | 'create' | 'retrieve' | 'update' | 'transit',
  id?: string,
) => UseQueryResult<JsonSchema>;

/** `useFilterFields(path)`. */
export const useAnyFilterFields = useFilterFields as unknown as (path: string) => UseQueryResult;

/** `useResourceForm(path, {id})`: a create without an id. */
export const useAnyResourceForm = useResourceForm as unknown as (
  path: string,
  options: { id?: string },
) => ResourceForm<unknown>;

/** A value as text: a JSON value that is not a string, a number or a boolean as JSON. */
export function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value === undefined ? '' : JSON.stringify(value);
}
