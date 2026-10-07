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

export { BazisProvider, useApi, useSessionKey } from './context.js';
export type { Api, BazisProviderProps } from './context.js';
export { useCreate, useDestroy, useRelationship, useUpdate } from './mutations.js';
export { useFilterFields, useItem, useList, useSchema } from './queries.js';
export { useResourceForm } from './form.js';
export type { ResourceForm } from './form.js';
export { objectFields, resourceSchema } from './schema.js';
export type { AttributeField, FormField, RelationField, ResourceSchema } from './schema.js';
export type {
  CreateDocument,
  CreatePath,
  CreateResponse,
  ItemPath,
  ItemQuery,
  ItemResponse,
  JsonSchema,
  ListPath,
  ListQuery,
  ListResponse,
  RelationshipChange,
  UpdateDocument,
  UpdatePath,
  UpdateResponse,
} from './types.js';
