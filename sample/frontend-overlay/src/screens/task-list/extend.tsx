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

// The extension of the list of the tasks generated from spec/screens/task-list.yaml (`extend:
// true`): what its spec cannot say, before the list — the number of the tasks of each status,
// and their count by a background task (the custom action `count` of the route set, followed
// by `TaskProgress`) — and the height of its map (`list.map`).

import { Calculator } from 'lucide-react';

import { Filter, pagination } from '@/bazis/client';
import { TRANSITS } from '@/bazis/generated/contract';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import { useAction, useCan, useList } from '@/bazis/react';
import type { ResourceMapProps } from '@/bazis/ui/map';
import type { ResourceListProps } from '@/bazis/ui/resource-list';
import type { ScreenExtension } from '@/bazis/ui/screens';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { statusName, statusTone } from '@/bazis/ui/status-badge';
import { TaskProgress } from '@/bazis/ui/task-progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ENTITIES } from '@/screens/generated/entities';

const TASK = ENTITIES.task;

/** The dot of each tone of a status. */
const DOTS = {
  neutral: 'bg-neutral',
  primary: 'bg-primary',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

/** The number of the tasks of a status that the user may view. */
function StatusCount({ status }: { status: string }) {
  const { language } = useLanguage();
  const list = useList(TASK.path, { filter: Filter.where('status', status), page: { limit: 1 }, meta: ['pagination'] });
  return (
    <div className="grid min-w-0 gap-1 rounded-xl border bg-card px-3 py-2.5 shadow-xs sm:px-4 sm:py-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOTS[statusTone(status)]}`} />
        <span className="truncate">{statusName(TASK.type, status, language)}</span>
      </span>
      {list.data ? (
        <span className="text-2xl font-semibold tabular-nums">
          {formatNumber(pagination(list.data)?.count ?? 0, language)}
        </span>
      ) : (
        <Skeleton className="h-8 w-10" />
      )}
    </div>
  );
}

/**
 * The count of the tasks by their status in the background: the action `count` of the route
 * set queues a task of bazis-bg, whose progress and result `TaskProgress` shows. It is offered
 * to the users the backend lets call it (`custom_actions` of bazis-permit: a user with a
 * login); it changes no task: nothing to refetch.
 */
function TaskCount() {
  const { t } = useLanguage();
  const allowed = useCan(TASK.path, 'action_count');
  const count = useAction(TASK.path, 'count', { invalidate: false });
  if (!allowed) return null;
  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-bz="action:count"
          disabled={count.isPending}
          onClick={() => {
            count.mutate({});
          }}
        >
          <Calculator />
          {t('tasks.count')}
        </Button>
      </div>
      {count.isError && <StatePanel inline state={errorState(count.error)} error={count.error} />}
      {count.data && (
        <TaskProgress id={count.data.task} title={t('tasks.count')}>
          {(task) => <pre className="text-xs">{JSON.stringify(task.result)}</pre>}
        </TaskProgress>
      )}
    </div>
  );
}

export const extension: ScreenExtension<ResourceListProps, ResourceMapProps> = {
  before: (
    <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TRANSITS[TASK.type].statuses.map((status) => (
          <StatusCount key={status.id} status={status.id} />
        ))}
      </div>
      <TaskCount />
    </>
  ),
  // the map lower than by default; its tiles are those of `MapProvider` (OpenStreetMap)
  map: { className: 'h-56 sm:h-64' },
};
