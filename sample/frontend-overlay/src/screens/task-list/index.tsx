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

// spec/screens/task-list.yaml: the tasks with the number of each status, their count by a
// background task (the custom action `count` of the route set, followed by `TaskProgress`),
// the tasks with a location on a map (`list.map`), and the creation of a task in a dialog or
// on a page (`composition.forms` of the theme); the open task is selected, next to the list
// (`composition.list_card`).

import { Calculator, Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Filter, pagination } from '@/bazis/client';
import { ROUTES, TRANSITS } from '@/bazis/generated/contract';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import { useAction, useCan, useList } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceMap } from '@/bazis/ui/map';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { errorState, StatePanel } from '@/bazis/ui/state-panel';
import { StatusBadge, statusName, statusOptions, statusTone } from '@/bazis/ui/status-badge';
import { TaskProgress } from '@/bazis/ui/task-progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const TASKS = ROUTES['tasks.task'];

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
function StatusCount({ status, name }: { status: string; name: string }) {
  const { language } = useLanguage();
  const list = useList(TASKS, { filter: Filter.where('status', status), page: { limit: 1 }, meta: ['pagination'] });
  return (
    <div className="grid min-w-0 gap-1 rounded-xl border bg-card px-3 py-2.5 shadow-xs sm:px-4 sm:py-3">
      <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOTS[statusTone(status)]}`} />
        <span className="truncate">{name}</span>
      </span>
      {list.data ? (
        <span className="text-2xl font-semibold tabular-nums">{formatNumber(pagination(list.data)?.count ?? 0, language)}</span>
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
  const allowed = useCan(TASKS, 'action_count');
  const count = useAction(TASKS, 'count', { invalidate: false });
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

export function TaskListScreen() {
  const navigate = useNavigate();
  // the task open next to the list
  const { id } = useParams();
  const [creating, setCreating] = useState(false);
  const { language, t } = useLanguage();
  return (
    <Screen id="task-list" title={t('tasks.title')} description={t('tasks.description')}>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {TRANSITS['tasks.task'].statuses.map((status) => (
          <StatusCount key={status.id} status={status.id} name={statusName('tasks.task', status.id, language)} />
        ))}
      </div>
      <TaskCount />
      {/* `list.map` of the screen: the tasks with a location, a marker opening each */}
      <ResourceMap
        path={TASKS}
        entity="task"
        field="location"
        selected={id}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
        emptyMessage={t('tasks.no_location')}
        className="h-56 sm:h-64"
      />
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'priority', 'assignee', 'dt_created']}
        // the priority is filtered by the labels of its choices (the list schema)
        filters={[{ field: 'status', options: statusOptions('tasks.task', language) }, 'assignee', 'priority']}
        sort={['-dt_created']}
        search
        selected={id}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
        actions={[
          {
            id: 'create',
            label: t('tasks.new'),
            icon: Plus,
            permission: 'add',
            onClick: () => {
              setCreating(true);
            },
          },
        ]}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
        emptyMessage={t('tasks.empty')}
      />
      <FormSurface
        open={creating}
        title={t('tasks.new')}
        description={t('tasks.new_description')}
        onClose={() => {
          setCreating(false);
        }}
      >
        <ResourceForm
          path={TASKS}
          fields={['title', 'assignee', 'priority']}
          onSaved={(saved) => {
            setCreating(false);
            void navigate(`/tasks/${saved.data.id}`);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      </FormSurface>
    </Screen>
  );
}
