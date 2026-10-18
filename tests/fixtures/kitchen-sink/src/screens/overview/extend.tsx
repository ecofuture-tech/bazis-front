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

// The extension of a generated dashboard (the kitchen sink), whose component is its screen:
// its header (`actions`) and what it shows before its parts come from the slots, a tile added
// to those of the spec and one of them replaced in its place.

import type { DashboardProps } from '@/bazis/ui/dashboard';
import type { ScreenExtension } from '@/bazis/ui/screens';
import { ENTITIES } from '@/screens/generated/entities';

export const extension: ScreenExtension<DashboardProps> = {
  before: <p data-bz="extension:before">The week at a glance.</p>,
  actions: <a href="#help">Help</a>,
  props: {
    tiles: [
      { id: 'steps', path: ENTITIES.step.path, label: 'All the steps', tone: 'info' },
      { id: 'tasks', path: ENTITIES.task.path, label: 'All the tasks' },
    ],
  },
};
