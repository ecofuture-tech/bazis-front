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

// spec/screens/task-list.yaml: the tasks, and the creation of a task in a dialog.

import { useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceForm } from '@/bazis/ui/resource-form';
import { ResourceList } from '@/bazis/ui/resource-list';
import { StatusBadge, statusOptions } from '@/bazis/ui/status-badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TASKS = ROUTES['tasks.task'];

export function TaskListScreen() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <Screen id="task-list" title="Tasks">
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'status', 'assignee', 'dt_created']}
        filters={[{ field: 'status', options: statusOptions('tasks.task') }, 'assignee']}
        sort={['-dt_created']}
        search
        onOpen={(id) => void navigate(`/tasks/${id}`)}
        actions={[
          {
            id: 'create',
            label: 'Create',
            permission: 'add',
            onClick: () => {
              setCreating(true);
            },
          },
        ]}
        cells={{ status: (row) => <StatusBadge resource={row} /> }}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>The task is created as a draft.</DialogDescription>
          </DialogHeader>
          <ResourceForm
            path={TASKS}
            fields={['title', 'assignee']}
            onSaved={(saved) => void navigate(`/tasks/${saved.data.id}`)}
            onCancel={() => {
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
