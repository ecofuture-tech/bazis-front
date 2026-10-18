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
import { useCallback } from 'react';

import { ApiError } from '@/bazis/client';

import { useBazis } from './context.js';
import { keys } from './keys.js';
import {
  loose,
  type CreateDocument,
  type ItemPath,
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

/**
 * Reads an item again: the function it returns marks every query of the item stale (its
 * retrieves, its schemas, the responses of its GET actions) and refetches the active ones,
 * after a change that the backend makes to it through another resource (a related item
 * added or deleted changes its computed fields, its transits). The mutations of its own
 * resource refetch it already.
 */
export function useRefreshItem(path: ItemPath, id: string): () => Promise<void> {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: keys.item(path, id) }), [queryClient, path, id]);
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

/**
 * Removes the queries of a deleted item once nothing shows them: a query removed under a
 * screen of the item would be built and read again (a 404). Unless that screen is left
 * (`leaving`: a navigation is a transition, rendered after the screen again, which keeps its
 * data until then), the queries shown are told that the item is not found, as the backend
 * would answer, without asking it.
 */
function forget(queryClient: QueryClient, queryKey: readonly unknown[], leaving: boolean): void {
  const cache = queryClient.getQueryCache();
  if (!leaving) {
    const error = new ApiError(404, []);
    for (const query of cache.findAll({ queryKey, type: 'active' })) {
      void query.cancel({ silent: true });
      query.setState({ status: 'error', data: undefined, error, fetchStatus: 'idle' });
    }
  }
  const removed = () => {
    queryClient.removeQueries({ queryKey, predicate: (query) => query.getObserversCount() === 0 });
    return cache.findAll({ queryKey }).length === 0;
  };
  if (removed()) return;
  const unsubscribe = cache.subscribe((event) => {
    if (event.type === 'observerRemoved' && removed()) unsubscribe();
  });
}

/** The options of `useDestroy`. */
export interface DestroyOptions {
  /**
   * The screens of the item are left once it is deleted (a navigation in the callbacks of
   * `mutate`): they keep its data until then. Otherwise a screen still showing it (a card
   * next to the list of a bulk deletion) shows it not found at once.
   */
  leaving?: boolean;
}

/**
 * Deletes an item: `mutate(id)`. Its queries are not read again (a 404): a screen still
 * showing it shows it not found (its queries in the error 404, without a request), unless
 * it is left (`leaving`); they are removed once nothing shows them. The other queries of the
 * resource are refetched.
 */
export function useDestroy(path: DestroyPath, { leaving = false }: DestroyOptions = {}): UseMutationResult<void, Error, string> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => loose(api).destroy(path, id),
    onSuccess: (_, id) => {
      const item = keys.item(path, id);
      forget(queryClient, item, leaving);
      return queryClient.invalidateQueries({
        queryKey: keys.resource(path),
        predicate: ({ queryKey }) => item.some((part, index) => queryKey[index] !== part),
      });
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
