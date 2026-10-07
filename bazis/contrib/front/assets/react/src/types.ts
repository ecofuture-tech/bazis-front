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

// The typed signatures of the hooks are those of the client: a path of the generated
// `paths` and its options. At run time the paths are plain strings, as in the client.

import type {
  BodyOf,
  EndpointOf,
  ItemOptions,
  ListOptions,
  RelationshipOperation,
  ResourceIdentifier,
  ResponseOf,
  RouteSetWith,
  SchemaSuffix,
} from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import type { Api } from './context.js';
import type { QueryOptions } from './keys.js';

/** A JSON Schema as the backend returns it (the runtime schemas, the bodies of transits). */
export type JsonSchema = Readonly<Record<string, unknown>>;

type Item = '{item_id}/';

export type ListPath = RouteSetWith<paths, '', 'get'>;
export type ListOperation<P extends ListPath> = EndpointOf<paths, P, '', 'get'>;
/** The options of `list` without `signal`: filter, search, sort, page, fields, meta. */
export type ListQuery<P extends ListPath> = Omit<ListOptions<ListOperation<P>>, 'signal'>;
export type ListResponse<P extends ListPath> = ResponseOf<ListOperation<P>>;

export type ItemPath = RouteSetWith<paths, Item, 'get'>;
export type ItemOperation<P extends ItemPath> = EndpointOf<paths, P, Item, 'get'>;
/** The options of `retrieve` without `signal`: include, fields, meta. */
export type ItemQuery<P extends ItemPath> = Omit<ItemOptions<ItemOperation<P>>, 'signal'>;
export type ItemResponse<P extends ItemPath> = ResponseOf<ItemOperation<P>>;

export type SchemaPath<K extends keyof SchemaSuffix> = RouteSetWith<paths, SchemaSuffix[K], 'get'>;
export type FilterFieldsPath = RouteSetWith<paths, 'route_filter_fields/', 'get'>;
export type FilterFields<P extends FilterFieldsPath> = ResponseOf<
  EndpointOf<paths, P, 'route_filter_fields/', 'get'>
>;

export type CreatePath = RouteSetWith<paths, '', 'post'>;
export type CreateOperation<P extends CreatePath> = EndpointOf<paths, P, '', 'post'>;
export type CreateDocument<P extends CreatePath> = BodyOf<CreateOperation<P>>;
export type CreateResponse<P extends CreatePath> = ResponseOf<CreateOperation<P>>;

export type UpdatePath = RouteSetWith<paths, Item, 'patch'>;
export type UpdateOperation<P extends UpdatePath> = EndpointOf<paths, P, Item, 'patch'>;
export type UpdateDocument<P extends UpdatePath> = BodyOf<UpdateOperation<P>>;
export type UpdateResponse<P extends UpdatePath> = ResponseOf<UpdateOperation<P>>;

export type DestroyPath = RouteSetWith<paths, Item, 'delete'>;
export type RelationshipPath = RouteSetWith<
  paths,
  '{item_id}/relationships/{related_field_name}',
  'post'
>;

/** A change of a relationship of an item: `useRelationship(path).mutate(change)`. */
export interface RelationshipChange {
  id: string;
  field: string;
  /** `add` to and `remove` from a to-many relationship, `replace` any relationship */
  operation: RelationshipOperation;
  data: ResourceIdentifier | readonly ResourceIdentifier[] | null;
}

interface Signal {
  signal?: AbortSignal;
}

/** The client with plain strings for paths and documents, for the bodies of the hooks. */
export interface LooseClient {
  list(path: string, options: QueryOptions & Signal): Promise<unknown>;
  retrieve(path: string, id: string, options: QueryOptions & Signal): Promise<unknown>;
  create(path: string, document: unknown): Promise<unknown>;
  update(path: string, id: string, document: unknown): Promise<unknown>;
  destroy(path: string, id: string): Promise<void>;
  relationship(
    path: string,
    id: string,
    field: string,
    operation: RelationshipOperation,
    data: unknown,
  ): Promise<void>;
  schema(path: string, kind: string, id: string, options: Signal): Promise<unknown>;
  schema(path: string, kind: string, options: Signal): Promise<unknown>;
  filterFields(path: string, options: Signal): Promise<unknown>;
  transit(path: string, id: string, transit: string, payload?: unknown): Promise<unknown>;
}

export function loose(api: Api): LooseClient {
  return api as unknown as LooseClient;
}
