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

export { AUTH_POLL_INTERVAL, createClient, TOKEN_PATH } from './client.js';
export type {
  BazisClient,
  ClientOptions,
  CollectionSchemaKind,
  ItemSchemaKind,
  RelationshipOperation,
  SchemaSuffix,
} from './client.js';
export { ApiError } from './errors.js';
export type { ErrorObject } from './errors.js';
export { Filter } from './filter.js';
export type { FilterValue } from './filter.js';
export { nextPage, pagination, prevPage } from './pagination.js';
export type { PaginationLinks, PaginationMeta } from './pagination.js';
export { can } from './permit.js';
export type { CrudAccessAction, PermitMeta } from './permit.js';
export type {
  AuthAction,
  AuthState,
  AuthUser,
  BodyOf,
  EndpointOf,
  ItemOptions,
  ListOptions,
  Page,
  RequestOptions,
  ResourceIdentifier,
  ResponseOf,
  RouteSetPath,
  RouteSetWith,
  TokenResponse,
  UploadOptions,
  UploadProgress,
} from './types.js';
