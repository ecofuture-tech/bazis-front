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

// The drag and drop of the boards below `BoardDnd` (`ResourceBoard` of resource-board): a
// card dropped on a column runs the transit of the item to its status. @dnd-kit is loaded with
// the first board shown (`dnd-view.tsx`, a chunk of its own), the boards in the loading state
// until then: shown without it first, they would be mounted again with it, closing a menu
// that the user opened and losing their filters.

import { lazy, Suspense, type ReactNode } from 'react';

import { StatePanel } from '@/bazis/ui/state-panel';

const DndBoards = lazy(() => import('./dnd-view.js'));

/** The boards below it move their cards by drag and drop too. */
export function BoardDnd({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<StatePanel state="loading" />}>
      <DndBoards>{children}</DndBoards>
    </Suspense>
  );
}
