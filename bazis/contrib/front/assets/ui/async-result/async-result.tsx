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

// The result of a request run in the background (bazis-async-request, `useAsyncRequest`) or
// of a task of bazis-async-background: queued, it is read until it is done
// (`async:<status>`: `pending`, `processing`, then `completed` or `failed`), and its
// response rendered by the product; a request that the backend ran at once (no Kafka) is
// `completed` with its response. The response of a replayed request is that of its
// endpoint: an HTTP error there is `failed`, with its message.

import { useEffect, useRef, type ReactNode } from 'react';

import type { BackgroundStart } from '@/bazis/client';
import { CAPABILITIES } from '@/bazis/generated/contract';
import { replayedResponse, useAsyncTask } from '@/bazis/react/async';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { cn } from '@/lib/utils';

/** The result path of the tasks (`result_path` of `CAPABILITIES.async_background`); null when it is not routed. */
export const RESULT_PATH: string | null = CAPABILITIES.async_background?.result_path ?? null;

export type ResultView = 'pending' | 'processing' | 'completed' | 'failed';

export const RESULT_LABELS: Readonly<Record<ResultView, string>> = {
  pending: 'Queued',
  processing: 'In progress',
  completed: 'Done',
  failed: 'Failed',
};

const TONES: Readonly<Record<ResultView, string>> = {
  pending: 'bg-muted text-muted-foreground',
  processing: 'bg-info-soft text-info-ink',
  completed: 'bg-success-soft text-success-ink',
  failed: 'bg-danger-soft text-danger-ink',
};

export interface AsyncOutcome {
  view: ResultView;
  /** The response: of a replayed request, the body of the response of its endpoint. */
  response: unknown;
  /** The message of a failure. */
  message: string | null;
}

function messageOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const { errors, error } = body as { errors?: { detail?: unknown; title?: unknown }[]; error?: unknown };
  const first = Array.isArray(errors) ? errors[0] : undefined;
  const text = first?.detail ?? first?.title ?? error;
  return typeof text === 'string' ? text : null;
}

/** What a finished task gave: `completed` or `failed`, its response and the message of a failure. */
export function asyncResult(status: 'completed' | 'failed', response: unknown): AsyncOutcome {
  const replayed = replayedResponse(response);
  const body = replayed === null ? response : replayed.response;
  const failed = status === 'failed' || (replayed !== null && replayed.status >= 400);
  return {
    view: failed ? 'failed' : 'completed',
    response: body,
    message: failed ? (messageOf(body) ?? (replayed ? `HTTP ${String(replayed.status)}` : null)) : null,
  };
}

export interface AsyncResultProps {
  /** What `useAsyncRequest` resolved to; a task of the product's own is `{status: 'queued', taskId}`. */
  start: BackgroundStart;
  /** The result path of the tasks: `RESULT_PATH` by default. */
  path?: string | null;
  /** The title of the result. */
  title?: ReactNode;
  /** Called once, when the task is done. */
  onDone?: (result: AsyncOutcome) => void;
  /** What the response is to the user, once it completed. */
  children?: (response: unknown) => ReactNode;
}

/** The result of a request run in the background, until it is done. */
export function AsyncResult({ start, path = RESULT_PATH, title = 'Result', onDone, children }: AsyncResultProps) {
  const queued = start.status === 'queued' ? start.taskId : null;
  const task = useAsyncTask(path ?? '', path === null ? null : queued);
  const result =
    start.status === 'done'
      ? asyncResult('completed', start.response)
      : task.status === 'completed' || task.status === 'failed'
        ? asyncResult(task.status, task.response)
        : null;
  // once for each request
  const reported = useRef<BackgroundStart | null>(null);
  useEffect(() => {
    if (result === null || reported.current === start) return;
    reported.current = start;
    onDone?.(result);
  }, [result, start, onDone]);

  if (queued !== null && path === null) {
    return <StatePanel state="error" inline message="The backend does not route the results of bazis-async-background." />;
  }
  if (task.error) return <StatePanel state={errorState(task.error)} error={task.error} inline />;
  const view: ResultView = result?.view ?? (task.status === 'processing' ? 'processing' : 'pending');
  return (
    <section data-bz={`async:${view}`} aria-busy={result === null} className="grid gap-3 rounded-lg border bg-card p-(--space-card) text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{title}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', TONES[view])}>{RESULT_LABELS[view]}</span>
      </div>
      {result?.message != null && <p className="text-sm text-danger-ink">{result.message}</p>}
      {result?.view === 'completed' && children?.(result.response)}
    </section>
  );
}
