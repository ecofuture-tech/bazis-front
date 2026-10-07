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

// spec/screens/task-list.yaml: the tasks with the number of each status, and the creation of
// a task in a dialog or on a page (`composition.forms` of the theme); the open task is
// selected, next to the list (`composition.list_card`).

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { Filter, pagination } from '@/bazis/client';
import { ROUTES, TRANSITS } from '@/bazis/generated/contract';
import { useList } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { StatusBadge, statusOptions, statusTone } from '@/bazis/ui/status-badge';
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
  const list = useList(TASKS, { filter: Filter.where('status', status), page: { limit: 1 }, meta: ['pagination'] });
  return (
    <div className="grid gap-1 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <span aria-hidden="true" className={`size-2 rounded-full ${DOTS[statusTone(status)]}`} />
        {name}
      </span>
      {list.data ? (
        <span className="text-2xl font-semibold tabular-nums">{pagination(list.data)?.count ?? '—'}</span>
      ) : (
        <Skeleton className="h-8 w-10" />
      )}
    </div>
  );
}

export function TaskListScreen() {
  const navigate = useNavigate();
  // the task open next to the list
  const { id } = useParams();
  const [creating, setCreating] = useState(false);
  return (
    <Screen id="task-list" title="Tasks" description="The tasks of the team, from the draft to the report.">
      <div className="grid grid-cols-3 gap-3">
        {TRANSITS['tasks.task'].statuses.map((status) => (
          <StatusCount key={status.id} status={status.id} name={status.name} />
        ))}
      </div>
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'assignee', 'dt_created']}
        filters={[{ field: 'status', options: statusOptions('tasks.task') }, 'assignee']}
        sort={['-dt_created']}
        search
        selected={id}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
        actions={[
          {
            id: 'create',
            label: 'New task',
            icon: Plus,
            permission: 'add',
            onClick: () => {
              setCreating(true);
            },
          },
        ]}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
        emptyMessage="No tasks yet."
      />
      <FormSurface
        open={creating}
        title="New task"
        description="The task is created as a draft."
        onClose={() => {
          setCreating(false);
        }}
      >
        <ResourceForm
          path={TASKS}
          fields={['title', 'assignee']}
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
