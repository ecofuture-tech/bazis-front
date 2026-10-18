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

// The texts of the sample in Russian (see `en.ts`).

import type { Messages } from '@/bazis/i18n';

export const ru: Messages = {
  'home.title': 'Обзор',
  'home.description': 'Задачи команды с первого взгляда и куда идти дальше.',
  'home.drafts': 'Черновики',
  'home.in_progress': 'В работе',
  'home.done': 'Готово',
  'home.review': 'На проверку',
  'home.by_status': 'По статусам',
  'home.by_week': 'Созданы по неделям',
  'home.last_tasks': 'Последние задачи',
  'tasks.title': 'Задачи',
  'tasks.description': 'Задачи команды: от черновика до отчёта.',
  'tasks.new': 'Новая задача',
  'tasks.new_description': 'Задача создаётся черновиком.',
  'tasks.empty': 'Задач пока нет.',
  'tasks.count': 'Посчитать задачи',
  'tasks.no_location': 'Ни у одной задачи нет местоположения.',
  'tasks.start_all': 'Начать',
  'tasks.board': 'Доска',
  'tasks.board_description': 'Задачи по статусам, переводимые их переходами.',
  'tasks.calendar': 'Календарь',
  'tasks.calendar_description': 'Задачи в дни их создания.',
};
