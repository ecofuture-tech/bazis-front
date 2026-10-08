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

// What the resource components share: the resource objects of JSON:API, the fields of the
// runtime schemas (their titles, types and formats, for the current user), the related
// resources of the contract and the permission meta of bazis-permit.

import { can, type PermitMeta } from '@/bazis/client';
import { RESOURCES, ROUTES } from '@/bazis/generated/contract';
import { ENGLISH, formatDate, formatDateTime, formatNumber, type LanguageContextValue } from '@/bazis/i18n';
import { resourceSchema, type FormField, type JsonSchema } from '@/bazis/react';

import { useAnySchema } from './hooks.js';

/** A resource object of JSON:API, an item of a list or the `data` of an item. */
export interface ResourceObject {
  id: string;
  type: string;
  attributes?: Readonly<Record<string, unknown>> | null;
  relationships?: Readonly<Record<string, { data?: unknown } | null | undefined>> | null;
  meta?: unknown;
}

/** The fields of a runtime schema by name, and the state of its query. */
export interface Fields {
  fields: ReadonlyMap<string, FormField>;
  /** The title of a field in the language of the backend, its name until the schema loads. */
  title: (name: string) => string;
  /** Whether the schema is loaded (or failed: the names stand for the titles then). */
  ready: boolean;
  /** Whether the schema is loaded (not failed). */
  loaded: boolean;
  /**
   * Whether the schema has the field: bazis-permit leaves out the fields that the user may
   * not see (or change, in the schema of an update); every field while the schema is not
   * loaded.
   */
  has: (name: string) => boolean;
}

function fieldsOf(query: { data?: JsonSchema | undefined; isPending: boolean }): Fields {
  const schema = query.data;
  const fields = new Map((schema ? resourceSchema(schema).fields : []).map((it) => [it.name, it]));
  return {
    fields,
    title: (name) => fields.get(name)?.title ?? name,
    ready: !query.isPending,
    loaded: schema !== undefined,
    has: (name) => schema === undefined || fields.has(name),
  };
}

/**
 * The fields of a list (`schema_list/`): their titles and types. Which of them the user sees
 * is in the items: with bazis-permit the schema of a list also has the fields that the field
 * permissions hide (its first member has every field), and an item leaves them out.
 */
export function useListFields(path: string): Fields {
  return fieldsOf(useAnySchema(path, 'list'));
}

/**
 * The fields that the current user may see in an item (`schema_retrieve/`, by default), or
 * may set in its update (`schema_update/`: those they may not change now are `readOnly`),
 * for this item: the field permissions of bazis-permit depend on the item (its selectors,
 * its status).
 */
export function useItemFields(path: string, id: string, kind: 'retrieve' | 'update' = 'retrieve'): Fields {
  return fieldsOf(useAnySchema(path, kind, id));
}

/**
 * The value of a field of a resource object: an attribute, the id of the related item of a
 * to-one relationship (null for none), the ids of a to-many one; undefined when it is absent.
 */
export function fieldValue(resource: ResourceObject, name: string): unknown {
  const attributes = resource.attributes ?? {};
  if (name in attributes) return attributes[name];
  const data = resource.relationships?.[name]?.data;
  if (Array.isArray(data)) return data.map((it) => (it as { id: string }).id);
  if (typeof data === 'object' && data !== null) return (data as { id: string }).id;
  return data === null ? null : undefined;
}

/** The path of the route set of a JSON:API type (`ROUTES` of the contract), if it has one. */
export function routeOf(type: string): string | undefined {
  return (ROUTES as Readonly<Record<string, string | undefined>>)[type];
}

/**
 * Whether the route set of a JSON:API type searches (`search`): it has search fields in the
 * contract (`search` of its resource). The core answers a search of a route set without
 * them with 400 `ERR_FILTER`; a type the contract does not know has no search.
 */
export function hasSearch(type: string): boolean {
  const resource = (RESOURCES as Readonly<Record<string, { readonly search?: readonly string[] } | undefined>>)[type];
  return (resource?.search?.length ?? 0) > 0;
}

/** The attributes that name an item, in this order. */
const LABELS = ['name', 'title', 'username', 'email', 'slug', 'code'];

/** The label of an item: its first non-empty attribute of `LABELS`, or its id. */
export function itemLabel(resource: ResourceObject): string {
  for (const name of LABELS) {
    const value = resource.attributes?.[name];
    if (typeof value === 'string' && value) return value;
  }
  return resource.id;
}

/**
 * Whether the backend allows an action now, from the permission meta of bazis-permit
 * (`can()` of the client): `add` from `for_create` of a list or `crud_actions` of an item,
 * `change` and `delete` of an item of a list from `for_change`/`for_delete` with its id.
 * Without the meta (no bazis-permit, or a route set without it) it is allowed: the backend
 * checks every request itself.
 */
export function permitted(
  meta: PermitMeta | null | undefined,
  action: 'add' | 'change' | 'delete',
  id?: string,
): boolean {
  if (id !== undefined && action !== 'add') {
    const ids = action === 'change' ? meta?.for_change : meta?.for_delete;
    return ids === undefined || ids === null || can(meta, action, id);
  }
  if (meta?.crud_actions !== undefined && meta.crud_actions !== null) return can(meta, action);
  if (action === 'add' && meta?.for_create !== undefined && meta.for_create !== null) {
    return can(meta, 'add');
  }
  return true;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** A date-time of the backend as the value of `<input type="datetime-local">`. */
export function toLocalDateTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return (
    `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** The value of `<input type="datetime-local">` as a date-time of the backend (ISO, UTC). */
export function fromLocalDateTime(text: string): string | null {
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Whether a field is a number: aligned to the right, with figures of the same width. */
export function isNumeric(field: FormField | undefined): boolean {
  return field?.kind === 'attribute' && (field.type === 'integer' || field.type === 'number');
}

/** Whether a field is a long text (a string without a format and a maximal length). */
export function isLongText(field: FormField | undefined): boolean {
  return (
    field?.kind === 'attribute' && field.type === 'string' && field.format === null && field.schema.maxLength === undefined
  );
}

/**
 * The text of the value of an attribute, by its type and format, in the language of the
 * interface (`useLanguage()`; English by default): the numbers and the dates with `Intl`;
 * `—` for no value.
 */
export function formatValue(
  field: FormField | undefined,
  value: unknown,
  { language, t }: Pick<LanguageContextValue, 'language' | 't'> = ENGLISH,
): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return t(value ? 'value.yes' : 'value.no');
  if (typeof value === 'number') return formatNumber(value, language);
  if (typeof value === 'string') {
    const format = field?.kind === 'attribute' ? field.format : null;
    if (format === 'date-time') return formatDateTime(value, language);
    if (format === 'date') return formatDate(value, language);
    return value;
  }
  return JSON.stringify(value);
}
