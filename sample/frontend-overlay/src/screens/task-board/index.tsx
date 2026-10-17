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

// spec/screens/task-board.yaml: the tasks in a column for each status, filtered by the
// assignee, moved by the transits that the backend allows them (the menu of a card, or a card
// dropped on a column: `BoardDnd`); a card opens the task.

import { SquareKanban } from 'lucide-react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/bazis/generated/contract';
import { useLanguage } from '@/bazis/i18n';
import { Screen } from '@/bazis/ui/app-shell';
import { BoardDnd } from '@/bazis/ui/board-dnd';
import { ResourceBoard } from '@/bazis/ui/resource-board';

const TASKS = ROUTES['tasks.task'];

export function TaskBoardScreen() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  return (
    <Screen id="task-board" title={t('tasks.board')} description={t('tasks.board_description')}>
      <BoardDnd>
        <ResourceBoard
          path={TASKS}
          entity="task"
          title="title"
          fields={['assignee', 'priority']}
          filters={['assignee']}
          move
          onOpen={(task) => void navigate(`/tasks/${task}`)}
          emptyMessage={t('tasks.empty')}
          icon={SquareKanban}
        />
      </BoardDnd>
    </Screen>
  );
}
