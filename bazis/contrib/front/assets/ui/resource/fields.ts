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

import { can, type CustomActionName, type PermitMeta } from '@/bazis/client';
import { LANGUAGE, RESOURCES, ROUTES, TRANSITS } from '@/bazis/generated/contract';
import {
  baseLanguage,
  ENGLISH,
  formatDate,
  formatDateTime,
  formatDecimal,
  formatNumber,
  type LanguageContextValue,
} from '@/bazis/i18n';
import { choiceLabel, resourceSchema, type AttributeField, type FormField, type JsonSchema } from '@/bazis/react';

import { text, useAnySchema } from './hooks.js';
import { formatPoint, pointOf } from './points.js';

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
  /**
   * The title of a field in the language of the backend; its title in the contract (in the
   * default language of the backend) until the schema loads or when the schema does not have
   * it; a title that is the name itself (a calculated field without one) or the default
   * `verbose_name` of Django (`status author`), S018 of `check`, as words (`Status author`),
   * never shown as an identifier.
   */
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

/** A field of a resource of the contract. */
interface ContractField {
  readonly title?: string;
  /** The format of an attribute (`decimal`, `point`, ...), read from the model where the OpenAPI has none. */
  readonly format?: string;
  /** The decimal places of a decimal. */
  readonly places?: number;
  readonly order?: string;
  /** The JSON:API type of the related resource of a relationship. */
  readonly relation?: string;
  /** A to-many relationship. */
  readonly many?: boolean;
  readonly reverse?: boolean;
}

/**
 * A resource of the contract (`RESOURCES`), read as plain records: the contract of a product
 * without resources is empty.
 */
interface ContractResource {
  readonly path: string;
  readonly fields: Readonly<Record<string, ContractField>>;
  /** The attributes that label an item (none: its id). */
  readonly label?: readonly string[];
  readonly search?: readonly string[];
  /** The custom actions of its route set, by their name in `x-bazis` (`action_<name>`). */
  readonly custom_actions?: Readonly<Record<string, ContractCustomAction>>;
}

/** A custom action of a route set in the contract (`custom_actions` of its resource). */
export interface ContractCustomAction {
  /** Its name in the path: `<path><name>/`, or `<path><id>/<name>/` for an item. */
  readonly name: string;
  /** Whether it is an action of an item. */
  readonly item: boolean;
  readonly method: string;
  /** What the route requires of the user on the item (`change`), null for nothing more than the route. */
  readonly access_action: string | null;
  /** The JSON Schema of its body, null without one. */
  readonly body: JsonSchema | null;
  /** Whether it answers a file (`useActionFile`), not JSON. */
  readonly file: boolean;
}

const CONTRACT_RESOURCES = RESOURCES as Readonly<Record<string, ContractResource | undefined>>;

/** The resource of the contract whose route set has this path, if it has one. */
export function resourceAt(path: string): ContractResource | undefined {
  return Object.values(CONTRACT_RESOURCES).find((it) => it?.path === path);
}

/**
 * The custom action `name` (its name in the path) of the items (`item`) or of the route set of
 * `path` in the contract, with its key in the permission meta (`action_<method>` of
 * `custom_actions`, by the method of the route set); undefined when the contract does not
 * have it. A route set may have both, `<path>export/` and `<path><id>/export/`.
 */
export function customActionAt(
  path: string,
  name: string,
  item: boolean,
): (ContractCustomAction & { readonly key: CustomActionName }) | undefined {
  const found = Object.entries(resourceAt(path)?.custom_actions ?? {}).find(([, it]) => it.name === name && it.item === item);
  return found && { ...found[1], key: found[0] as CustomActionName };
}

/**
 * The key of the custom action `name` (its name in the path) of the route set of `path` in the
 * contract: `action_<method>`, what `custom_actions` of bazis-permit lists (`requires.can` of
 * the link of the form of the action), never `action_` and the name in the path. The contract
 * must have it (the check of the specs, S032).
 */
export function customActionKey(path: string, name: string): CustomActionName {
  const declared = customActionAt(path, name, false);
  if (declared === undefined) {
    throw new Error(`The contract has no custom action "${name}" of the route ${path}: export the contract again.`);
  }
  return declared.key;
}

/**
 * A title that is the name of its field (`is_overdue`), or the default `verbose_name` of
 * Django (`status author`: S018 of `check` reports both), as words (`Is overdue`); another
 * as it is.
 */
function readable(title: string, name: string): string {
  if (title !== name && title !== name.replaceAll('_', ' ')) return title;
  const words = name.replace(/_+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The title of a field of the route set of `path`: that of its runtime schema (`title`), else
 * that of the contract, else its name as words; never a name of the code.
 */
export function fieldTitle(path: string, name: string, title?: string): string {
  return readable(title ?? resourceAt(path)?.fields[name]?.title ?? name, name);
}

/**
 * The field of a property of the body of a custom action or of the payload of a transit of
 * the route set of `path`: the picker of the related items of the relationship of the
 * resource of the same name in the contract (`relation`: a text for a to-one one, an array for
 * a to-many one), else of the resource of its `x-relation` (`relation` of the property: the
 * uploaded files of `UploadedFileId` of bazis-uploadable, a file field), else the property as
 * it is. Its title is `label` (of the specs), else that of the field of the resource (in the
 * runtime schema of `resource`, else in the contract), else that of the property.
 */
export function relatedField(path: string, property: AttributeField, label?: string, resource?: Fields): FormField {
  const { name, required, readOnly, nullable } = property;
  const own = resourceAt(path)?.fields[name];
  const runtime = resource?.fields.get(name);
  const title =
    label ?? (resource && runtime ? resource.title(name) : own === undefined ? property.title : fieldTitle(path, name));
  if (own?.relation !== undefined && property.type === (own.many === true ? 'array' : 'string')) {
    return { kind: 'relation', name, title, required, readOnly, nullable, relation: own.relation, many: own.many === true };
  }
  if (property.relation !== null) {
    return { kind: 'relation', name, title, required, readOnly, nullable, relation: property.relation, many: property.type === 'array' };
  }
  return { ...property, title, labels: runtime?.kind === 'attribute' ? runtime.labels : property.labels };
}

/**
 * The format of an attribute of the route set of `path` in the contract, read from the model
 * where the runtime schemas may have none (`decimal` of a `DecimalField`, `point`), and the
 * decimal places of a decimal (`places`); nulls for a field that the contract does not have.
 */
export function contractFormat(path: string, name: string): { format: string | null; places: number | null } {
  const field = resourceAt(path)?.fields[name];
  return { format: field?.format ?? null, places: field?.places ?? null };
}

function fieldsOf(path: string, query: { data?: JsonSchema | undefined; isPending: boolean }): Fields {
  const schema = query.data;
  const fields = new Map((schema ? resourceSchema(schema).fields : []).map((it) => [it.name, it]));
  return {
    fields,
    title: (name) => fieldTitle(path, name, fields.get(name)?.title),
    ready: !query.isPending,
    loaded: schema !== undefined,
    has: (name) => schema === undefined || fields.has(name),
  };
}

/**
 * The fields of a list (`schema_list/`): their titles and types. Which of them the user sees
 * is in the items: with bazis-permit the schema of a list also has the fields that the field
 * permissions hide in some rows (its first member has all the fields any row can show), and
 * an item leaves them out.
 */
export function useListFields(path: string): Fields {
  return fieldsOf(path, useAnySchema(path, 'list'));
}

/**
 * The fields that the current user may see in an item (`schema_retrieve/`, by default), or
 * may set in its update (`schema_update/`: those they may not change now are `readOnly`),
 * for this item: the field permissions of bazis-permit depend on the item (its selectors,
 * its status).
 */
export function useItemFields(path: string, id: string, kind: 'retrieve' | 'update' = 'retrieve'): Fields {
  return fieldsOf(path, useAnySchema(path, kind, id));
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

/** The JSON:API type of the route set of a path (`ROUTES` of the contract), as `routeOf` the other way. */
export function typeAt(path: string): string | undefined {
  return Object.entries(ROUTES as Readonly<Record<string, string>>).find(([, it]) => it === path)?.[0];
}

/**
 * Whether the route set of a JSON:API type searches (`search`): it has search fields in the
 * contract (`search` of its resource). The core answers a search of a route set without
 * them with 400 `ERR_FILTER`; a type the contract does not know has no search.
 */
export function hasSearch(type: string): boolean {
  return (CONTRACT_RESOURCES[type]?.search?.length ?? 0) > 0;
}

/**
 * Whether a relationship of a resource is a reverse one (`reverse` of its field in the
 * contract): its foreign key or many-to-many field is on the related model, and the core sets
 * it to the items of a create or an update, deleting the unlinked items of a foreign key that
 * is not null. A form edits it only when its `fields` name it.
 */
export function isReverse(type: string, name: string): boolean {
  return CONTRACT_RESOURCES[type]?.fields[name]?.reverse === true;
}

/**
 * The attributes that name an item, in this order: a display name first (`name`, `full_name`,
 * the first and the last name together, as `get_full_name()` of the users of Django and
 * bazis-users, `title`), then the identifiers (`username`, `email`, `slug`, `code`).
 * `LABEL_FIELDS` of `contract/resources.py` of bazis-front, which gives the `label` of the
 * resources of the contract, is the same list, compared by its tests: it names an item of a
 * type that the contract does not label, or one without a value of its label attributes.
 */
const LABELS: readonly (readonly string[])[] = [
  ['name'],
  ['full_name'],
  ['first_name', 'last_name'],
  ['title'],
  ['username'],
  ['email'],
  ['slug'],
  ['code'],
];

/** The non-empty values of these attributes of an item, joined; empty without any. */
function joined(resource: ResourceObject, names: readonly string[]): string {
  return names
    .map((name) => resource.attributes?.[name])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' ');
}

/**
 * The name of an item: the values of the attributes of `label` of its resource in the
 * contract, the backend's own; for a type that the contract does not label, or an item
 * without a value of them (a user without his names), its first non-empty name of `LABELS`
 * (`name`, `full_name`, the first and the last name, `title`, `username`, `email`, `slug`,
 * `code`); null without any.
 */
export function itemName(resource: ResourceObject): string | null {
  const label = CONTRACT_RESOURCES[resource.type]?.label ?? [];
  const named = joined(resource, label);
  if (named) return named;
  for (const names of LABELS) {
    const name = joined(resource, names);
    if (name) return name;
  }
  return null;
}

/** The label of an item: its name (`itemName`), or its id. */
export function itemLabel(resource: ResourceObject): string {
  return itemName(resource) ?? resource.id;
}

/** A name of the contract in every language of the backend (`{en, ru}`): a status, a transit. */
interface ContractName {
  id: string;
  name: Readonly<Record<string, string>>;
}

/**
 * A name of the contract in a language: that of the language, of its base language, of the
 * default language of the backend; its id without any.
 */
export function localizedName(item: ContractName | undefined, id: string, language: string): string {
  const names = item?.name ?? {};
  return names[language] ?? names[baseLanguage(language)] ?? names[LANGUAGE] ?? Object.values(names)[0] ?? id;
}

/**
 * A statusy model of bazis-statusy: its statuses and its transits (`TRANSITS` of the
 * contract), each with the JSON Schema of its payload when it requires one.
 */
interface StatusyModel {
  initial?: string;
  statuses: readonly ContractName[];
  transits: readonly (ContractName & {
    src?: string;
    dst?: string;
    payload?: { required: boolean; schema: JsonSchema } | null;
  })[];
}

/** The statusy model of a JSON:API type, undefined for a type that is not one. */
export function statusyModel(type: string): StatusyModel | undefined {
  return (TRANSITS as Readonly<Record<string, StatusyModel | undefined>>)[type];
}

/**
 * The statuses of a statusy model in the order of its workflow (the contract sorts them by
 * id): the initial one, then those its transits reach, in the order of the transits; the
 * statuses no transit reaches last. None for a type that is not a statusy model.
 */
export function workflowStatuses(type: string): readonly string[] {
  const model = statusyModel(type);
  if (!model) return [];
  const order = model.initial ? [model.initial] : [];
  for (let index = 0; index < order.length; index += 1) {
    for (const transit of model.transits) {
      if (transit.src === order[index] && transit.dst && !order.includes(transit.dst)) order.push(transit.dst);
    }
  }
  return [...order, ...model.statuses.map((it) => it.id).filter((it) => !order.includes(it))];
}

/**
 * The name of a status of the model in a language (`useLanguage().language`; the default
 * language of the backend without it); its id when the contract does not have it.
 */
export function statusName(type: string, status: string, language: string = LANGUAGE): string {
  return localizedName(statusyModel(type)?.statuses.find((it) => it.id === status), status, language);
}

/**
 * Whether the backend allows an action now, from the permission meta of bazis-permit
 * (`can()` of the client): `add` from `for_create` of a list or `crud_actions` of an item,
 * `change` and `delete` of an item of a list from `for_change`/`for_delete` with its id, a
 * custom action (`'action_<name>'`, `action` of `x-bazis`) from `custom_actions` (bazis-permit
 * 2.11; by what the action declares, not the checks of its own code). Without the meta (no
 * bazis-permit, or a route set without it) it is allowed: the backend checks every request
 * itself.
 */
export function permitted(
  meta: PermitMeta | null | undefined,
  action: 'add' | 'change' | 'delete' | CustomActionName,
  id?: string,
): boolean {
  if (action !== 'add' && action !== 'change' && action !== 'delete') {
    return meta?.custom_actions === undefined || meta.custom_actions === null || can(meta, action);
  }
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
 * The choices of an attribute with choices as options (the value as text, the label of
 * `enumDict`, else the value), in their order; null for another field. A list offers them
 * as the select of its filter.
 */
export function choiceOptions(field: FormField | undefined): { value: string; label: string }[] | null {
  if (field?.kind !== 'attribute' || field.enum === null) return null;
  return field.enum.map((choice) => {
    const value = text(choice);
    return { value, label: choiceLabel(field, choice) ?? value };
  });
}

/**
 * How the value of a field is shown (`display` of the field of an entity of the specs):
 * `plain`, a number without the separators of its thousands (a code of five digits or more:
 * a number below 10,000 has none anyway, a year as it is written); `phone`, a
 * phone number to call; `{currency}`, a sum in the currency (ISO 4217); `{unit}`, a quantity
 * followed by its unit; `{bar}`, a number with a bar of its share of the maximum.
 */
export type FieldDisplay = 'plain' | 'phone' | { currency: string } | { unit: string } | { bar: number };

/**
 * A phone number written without separators (`+79161234567`, 7 to 15 digits) in groups
 * from its end (`+7 916 123-45-67`); one written with them as it is.
 */
function formatPhone(value: string): string {
  const match = /^(\+?)(\d{7,15})$/.exec(value.trim());
  if (!match) return value.trim();
  const [, plus = '', digits = ''] = match;
  const groups = [digits.slice(0, -10), digits.slice(-10, -7), `${digits.slice(-7, -4)}-${digits.slice(-4, -2)}-${digits.slice(-2)}`];
  return plus + groups.filter(Boolean).join(' ');
}

/**
 * The text of the value of an attribute, in the language of the interface (`useLanguage()`;
 * English by default): a choice by its label (`enumDict` of the backend, the choices of an
 * array each), else by its type and format, the numbers, the sums, the quantities and the
 * phones as `display` says and the dates with `Intl`, a point (GeoJSON) as its coordinates
 * (`formatPoint`); `—` for no value. A number is grouped by thousands from five digits
 * (`formatNumber`: a year `2020`, `12,345`), never with `display: plain`.
 */
export function formatValue(
  field: FormField | undefined,
  value: unknown,
  { language, t }: Pick<LanguageContextValue, 'language' | 't'> = ENGLISH,
  display?: FieldDisplay,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const label = choiceLabel(field, value);
  if (label !== null) return label;
  if (Array.isArray(value) && field?.kind === 'attribute' && field.labels !== null) {
    return value.length ? value.map((it) => choiceLabel(field, it) ?? text(it)).join(', ') : '—';
  }
  if (typeof value === 'boolean') return t(value ? 'value.yes' : 'value.no');
  // a sum or a quantity: a number, or a DecimalField (its exact digits)
  if (typeof display === 'object' && !('bar' in display) && (typeof value === 'number' || typeof value === 'string')) {
    if ('currency' in display) {
      try {
        return formatDecimal(value, language, { style: 'currency', currency: display.currency });
      } catch {
        // a code that `Intl` refuses (not of ISO 4217): after the number, as a unit
      }
    }
    return `${formatDecimal(value, language)} ${'currency' in display ? display.currency : display.unit}`;
  }
  if (typeof value === 'number') {
    return formatNumber(value, language, display === 'plain' ? { useGrouping: false } : undefined);
  }
  if (typeof value === 'string') {
    if (display === 'phone') return formatPhone(value);
    const format = field?.kind === 'attribute' ? field.format : null;
    if (format === 'date-time') return formatDateTime(value, language);
    if (format === 'date') return formatDate(value, language);
    return value;
  }
  // a point (GeoJSON) as its coordinates
  const point = pointOf(value);
  return point ? formatPoint(point) : JSON.stringify(value);
}
