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

// The background tasks of bazis-bg, the resource `bg.task` (`CAPABILITIES.bg.resource`): a
// user reads the tasks they queued. A task goes `waiting` → `starting` → `running` →
// `done`; while it runs, `phase` is the name of its phase and `expected`/`performed` its
// progress (numbers, or numbers by key), saved every few seconds; when a phase ends they are
// cleared (the phase goes to its history). Done, `phase` is `completed`, `error` or
// `interrupted`, `error` holds the traceback of a failure and `result` what the task set.

import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useBazis } from '../context.js';
import { retrieveQuery } from '../queries.js';
import type { ItemPath } from '../types.js';

/** How often a task that is not done is read, in milliseconds. */
export const BG_POLL_INTERVAL = 2000;

export type BgState = 'draft' | 'waiting' | 'starting' | 'running' | 'done';

/** The progress of a phase: one counter, or one by key. */
export interface BgProgress {
  /** The key of the counter; null for a single counter. */
  key: string | null;
  performed: number | null;
  expected: number | null;
}

/** A task of bazis-bg as the components show it. */
export interface BgTask {
  id: string;
  name: string;
  state: BgState;
  phase: string;
  /** Done: `success`, `error` or `interrupted`; null before. */
  outcome: 'success' | 'error' | 'interrupted' | null;
  progress: readonly BgProgress[];
  result: unknown;
  started: string | null;
  finished: string | null;
}

interface Attributes {
  name?: unknown;
  state?: unknown;
  phase?: unknown;
  expected?: unknown;
  performed?: unknown;
  result?: unknown;
  error?: unknown;
  interrupt?: unknown;
  dt_start?: unknown;
  dt_finish?: unknown;
}

const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);

function counters(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** The progress of the phase: `expected` and `performed`, numbers or numbers by key. */
export function bgProgress(expected: unknown, performed: unknown): BgProgress[] {
  const byKey = [counters(expected), counters(performed)];
  if (byKey[0] !== null || byKey[1] !== null) {
    const names = [...new Set([...Object.keys(byKey[0] ?? {}), ...Object.keys(byKey[1] ?? {})])];
    return names.map((key) => ({ key, expected: number(byKey[0]?.[key]), performed: number(byKey[1]?.[key]) }));
  }
  if (number(expected) === null && number(performed) === null) return [];
  return [{ key: null, expected: number(expected), performed: number(performed) }];
}

/** A task of a retrieve of `bg.task`. */
export function bgTask(document: { data: { id: string | number; attributes: unknown } }): BgTask {
  const attributes = (document.data.attributes ?? {}) as Attributes;
  const state = (typeof attributes.state === 'string' ? attributes.state : 'waiting') as BgState;
  const outcome =
    state !== 'done' ? null : attributes.interrupt === true ? 'interrupted' : attributes.error ? 'error' : 'success';
  return {
    id: String(document.data.id),
    name: typeof attributes.name === 'string' ? attributes.name : '',
    state,
    phase: typeof attributes.phase === 'string' ? attributes.phase : '',
    outcome,
    progress: bgProgress(attributes.expected, attributes.performed),
    result: attributes.result ?? null,
    started: typeof attributes.dt_start === 'string' ? attributes.dt_start : null,
    finished: typeof attributes.dt_finish === 'string' ? attributes.dt_finish : null,
  };
}

/**
 * A task of bazis-bg (`ROUTES[CAPABILITIES.bg.resource]`, null: none), read every
 * `BG_POLL_INTERVAL` until it is done. It is the query of `useItem(path, id)`: a change of
 * the resource (a message of the socket, `useLiveQueries`) refetches it too.
 */
export function useBgTask(path: ItemPath, id: string | null): UseQueryResult<BgTask> {
  const { api, session } = useBazis();
  return useQuery({
    ...retrieveQuery<{ data: { id: string | number; attributes: unknown } }>(api, path, id ?? '', {}, session),
    enabled: id !== null,
    select: bgTask,
    refetchInterval: ({ state }) =>
      state.error !== null || (state.data !== undefined && bgTask(state.data).state === 'done') ? false : BG_POLL_INTERVAL,
  });
}
