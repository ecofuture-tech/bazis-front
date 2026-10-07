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

// spec/screens/task-card.yaml: a task with its status, its transits, its edit and its
// deletion.

import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useDestroy } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceCard } from '@/bazis/ui/resource-card';
import { toast } from '@/bazis/ui/state-panel';
import { StatusBadge, statusName, statusOf } from '@/bazis/ui/status-badge';
import { StatusHistory } from '@/bazis/ui/status-history';
import { TransitBar } from '@/bazis/ui/transit-bar';
import { Button } from '@/components/ui/button';

const TASKS = ROUTES['tasks.task'];

export function TaskCardScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const destroy = useDestroy(TASKS);
  return (
    <Screen
      id="task-card"
      title="Task"
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/tasks">
            <ArrowLeft />
            All tasks
          </Link>
        </Button>
      }
    >
      <ResourceCard
        path={TASKS}
        id={id}
        edit
        sections={[
          { id: 'main', title: 'Details', fields: ['title', 'status', 'assignee'] },
          { id: 'report', title: 'Report', fields: ['report'] },
        ]}
        badge={(item) => <StatusBadge resource={item} />}
        values={{ status: (item) => statusName(item.type, statusOf(item) ?? '') }}
        actions={[
          {
            id: 'delete',
            label: 'Delete',
            permission: 'delete',
            variant: 'destructive',
            onClick: () => {
              destroy.mutate(id, {
                onSuccess: () => {
                  toast({ title: 'Deleted' });
                  void navigate('/tasks');
                },
              });
            },
          },
        ]}
      >
        {(item) => (
          <>
            {/* null: the user can no longer view the task */}
            <TransitBar
              path={TASKS}
              id={id}
              onDone={(done) => {
                if (done === null) void navigate('/tasks');
              }}
            />
            {/* `history: true` of the screen */}
            <StatusHistory resource={item} />
          </>
        )}
      </ResourceCard>
    </Screen>
  );
}
