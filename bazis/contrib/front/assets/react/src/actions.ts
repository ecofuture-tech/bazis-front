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

// The custom actions of the route sets (`@http_post('/<name>/')` of the backend, kind `other`
// in the contract) as mutations: `client.action` and `client.itemAction`, typed by the
// OpenAPI. An action may change the items of its resource: its queries are refetched after it,
// unless `invalidate: false` (an export that changes nothing). An action that queues a task of
// bazis-bg answers with its id, which `TaskProgress` (or `useBgTask`) follows.

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { ApiError, type ActionName, type BodyOf, type EndpointOf, type HttpMethod, type ResponseOf, type RouteSetPath } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { useBazis } from './context.js';
import { invalidateResource } from './mutations.js';
import { loose } from './types.js';

type Item = '{item_id}/';

/** A route set: the path of its collection. */
export type ActionPath = RouteSetPath<paths>;
/** The body of the action `N` of the route set `P` (`<P><Prefix><N>/`) for the method `M`. */
export type ActionBody<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = BodyOf<
  EndpointOf<paths, P, `${Prefix}${N}/`, M>
>;
/** What `mutate` of an action takes: its body, `undefined` for an action without one (a GET). */
export type ActionVariables<Body> = [Body] extends [never] ? undefined : Body;
/** The response of the action `N` of the route set `P` for the method `M`. */
export type ActionResponse<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = ResponseOf<
  EndpointOf<paths, P, `${Prefix}${N}/`, M>
>;

export interface ActionHookOptions<M extends HttpMethod> {
  /** The method of the action, `post` by default. */
  method?: M;
  /** Refetch the queries of the resource after the action (true by default). */
  invalidate?: boolean;
}

/**
 * A mutation of an action, with the errors of its body by field (`ApiError.bodyErrors()` of
 * the last call: a 422 of the validation of the body, `/<field>`); its `error` is the
 * `ApiError` (`StatePanel` `errorState(error)` shows it).
 */
export type ActionMutation<Response, Variables> = UseMutationResult<Response, Error, Variables> & {
  errors: Readonly<Record<string, readonly string[]>>;
};

function withErrors<Response, Variables>(
  mutation: UseMutationResult<Response, Error, Variables>,
): ActionMutation<Response, Variables> {
  return { ...mutation, errors: mutation.error instanceof ApiError ? mutation.error.bodyErrors() : {} };
}

/**
 * A custom action of a route set, `<path><name>/`: `mutate(body)` calls it (`client.action`)
 * and resolves to its response, e.g. the id of a task of bazis-bg to follow.
 */
export function useAction<P extends ActionPath, N extends ActionName<paths, P, M>, M extends HttpMethod = 'post'>(
  path: P,
  name: N,
  { method = 'post' as M, invalidate = true }: ActionHookOptions<M> = {},
): ActionMutation<ActionResponse<P, N, M>, ActionVariables<ActionBody<P, N, M>>> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return withErrors(
    useMutation({
      mutationFn: (body) =>
        loose(api).action(path, name, body, { method }) as Promise<ActionResponse<P, N, M>>,
      onSuccess: () => (invalidate ? invalidateResource(queryClient, path) : undefined),
    }),
  );
}

/** A custom action of an item, `<path><id>/<name>/`: `mutate({id, body})` (`client.itemAction`). */
export function useItemAction<P extends ActionPath, N extends ActionName<paths, P, M, Item>, M extends HttpMethod = 'post'>(
  path: P,
  name: N,
  { method = 'post' as M, invalidate = true }: ActionHookOptions<M> = {},
): ActionMutation<ActionResponse<P, N, M, Item>, { id: string; body?: ActionBody<P, N, M, Item> }> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return withErrors(
    useMutation({
      mutationFn: ({ id, body }) =>
        loose(api).itemAction(path, id, name, body, { method }) as Promise<ActionResponse<P, N, M, Item>>,
      onSuccess: () => (invalidate ? invalidateResource(queryClient, path) : undefined),
    }),
  );
}
