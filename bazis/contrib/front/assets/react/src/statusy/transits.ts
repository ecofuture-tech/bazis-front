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

// The transits of bazis-statusy. `meta: ['state_actions']` of a retrieve lists the transits
// that the current user may run on the item now (its status and their permissions): each
// with the endpoint and the JSON Schema of its body (`{transit, payload}`), and in
// `restricts` the errors of its validators, which make it fail. An entry may be a list: a
// transit and those of related items that run with it.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { EndpointOf, ResponseOf, RouteSetWith } from '@/bazis/client';
import type { paths } from '@/bazis/generated/schema';

import { useBazis } from '../context.js';
import { keys } from '../keys.js';
import { invalidateResource } from '../mutations.js';
import { retrieveQuery } from '../queries.js';
import { allowsNull, standalone } from '../schema.js';
import { loose, type JsonSchema } from '../types.js';

type TransitSuffix = '{item_id}/transit/';

/** The route sets of statusy models (`StatusyRouteSetBase`). */
export type TransitPath = RouteSetWith<paths, TransitSuffix, 'post'>;
export type TransitResponse<P extends TransitPath> = ResponseOf<EndpointOf<paths, P, TransitSuffix, 'post'>>;

/** An error of a validator of a transit (`StateActionRestrictsSchema`). */
export interface TransitRestrict {
  title: string;
  code: string;
  detail: string | null;
  meta: Readonly<Record<string, unknown>> | null;
}

/** A transit that the current user may run on the item. */
export interface Transit {
  /** The id of the transit; its name is in `TRANSITS` of `contract.ts`. */
  id: string;
  /** No validator restricts it: running it is expected to succeed. */
  allowed: boolean;
  restricts: readonly TransitRestrict[];
  /** The JSON Schema of the payload that it requires; null when it takes none. */
  payload: JsonSchema | null;
  hint: string | null;
  hintTitle: string | null;
  hintAction: string | null;
  /** The item that it changes: the item itself, or a related one for `related`. */
  resource: { type: string; id: string };
  /** The transits of related items that run with it. */
  related: readonly Transit[];
}

interface StateAction {
  endpoint?: { body?: JsonSchema | null } | null;
  restricts?: readonly TransitRestrict[] | null;
  hint?: string | null;
  hint_title?: string | null;
  hint_action?: string | null;
  resource?: { type: string; id: string } | null;
}

function transit(action: StateAction, related: readonly StateAction[]): Transit {
  const body = action.endpoint?.body ?? {};
  const properties = (body.properties ?? {}) as Record<string, JsonSchema | undefined>;
  const id = properties.transit?.default;
  const restricts = action.restricts ?? [];
  return {
    id: typeof id === 'string' ? id : '',
    allowed: restricts.length === 0,
    restricts,
    // a transit without a typed payload takes any object or null
    payload: allowsNull(properties.payload, body) ? null : standalone(properties.payload, body),
    hint: action.hint ?? null,
    hintTitle: action.hint_title ?? null,
    hintAction: action.hint_action ?? null,
    resource: { type: action.resource?.type ?? '', id: action.resource?.id ?? '' },
    related: related.map((it) => transit(it, [])),
  };
}

/** The transits of `meta.state_actions` of a retrieve. */
export function transits(document: {
  meta?: { state_actions?: readonly (StateAction | readonly StateAction[])[] | null } | null;
}): readonly Transit[] {
  return (document.meta?.state_actions ?? []).map((entry) => {
    if (!Array.isArray(entry)) return transit(entry as StateAction, []);
    const [first, ...related] = entry as readonly StateAction[];
    return transit(first ?? {}, related);
  });
}

/**
 * The transits that the current user may run on the item now, from
 * `meta: ['state_actions']` of its retrieve (the query of `useItem` with this meta). Run
 * one with `useTransit`. What the item must satisfy before a transit is
 * `useSchema(path, 'transit', id)`.
 */
export function useTransits(
  path: TransitPath,
  id: string,
): UseQueryResult<readonly Transit[]> {
  const { api, session } = useBazis();
  return useQuery({
    ...retrieveQuery<Parameters<typeof transits>[0]>(api, path, id, { meta: ['state_actions'] }, session),
    select: transits,
  });
}

/**
 * Runs a transit of the item: `mutate({transit, payload})`. Resolves to the item, or to
 * null when the user can no longer view it (204): its queries are removed then, leave its
 * screen. The queries of the resource are refetched.
 */
export function useTransit<P extends TransitPath>(
  path: P,
  id: string,
): UseMutationResult<TransitResponse<P> | null, Error, { transit: string; payload?: unknown }> {
  const { api } = useBazis();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ transit: name, payload }) =>
      loose(api).transit(path, id, name, payload) as Promise<TransitResponse<P> | null>,
    onSuccess: (item) => {
      if (item === null) queryClient.removeQueries({ queryKey: keys.item(path, id) });
      return invalidateResource(queryClient, path);
    },
  });
}
