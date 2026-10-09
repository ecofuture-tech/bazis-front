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

// spec/screens/draft-tasks.yaml: a report, the drafts (the filter of the screen, combined
// with the filter of the user by the assignee); a row opens the card of the task.

import { useNavigate } from 'react-router';

import { Filter } from '@/bazis/client';
import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { Screen } from '@/bazis/ui/app-shell';
import { ResourceList } from '@/bazis/ui/resource-list';

const TASKS = ROUTES['tasks.task'];

/** `list.filter` of the spec. */
const DRAFT = Filter.where('status', 'draft');

export function DraftTasksScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Screen id="draft-tasks" title={t('drafts.title')} description={t('drafts.description')}>
      <ResourceList
        path={TASKS}
        entity="task"
        columns={['title', 'assignee', 'dt_created']}
        filters={['assignee']}
        filter={DRAFT}
        sort={['-dt_created']}
        onOpen={(task) => void navigate(`/tasks/${task}`)}
        emptyMessage={t('drafts.empty')}
      />
    </Screen>
  );
}
