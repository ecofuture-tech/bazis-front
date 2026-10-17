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

// spec/screens/home.yaml: the dashboard of the tasks: their number by status and the task
// that a scenario reviews (the tiles, the drafts opening their report), the tasks by status
// and by the week of their creation (the charts), the last ones (`recent`), and the creation
// of a task, whose card opens then; the links to the other screens of the navigation.

import { CircleCheck, FilePen, LoaderCircle, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Filter } from '@/bazis/client';
import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { useCan } from '@/bazis/react';
import { StatusChart, TimeChart } from '@/bazis/ui/charts';
import { Dashboard } from '@/bazis/ui/dashboard';
import { FormSurface, ResourceForm } from '@/bazis/ui/resource-form';
import { Button } from '@/components/ui/button';

const TASKS = ROUTES['tasks.task'];

export function HomeScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [creating, setCreating] = useState(false);
  const canAdd = useCan(TASKS, 'add');
  const open = (task: string) => void navigate(`/tasks/${task}`);
  return (
    <>
      <Dashboard
        title={t('home.title')}
        description={t('home.description')}
        actions={
          canAdd ? (
            <Button
              type="button"
              data-bz="action:create"
              onClick={() => {
                setCreating(true);
              }}
            >
              <Plus />
              {t('tasks.new')}
            </Button>
          ) : undefined
        }
        tiles={[
          {
            id: 'drafts',
            path: TASKS,
            filter: Filter.where('status', 'draft'),
            label: t('home.drafts'),
            icon: FilePen,
            onOpen: () => void navigate('/drafts'),
          },
          {
            id: 'in-progress',
            path: TASKS,
            filter: Filter.where('status', 'in_progress'),
            label: t('home.in_progress'),
            tone: 'info',
            icon: LoaderCircle,
          },
          {
            id: 'done',
            path: TASKS,
            filter: Filter.where('status', 'done'),
            label: t('home.done'),
            tone: 'success',
            icon: CircleCheck,
          },
          // the task that `manage.py e2e_data` creates: one at every run
          {
            id: 'review',
            path: TASKS,
            filter: Filter.where('title', 'Review the plan'),
            label: t('home.review'),
            tone: 'warning',
            icon: Search,
          },
        ]}
        charts={
          <>
            <StatusChart id="by-status" path={TASKS} label={t('home.by_status')} />
            <TimeChart
              id="created-by-week"
              path={TASKS}
              field="dt_created"
              bucket="week"
              last={12}
              label={t('home.by_week')}
            />
          </>
        }
        recent={[
          {
            id: 'last-tasks',
            path: TASKS,
            label: t('home.last_tasks'),
            columns: ['title', 'status', 'dt_created'],
            sort: ['-dt_created'],
            limit: 5,
            onOpen: open,
          },
        ]}
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
          fields={['title']}
          onSaved={(saved) => {
            setCreating(false);
            open(saved.data.id);
          }}
          onCancel={() => {
            setCreating(false);
          }}
        />
      </FormSurface>
    </>
  );
}
