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

// The mutations refetch the queries of their resource (`['bazis', path]`): the lists, the
// items and their schemas, which the change may affect. The mutation is pending until the
// active ones are refetched.

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { useBazis } from './context.js';
import { keys } from './keys.js';
import {
  loose,
  type CreateDocument,
  type CreatePath,
  type CreateResponse,
  type DestroyPath,
  type RelationshipChange,
  type RelationshipPath,
  type UpdateDocument,
  type UpdatePath,
  type UpdateResponse,
} from './types.js';

/** Marks every query of the resource stale and refetches the active ones. */
export function invalidateResource(queryClient: QueryClient, path: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: keys.resource(path) });
}

/** Creates an item: `mutate(document)`. */
export function useCreate<P extends CreatePath>(
  path: P,
): UseMutationResult<CreateResponse<P>, Error, CreateDocument<P>> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (document) => loose(api).create(path, document) as Promise<CreateResponse<P>>,
    onSuccess: () => invalidateResource(queryClient, path),
  });
}

/** Updates an item: `mutate({id, document})`. */
export function useUpdate<P extends UpdatePath>(
  path: P,
): UseMutationResult<UpdateResponse<P>, Error, { id: string; document: UpdateDocument<P> }> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, document }) =>
      loose(api).update(path, id, document) as Promise<UpdateResponse<P>>,
    onSuccess: () => invalidateResource(queryClient, path),
  });
}

/** Deletes an item: `mutate(id)`. Its queries are removed, not refetched. */
export function useDestroy(path: DestroyPath): UseMutationResult<void, Error, string> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => loose(api).destroy(path, id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.item(path, id) });
      return invalidateResource(queryClient, path);
    },
  });
}

/**
 * Changes a relationship of an item through its relationship endpoint:
 * `mutate({id, field, operation, data})`; `add` and `remove` change a to-many relationship.
 */
export function useRelationship(
  path: RelationshipPath,
): UseMutationResult<void, Error, RelationshipChange> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, field, operation, data }) =>
      loose(api).relationship(path, id, field, operation, data),
    onSuccess: () => invalidateResource(queryClient, path),
  });
}
