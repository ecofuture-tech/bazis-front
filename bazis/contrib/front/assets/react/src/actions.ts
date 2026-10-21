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
// bazis-bg answers with its id, which `TaskProgress` (or `useBgTask`) follows. An action
// declared with GET (`@http_get`) that a screen reads is a query instead (`useActionQuery`,
// `useItemActionQuery`): keyed under its resource, so that a change of it refetches it, and
// by its query parameters. An action that answers a file (`custom_actions[].file` of the
// contract) is saved in the browser (`useActionFile`).

import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';

import {
  ApiError,
  saveFile,
  type ActionName,
  type BodyOf,
  type EndpointOf,
  type ErrorObject,
  type HttpMethod,
  type QueryParams,
  type ResponseOf,
  type RouteSetPath,
} from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { useBazis } from './context.js';
import { keys } from './keys.js';
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

/** The query parameters of the action `N` of the route set `P` for the method `M`, as its OpenAPI declares them. */
export type ActionQuery<P extends string, N extends string, M extends HttpMethod, Prefix extends string = ''> = QueryParams<
  EndpointOf<paths, P, `${Prefix}${N}/`, M>
>;

export interface ActionQueryOptions<Query> {
  /**
   * The query parameters of the action (`?<name>=<value>`), typed by its OpenAPI and in the
   * key of the query: other parameters are another query. Nothing is read while it is null
   * (a form not submitted yet).
   */
  query?: Query | null;
}

/**
 * The options argument of a query of an action whose query parameters are `Query`: required,
 * with its `query` (or null), when the action has a required query parameter, optional
 * otherwise.
 */
export type ActionQueryArg<Query> = [Query] extends [never]
  ? [options?: ActionQueryOptions<never>]
  : object extends Query
    ? [options?: ActionQueryOptions<Query>]
    : [options: ActionQueryOptions<Query> & { query: Query | null }];

/** The query parameters of the options argument of a query of an action. */
function queryOf(args: readonly unknown[]): Readonly<Record<string, unknown>> | null | undefined {
  return (args[0] as ActionQueryOptions<Readonly<Record<string, unknown>>> | undefined)?.query;
}

export interface ActionHookOptions<M extends HttpMethod> {
  /** The method of the action, `post` by default. */
  method?: M;
  /** Refetch the queries of the resource after the action (true by default). */
  invalidate?: boolean;
}

/**
 * A mutation of an action, with the errors of its body by field (`ApiError.bodyErrors()` of
 * the last call: a 422 of the validation of the body, `/<field>`, in the language of the
 * interface: `useErrorMessage`); its `error` is the
 * `ApiError` (`StatePanel` `errorState(error)` shows it).
 */
export type ActionMutation<Response, Variables> = UseMutationResult<Response, Error, Variables> & {
  errors: Readonly<Record<string, readonly string[]>>;
};

function withErrors<Response, Variables>(
  mutation: UseMutationResult<Response, Error, Variables>,
  message: (error: ErrorObject) => string,
): ActionMutation<Response, Variables> {
  return { ...mutation, errors: mutation.error instanceof ApiError ? mutation.error.bodyErrors(message) : {} };
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
  const { api, errorMessage } = useBazis();
  const queryClient = useQueryClient();
  return withErrors(
    useMutation({
      mutationFn: (body) =>
        loose(api).action(path, name, body, { method }) as Promise<ActionResponse<P, N, M>>,
      onSuccess: () => (invalidate ? invalidateResource(queryClient, path) : undefined),
    }),
    errorMessage,
  );
}

/**
 * A custom action of a route set that answers a file (`custom_actions[].file` of the
 * contract), `POST <path><name>/`: `mutate(body)` calls it (`client.actionFile`), saves the
 * file in the browser under the name the backend gives it (`Content-Disposition`; the name of
 * the action without one) and resolves to that name, not the content; the queries of its
 * resource are refetched after it, as after `useAction`.
 */
export function useActionFile<P extends ActionPath, N extends ActionName<paths, P, 'post'>>(
  path: P,
  name: N,
): ActionMutation<string, ActionVariables<ActionBody<P, N, 'post'>>> {
  const { api, errorMessage } = useBazis();
  const queryClient = useQueryClient();
  return withErrors(
    useMutation({
      mutationFn: async (body) => {
        const file = await loose(api).actionFile(path, name, body);
        saveFile(file, name);
        return file.name ?? name;
      },
      onSuccess: () => invalidateResource(queryClient, path),
    }),
    errorMessage,
  );
}

/** A custom action of an item, `<path><id>/<name>/`: `mutate({id, body})` (`client.itemAction`). */
export function useItemAction<P extends ActionPath, N extends ActionName<paths, P, M, Item>, M extends HttpMethod = 'post'>(
  path: P,
  name: N,
  { method = 'post' as M, invalidate = true }: ActionHookOptions<M> = {},
): ActionMutation<ActionResponse<P, N, M, Item>, { id: string; body?: ActionBody<P, N, M, Item> }> {
  const { api, errorMessage } = useBazis();
  const queryClient = useQueryClient();
  return withErrors(
    useMutation({
      mutationFn: ({ id, body }) =>
        loose(api).itemAction(path, id, name, body, { method }) as Promise<ActionResponse<P, N, M, Item>>,
      onSuccess: () => (invalidate ? invalidateResource(queryClient, path) : undefined),
    }),
    errorMessage,
  );
}

/**
 * A custom action of a route set declared with GET, `<path><name>/`, read as a query (the
 * response of `client.action` with the method `get` and the query parameters of `query`,
 * required with a required parameter): a summary, a report, a check, the content that a
 * screen shows. It is refetched with the
 * queries of its resource (after a mutation of it or an action); its `error` is the
 * `ApiError`.
 */
export function useActionQuery<P extends ActionPath, N extends ActionName<paths, P, 'get'>>(
  path: P,
  name: N,
  ...options: ActionQueryArg<ActionQuery<P, N, 'get'>>
): UseQueryResult<ActionResponse<P, N, 'get'>> {
  const { api, scope } = useBazis();
  const query = queryOf(options);
  const params = query ?? undefined;
  return useQuery({
    queryKey: keys.action(path, name, query, scope),
    queryFn: ({ signal }) =>
      loose(api).action(path, name, undefined, { method: 'get', query: params, signal }) as Promise<
        ActionResponse<P, N, 'get'>
      >,
    enabled: query !== null,
  });
}

/**
 * A custom action of an item declared with GET, `<path><id>/<name>/`, read as a query
 * (`client.itemAction` with the method `get` and the query parameters of `query`); nothing
 * is read while `id` or `query` is null. It is refetched with the queries of its item and of
 * its resource.
 */
export function useItemActionQuery<P extends ActionPath, N extends ActionName<paths, P, 'get', Item>>(
  path: P,
  id: string | null,
  name: N,
  ...options: ActionQueryArg<ActionQuery<P, N, 'get', Item>>
): UseQueryResult<ActionResponse<P, N, 'get', Item>> {
  const { api, scope } = useBazis();
  const query = queryOf(options);
  const params = query ?? undefined;
  return useQuery({
    queryKey: keys.itemAction(path, id ?? '', name, query, scope),
    queryFn: ({ signal }) =>
      loose(api).itemAction(path, id ?? '', name, undefined, { method: 'get', query: params, signal }) as Promise<
        ActionResponse<P, N, 'get', Item>
      >,
    enabled: id !== null && query !== null,
  });
}
