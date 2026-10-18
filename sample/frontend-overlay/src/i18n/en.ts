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

// The texts of the custom screens of the sample in English (the home, the list, the board
// and the calendar of the tasks); those of the specs are generated (`GENERATED_MESSAGES`).

import type { Messages } from '@/bazis/i18n';

export const en: Messages = {
  'home.title': 'Overview',
  'home.description': 'The tasks of the team at a glance, and where to go next.',
  'home.drafts': 'Drafts',
  'home.in_progress': 'In progress',
  'home.done': 'Done',
  'home.review': 'To review',
  'home.by_status': 'By status',
  'home.by_week': 'Created by week',
  'home.last_tasks': 'The last tasks',
  'tasks.title': 'Tasks',
  'tasks.description': 'The tasks of the team, from the draft to the report.',
  'tasks.new': 'New task',
  'tasks.new_description': 'The task is created as a draft.',
  'tasks.empty': 'No tasks yet.',
  'tasks.count': 'Count the tasks',
  'tasks.no_location': 'No task has a location.',
  'tasks.start_all': 'Start',
  'tasks.board': 'Board',
  'tasks.board_description': 'The tasks by status, moved by their transits.',
  'tasks.calendar': 'Calendar',
  'tasks.calendar_description': 'The tasks on the days they were created.',
};
