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

// A list and the card of its items (`composition.list_card` of spec/design/theme.yaml): the
// route of the list renders `ListCardLayout` with its screen, and the route of the card is
// its child. `split`: on a wide screen the card is shown next to the list, which keeps its
// filters and its page (the list takes the whole width while no item is open); on a narrow
// one, as `pages`, the card replaces the list.

import type { ReactNode } from 'react';
import { useOutlet } from 'react-router';

import { THEME } from '@/bazis/generated/theme';

export interface ListCardLayoutProps {
  /** The screen of the list. */
  list: ReactNode;
  /** `composition.list_card` of the theme by default. */
  mode?: 'split' | 'pages';
}

/** The screen of a list with the screen of its card (the child route). */
export function ListCardLayout({ list, mode = THEME.composition.list_card }: ListCardLayoutProps) {
  const card = useOutlet();
  if (mode === 'pages' || card === null) return <>{card ?? list}</>;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-(--space-section) xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="hidden min-w-0 xl:block xl:[--bleed:0px]">{list}</div>
      <div className="min-w-0 xl:sticky xl:top-0 xl:-mt-(--space-section) xl:max-h-dvh xl:overflow-y-auto xl:border-l xl:pt-(--space-section) xl:pl-(--space-section) xl:[--bleed:0px]">
        {card}
      </div>
    </div>
  );
}
