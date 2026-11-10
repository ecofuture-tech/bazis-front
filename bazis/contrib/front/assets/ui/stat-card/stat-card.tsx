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
// tone of the theme it is marked in: a card, or a row of the rail beside the chart in focus of a
// dashboard (`layout="rail"`). Marked `tile:<id>` with the number (the date of a minimum
// or a maximum of a date) in `data-value` once it is loaded; the states of its list
// `state:<state>` (an aggregate that the core refuses, 400 `ERR_AGGREGATE`: `state:error`).

import type { ComponentType, ReactNode } from 'react';
import { useId } from 'react';

import { aggregateValues, type AggregateValue, type Filter } from '@/bazis/client';
import type { Tone } from '@/bazis/generated/theme';
import { formatDate, formatDateTime, formatDecimal, useLanguage, type LanguageContextValue } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import { contractFormat, formatValue, SOFT_TONES, useAnyList, type FieldDisplay } from '@/bazis/ui/resource';
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

/** A number with these decimal places, its digits rounded exactly (`1.545` → `'1.55'`). */
function rounded(value: number | string, places: number): string {
  const digits = { useGrouping: false, minimumFractionDigits: places, maximumFractionDigits: places };
  // Intl rounds the decimal of the string itself, never a double (ES2023)
  return new Intl.NumberFormat('en', digits).format(String(value) as unknown as number);
}

/**
 * The text of the value of a tile: a number as `display` says (a decimal with its digits, an
 * average rounded: to the decimal places of its decimal field, `places`, if it has them), a date.
 */
function formatTile(
  value: AggregateValue | undefined,
  average: { places: number | null } | null,
  language: LanguageContextValue,
  display: FieldDisplay | undefined,
): string {
  const shown = dataValue(value);
  if (value === null || value === undefined || shown === undefined) return '—';
  if (typeof shown === 'string') {
    return shown.includes('T') ? formatDateTime(shown, language.language) : formatDate(shown, language.language);
  }
  const number = average === null ? value : average.places === null ? shown : rounded(value, average.places);
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
  /**
   * A card (the default), or a row of a rail (the tiles beside the chart in focus of a
   * dashboard, in one surface): its label over its number, its icon at its end; a number 0
   * muted, that of the tone `primary` in it.
   */
  layout?: 'card' | 'rail';
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
  layout = 'card',
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
  const shown = dataValue(result);
  const rail = layout === 'rail';
  return (
    <div
      data-bz={`tile:${id}`}
      data-value={shown}
      className={cn(
        'relative grid min-w-0 text-card-foreground',
        rail
          ? 'grid-cols-[minmax(0,1fr)_auto] content-center gap-x-3 gap-y-1 px-(--space-card) py-3'
          : 'surface gap-3 p-(--space-card)',
        onOpen && (rail ? 'transition-colors hover:bg-muted/50' : 'transition-shadow hover:shadow-(--shadow-lift-2)'),
        className,
      )}
    >
      {/* a row of a rail: the label and the number in its first column, the icon in its second */}
      <div className={rail ? 'contents' : 'flex min-w-0 items-start justify-between gap-3'}>
        <span id={labelId} className="min-w-0 text-sm font-medium wrap-break-word hyphens-auto text-muted-foreground">
          {label}
        </span>
        {Icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex shrink-0 items-center justify-center',
              rail ? 'col-start-2 row-span-2 row-start-1 size-[2.125rem] self-center rounded-[0.625rem]' : 'size-8 rounded-lg',
              SOFT_TONES[tone],
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <StatePanel inline state={queryState(list)} error={list.error} skeleton={<Skeleton className="h-8 w-16" />}>
        <span
          className={cn(
            'font-heading text-3xl',
            rail && 'tabular-nums',
            rail && (shown === 0 ? 'text-muted-foreground' : tone === 'primary' && 'text-tone-primary-ink'),
          )}
        >
          {formatTile(
            result,
            func === 'avg' && field !== undefined ? contractFormat(path, field) : null,
            language,
            field === undefined ? undefined : display[field],
          )}
        </span>
      </StatePanel>
      {onOpen && (
        // the whole tile opens it: a button over it, named by its label
        <button
          type="button"
          aria-labelledby={labelId}
          className={cn('absolute inset-0 outline-none focus-visible:ring-focus', rail ? 'rounded-md' : 'rounded-xl')}
          onClick={onOpen}
        />
      )}
    </div>
  );
}
