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
// deletion, and its steps (`card.related`), added here with the task fixed while the user may
// change the task.

import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { useDestroy } from '@/bazis/react';
import { Screen } from '@/bazis/ui/app-shell';
import { permitted } from '@/bazis/ui/resource';
import { RelatedList, ResourceCard } from '@/bazis/ui/resource-card';
import { toast } from '@/bazis/ui/state-panel';
import { StatusBadge, statusName, statusOf } from '@/bazis/ui/status-badge';
import { StatusHistory } from '@/bazis/ui/status-history';
import { TransitBar } from '@/bazis/ui/transit-bar';
import { Button } from '@/components/ui/button';

const TASKS = ROUTES['tasks.task'];
const STEPS = ROUTES['tasks.step'];

export function TaskCardScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const destroy = useDestroy(TASKS);
  const { language, t } = useLanguage();
  return (
    <Screen
      id="task-card"
      title={t('task.title')}
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link to="/tasks">
            <ArrowLeft />
            {t('task.all')}
          </Link>
        </Button>
      }
    >
      <ResourceCard
        path={TASKS}
        id={id}
        edit
        sections={[
          { id: 'main', title: t('task.details'), fields: ['title', 'status', 'assignee', 'attachment', 'priority'] },
          { id: 'report', title: t('task.report'), fields: ['report'] },
        ]}
        badge={(item) => <StatusBadge resource={item} />}
        values={{ status: (item) => statusName(item.type, statusOf(item) ?? '', language) }}
        actions={[
          {
            id: 'delete',
            label: t('task.delete'),
            permission: 'delete',
            variant: 'destructive',
            onClick: () => {
              destroy.mutate(id, {
                onSuccess: () => {
                  toast({ title: t('task.deleted') });
                  void navigate('/tasks');
                },
              });
            },
          },
        ]}
      >
        {(item, meta) => (
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
            {/* `card.related` of the screen: a step is added while the task may be changed */}
            <RelatedList
              path={STEPS}
              entity="step"
              relation="task"
              item={id}
              title={t('task.steps')}
              columns={['title', 'dt_created']}
              add={permitted(meta, 'change') ? { id: 'add-step', label: t('task.add_step'), fields: ['title'] } : undefined}
              emptyMessage={t('task.no_steps')}
            />
          </>
        )}
      </ResourceCard>
    </Screen>
  );
}
