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

// The charts of a dashboard: the number of the items of a route set by status (`StatusChart`)
// or by day, week or month of a date field (`TimeChart`), each a count of the pagination of a
// list of one item (the core has no aggregates: a query per value, cached and refreshed by
// TanStack Query), drawn by recharts (`chart-view.tsx`, loaded with the first chart shown) in
// the colors of the series of the theme. Marked `chart:<id>` with the states of its lists
// (`state:<state>`) and each value `value:<key>` with the number in `data-value`: the
// legend of a ring, a list for the screen readers under bars or a line.

import { lazy, Suspense, useMemo, type ReactNode } from 'react';

import { Filter, pagination } from '@/bazis/client';
import { formatNumber, isoDate, useLanguage, weekStart } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import {
  statusName,
  typeAt,
  useAnyLists,
  useListFields,
  workflowStatuses,
  type ListDocument,
} from '@/bazis/ui/resource';
import { errorState, StatePanel, type ViewState } from '@/bazis/ui/state-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** A ring of the shares (`donut`), bars, or a line. */
export type ChartKind = 'donut' | 'bar' | 'line';

/** The period of a value of `TimeChart`. */
export type ChartBucket = 'day' | 'week' | 'month';

/** A value of a chart. */
export interface ChartValue {
  /** Its key: `value:<key>` (a status, the first day of a period `2026-10-05`). */
  key: string;
  label: string;
  value: number;
}

/** The colors of the series of the theme, one per value of a ring or of the bars of statuses. */
const SERIES = 6;

function seriesColor(index: number): string {
  return `var(--chart-${String((index % SERIES) + 1)})`;
}

const ChartView = lazy(() => import('./chart-view.js'));

export interface ChartProps {
  /** The id of the chart in the specs: `chart:<id>`. */
  id: string;
  label: ReactNode;
  kind?: ChartKind;
  values: readonly ChartValue[];
  /** A color of the series per value (the statuses); one color for all by default (the periods). */
  series?: boolean;
  /** The state of what it shows: `empty` when every value is 0. */
  state?: ViewState;
  error?: unknown;
  className?: string;
}

/** A chart of values in a card: its title, the drawing, the values as text. */
export function Chart({
  id,
  label,
  kind = 'bar',
  values,
  series = kind === 'donut',
  state = 'loaded',
  error,
  className,
}: ChartProps) {
  const { language } = useLanguage();
  const points = values.map((it, index) => ({
    ...it,
    color: series ? seriesColor(index) : seriesColor(0),
  }));
  const empty = state === 'loaded' && values.every((it) => it.value === 0);
  return (
    <section
      data-bz={`chart:${id}`}
      className={cn(
        'grid min-w-0 gap-4 rounded-xl border bg-card p-(--space-card) text-card-foreground shadow-xs',
        className,
      )}
    >
      <h3 className="truncate text-sm font-medium text-muted-foreground">{label}</h3>
      <StatePanel
        state={empty ? 'empty' : state}
        error={error}
        className="min-w-0"
        skeleton={<Skeleton className="h-56 w-full" />}
      >
        <div className={cn('grid gap-4', kind === 'donut' && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center')}>
          {/* the drawing is for the eyes: the values are the text below it */}
          <div aria-hidden="true" className="h-56 min-w-0">
            <Suspense fallback={<Skeleton className="size-full" />}>
              <ChartView kind={kind} points={points} />
            </Suspense>
          </div>
          <ul className={cn('grid content-start gap-2 text-sm', kind !== 'donut' && 'sr-only')}>
            {points.map((it) => (
              <li key={it.key} data-bz={`value:${it.key}`} data-value={it.value} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                <span className="font-medium tabular-nums">{formatNumber(it.value, language)}</span>
              </li>
            ))}
          </ul>
        </div>
      </StatePanel>
    </section>
  );
}

/** The counts of the lists of one item each, and their state: the first error, else loaded. */
function counts(
  lists: readonly {
    status: 'pending' | 'error' | 'success';
    data?: ListDocument | undefined;
    error: unknown;
  }[],
) {
  const failed = lists.find((it) => it.status === 'error');
  const state: ViewState = failed
    ? errorState(failed.error)
    : lists.some((it) => it.status === 'pending')
      ? 'loading'
      : 'loaded';
  return {
    state,
    error: failed?.error,
    values: lists.map((it) => (it.data ? (pagination(it.data)?.count ?? 0) : 0)),
  };
}

function countQuery(filter: Filter) {
  return { filter, page: { limit: 1 }, meta: ['pagination' as const] };
}

function and(filter: Filter | undefined, ...conditions: readonly Filter[]): Filter {
  return Filter.and(...(filter ? [filter] : []), ...conditions);
}

export interface StatusChartProps {
  id: string;
  /** The route set of a statusy model (`ROUTES` of the contract). */
  path: ListPath;
  label: ReactNode;
  /** A ring by default. */
  kind?: ChartKind;
  /** The items it counts; every item that the user may view without. */
  filter?: Filter | undefined;
  /** The statuses it shows, in this order; all of the workflow by default. */
  statuses?: readonly string[] | undefined;
  className?: string;
}

/** The number of the items of a statusy model by status: a list of one item per status. */
export function StatusChart({ id, path, label, kind = 'donut', filter, statuses, className }: StatusChartProps) {
  const { language } = useLanguage();
  const type = typeAt(path) ?? '';
  const shown = statuses ?? workflowStatuses(type);
  const lists = useAnyLists(
    path,
    shown.map((it) => countQuery(and(filter, Filter.where('status', it)))),
  );
  const { state, error, values } = counts(lists);
  return (
    <Chart
      id={id}
      label={label}
      kind={kind}
      series
      state={state}
      error={error}
      className={className}
      values={shown.map((it, index) => ({
        key: it,
        label: statusName(type, it, language),
        value: values[index] ?? 0,
      }))}
    />
  );
}

/** The first moment of the period of a moment, in the time zone of the browser. */
function periodStart(date: Date, bucket: ChartBucket, firstDay: number): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), bucket === 'month' ? 1 : date.getDate());
  // `getDay` counts from Sunday (0), the first day of the week of `Intl` from Monday (1 … 7)
  if (bucket === 'week') start.setDate(start.getDate() - ((start.getDay() - (firstDay % 7) + 7) % 7));
  return start;
}

/** The period `count` periods after the one that starts at `start`. */
function shifted(start: Date, bucket: ChartBucket, count: number): Date {
  const next = new Date(start);
  if (bucket === 'month') next.setMonth(next.getMonth() + count);
  else next.setDate(next.getDate() + (bucket === 'week' ? 7 * count : count));
  return next;
}

const LABELS: Readonly<Record<ChartBucket, Intl.DateTimeFormatOptions>> = {
  day: { day: 'numeric', month: 'short' },
  week: { day: 'numeric', month: 'short' },
  month: { month: 'short', year: 'numeric' },
};

export interface TimeChartProps {
  id: string;
  path: ListPath;
  /** The date or date-time field whose periods it counts (`dt_created`, `due_date`). */
  field: string;
  label: ReactNode;
  /** Bars by default. */
  kind?: ChartKind;
  /** A week by default (from the first day of the week of the language). */
  bucket?: ChartBucket;
  /** The number of the periods, the current one the last: 12 by default. */
  last?: number;
  filter?: Filter | undefined;
  /** The current moment (the tests); the moment of the first render by default. */
  now?: Date | undefined;
  className?: string;
}

/**
 * The number of the items by period of a date field, the last periods to the current one: a
 * list of one item per period (`<field>__gte` its first day, `<field>__lt` the next one; the
 * first moment of a day in the time zone of the browser for a date-time).
 */
export function TimeChart({
  id,
  path,
  field,
  label,
  kind = 'bar',
  bucket = 'week',
  last = 12,
  filter,
  now,
  className,
}: TimeChartProps) {
  const { language } = useLanguage();
  const fields = useListFields(path);
  const time = now?.getTime();
  const periods = useMemo(() => {
    const current = periodStart(time === undefined ? new Date() : new Date(time), bucket, weekStart(language));
    return Array.from({ length: last }, (_, index) => shifted(current, bucket, index - last + 1));
  }, [time, bucket, last, language]);
  const spec = fields.fields.get(field);
  const date = spec?.kind === 'attribute' && spec.format === 'date';
  const bound = (it: Date) => (date ? isoDate(it) : it.toISOString());
  // the format of the bounds is that of the field: the queries wait for its schema
  const lists = useAnyLists(
    path,
    fields.ready
      ? periods.map((it) =>
          countQuery(
            and(
              filter,
              Filter.where(`${field}__gte`, bound(it)),
              Filter.where(`${field}__lt`, bound(shifted(it, bucket, 1))),
            ),
          ),
        )
      : [],
  );
  const { state, error, values } = counts(lists);
  const format = new Intl.DateTimeFormat(language, LABELS[bucket]);
  return (
    <Chart
      id={id}
      label={label}
      kind={kind}
      state={fields.ready ? state : 'loading'}
      error={error}
      className={className}
      values={periods.map((it, index) => ({
        key: isoDate(it),
        label: format.format(it),
        value: values[index] ?? 0,
      }))}
    />
  );
}
