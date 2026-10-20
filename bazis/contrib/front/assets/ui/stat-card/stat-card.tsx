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

// A figure of a dashboard: the number of the items of a route set that a filter selects, or the
// sum, the average, the minimum or the maximum of a field of them (`value`), an aggregate of
// the list of the core (`meta: ['aggregates']`, bazis 2.17), with its label, its icon and the
// tone of the theme it is marked in. Marked `tile:<id>` with the number (the date of a minimum
// or a maximum of a date) in `data-value` once it is loaded; the states of its list
// `state:<state>` (an aggregate that the core refuses, 400 `ERR_AGGREGATE`: `state:error`).

import type { ComponentType, ReactNode } from 'react';
import { useId } from 'react';

import { aggregateValues, type AggregateValue, type Filter } from '@/bazis/client';
import type { Tone } from '@/bazis/generated/theme';
import { formatDate, formatDateTime, formatDecimal, useLanguage, type LanguageContextValue } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { formatValue, SOFT_TONES, useAnyList, type FieldDisplay } from '@/bazis/ui/resource';
import { queryState, StatePanel } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** What a tile shows of a field of its items (`value` of the tile): its sum, average, minimum or maximum. */
export type TileValue = { readonly sum: string } | { readonly avg: string } | { readonly min: string } | { readonly max: string };

/** The value of a tile in `data-value`: a number (a decimal too), a date as the backend writes it. */
function dataValue(value: AggregateValue | undefined): number | string | undefined {
  if (value === null || value === undefined) return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? value : number;
}

/** The text of the value of a tile: a number as `display` says (a decimal with its digits, an average rounded), a date. */
function formatTile(
  value: AggregateValue | undefined,
  average: boolean,
  language: LanguageContextValue,
  display: FieldDisplay | undefined,
): string {
  const shown = dataValue(value);
  if (value === null || value === undefined || shown === undefined) return '—';
  if (typeof shown === 'string') {
    return shown.includes('T') ? formatDateTime(shown, language.language) : formatDate(shown, language.language);
  }
  const number = average ? shown : value;
  return typeof display === 'object' ? formatValue(undefined, number, language, display) : formatDecimal(number, language.language);
}

export interface StatCardProps {
  /** The id of the tile in the specs: `tile:<id>`. */
  id: string;
  /** The route set whose items it counts (`ROUTES` of the contract). */
  path: ListPath;
  /** The items it counts (`filter` of the tile); every item that the user may view without. */
  filter?: Filter | undefined;
  /** What it shows of a field of the items instead of their number: `{sum: 'amount'}`. */
  value?: TileValue | undefined;
  /** How the fields are shown (`display` of the entity of the specs): that of the field of `value`. */
  display?: Readonly<Record<string, FieldDisplay>>;
  label: ReactNode;
  /** The tone of the theme of its icon; neutral by default. */
  tone?: Tone;
  /** Its icon, such as the icon of the entity (lucide-react). */
  icon?: ComponentType<{ className?: string }>;
  /** Opens what it counts (`open` of the tile): a click anywhere on it. */
  onOpen?: () => void;
  className?: string;
}

/** The number of the items that a filter selects, or an aggregate of a field of them, as a tile. */
export function StatCard({
  id,
  path,
  filter,
  value,
  display = {},
  label,
  tone = 'neutral',
  icon: Icon,
  onOpen,
  className,
}: StatCardProps) {
  const language = useLanguage();
  const labelId = useId();
  const [func, field] = value ? (Object.entries(value)[0] ?? []) : [];
  const term = func && field ? `${func}(${field})` : 'count';
  const list = useAnyList(path, {
    ...(filter ? { filter } : {}),
    page: { limit: 1 },
    meta: ['aggregates'],
    aggregate: [term],
  });
  const result = list.data ? aggregateValues(list.data)?.[term] : undefined;
  return (
    <div
      data-bz={`tile:${id}`}
      data-value={dataValue(result)}
      className={cn(
        'relative grid min-w-0 gap-3 rounded-xl border bg-card p-(--space-card) text-card-foreground shadow-xs',
        onOpen && 'transition-[box-shadow,border-color] hover:border-primary/40 hover:shadow-md',
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <span id={labelId} className="min-w-0 text-sm font-medium wrap-anywhere text-muted-foreground">
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
          {formatTile(result, func === 'avg', language, field === undefined ? undefined : display[field])}
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
