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

// spec/screens/task-calendar.yaml: the tasks on the days they were created, a month or a
// week at a time; an item opens the task.

import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceCalendar } from '@/bazis/ui/resource-calendar';

const TASKS = ROUTES['tasks.task'];

export function TaskCalendarScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Screen id="task-calendar" title={t('tasks.calendar')} description={t('tasks.calendar_description')}>
      <ResourceCalendar
        path={TASKS}
        entity="task"
        field="dt_created"
        label={['title']}
        views={['month', 'week']}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
      />
    </Screen>
  );
}
