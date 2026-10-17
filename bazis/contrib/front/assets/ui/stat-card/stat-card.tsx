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

// A figure of a dashboard: the number of the items of a route set that a filter selects, the
// count of the pagination of a list of one item (the core has no aggregates), with its label,
// its icon and the tone of the theme it is marked in. Marked `tile:<id>` with the number in
// `data-value` once it is loaded; the states of its list `state:<state>`.

import type { ComponentType, ReactNode } from 'react';
import { useId } from 'react';

import { pagination, type Filter } from '@/bazis/client';
import type { Tone } from '@/bazis/generated/theme';
import { formatNumber, useLanguage } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { SOFT_TONES, useAnyList } from '@/bazis/ui/resource';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  /** The id of the tile in the specs: `tile:<id>`. */
  id: string;
  /** The route set whose items it counts (`ROUTES` of the contract). */
  path: ListPath;
  /** The items it counts (`filter` of the tile); every item that the user may view without. */
  filter?: Filter | undefined;
  label: ReactNode;
  /** The tone of the theme of its icon; neutral by default. */
  tone?: Tone;
  /** Its icon, such as the icon of the entity (lucide-react). */
  icon?: ComponentType<{ className?: string }>;
  /** Opens what it counts (`open` of the tile): a click anywhere on it. */
  onOpen?: () => void;
  className?: string;
}

/** The number of the items that a filter selects, as a tile. */
export function StatCard({ id, path, filter, label, tone = 'neutral', icon: Icon, onOpen, className }: StatCardProps) {
  const { language } = useLanguage();
  const labelId = useId();
  const list = useAnyList(path, { ...(filter ? { filter } : {}), page: { limit: 1 }, meta: ['pagination'] });
  const count = list.data ? pagination(list.data)?.count : undefined;
  return (
    <div
      data-bz={`tile:${id}`}
      data-value={count}
      className={cn(
        'relative grid min-w-0 gap-3 rounded-xl border bg-card p-(--space-card) text-card-foreground shadow-xs',
        onOpen && 'transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md',
        className,
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span id={labelId} className="truncate text-sm font-medium text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span aria-hidden="true" className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', SOFT_TONES[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <StatePanel inline state={queryState(list)} error={list.error} skeleton={<Skeleton className="h-8 w-16" />}>
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {count === undefined ? '—' : formatNumber(count, language)}
        </span>
      </StatePanel>
      {onOpen && (
        // the whole tile opens it: a button over it, named by its label
        <button
          type="button"
          aria-labelledby={labelId}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onClick={onOpen}
        />
      )}
    </div>
  );
}
