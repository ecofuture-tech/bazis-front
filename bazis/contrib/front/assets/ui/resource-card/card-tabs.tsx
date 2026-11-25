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

// The tabs of a card (`card.tabs` of the specs): a tab `tab:<id>` each, with the sections it
// names and what else it shows (the related lists, the status history); the sections that no
// tab names are in the first one shown. A tab of lists only (`paths`) is left out, its trigger
// and its panel (so its lists are not read), when the backend lets the user view none of them;
// the tabs are loading until it tells. Every tab shown stays mounted, its content hidden while
// another one is shown: its lists keep their data, and a scenario finds a field or a list in it
// (the helpers open the tab whose panel has it, by `aria-controls`).

import type { ReactNode } from 'react';

import type { PermitMeta } from '@/bazis/client';
import { useAnyViewable, type ResourceObject } from '@/bazis/ui/resource';
import { StatePanel } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { CardSection } from './resource-card.js';

/** A tab of a card: `tab:<id>`. */
export interface CardTab {
  id: string;
  title: ReactNode;
  /** The ids of the sections it shows (`sections` of the card). */
  sections?: readonly string[];
  /**
   * The route sets of the lists that are all it shows (its related lists): it is left out when
   * the user may view none of them.
   */
  paths?: readonly string[];
  /** What it shows after them, given the item and its permission meta, as the children of the card. */
  content?: ReactNode | ((item: ResourceObject, meta: PermitMeta | null | undefined) => ReactNode);
}

export interface CardTabsProps {
  tabs: readonly CardTab[];
  sections: readonly CardSection[];
  item: ResourceObject;
  meta: PermitMeta | null | undefined;
  /** The sections of a tab, as the card renders them. */
  render: (sections: readonly CardSection[]) => ReactNode;
}

/** The tabs of a card that the user may view, the first one shown; without any, the sections that no tab names. */
export function CardTabs({ tabs, sections, item, meta, render }: CardTabsProps) {
  // a route set once, whichever lists of the tabs show it
  const paths = [...new Set(tabs.flatMap((tab) => tab.paths ?? []))];
  const viewable = useAnyViewable(paths);
  if (viewable.includes(undefined)) return <StatePanel state="loading" skeleton={<Skeleton className="h-40 w-full rounded-xl" />} />;
  const allowed = new Set(paths.filter((_, index) => viewable[index]));
  const shown = tabs.filter((tab) => !tab.paths?.length || tab.paths.some((path) => allowed.has(path)));
  const placed = new Set(tabs.flatMap((tab) => tab.sections ?? []));
  if (!shown.length) return render(sections.filter((it) => !placed.has(it.id)));
  return (
    <Tabs defaultValue={shown[0]?.id} className="gap-(--space-section)">
      <TabsList variant="line" className="max-w-full justify-start overflow-x-auto overflow-y-hidden">
        {shown.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} data-bz={`tab:${tab.id}`} className="flex-none px-3">
            {tab.title}
          </TabsTrigger>
        ))}
      </TabsList>
      {shown.map((tab, index) => (
        <TabsContent key={tab.id} value={tab.id} forceMount className="grid grid-cols-[minmax(0,1fr)] gap-(--space-section) data-[state=inactive]:hidden">
          {render(sections.filter((it) => tab.sections?.includes(it.id) || (index === 0 && !placed.has(it.id))))}
          {typeof tab.content === 'function' ? tab.content(item, meta) : tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
