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

// A background task of bazis-bg (`bg.task`, `useBgTask`), read until it is done: its name, its
// state (`bg:<state>`: `waiting`, `running`, then `success`, `error` or `interrupted`), the
// phase that runs with its progress (a bar for each counter, without a maximum when the task
// expects no count) and, done, what the product renders of it. bazis-bg saves the progress
// every few seconds; the traceback of a failure (`error`) is not shown.

import type { UseQueryResult } from '@tanstack/react-query';
import { useEffect, useRef, type ReactNode } from 'react';

import { CAPABILITIES, ROUTES } from '@/bazis/generated/contract';
import { useBgTask, type BgProgress, type BgTask } from '@/bazis/react/bg';
import { errorState, SkeletonLines, StatePanel } from '@/bazis/ui/state-panel';
import { cn } from '@/lib/utils';

/** The route set of the tasks of bazis-bg (`resource` of `CAPABILITIES.bg`); null when it is not routed. */
export const BG_TASKS: string | null =
  CAPABILITIES.bg?.resource != null
    ? ((ROUTES as Readonly<Record<string, string | undefined>>)[CAPABILITIES.bg.resource] ?? null)
    : null;

export type TaskView = 'waiting' | 'running' | 'success' | 'error' | 'interrupted';

export const TASK_LABELS: Readonly<Record<TaskView, string>> = {
  waiting: 'Waiting',
  running: 'Running',
  success: 'Done',
  error: 'Failed',
  interrupted: 'Interrupted',
};

const TONES: Readonly<Record<TaskView, string>> = {
  waiting: 'bg-muted text-muted-foreground',
  running: 'bg-info-soft text-info-ink',
  success: 'bg-success-soft text-success-ink',
  error: 'bg-danger-soft text-danger-ink',
  interrupted: 'bg-warning-soft text-warning-ink',
};

/** `useBgTask` over a plain path: the component is generic over the route sets of any product. */
const useAnyBgTask = useBgTask as unknown as (path: string, id: string | null) => UseQueryResult<BgTask>;

/** What a task is to the user: waiting until it runs, then running, then its outcome. */
export function taskView(task: BgTask): TaskView {
  if (task.outcome !== null) return task.outcome;
  return task.state === 'running' ? 'running' : 'waiting';
}

export interface TaskProgressProps {
  /** The id of the task, which the endpoint of the product that queued it returns. */
  id: string;
  /** The route set of the tasks: `BG_TASKS` by default. */
  path?: string | null;
  /** The title; the name of the task by default. */
  title?: ReactNode;
  /** Called once, when the task is done (whatever its outcome). */
  onDone?: (task: BgTask) => void;
  /** What the task gave, once it succeeded (its `result`). */
  children?: (task: BgTask) => ReactNode;
}

function Bar({ progress }: { progress: BgProgress }) {
  const { key, performed, expected } = progress;
  const percent =
    expected !== null && expected > 0 ? Math.min(100, Math.round(((performed ?? 0) / expected) * 100)) : null;
  const label = key === null ? 'Progress' : `Progress of ${key}`;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span>{key ?? ''}</span>
        <span>
          {performed ?? 0}
          {expected !== null && ` / ${String(expected)}`}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        {...(percent === null ? {} : { 'aria-valuemax': 100, 'aria-valuenow': percent })}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full bg-primary transition-[width]', percent === null && 'w-1/3 motion-safe:animate-pulse')}
          style={percent === null ? undefined : { width: `${String(percent)}%` }}
        />
      </div>
    </div>
  );
}

/** A background task of bazis-bg with its progress. */
export function TaskProgress({ id, path = BG_TASKS, title, onDone, children }: TaskProgressProps) {
  if (path === null) {
    return <StatePanel state="error" inline message="The backend does not route the tasks of bazis-bg." />;
  }
  return (
    <Task id={id} path={path} title={title} onDone={onDone}>
      {children}
    </Task>
  );
}

function Task({
  id,
  path,
  title,
  onDone,
  children,
}: Omit<TaskProgressProps, 'path'> & { path: string }) {
  const query = useAnyBgTask(path, id);
  const task = query.data;
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (task?.outcome == null || reported.current === task.id) return;
    reported.current = task.id;
    onDone?.(task);
  }, [task, onDone]);

  if (task === undefined) {
    return query.error ? (
      <StatePanel
        state={errorState(query.error)}
        error={query.error}
        inline
        onRetry={() => {
          void query.refetch();
        }}
      />
    ) : (
      <StatePanel state="loading" skeleton={<SkeletonLines lines={2} />} />
    );
  }
  const view = taskView(task);
  const name = title ?? task.name;
  return (
    <section
      data-bz={`bg:${view}`}
      aria-label={typeof name === 'string' ? name : undefined}
      className="grid gap-3 rounded-lg border bg-card p-(--space-card) text-card-foreground"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-medium">{name}</p>
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', TONES[view])}>{TASK_LABELS[view]}</span>
      </div>
      {view === 'running' && (
        <>
          {task.phase && <p className="text-sm text-muted-foreground">{task.phase}</p>}
          {task.progress.map((progress) => (
            <Bar key={progress.key ?? ''} progress={progress} />
          ))}
        </>
      )}
      {view === 'success' && children?.(task)}
    </section>
  );
}
