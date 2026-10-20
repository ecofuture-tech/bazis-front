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

// The charts of a dashboard: the number of the items of a route set, or the sum or the average
// of a field of them (`value`), by status (`StatusChart`) or by day, week or month of a date
// field (`TimeChart`), each one query of the aggregates of the list of the core grouped by the
// status or by the day (the month) of the field (`meta: ['aggregates']` with `group`, bazis
// 2.17; an aggregate that it refuses, 400 `ERR_AGGREGATE`, is the error of the chart with the
// text of the backend), drawn by recharts (`chart-view.tsx`, loaded with the first chart shown) in
// the colors of the series of the theme, a status in that of its tone (`statuses` of the theme,
// the color of its badge). Marked `chart:<id>` with the states of its lists
// (`state:<state>`) and each value `value:<key>` with the number in `data-value`: the
// legend of a ring, a list for the screen readers under bars or a line.

import { lazy, Suspense, useMemo, type ReactNode } from 'react';

import { aggregateGroups, Filter, type AggregatesGroup } from '@/bazis/client';
import { THEME, type Tone } from '@/bazis/generated/theme';
import { formatNumber, isoDate, useLanguage, weekStart } from '@/bazis/i18n';
import type { ListPath } from '@/bazis/react';
import {
  type ListDocument,
  statusName,
  titleFromText,
  typeAt,
  useAnyLists,
  useListFields,
  workflowStatuses,
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
  /** Its tone (a status: `statuses` of the theme), drawn in the color of the tone rather than of a series. */
  tone?: Tone | undefined;
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
    color: it.tone ? `var(--color-${it.tone})` : seriesColor(series ? index : 0),
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
      <h3 ref={titleFromText} className="truncate text-sm font-medium text-muted-foreground">
        {label}
      </h3>
      <StatePanel
        state={empty ? 'empty' : state}
        error={error}
        className="min-w-0"
        skeleton={<Skeleton className="h-56 w-full" />}
      >
        <div className={cn('grid gap-4', kind === 'donut' && 'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center')}>
          {/* the drawing is for the eyes: the values are the text below it */}
          <div aria-hidden="true" className="h-56 min-w-0">
            <Suspense fallback={<Skeleton data-bz="state:loading" aria-busy="true" className="size-full" />}>
              <ChartView kind={kind} points={points} />
            </Suspense>
          </div>
          <ul className={cn('grid content-start gap-2 text-sm', kind !== 'donut' && 'sr-only')}>
            {points.map((it) => (
              <li key={it.key} data-bz={`value:${it.key}`} data-value={it.value} className="flex items-center gap-2">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
                <span title={it.label} className="min-w-0 flex-1 truncate">
                  {it.label}
                </span>
                <span className="font-medium tabular-nums">{formatNumber(it.value, language)}</span>
              </li>
            ))}
          </ul>
        </div>
      </StatePanel>
    </section>
  );
}

/** What a chart shows of a field of the items instead of their number: its sum or its average. */
export type ChartMeasure = { readonly sum: string } | { readonly avg: string };

/** The terms of the aggregates of a measure: an average by its sum and its count, which add up over the days of a period. */
function terms(value: ChartMeasure | undefined): string[] {
  if (!value) return ['count'];
  if ('sum' in value) return [`sum(${value.sum})`];
  return [`sum(${value.avg})`, `count(${value.avg})`];
}

/** The measure of the items of groups: their number, or the sum or the average of the field. */
function measure(groups: readonly AggregatesGroup[], value: ChartMeasure | undefined): number {
  const total = (term: string) => groups.reduce((sum, it) => sum + Number(it.values[term] ?? 0), 0);
  if (!value) return total('count');
  if ('sum' in value) return total(`sum(${value.sum})`);
  const count = total(`count(${value.avg})`);
  return count === 0 ? 0 : total(`sum(${value.avg})`) / count;
}

/** The query of the aggregates of the items by `group`: a list of one item. */
function groupsQuery(filter: Filter | undefined, group: string, value: ChartMeasure | undefined) {
  return { ...(filter ? { filter } : {}), page: { limit: 1 }, meta: ['aggregates'], aggregate: terms(value), group };
}

/** The groups of the query of the aggregates, and its state; loading without the query. */
function groupsOf(list: { status: 'pending' | 'error' | 'success'; data?: ListDocument | undefined; error: unknown } | undefined): {
  state: ViewState;
  error: unknown;
  groups: readonly AggregatesGroup[];
} {
  if (list?.status === 'error') return { state: errorState(list.error), error: list.error, groups: [] };
  if (list?.status !== 'success' || !list.data) return { state: 'loading', error: undefined, groups: [] };
  return { state: 'loaded', error: undefined, groups: aggregateGroups(list.data) ?? [] };
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
  /** What it shows of a field of the items instead of their number: `{sum: 'amount'}`. */
  value?: ChartMeasure | undefined;
  className?: string;
}

/** The number of the items of a statusy model by status, or a measure of a field of them. */
export function StatusChart({ id, path, label, kind = 'donut', filter, statuses, value, className }: StatusChartProps) {
  const { language } = useLanguage();
  const type = typeAt(path) ?? '';
  const shown = statuses ?? workflowStatuses(type);
  // a model without statuses (no statusy model of the contract) shows none, without a query
  const [list] = useAnyLists(path, shown.length ? [groupsQuery(filter, 'status', value)] : []);
  const { state, error, groups } = groupsOf(list);
  return (
    <Chart
      id={id}
      label={label}
      kind={kind}
      series
      state={shown.length ? state : 'loaded'}
      error={error}
      className={className}
      values={shown.map((it) => ({
        key: it,
        label: statusName(type, it, language),
        value: measure(
          groups.filter((group) => group.group === it),
          value,
        ),
        tone: THEME.statuses[it],
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
  /** What it shows of a field of the items instead of their number: `{sum: 'amount'}`. */
  value?: ChartMeasure | undefined;
  /** The current moment (the tests); the moment of the first render by default. */
  now?: Date | undefined;
  className?: string;
}

/**
 * The number of the items by period of a date field, or a measure of a field of them, the last
 * periods to the current one: the aggregates of the items from the first day of the first
 * period to the end of the last one (`<field>__gte`, `<field>__lt`: the first moment of a day in
 * the time zone of the browser for a date-time) grouped by month, or by day (in the time zone of
 * the backend) added up into the days and the weeks (from the first day of the week of the
 * language).
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
  value,
  now,
  className,
}: TimeChartProps) {
  const { language } = useLanguage();
  const fields = useListFields(path);
  const time = now?.getTime();
  // the first days of the periods, and that of the period after the last one
  const starts = useMemo(() => {
    const current = periodStart(time === undefined ? new Date() : new Date(time), bucket, weekStart(language));
    return Array.from({ length: last + 1 }, (_, index) => shifted(current, bucket, index - last + 1));
  }, [time, bucket, last, language]);
  const periods = starts.slice(0, -1);
  const keys = starts.map(isoDate);
  const spec = fields.fields.get(field);
  const date = spec?.kind === 'attribute' && spec.format === 'date';
  const bound = (it: Date) => (date ? isoDate(it) : it.toISOString());
  const range = and(
    filter,
    Filter.where(`${field}__gte`, bound(starts[0] ?? new Date())),
    Filter.where(`${field}__lt`, bound(starts[last] ?? new Date())),
  );
  // the format of the bounds is that of the field: the query waits for its schema
  const [list] = useAnyLists(
    path,
    fields.ready ? [groupsQuery(range, `${field}:${bucket === 'month' ? 'month' : 'day'}`, value)] : [],
  );
  const { state, error, groups } = groupsOf(list);
  const format = new Intl.DateTimeFormat(language, LABELS[bucket]);
  return (
    <Chart
      id={id}
      label={label}
      kind={kind}
      state={state}
      error={error}
      className={className}
      values={periods.map((it, index) => ({
        key: keys[index] ?? '',
        label: format.format(it),
        // the groups whose first day (ISO, as the backend writes it) is in the period
        value: measure(
          groups.filter((group) => group.group !== null && group.group >= (keys[index] ?? '') && group.group < (keys[index + 1] ?? '')),
          value,
        ),
      }))}
    />
  );
}
