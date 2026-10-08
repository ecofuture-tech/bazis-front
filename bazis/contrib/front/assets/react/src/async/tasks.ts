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

// The requests of bazis-async-request and the tasks of bazis-async-background. A request
// sent with `X-Async-Background` is queued in Kafka (202 with the id of its task) or, without
// Kafka, run at once; a task is read at the result path of the contract
// (`CAPABILITIES.async_background.result_path`) with the token of the request that queued
// it, until it is `completed` or `failed`. Its statuses also come on the socket of bazis-ws:
// with `useLiveQueries` of `@/bazis/react/ws` mounted, each refetches the task at once.

import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';

import type {
  BackgroundMethod,
  BackgroundResult,
  BackgroundStart,
  BackgroundStatus,
  ReplayedResponse,
} from '@/bazis/client';

import { useBazis } from '../context.js';
import { keys } from '../keys.js';

/** How often the state of a task that is not done is read, in milliseconds. */
export const ASYNC_POLL_INTERVAL = 2000;

/** A request of the API to run in the background: its method, its path and its body (a JSON:API document). */
export interface AsyncRequest {
  method: BackgroundMethod;
  path: string;
  body?: unknown;
}

/**
 * Sends a request with `X-Async-Background` (bazis-async-request): `mutate({method, path,
 * body})` resolves to `{status: 'queued', taskId}` (202), or `{status: 'done', response}`
 * when the backend ran it at once. Nothing is refetched: the change is done when its task
 * is (`useAsyncTask`); refetch then what it changed (`['bazis', path]`).
 */
export function useAsyncRequest(): UseMutationResult<BackgroundStart, Error, AsyncRequest> {
  const { api } = useBazis();
  return useMutation({
    mutationFn: ({ method, path, body }) => api.background(method, path, body === undefined ? {} : { body }),
  });
}

/** The state of a task of bazis-async-background. */
export interface AsyncTask {
  /** Null while it is first read, and without a task. */
  status: BackgroundStatus | null;
  /** The response of the task once it set one (a `ReplayedResponse` for bazis-async-request), else null. */
  response: unknown;
  /** `completed` or `failed`: it is no longer read. */
  done: boolean;
  /** The error of the reading: 404 for an unknown or expired task, 403 for another token. */
  error: Error | null;
}

/** Whether a task is finished. */
export function finished(status: BackgroundStatus | null | undefined): boolean {
  return status === 'completed' || status === 'failed';
}

/** The result path of a task: `result_path` of the contract with its id. */
export function resultPath(path: string, taskId: string): string {
  return path.replace('{task_id}', encodeURIComponent(taskId));
}

/**
 * The state of a task (null: none), read at `path` (`CAPABILITIES.async_background.result_path`)
 * every `ASYNC_POLL_INTERVAL` until it is done or the reading fails.
 */
export function useAsyncTask(path: string, taskId: string | null): AsyncTask {
  const { api, session } = useBazis();
  const query = useQuery<BackgroundResult>({
    queryKey: keys.asyncTask(taskId ?? '', session),
    queryFn: ({ signal }) => api.backgroundResult(resultPath(path, taskId ?? ''), { signal }),
    enabled: taskId !== null,
    refetchInterval: ({ state }) =>
      state.error !== null || finished(state.data?.status) ? false : ASYNC_POLL_INTERVAL,
  });
  const status = taskId === null ? null : (query.data?.status ?? null);
  return {
    status,
    response: taskId === null ? null : (query.data?.response ?? null),
    done: finished(status),
    error: taskId === null ? null : query.error,
  };
}

/** The response of a request replayed by bazis-async-request (its status and body); null for another response. */
export function replayedResponse(response: unknown): ReplayedResponse | null {
  if (typeof response !== 'object' || response === null) return null;
  const replayed = response as Partial<ReplayedResponse>;
  return typeof replayed.status === 'number' && typeof replayed.endpoint === 'string' && 'response' in replayed
    ? (replayed as ReplayedResponse)
    : null;
}
